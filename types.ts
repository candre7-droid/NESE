
export enum AppStep {
  INPUT = 'input',
  CONCLUSIONS = 'conclusions',
  ORIENTATIONS = 'orientations',
  FINALIZE = 'finalize'
}

export interface ReportData {
  id?: string;
  timestamp?: number;
  rawInput: string;
  selectedBlocks: number[];
  conclusions: string;
  orientations: string;
  studentName: string;
  schoolYear: string;
  schoolLevel: string;
  currentStep?: AppStep;
}

export interface BlockOption {
  id: number;
  label: string;
  description: string;
}
