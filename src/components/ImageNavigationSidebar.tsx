import React from 'react'
import { cn } from '@/lib/utils'
import { getImageWithFallback } from '@/lib/imageUtils'

interface GroundTruthPanelProps {
  imageUrl: string
  groundTruth: {
    findings: string
    impressions: string
  }
  imageLabel?: string
}

export const GroundTruthPanel: React.FC<GroundTruthPanelProps> = ({
  imageUrl,
  groundTruth,
  imageLabel = "ORIGINAL DICOM"
}) => {
  return (
    <div className="w-[400px] bg-medical-darker-gray border-r border-medical-dark-gray/30 flex flex-col h-full">
      {/* Ground Truth Badge */}
      <div className="flex items-center gap-2 p-4 border-b border-medical-dark-gray/30">
        <div className="flex items-center gap-2 bg-medical-blue/10 border border-medical-blue/50 rounded px-3 py-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-medical-blue">GROUND TRUTH</span>
        </div>
        <span className="text-xs bg-green-500/20 text-green-500 border border-green-500/50 rounded px-2 py-1">
          Validated
        </span>
      </div>

      {/* X-Ray Image */}
      <div className="flex-shrink-0 bg-black border-b border-medical-dark-gray/30">
        <div className="relative">
          <div className="absolute top-3 left-3 bg-medical-darkest-gray/90 px-2 py-1 rounded text-xs font-medium text-medical-gray z-10">
            {imageLabel}
          </div>
          <img
            src={getImageWithFallback(imageUrl, 400, 320, 'ground-truth')}
            alt="Ground Truth X-Ray"
            className="w-full h-auto object-contain"
            style={{ maxHeight: '320px' }}
            onError={(e) => {
              e.currentTarget.src = getImageWithFallback(null, 400, 320, 'ground-truth')
            }}
          />
        </div>
      </div>

      {/* Ground Truth Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-medium text-medical-gray uppercase mb-2">
            FINDINGS
          </h3>
          <p className="text-sm text-foreground leading-relaxed">
            {groundTruth.findings}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-medium text-medical-gray uppercase mb-2">
            IMPRESSION
          </h3>
          <div className="bg-medical-blue/10 border-l-2 border-medical-blue p-3 rounded">
            <p className="text-sm text-foreground leading-relaxed">
              {groundTruth.impressions}
            </p>
          </div>
        </div>

        {/* Patient Metadata */}
        <div className="pt-4 border-t border-medical-dark-gray/30">
          <h3 className="text-xs font-medium text-medical-gray uppercase mb-3">
            PATIENT METADATA
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-medical-darkest-gray p-2 rounded">
              <p className="text-xs text-medical-gray">Age/Sex</p>
              <p className="text-sm font-medium">45 / M</p>
            </div>
            <div className="bg-medical-darkest-gray p-2 rounded">
              <p className="text-xs text-medical-gray">View</p>
              <p className="text-sm font-medium">PA Upright</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
