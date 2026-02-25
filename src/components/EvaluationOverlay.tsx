import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ModelOutput, Metric } from '@/types'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getImageWithFallback } from '@/lib/imageUtils'
import { refreshImageUrl } from '@/services'

interface EvaluationOverlayProps {
  model: ModelOutput | null
  metrics: Metric[]
  onClose: () => void
  onSave: (modelId: string, scores: Record<string, number>) => void
  existingScores?: Record<string, number>
}

const METRIC_GUIDELINES: Record<string, { 1: string; 0: string }> = {
  'Anatomical Validity': {
    1: 'Anatomically plausible thoracic structures without distortion.',
    0: 'Implausible, distorted, or missing major anatomical structures.'
  },
  'Pathology Presence': {
    1: 'Prompted pathology is clearly visible.',
    0: 'Pathology is absent, unclear, or different from the prompt.'
  },
  'Location Concordance': {
    1: 'Pathology is in the correct anatomical location and laterality.',
    0: 'Wrong location, or side.'
  },
  'Internal Consistency': {
    1: 'Imaging features are radiologically plausible, including the presence of indirect signs.',
    0: 'Conflicting or physiologically impossible features (e.g., consolidation without loss of silhouette sign).'
  },
  'Similarity Index': {
    1: 'Reference anatomy preserved except for the intended modification.',
    0: 'Unintended changes or hallucinated findings.'
  }
};

export const EvaluationOverlay: React.FC<EvaluationOverlayProps> = ({
  model,
  metrics,
  onClose,
  onSave,
  existingScores = {},
}) => {
  const [scores, setScores] = useState<Record<string, number>>(existingScores)
  const [currentUrl, setCurrentUrl] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reset/Update scores when model or existingScores change
  React.useEffect(() => {
    setScores(existingScores || {})
    if (model) {
      setCurrentUrl(model.imageUrl || '')
      setIsRefreshing(false)
    }
  }, [model, existingScores])

  const handleImageError = async () => {
    if (!model || isRefreshing) return
    setIsRefreshing(true)
    try {
      const data = await refreshImageUrl('model', model.id)
      if (data && data.url) {
        setCurrentUrl(data.url)
      } else {
        setCurrentUrl(getImageWithFallback(null, 900, 900, `eval-${model.id}`))
      }
    } catch (e) {
      console.error("Failed to refresh image url", e)
      setCurrentUrl(getImageWithFallback(null, 900, 900, `eval-${model.id}`))
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!model) return null

  const handleScoreSelect = (metricId: string, score: number) => {
    setScores(prev => ({
      ...prev,
      [metricId]: score
    }))
  }

  const handleSave = () => {
    onSave(model.id, scores)
    onClose()
  }

  const allScored = metrics.every(metric => scores[metric.id] !== undefined)

  const getScoreColor = (score: number): string => {
    const colors = {
      1: 'bg-red-500 hover:bg-red-600 text-white',
      2: 'bg-orange-500 hover:bg-orange-600 text-white',
      3: 'bg-yellow-500 hover:bg-yellow-600 text-white',
      4: 'bg-lime-500 hover:bg-lime-600 text-white',
      5: 'bg-green-500 hover:bg-green-600 text-white',
    }
    return colors[score as keyof typeof colors] || ''
  }

  return (
    <Dialog open={!!model} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 bg-medical-darkest-gray border-2 border-medical-blue/50 flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="bg-medical-blue px-6 py-4 flex items-center justify-between border-b border-medical-blue/50">
          <div>
            <DialogTitle className="text-xl font-semibold text-white">Model {model.modelName} Evaluation</DialogTitle>
            <DialogDescription className="text-sm text-white/80">ID: {model.id.substring(0, 8)}...</DialogDescription>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>


        {/* Content - Side by Side Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Image */}
          <div className="w-1/2 bg-black border-r border-medical-dark-gray/30 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-6">
              <img
                src={currentUrl || getImageWithFallback(null, 900, 900, `eval-${model.id}`)}
                alt={`Model ${model.modelName}`}
                className={cn(
                  "max-w-full max-h-full object-contain transition-opacity duration-300",
                  isRefreshing && "opacity-50 blur-sm"
                )}
                onError={handleImageError}
              />
            </div>
          </div>

          {/* Right Side - Model Response & Evaluation Metrics */}
          <div className="w-1/2 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Model Response */}
              <div className="bg-medical-dark-gray/30 rounded-lg border border-medical-dark-gray/30 p-4">
                <h3 className="text-sm font-medium text-medical-gray uppercase mb-2">
                  Model Response:
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{model.response}</p>
              </div>

              {/* Evaluation Metrics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Evaluation Metrics</h3>
                
                {metrics.map((metric) => {
                  const guidelines = METRIC_GUIDELINES[metric.name] || {
                    1: 'Positive / Correct',
                    0: 'Negative / Incorrect'
                  };
                  
                  return (
                    <div key={metric.id} className="space-y-3 pb-4 border-b border-medical-dark-gray/30 last:border-0">
                      <div>
                        <h4 className="text-base font-semibold text-foreground">{metric.name}</h4>
                        <p className="text-xs text-medical-gray mt-1">{metric.description?.split('?')[0]}?</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Option 1 */}
                        <button
                          onClick={() => handleScoreSelect(metric.id, 1)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left h-full",
                            scores[metric.id] === 1
                              ? "bg-green-500/10 border-green-500"
                              : "bg-medical-dark-gray/30 border-transparent hover:bg-medical-dark-gray/50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                              scores[metric.id] === 1 ? "bg-green-500 text-white" : "bg-medical-gray text-medical-darkest-gray"
                            )}>1</span>
                            <span className={cn("font-medium text-sm", scores[metric.id] === 1 ? "text-green-500" : "text-foreground")}>
                              Yes / Good
                            </span>
                          </div>
                          <p className="text-xs text-medical-gray/80 leading-relaxed">
                            {guidelines[1]}
                          </p>
                        </button>

                        {/* Option 0 */}
                        <button
                          onClick={() => handleScoreSelect(metric.id, 0)}
                          className={cn(
                            "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left h-full",
                            scores[metric.id] === 0
                              ? "bg-red-500/10 border-red-500"
                              : "bg-medical-dark-gray/30 border-transparent hover:bg-medical-dark-gray/50"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                              scores[metric.id] === 0 ? "bg-red-500 text-white" : "bg-medical-gray text-medical-darkest-gray"
                            )}>0</span>
                            <span className={cn("font-medium text-sm", scores[metric.id] === 0 ? "text-red-500" : "text-foreground")}>
                              No / Bad
                            </span>
                          </div>
                          <p className="text-xs text-medical-gray/80 leading-relaxed">
                            {guidelines[0]}
                          </p>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-medical-dark-gray/30 p-6 bg-medical-darker-gray flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-medical-dark-gray text-foreground hover:bg-medical-dark-gray/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!allScored}
            className={cn(
              "px-6 py-2 rounded-lg font-medium transition-colors",
              allScored
                ? "bg-medical-blue text-white hover:bg-medical-blue/90"
                : "bg-medical-dark-gray/50 text-medical-gray cursor-not-allowed"
            )}
          >
            {allScored ? 'Save Evaluation' : 'Score All Metrics'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
