import React, { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ModelOutput, Metric } from '@/types'
import { X, BookOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getImageWithFallback } from '@/lib/imageUtils'
import { refreshImageUrl } from '@/services'

interface EvaluationOverlayProps {
  model: ModelOutput | null
  metrics: Metric[]
  structuredPromptText?: string
  groundTruthImage?: string
  groundTruthImageId?: string
  onClose: () => void
  onSave: (modelId: string, scores: Record<string, number>) => void
  existingScores?: Record<string, number>
}

const METRIC_KEY = (name: string) => name.trim().toLowerCase()

const METRIC_GUIDELINES: Record<string, { 1: ReactNode; 0: ReactNode }> = {
  [METRIC_KEY('Anatomical Validity')]: {
    1: 'Only anatomically plausible thoracic structures without distortion.',
    0: 'One or more implausible, distorted, or missing major anatomical structures.'
  },
  [METRIC_KEY('Pathology Presence')]: {
    1: 'The prompted pathology (finding) is clearly visible.',
    0: 'Pathology (finding) is absent or different from the prompt.'
  },
  [METRIC_KEY('Internal Consistency')]: {
    1: 'Imaging findings are consistent with the prompted pathology (finding) and follow natural radiological patterns.',
    0: 'Imaging findings show unrealistic features that do not naturally occur'
  },
  [METRIC_KEY('Attribute Concordance')]: {
    1: 'Attribute/ location and side is correctly depicted.',
    0: 'Wrong attribute, location, or side.'
  },
  [METRIC_KEY('Similarity Index')]: {
    1: <>The background image looks <u>same</u> as the reference image.</>,
    0: <>The background image looks <u>different</u> from the reference image.</>
  }
};

const METRIC_INSTRUCTIONS: Record<string, ReactNode> = {
  [METRIC_KEY('Anatomical Validity')]: (
    <div className="space-y-2 text-xs text-white leading-relaxed">
      <p className="text-white font-semibold">1) Anatomical Validity</p>
      <p className="text-white">Evaluate ONLY the generated image (ignore reference image and pathology region).</p>
      <p className="text-white font-medium">Look for:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li className="text-white">Normal lung fields, ribs, clavicles, scapulae</li>
        <li className="text-white">Normal cardiomediastinal silhouette, shape and position</li>
        <li className="text-white">Normal diaphragm contours and bowel shadows</li>
      </ul>
    </div>
  ),
  [METRIC_KEY('Pathology Presence')]: (
    <div className="space-y-2 text-xs text-white leading-relaxed">
      <p className="text-white font-semibold">2) Pathology Presence</p>
      <p className="text-white">
        Evaluate only whether a pathology (finding) is present in the generated image. Do not assess whether the pathology (finding) is radiologically correct.
      </p>
      <p className="text-white">
        Revisiting prompt structure: Right moderate pleural effusion = Right moderate (Attribute) + Pleural effusion (Finding).
      </p>
      <p className="text-white font-medium">Focus ONLY on:</p>
      <ul className="list-disc pl-5 space-y-1 mb-1">
        <li className="text-white">Presence of abnormality</li>
      </ul>
      <p className="text-white font-medium">Ignore:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li className="text-white">Whether it is radiologically correct</li>
        <li className="text-white">Whether secondary signs are present</li>
        <li className="text-white">Whether the diagnosis is accurate</li>
      </ul>
    </div>
  ),
  [METRIC_KEY('Internal Consistency')]: (
    <div className="space-y-2 text-xs text-white leading-relaxed">
      <p className="text-white font-semibold">3) Internal Consistency</p>
      <p className="text-white">Evaluate whether the pathology (finding) is radiologically correct.</p>
      <p className="text-white font-medium">Focus on:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li className="text-white">Radiological patterns fit the prompted pathology (finding)</li>
        <li className="text-white">Presence or absence of expected secondary signs</li>
      </ul>
    </div>
  ),
  [METRIC_KEY('Attribute Concordance')]: (
    <div className="space-y-2 text-xs text-white leading-relaxed">
      <p className="text-white font-semibold">4) Attribute concordance</p>
      <p className="text-white">
        Evaluate whether attribute, location, and side of the prompted pathology (finding) is accurate. Revisiting prompt structure: Right moderate pleural effusion = Right moderate (Attribute) + Pleural effusion (Finding).
      </p>
    </div>
  ),
  [METRIC_KEY('Similarity Index')]: (
    <div className="space-y-2 text-xs text-white leading-relaxed">
      <p className="text-white font-semibold">5) Similarity index</p>
      <p className="text-white">
        Evaluate only the background features (ignoring the generated pathology) of the generated image compared to the reference image.
      </p>
      <p className="text-white font-medium">Carefully look for:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li className="text-white">Same radiographic marker</li>
        <li className="text-white">Same breast shadow</li>
        <li className="text-white">Same bowel or stomach gas</li>
        <li className="text-white">Presence of additional hallucinated artefacts</li>
        <li className="text-white">Increased or decreased graininess</li>
        <li className="text-white">Any signs that the background chest X-ray is not from the same patient</li>
      </ul>
    </div>
  ),
}

