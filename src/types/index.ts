export interface Navigation {
  hasPrevious: boolean;
  hasNext: boolean;
  previousId: string | null;
  nextId: string | null;
}

export interface Metric {
  id: string;
  name: string;
  description?: string;
}

export interface EvaluationMetric {
  id: string;
  name: string;
  description?: string;
  value: number | null;
}

export interface Evaluation {
  responseId: string;
  metrics: EvaluationMetric[];
}

export interface APIEvaluation {
  responseId: string;
  metricId: string;
  metricName?: string;
  score: number;
}

export interface Record {
  id: string;
  internalId?: string; // Internal UUID for API calls
  imageUrl: string;
  image_id?: string;
  status?: string;
  modelOutputs: Array<{
    responseId: string;
    response: string;
    evaluations?: APIEvaluation[];
  }>;
  metrics: Metric[];
  evaluations: APIEvaluation[];
  groundTruth: {
    findings: string;
    impressions: string;
  };
  models: any[];
  navigation?: Navigation;
}

// New types for 6-image evaluation workflow
export interface ModelOutput {
  id: string;
  modelName: string; // A, B, C, D, E, F
  imageUrl: string;
  response: string;
  evaluations?: APIEvaluation[];
  status?: 'completed' | 'in_progress' | 'pending';
}

export interface ImageRecord {
  imageIndex: number;
  imageUrl: string;
  imageId: string;
  internalId?: string; // Internal UUID for API calls
  studyId?: string;
  groundTruth: {
    findings: string;
    impressions: string;
  };
  modelOutputs: ModelOutput[];
  evaluationStatus?: 'completed' | 'in_progress' | 'pending';
  completedModels: number;
  totalModels: number;
}

export interface CaseRecord {
  id: string;
  studyId: string;
  images: ImageRecord[];
  totalProgress: number; // 0-100
}
