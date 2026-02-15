// Mock data utilities for 6-image evaluation workflow

import { ImageRecord, ModelOutput, CaseRecord } from '@/types'

// Sample X-ray image URL (we'll use the same placeholder for all models)
const SAMPLE_XRAY_URL = "https://images.unsplash.com/photo-1530497510245-51235c4c230a?w=400&h=400&fit=crop"

// Sample model responses
const MODEL_RESPONSES = [
  "Normal chest examination with clear lung fields bilaterally. No consolidation, effusion, or pneumothorax. Heart size normal.",
  "The cardiac silhouette and pulmonary vasculature appear within normal limits. Lungs are clear without infiltrates. No acute findings.",
  "No radiographic evidence of acute disease. Clear lungs, normal heart size, intact bony structures.",
  "Bilateral lung fields demonstrate no focal consolidation. Normal cardiovascular contours. No pleural abnormality detected.",
  "Unremarkable chest radiograph. Cardiothoracic ratio normal. No signs of infection or mass. Clear bilateral lung fields.",
  "Normal cardiopulmonary examination. No infiltrates, masses, or effusions. Skeletal structures intact."
]

// Different ground truths for each of the 6 images
const GROUND_TRUTHS = [
  {
    findings: "The lungs are clear. The cardiomediastinal silhouette is within normal limits. No acute osseous abnormalities. No pleural effusion or pneumothorax is seen. The costophrenic angles are sharp.",
    impressions: "No acute cardiopulmonary process. Normal chest X-ray."
  },
  {
    findings: "Mild cardiomegaly noted. Pulmonary vasculature appears slightly prominent. No focal consolidation. Costophrenic angles are sharp. No pneumothorax.",
    impressions: "Mild cardiomegaly. Possible early pulmonary vascular congestion. Clinical correlation recommended."
  },
  {
    findings: "Small right pleural effusion blunting the costophrenic angle. Otherwise clear lung fields. Normal cardiac silhouette. No pneumothorax or infiltrates.",
    impressions: "Small right pleural effusion. Clinical correlation and follow-up recommended."
  },
  {
    findings: "Patchy opacity in the right lower lobe concerning for pneumonia. Left lung clear. No effusion or pneumothorax. Cardiac size normal.",
    impressions: "Right lower lobe pneumonia. Antibiotic therapy recommended."
  },
  {
    findings: "Bilateral interstitial markings increased throughout both lung fields. Cardiac size upper limits of normal. No focal consolidation, effusion, or pneumothorax.",
    impressions: "Interstitial lung disease pattern. Recommend HRCT for further evaluation."
  },
  {
    findings: "Left upper lobe nodular opacity measuring approximately 2.5 cm. Remainder of lungs clear. No lymphadenopathy visible on chest radiograph. No pleural effusion.",
    impressions: "Left upper lobe mass. Recommend CT chest with contrast for further characterization. Consider biopsy."
  }
]

export const generateMockImageRecord = (imageIndex: number): ImageRecord => {
  const models: ModelOutput[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((modelName, idx) => ({
    id: `model-${imageIndex}-${modelName}`,
    modelName,
    imageUrl: SAMPLE_XRAY_URL,
    response: MODEL_RESPONSES[idx],
    status: 'pending' as const,
  }))

  return {
    imageIndex,
    imageUrl: SAMPLE_XRAY_URL,
    imageId: `image-${imageIndex}-${Date.now()}`,
    groundTruth: GROUND_TRUTHS[imageIndex] || GROUND_TRUTHS[0], // Each image gets its own ground truth
    modelOutputs: models,
    evaluationStatus: 'pending',
    completedModels: 0,
    totalModels: 6,
  }
}

export const generateMockCaseRecord = (caseId: string): CaseRecord => {
  const images: ImageRecord[] = Array.from({ length: 6 }, (_, i) => generateMockImageRecord(i))

  return {
    id: caseId,
    studyId: `CXR-2024-${Math.floor(Math.random() * 1000)}`,
    images,
    totalProgress: 0,
  }
}