export const EvaluationOverlay: React.FC<EvaluationOverlayProps> = ({
  model,
  metrics,
  structuredPromptText,
  groundTruthImage,
  groundTruthImageId,
  onClose,
  onSave,
  existingScores = {},
}) => {
  const [scores, setScores] = useState<Record<string, number>>(existingScores)
  const [currentUrl, setCurrentUrl] = useState<string>(model?.imageUrl || '')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentGroundTruthUrl, setCurrentGroundTruthUrl] = useState<string>(groundTruthImage || '')
  const [isGroundTruthRefreshing, setIsGroundTruthRefreshing] = useState(false)
  const [zoom, setZoom] = useState({
    groundTruth: 1,
    model: 1,
  })
  const [panOffsets, setPanOffsets] = useState({
    groundTruth: { x: 0, y: 0 },
    model: { x: 0, y: 0 },
  })
  const [activePan, setActivePan] = useState<{
    type: 'groundTruth' | 'model'
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [activeInstructionMetric, setActiveInstructionMetric] = useState<string | null>(null)

  // Reset/Update scores when model or existingScores change
  React.useEffect(() => {
    setScores(existingScores || {})
    if (model) {
      setCurrentUrl(model.imageUrl)
      setIsRefreshing(false)
    }
  }, [model, existingScores])

  React.useEffect(() => {
    if (groundTruthImage) {
      setCurrentGroundTruthUrl(groundTruthImage);
    }
  }, [groundTruthImage])

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

  const handleGroundTruthError = async () => {
    if (!groundTruthImageId || isGroundTruthRefreshing) return
    setIsGroundTruthRefreshing(true)
    try {
      const data = await refreshImageUrl('image', groundTruthImageId)
      if (data && data.url) {
        setCurrentGroundTruthUrl(data.url)
      } else {
        setCurrentGroundTruthUrl(getImageWithFallback(null, 900, 900, `eval-gt-${groundTruthImageId}`))
      }
    } catch (e) {
      console.error("Failed to refresh ground truth image url", e)
      setCurrentGroundTruthUrl(getImageWithFallback(null, 900, 900, `eval-gt-${groundTruthImageId}`))
    } finally {
      setIsGroundTruthRefreshing(false)
    }
  }

  const handlePanStart = (
    type: 'groundTruth' | 'model',
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    setActivePan({
      type,
      startX: event.clientX,
      startY: event.clientY,
      origX: panOffsets[type].x,
      origY: panOffsets[type].y,
    })
  }

  const handlePanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activePan) return

    const deltaX = event.clientX - activePan.startX
    const deltaY = event.clientY - activePan.startY

    setPanOffsets((prev) => ({
      ...prev,
      [activePan.type]: {
        x: activePan.origX + deltaX,
        y: activePan.origY + deltaY,
      },
    }))
  }

  const handlePanEnd = () => {
    if (!activePan) return
    setActivePan(null)
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
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 bg-medical-darkest-gray border-2 border-medical-blue/50 flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="bg-medical-blue px-6 py-4 flex items-center justify-between border-b border-medical-blue/50">
          <div>
            <DialogTitle className="text-xl font-semibold text-white">{model.modelName} Evaluation</DialogTitle>
            <DialogDescription className="text-sm text-white/80">ID: {model.id.substring(0, 8)}...</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>


        {/* Content - Side by Side Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Images */}
          <div className="w-2/3 bg-black border-r border-medical-dark-gray/30 flex relative flex-col">
            <div className="flex-1 flex overflow-hidden">
            {/* Ground Truth Image */}
              <div className="flex-1 flex flex-col relative border-r border-medical-dark-gray/50 bg-gradient-to-br from-blue-500/10 to-emerald-500/10">
                <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-emerald-500/30 rounded-lg text-sm font-bold text-emerald-100 backdrop-blur-sm border border-emerald-400/50">
                  Ground Truth
                </div>
                <div className="flex-1 flex items-center justify-center p-6">
                  {currentGroundTruthUrl ? (
                    <div
                      className="relative max-w-full max-h-full overflow-hidden cursor-grab active:cursor-grabbing bg-black"
                      onMouseDown={(e) => handlePanStart('groundTruth', e)}
                      onMouseMove={handlePanMove}
                      onMouseUp={handlePanEnd}
                      onMouseLeave={handlePanEnd}
                    >
                      <div
                        style={{
                          transform: `translate(${panOffsets.groundTruth.x}px, ${panOffsets.groundTruth.y}px) scale(${zoom.groundTruth})`,
                          transformOrigin: 'center center',
                          transition: activePan ? 'none' : 'transform 150ms ease-out',
                        }}
                      >
                        <img
                          src={currentGroundTruthUrl}
                          alt="Ground Truth"
                          className={cn(
                            "max-w-full max-h-full object-contain select-none pointer-events-none",
                            isGroundTruthRefreshing && "opacity-50 blur-sm",
                          )}
                          onError={handleGroundTruthError}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-medical-gray">No ground truth image available</div>
                  )}
                </div>
                {/* Ground Truth Zoom Controls */}
                <div className="w-full px-6 pb-4 flex items-center gap-3">
                  <span className="text-[10px] font-medium text-medical-gray uppercase tracking-wide">
                    GT Zoom
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={zoom.groundTruth}
                    onChange={(e) =>
                      setZoom((prev) => ({ ...prev, groundTruth: parseFloat(e.target.value) }))
                    }
                    className="flex-1 accent-medical-blue"
                  />
                  <span className="text-[10px] text-medical-gray w-10 text-right">
                    {zoom.groundTruth.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom((prev) => ({ ...prev, groundTruth: 1 }))
                      setPanOffsets((prev) => ({
                        ...prev,
                        groundTruth: { x: 0, y: 0 },
                      }))
                    }}
                    className="px-2 py-1 text-[10px] font-medium rounded-md border border-medical-dark-gray/60 text-medical-gray hover:text-foreground hover:bg-medical-dark-gray/60 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Evaluated Image */}
              <div className="flex-1 flex flex-col relative">
                <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-blue-500/30 rounded-lg text-sm font-bold text-blue-100 backdrop-blur-sm border border-blue-400/50">
                  {model.modelName}
                </div>
                <div className="flex-1 flex items-center justify-center p-6">
                  {currentUrl ? (
                    <div
                      className="relative max-w-full max-h-full overflow-hidden cursor-grab active:cursor-grabbing bg-black"
                      onMouseDown={(e) => handlePanStart('model', e)}
                      onMouseMove={handlePanMove}
                      onMouseUp={handlePanEnd}
                      onMouseLeave={handlePanEnd}
                    >
                      <div
                        style={{
                          transform: `translate(${panOffsets.model.x}px, ${panOffsets.model.y}px) scale(${zoom.model})`,
                          transformOrigin: 'center center',
                          transition: activePan ? 'none' : 'transform 150ms ease-out',
                        }}
                      >
                        <img
                          src={currentUrl}
                          alt={`Model ${model.modelName}`}
                          className={cn(
                            "max-w-full max-h-full object-contain select-none pointer-events-none",
                            isRefreshing && "opacity-50 blur-sm",
                          )}
                          onError={handleImageError}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-medical-gray">No image available</div>
                  )}
                </div>
                {/* Model Zoom Controls */}
                <div className="w-full px-6 pb-4 flex items-center gap-3">
                  <span className="text-[10px] font-medium text-medical-gray uppercase tracking-wide">
                    Model Zoom
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={zoom.model}
                    onChange={(e) =>
                      setZoom((prev) => ({ ...prev, model: parseFloat(e.target.value) }))
                    }
                    className="flex-1 accent-medical-blue"
                  />
                  <span className="text-[10px] text-medical-gray w-10 text-right">
                    {zoom.model.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom((prev) => ({ ...prev, model: 1 }))
                      setPanOffsets((prev) => ({
                        ...prev,
                        model: { x: 0, y: 0 },
                      }))
                    }}
                    className="px-2 py-1 text-[10px] font-medium rounded-md border border-medical-dark-gray/60 text-medical-gray hover:text-foreground hover:bg-medical-dark-gray/60 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Model Response & Evaluation Metrics */}
          <div className="w-1/3 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Pathology to be inserted */}
              <div className="bg-medical-dark-gray/30 rounded-lg border border-medical-dark-gray/30 p-4">
                <h3 className="text-sm font-medium text-medical-gray uppercase mb-2">
                  Pathology to be inserted:
                </h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {structuredPromptText || 'No pathology to be inserted available'}
                </p>
              </div>

              {/* Evaluation Metrics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-lg font-semibold text-foreground">Evaluation Metrics</h3>
                 </div>

                {metrics.map((metric) => {
                  const metricKey = METRIC_KEY(metric.name)
                  const guidelines = METRIC_GUIDELINES[metricKey] || {
                    1: 'Positive / Correct',
                    0: 'Negative / Incorrect'
                  };
                  const instructions = METRIC_INSTRUCTIONS[metricKey]
                  const isInstructionsOpen = activeInstructionMetric === metric.id
                  
                  return (
                    <div key={metric.id} className="space-y-3 pb-4 border-b border-medical-dark-gray/30 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-foreground">{metric.name}</h4>
                          <p className="text-xs text-white mt-1">{metric.description?.split('?')[0]}?</p>
                        </div>
                        {instructions && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveInstructionMetric((current) =>
                                current === metric.id ? null : metric.id
                              )
                            }
                            className={cn(
                              "shrink-0 px-3 py-2 text-xs font-bold rounded-lg transition-colors",
                              "bg-blue-500/30 text-blue-100 border border-blue-400/50 hover:bg-blue-500/40"
                            )}
                          >
                            Instructions
                          </button>
                        )}
                      </div>

                      {isInstructionsOpen && instructions && (
                        <div className="rounded-lg border border-medical-dark-gray/40 bg-medical-darkest-gray p-4">
                          {instructions}
                        </div>
                      )}
                      
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
                          </div>
                          <p className={cn(
                            "text-xs leading-relaxed",
                            scores[metric.id] === 1 ? "text-green-300 font-medium" : "text-white"
                          )}>
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
                          </div>
                          <p className={cn(
                            "text-xs leading-relaxed",
                            scores[metric.id] === 0 ? "text-red-300 font-medium" : "text-white"
                          )}>
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
        <div className="border-t border-medical-dark-gray/30 p-6 bg-medical-darker-gray flex justify-between items-center gap-3">
          <a
            href="/Syn_CXR_RISE_Evaluators_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-medical-dark-gray border border-medical-dark-gray/50 hover:border-medical-blue/50",
              "text-sm font-medium text-white transition-all hover:bg-medical-blue/10"
            )}
          >
            <BookOpen size={16} className="text-medical-blue shrink-0" />
            Evaluator's Guide
          </a>
          <div className="flex gap-3">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
