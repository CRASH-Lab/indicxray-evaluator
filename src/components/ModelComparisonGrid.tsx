import React from 'react'
import { cn } from '@/lib/utils'
import { ModelOutput } from '@/types'
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Model Comparison</h2>
        <p className="text-sm text-medical-gray">Evaluate generated variants against the ground truth.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {models.map((model) => {
          console.log(`Model ${model.id} Rendering Image URL:`, model.imageUrl);
          return (
          <button
            key={model.id}
            onClick={() => onModelClick(model)}
            className={cn(
              "relative rounded-lg overflow-hidden transition-all",
              "border-2 hover:scale-[1.02] hover:shadow-lg",
              activeModelId === model.id
                ? "border-medical-blue shadow-lg shadow-medical-blue/20"
                : model.status === 'completed'
                ? "border-green-500/50"
                : "border-medical-dark-gray/30",
              "bg-medical-darkest-gray h-[280px] flex flex-col"
            )}
          >
            {/* Status Badge - Top Right */}
            <div className="absolute top-3 right-3 z-10">
              {getStatusBadge(model.status)}
            </div>

            {/* Completed Checkmark - Top Left */}
            {model.status === 'completed' && (
              <div className="absolute top-3 left-3 z-10 bg-green-500 rounded-full p-1">
                <CheckCircle2 size={20} className="text-white" />
              </div>
            )}

            {/* Image */}
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
              <img
                src={model.imageUrl}
                alt={`Model ${model.modelName}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>

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
