// src/components/FirstRound/FirstRoundTypes.ts
export interface FirstRoundApplicant {
  id: string;
  referenceId: string;
  name: string;
  bank: string;
  position: string;
  branch: string;
  phoneNumber: string;
  notes: string;
  status: 'pending' | 'completed' | 'archived';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface FirstRoundReport {
  id: string;
  reportDate: string;
  totalRecords: number;
  items: FirstRoundApplicant[];
  createdAt: string;
  createdBy: string;
}