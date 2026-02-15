import { Record as ApiRecord, Metric, CaseRecord, ImageRecord, ModelOutput } from '@/types';

// Helper to create a lookup map for metrics
export const createMetricKeyMap = (metrics: Metric[]): Record<string, string> => {
  return (metrics || []).reduce((acc: any, m: any) => {
    const key = m.name.toLowerCase().replace(/ /g, '_');
    acc[key] = m.id;
    return acc;
  }, {});
};

// Transform assignment API response to Record[]
export const transformAssignmentToRecords = (
  assignmentId: string,
  data: any,
  metrics: Metric[]
): ApiRecord[] => {
  const records: ApiRecord[] = [];
  
  if (data.images && Array.isArray(data.images)) {
    const metricKeyMap = createMetricKeyMap(metrics);

    data.images.forEach((img: any) => {
      records.push({
        id: assignmentId,
        internalId: img.id,
        imageUrl: img.ground_truth_image_url,
        image_id: img.image_id,
        status: img.progress.status,
        
        modelOutputs: (img.model_outputs || []).map((mo: any) => {
          const mappedEvaluations: any[] = [];
          if (mo.evaluations) {
            Object.entries(mo.evaluations).forEach(([key, score]) => {
              const metricId = metricKeyMap[key];
              if (metricId) {
                mappedEvaluations.push({
                  responseId: mo.id,
                  metricId: metricId,
                  score: Number(score)
                });
              } else {
                 console.warn(`Metric mapping failed for key: ${key}`);
              }
            });
          }

          return {
            responseId: mo.id,
            response: mo.response_text || '',
            displayLabel: mo.display_label,
            generatedImageUrl: mo.generated_image_url,
            isCompleted: mo.is_completed,
            evaluations: mappedEvaluations
          };
        }),
        
        metrics: metrics || [],
        evaluations: [],
        groundTruth: {
          findings: img.ground_truth?.findings || '',
          impressions: img.ground_truth?.impressions || ''
        },
        models: [],
        navigation: undefined
      });
    });
  }
  return records;
};

// Transform assigned images API response to Record[]
export const transformAssignedImagesToRecords = (
  data: any,
  metrics: Metric[]
): ApiRecord[] => {
  const records: ApiRecord[] = [];
  
  if (data.images && Array.isArray(data.images)) {
    const metricKeyMap = createMetricKeyMap(metrics);

    data.images.forEach((img: any) => {
      records.push({
        id: img.assignment_id,
        internalId: img.id,
        imageUrl: img.ground_truth_image_url,
        image_id: img.image_id,
        status: img.progress.status,
        
        modelOutputs: (img.model_outputs || []).map((mo: any) => {
          const mappedEvaluations: any[] = [];
          if (mo.evaluations) {
            Object.entries(mo.evaluations).forEach(([key, score]) => {
              const metricId = metricKeyMap[key];
              if (metricId) {
                mappedEvaluations.push({
                  responseId: mo.id,
                  metricId: metricId,
                  score: Number(score)
                });
              }
            });
          }

          return {
            responseId: mo.id,
            response: mo.response_text || '',
            displayLabel: mo.display_label,
            generatedImageUrl: mo.generated_image_url,
            isCompleted: mo.is_completed,
            evaluations: mappedEvaluations
          };
        }),
        
        metrics: metrics || [],
        evaluations: [],
        groundTruth: {
          findings: img.ground_truth?.findings || '',
          impressions: img.ground_truth?.impressions || ''
        },
        models: [],
        navigation: undefined
      });
    });
  }
  return records;
};

// Transform API Records to CaseRecord for Index.tsx
export const transformRecordsToCase = (records: any[]): { 
  caseRecord: CaseRecord; 
  initialEvaluationData: Record<string, Record<string, number>> 
} | null => {
  if (!records || records.length === 0) return null;

  const initialEvaluationData: Record<string, Record<string, number>> = {};
  
  const newCase: CaseRecord = {
    id: 'unified-worklist',
    studyId: 'Unified Worklist',
    totalProgress: 0,
    images: records.map((rec, index) => ({
        imageIndex: index,
        imageId: rec.image_id || `img-${index}`,
        internalId: rec.internalId,
        assignmentId: rec.id,
        studyId: rec.studyId,
        imageUrl: rec.imageUrl,
        groundTruth: rec.groundTruth,
        modelOutputs: rec.modelOutputs.map((mo:any, mIdx: number) => {
            if (mo.evaluations && mo.evaluations.length > 0) {
                const scores: Record<string, number> = {};
                mo.evaluations.forEach((evalItem: any) => {
                    if (evalItem.metricId) {
                        scores[evalItem.metricId] = evalItem.score;
                    }
                });
                initialEvaluationData[mo.responseId] = scores;
            }

            return {
                id: mo.responseId,
                modelName: mo.displayLabel || `Model ${mIdx+1}`, 
                imageUrl: mo.generatedImageUrl || '',
                response: mo.response,
                evaluations: mo.evaluations || [],
                status: mo.isCompleted ? 'completed' : 'pending'
            };
        }),
        completedModels: (rec.modelOutputs || []).filter((m:any) => m.isCompleted).length,
        totalModels: (rec.modelOutputs || []).length,
        evaluationStatus: rec.status as any
    }))
  };

  return { caseRecord: newCase, initialEvaluationData };
};
