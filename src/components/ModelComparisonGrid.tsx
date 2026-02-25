import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ModelOutput } from '@/types'
import { CheckCircle2, ImageIcon, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { refreshImageUrl } from '@/services'
import { getImageWithFallback } from '@/lib/imageUtils'

interface ModelComparisonGridProps {
  models: ModelOutput[]
  onModelClick: (model: ModelOutput) => void
  activeModelId?: string
}

export const ModelComparisonGrid: React.FC<ModelComparisonGridProps> = ({
  models,
  onModelClick,
  activeModelId,
}) => {
  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      completed: { label: 'Completed', className: 'bg-green-500/20 text-green-500 border-green-500/50' },
      in_progress: { label: 'Scoring', className: 'bg-orange-500/20 text-orange-500 border-orange-500/50' },
      pending: { label: 'Pending', className: 'bg-gray-500/20 text-gray-500 border-gray-500/50' },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    
    return (
      <Badge variant="outline" className={cn("text-xs font-medium border", config.className)}>
        {config.label}
      </Badge>
    )
  }


  const [currentUrls, setCurrentUrls] = useState<Record<string, string>>({})
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({})
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    setCurrentUrls(prev => {
      let isChanged = false;
      const nextUrls = { ...prev };
      models.forEach(m => {
         // Only update if it's new or the backend genuinely provided a fresh URL
         if (!nextUrls[m.id] && m.imageUrl) {
           nextUrls[m.id] = m.imageUrl;
           isChanged = true;
         }
      });
      return isChanged ? nextUrls : prev;
    });
  }, [models])

  const handleImageError = async (modelId: string) => {
    if (refreshingIds.has(modelId) || loadedImages[modelId]) return;
    
    setRefreshingIds(prev => new Set(prev).add(modelId));
    
    try {
      const data = await refreshImageUrl('model', modelId)
      if (data && data.url) {
        setCurrentUrls(prev => ({...prev, [modelId]: data.url}))
      } else {
        // Fallback applied to break loops
        setCurrentUrls(prev => ({...prev, [modelId]: getImageWithFallback(null, 900, 900, `eval-${modelId}`)}))
      }
      setLoadedImages(prev => ({ ...prev, [modelId]: true }))
    } catch (error) {
       console.error(`Failed to refresh model image URL for ${modelId}`, error)
       setCurrentUrls(prev => ({...prev, [modelId]: getImageWithFallback(null, 900, 900, `eval-${modelId}`)}))
       setLoadedImages(prev => ({ ...prev, [modelId]: true }))
    } finally {
       setRefreshingIds(prev => {
         const next = new Set(prev)
         next.delete(modelId)
         return next
       })
    }
  }

  const handleImageLoad = (modelId: string) => {
    setLoadedImages(prev => ({ ...prev, [modelId]: true }))
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Model Comparison</h2>
        <p className="text-sm text-medical-gray">Evaluate generated variants against the ground truth.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {models.map((model) => {
          return (
          <button
            key={model.id}
            onClick={() => onModelClick(model)}
            className={cn(
              "group relative rounded-lg overflow-hidden transition-all isolate",
              "border-2 hover:scale-[1.02] hover:shadow-lg",
              activeModelId === model.id
                ? "border-medical-blue shadow-lg shadow-medical-blue/20"
                : model.status === 'completed'
                ? "border-green-500/50"
                : "border-medical-dark-gray/30",
              "bg-medical-darkest-gray h-[280px] flex flex-col"
            )}
          >

            {/* Image Placeholder & Loader */}
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
               {(!loadedImages[model.id] || refreshingIds.has(model.id)) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-medical-darker-gray z-0">
                    <Loader2 size={32} className="animate-spin text-medical-blue/70 mb-2" />
                    <p className="text-xs text-medical-gray">Loading Preview...</p>
                 </div>
               )}
               
              <img
                src={currentUrls[model.id] || getImageWithFallback(model.imageUrl, 900, 900, `eval-${model.id}`)}
                alt={`Model ${model.modelName}`}
                loading="lazy"
                onLoad={() => handleImageLoad(model.id)}
                onError={() => handleImageError(model.id)}
                className={cn(
                  "max-w-full max-h-full object-contain transition-opacity duration-500 z-10 relative",
                  loadedImages[model.id] ? "opacity-100" : "opacity-0",
                  refreshingIds.has(model.id) && "opacity-50 blur-sm"
                )}
              />
              
              {/* Overlay hint on hover */}
              <div className="absolute inset-0 bg-medical-blue/10 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col items-center justify-center pointer-events-none">
                <div className="bg-medical-darkest-gray/90 px-4 py-2 rounded-full border border-medical-blue/50 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  <ImageIcon size={16} className="text-medical-blue" />
                  <span className="text-sm font-medium text-white shadow-sm">Click to Evaluate</span>
                </div>
              </div>
            </div>

            {/* Status Badge - Top Right */}
            <div className="absolute top-3 right-3 z-30">
              {getStatusBadge(model.status)}
            </div>

            {/* Completed Checkmark - Top Left */}
            {model.status === 'completed' && (
              <div className="absolute top-3 left-3 z-30 bg-green-500 rounded-full p-1 shadow-md">
                <CheckCircle2 size={20} className="text-white" />
              </div>
            )}

            {/* Model Label */}
            <div className="bg-medical-dark-gray/50 border-t border-medical-dark-gray/30 p-3">
              <p className="text-sm font-medium text-medical-gray">
                MODEL {model.modelName}
              </p>
            </div>
          </button>
          )
        })}
      </div>
    </div>
  )
}
