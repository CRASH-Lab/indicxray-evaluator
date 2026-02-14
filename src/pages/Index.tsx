import React, { useState, useEffect } from 'react'
import { transformRecordsToCase } from '@/services/adapters'
import { Settings } from 'lucide-react'
import { GroundTruthPanel } from '@/components/ImageNavigationSidebar'
import { ModelComparisonGrid } from '@/components/ModelComparisonGrid'
import { EvaluationOverlay } from '@/components/EvaluationOverlay'
import { CaseRecord, ModelOutput, Metric } from '@/types'
import { getMetrics, getUserDetails } from '@/services'
import { useToast } from '@/hooks/use-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface Props {
  records: any[] // Legacy prop, not used in v2
}

const EMPTY_SCORES: Record<string, number> = {}

const Index = (props: Props) => {
  const { toast } = useToast()
  const navigate = useNavigate()
  
  // State
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null)
  
  // Initialize index from URL if present
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize index from URL if present
  const [activeImageIndex, setActiveImageIndex] = useState(() => {
     const start = searchParams.get('startIndex');
     return start ? parseInt(start, 10) : 0;
  })

  // Sync URL when index changes
  useEffect(() => {
    setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('startIndex', activeImageIndex.toString());
        return newParams;
    }, { replace: true });
  }, [activeImageIndex, setSearchParams]);
  
  const [activeModel, setActiveModel] = useState<ModelOutput | null>(null)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [doctorName, setDoctorName] = useState<string>('')
  const [evaluationData, setEvaluationData] = useState<Record<string, Record<string, number>>>({})

  // Initialize case record from props
  useEffect(() => {
    if (props.records && props.records.length > 0) {
      const result = transformRecordsToCase(props.records);
      if (result) {
        setCaseRecord(result.caseRecord);
        setEvaluationData(result.initialEvaluationData);
      }
    }
  }, [props.records])

  // Fetch metrics on mount
  useEffect(() => {
    async function fetchMetrics() {
      try {
        const metricsData = await getMetrics()

        setMetrics(metricsData)
      } catch (error) {
        console.error('Error fetching metrics:', error)
      }
    }
    fetchMetrics()
  }, [])

  // Fetch user details
  useEffect(() => {
    async function fetchUser() {
      try {
        const user = await getUserDetails()
        setDoctorName(user.name)
      } catch (error) {
        console.error('Error fetching user details:', error)
      }
    }
    fetchUser()
  }, [])

  if (!caseRecord) {
     // ... (loading is same)
     return (
       <div className="min-h-screen flex items-center justify-center bg-medical-darkest-gray text-foreground">
         <p>Loading case...</p>
       </div>
     )
  }

  const currentImage = caseRecord.images[activeImageIndex]

  const handleModelClick = (model: ModelOutput) => {
    setActiveModel(model)
  }
  
  // Import saveEvaluations dynamically to avoid top-level issues if any
  const saveEvaluationsToApi = async (data: any) => {
      const { saveEvaluations } = await import('@/services');
      return saveEvaluations(data);
  }

  const completeAssignment = async (id: string) => {
      const { completeAssignment } = await import('@/services');
      return completeAssignment(id);
  }

  const handleSaveEvaluation = async (modelId: string, scores: Record<string, number>) => {
    try {
        // Prepare data for API
        const currentImg = caseRecord.images[activeImageIndex];
        
        // Convert scores object to array
        const evaluationsList = Object.entries(scores).map(([metricId, score]) => {
            const metric = metrics.find(m => m.id === metricId);
            return {
                metric_name: metric ? metric.name : 'Unknown Metric', 
                score: score
            };
        });
        
        if (!currentImg.internalId) {
            throw new Error("Internal Image ID missing");
        }
        
        // Use the image's specific assignment ID
        // Fallback to caseRecord.id if not found (backwards compatibility)
        const assignmentId = (currentImg as any).assignmentId || caseRecord.id;

        // Save to API immediately
        await saveEvaluationsToApi({
            assignmentId: assignmentId, 
            groundTruthImageId: currentImg.internalId, 
            modelOutputId: modelId,
            evaluations: evaluationsList
        });


        // Update local state to reflect what's saved
        setEvaluationData(prev => ({
          ...prev,
          [modelId]: scores
        }))
    
        // Update model status
        setCaseRecord(prev => {
          if (!prev) return prev
    
          const updatedImages = [...prev.images]
          const currentImg = updatedImages[activeImageIndex]
          
          const updatedModels = currentImg.modelOutputs.map(model => {
            if (model.id === modelId) {
              return { ...model, status: 'completed' as const }
            }
            return model
          })
    
          const completedCount = updatedModels.filter(m => m.status === 'completed').length
          const imageStatus = completedCount === 6 ? 'completed' : completedCount > 0 ? 'in_progress' : 'pending'
    
          updatedImages[activeImageIndex] = {
            ...currentImg,
            modelOutputs: updatedModels,
            completedModels: completedCount,
            evaluationStatus: imageStatus as any
          }
    
          // Calculate total progress
          const totalCompleted = updatedImages.reduce((sum, img) => sum + img.completedModels, 0)
          const totalProgress = Math.round((totalCompleted / (6 * 6)) * 100) // Assuming 6 models/image
    
          return {
            ...prev,
            images: updatedImages,
            totalProgress
          }
        })
    
        toast({
          title: 'Success',
          description: `Model evaluation saved`,
        })
    } catch (error) {
        console.error("Failed to save evaluation", error);
        toast({
            title: 'Error',
            description: 'Failed to save evaluation to server',
            variant: 'destructive'
        });
    }
  }

  const handleBackClick = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const doctorId = urlParams.get('doctorId')
    if (doctorId) {
      navigate(`/doctor/${doctorId}`)
    } else {
      navigate('/')
    }
  }

  const handleFinalSubmit = async () => {
    try {

      
      // Save all cached evaluations
      for (const img of caseRecord.images) {
          if (!img.internalId) {
              console.warn(`Skipping image index ${img.imageIndex}: Missing internal ID`);
              continue;
          }

          for (const model of img.modelOutputs) {
              if (model.status === 'completed' && model.evaluations && model.evaluations.length > 0) {
                     // evaluations in state are already in {metric_name, score} format from handleSaveEvaluation
                     // BUT handleSaveEvaluation updates state with: evaluations: evaluationsList
                     // so model.evaluations is correct.
                  
                  await saveEvaluationsToApi({

                      assignmentId: caseRecord.id,
                      groundTruthImageId: img.internalId,
                      modelOutputId: model.id,
                      evaluations: model.evaluations
                  });
              }
          }
      }

      await completeAssignment(caseRecord.id)
      
      toast({
        title: 'Success',
        description: 'Case evaluation completed and submitted successfully',
      })
      
      // Redirect to dashboard
      navigate('/')
    } catch (error) {
      console.error('Error submitting case:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit case',
        variant: 'destructive',
      })
    }
  }

  const handlePrevImage = () => {
    if (activeImageIndex > 0) {
      setActiveImageIndex(activeImageIndex - 1)
    }
  }

  const handleNextImage = () => {
    if (activeImageIndex < caseRecord.images.length - 1) {
      setActiveImageIndex(activeImageIndex + 1)
    }
  }

  const completedImages = caseRecord.images.filter(img => img.evaluationStatus === 'completed').length

  return (
    <div className="h-screen flex flex-col bg-medical-darkest-gray text-foreground overflow-hidden">
      {/* Header */}
      <header className="bg-medical-darker-gray px-8 py-3 border-b border-medical-dark-gray/30 flex justify-between items-center">
        <div className="flex items-center">
          <button
            onClick={handleBackClick}
            className="mr-4 hover:text-medical-blue transition-colors"
          >
            ← Back to Cases
          </button>
          <div className="flex items-center">
            <div>
              {/* Use current image's study ID, or fallback to case study ID */}
              <h1 className="text-xl font-bold text-foreground">STUDY ID: {currentImage?.studyId || caseRecord.studyId}</h1>
            </div>
          </div>
        </div>
        
        {/* Center - Image Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevImage}
            disabled={activeImageIndex === 0}
            className="p-2 rounded-lg hover:bg-medical-dark-gray/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-bold"
          >
            ←
          </button>
          <div className="bg-medical-darkest-gray border border-medical-dark-gray rounded-lg px-4 py-2 min-w-[140px]">
            <p className="text-xs text-medical-gray mb-0.5 text-center">Current Image</p>
            <p className="text-sm font-semibold text-center">
              Image {activeImageIndex + 1} of {caseRecord.images.length}
            </p>
          </div>
          <button
            onClick={handleNextImage}
            disabled={activeImageIndex === caseRecord.images.length - 1}
            className="p-2 rounded-lg hover:bg-medical-dark-gray/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-bold"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs text-medical-gray">Evaluator</p>
            <p className="text-sm font-medium">{doctorName || 'DR'}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Ground Truth */}
        <GroundTruthPanel
          imageUrl={currentImage.imageUrl}
          groundTruth={currentImage.groundTruth}
        />

        {/* Right Main Area */}
        <ModelComparisonGrid
          models={currentImage.modelOutputs}
          onModelClick={handleModelClick}
          activeModelId={activeModel?.id}
        />
      </div>

      {/* Bottom Progress Bar */}
      <div className="bg-medical-darker-gray border-t border-medical-dark-gray/30 px-8 py-4 flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Image {activeImageIndex + 1} Progress: {currentImage.completedModels}/{currentImage.totalModels} Models
            </span>
          </div>
          <Progress value={caseRecord.totalProgress} className="h-2" />
        </div>

      </div>

      {/* Evaluation Overlay */}
      <EvaluationOverlay
        model={activeModel}
        metrics={metrics}
        onClose={() => setActiveModel(null)}
        onSave={handleSaveEvaluation}
        existingScores={activeModel ? (evaluationData[activeModel.id] || EMPTY_SCORES) : EMPTY_SCORES}
      />
    </div>
  )
}

export default Index
