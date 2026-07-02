export type CustomerStatus =
  | 'Renewal Processing'
  | 'Completed'
  | 'Paid'
  | 'Rejected'
  | 'Waiting'
  | 'No Response';

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  status: CustomerStatus;
  addedBy: string;
  addedDate: string; // ISO string
  updatedDate: string; // ISO string
  updatedBy?: string; // Who made the latest update / status shift
  followUpDate?: string; // ISO string (YYYY-MM-DD or full ISO, let's use YYYY-MM-DD for simpler followUpDate comparison)
  notes?: string;
  evidenceImage?: string; // Base64 original/scanned contract or document proof
  loanAmount?: string;
  serviceFee?: string;
  interestRate?: string;
  contractSignedDate?: string;
  contractDueDate?: string;
  isStampAffixed?: boolean;
  isSignatureAffixed?: boolean;
  workspace?: 'first_round' | 'second_round'; // Assigned Round Workspace
}

export interface ActivityLog {
  id: string;
  customerName: string;
  previousStatus: CustomerStatus;
  newStatus: CustomerStatus;
  updatedBy: string;
  timestamp: string; // ISO string
}

export interface User {
  phoneNumber: string; // Document ID
  fullName: string;
  passwordHash?: string; // Kept as optional for MongoDB
  status: 'active' | 'deactive';
  role: 'super_admin' | 'admin' | 'employee' | 'FTD' | 'Contact Center'; // System Roles
  isSuperAdmin?: boolean;
  systemProtected?: boolean;
  createdAt: string;
  customRole?: string; // Legacy support
  businessRole?: string; // Business Roles: Senior Digital KYC Officer, etc.
  workspace?: 'first_round' | 'second_round' | 'both' | 'attendance' | 'chat' | 'attendance_chat';// Workspace Routing
  hasRenewalTrackerAccess?: boolean; // Toggles whether they see Renewal modules
  deviceSignature?: string;
  deviceRegistrationDate?: string;
  deviceApproved?: boolean;
  deviceApprovalStatus?: 'Pending' | 'Approved' | 'Blocked' | 'Stay Blocked';
  deviceApprovedBy?: string;
  deviceApprovedDate?: string;
  deviceApprovalReason?: string;
  approvedBy?: string; // Store approvedBy, approvedDate, approvalReason
  approvedDate?: string;
  approvalReason?: string;
  deviceInfo?: string;
  email?: string; // Real email for auth/password reset
  originalId?: string; // For account deduplication and merging
  normalizedId?: string; // Standardized local phone number format
  registeredSelfieUrl?: string; // Registered reference face image URL
  forcePasswordChange?: boolean; // Forced password change at next login
  tempPassword?: string; // Stored temporary password if reset


  permissions?: {
    canViewFirstRound: boolean;
    canViewSecondRound: boolean;
    canViewAttendance: boolean;
    canViewChat: boolean;
    canViewCustomers: boolean;
    canViewReports: boolean;
    canManageUsers: boolean;
    canViewAI: boolean;
  };
}

export const STATUS_LIST: CustomerStatus[] = [
  'Renewal Processing',
  'Completed',
  'Paid',
  'Waiting',
  'Rejected',
  'No Response'
];

export const STATUS_COLORS: Record<CustomerStatus, { bg: string; text: string; border: string; accent: string }> = {
  'Renewal Processing': {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    accent: 'bg-[#8B5CF6]'
  },
  'Completed': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    accent: 'bg-[#22C55E]'
  },
  'Paid': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    accent: 'bg-[#4F46E5]'
  },
  'Rejected': {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#B91C1C]',
    border: 'border-[#FEE2E2]',
    accent: 'bg-[#EF4444]'
  },
  'Waiting': {
    bg: 'bg-[#FFFBEB]',
    text: 'text-[#B45309]',
    border: 'border-[#FEF3C7]',
    accent: 'bg-[#F59E0B]'
  },
  'No Response': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    accent: 'bg-[#F59E0B]'
  }
};

export interface AIConfig {
  id: string; // 'global_config'
  featuresEnabled: boolean;
  customerBriefEnabled: boolean;
  dailyExecutiveReportEnabled: boolean;
  stuckCaseDetectorEnabled: boolean;
  followUpRecommendationEnabled: boolean;
  officerPerformanceEnabled: boolean;
  priorityQueueEnabled: boolean;
  aiReportSummarizationEnabled: boolean;
  imageGenerationEnabled: boolean;
  assistantPanelEnabled: boolean;
  stuckDaysThreshold: number;
}

export interface OfficerAIPermission {
  phoneNumber: string; // Operator phone number
  fullName: string;
  customerBriefAllowed: boolean;
  imageGenerationAllowed: boolean;
  assistantPanelAllowed: boolean;
  aiReportsAllowed: boolean;
}

export interface AIUsageLog {
  id: string;
  username: string; // Display name or phoneNumber
  phoneNumber: string;
  feature: string;
  action: string;
  timestamp: string; // ISO String
}

export type AttendanceStatus =
  | 'Present'
  | 'Late'
  | 'Very Late'
  | 'VERY LATE'
  | 'Absent'
  | 'Afternoon Present'
  | 'Afternoon Late'
  | 'Permission'
  | 'Emergency Leave'
  | 'Field Work'
  | 'Pending Approval'
  | 'New Device Pending Approval'
  | 'Admin Approval Required'
  | 'Afternoon Admin Approval Required'
  | 'OFFLINE PENDING SYNC'
  | 'OFFLINE TIME ANOMALY'
  | 'SYNCED FROM OFFLINE';

export interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeRole: string;
  phoneNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  attendanceType: 'Morning' | 'Afternoon';
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    distanceText?: string;
    isInside?: boolean;
  };
  deviceInformation: string;
  status: AttendanceStatus;
  syncSource?: string;
  managerReviewRequired?: boolean;
  localDeviceTime?: string;
  syncArrivalTime?: string;
  serverTimeAtSync?: string;
  networkName?: string;
  networkVerificationStatus?: string;
  selfieImageUrl?: string;
  verificationResult?: string;
  offlineCalculatedStatus?: string; // Originally-evaluated attendance status during offline capture
}

export interface AttendanceSettings {
  id: string; // 'office_config'
  latitude: number;
  longitude: number;
  radius: number; // in meters (default 10)
  updatedBy: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeName: string;
  phoneNumber: string;
  employeeRole: string;
  type: 'Permission' | 'Emergency Leave' | 'Field Work';
  date: string; // YYYY-MM-DD
  reason: string;
  notes: string;
  destination?: string; // field work destination
  expectedReturnTime?: string; // field work expected return text
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp: string; // ISO string
}

export interface WorkAssignment {
  id?: string;
  title?: string;
  description?: string;
  assignedTo: string; // Employee phone or "Unassigned"
  assignedToName?: string; // Cache employee name for fast rendering
  priority: 'High' | 'Medium' | 'Low' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline?: string; // YYYY-MM-DD
  reminder?: string | boolean; // HH:MM or boolean
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Deferred' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | string;
  notes?: string;
  source?: 'Telegram' | 'Call Center 6575' | 'First Round' | 'Second Round' | string;
  customerName?: string;
  customerPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  workspace?: 'first_round' | 'second_round' | 'all' | 'both' | string;
}

export interface SystemErrorLog {
  id: string;
  timestamp: string;
  errorName: string;
  errorMessage: string;
  stack?: string;
  userId?: string;
  userPhone?: string;
  path?: string;
}

export interface AttendanceException {
  id: string;
  date: string;
  employeeName: string;
  employeePhone: string;
  employeeRole: string;
  device: string;
  location: string;
  exceptionType:
  | 'Outside Office Attempt'
  | 'GPS Accuracy Failure'
  | 'New Device Attempt'
  | 'Device Approval Pending'
  | 'Duplicate Attendance Attempt'
  | 'Offline Attendance Sync'
  | 'Late Attendance'
  | 'Very Late Attendance'
  | 'Manual Attendance Correction'
  | 'Time Manipulation Attempt'
  | 'Clock Synchronization Failure'
  | 'Geofence Rejection'
  | 'OFFLINE TIME ANOMALY'
  | 'ACCOUNT SHARING SUSPECTED'
  | 'ACCOUNT SHARING BLOCKED'
  | 'ADMIN SECURITY RECOVERY'
  | 'No Face Detected'
  | 'Multiple Faces Detected'
  | 'Camera Permission Denied'
  | 'Poor Image Quality'
  | 'Selfie Verification Failed';
  actionTaken: string;
  timestamp: string;
}

export interface BackupSnapshot {
  id: string; // "backup-YYYYMMDD-HHMMSS"
  createdAt: string;
  createdBy: string;
  description: string;
  attendanceCount: number;
  employeesCount: number;
  renewalsCount: number;
  logsCount: number;
  data: {
    attendance: AttendanceRecord[];
    employees: User[];
    renewals: Customer[];
    logs: ActivityLog[];
  };
}

export interface AttendanceCorrectionRequest {
  id: string;
  employeeName: string;
  employeePhone: string;
  date: string; // YYYY-MM-DD
  reason: string;
  requestedBy: string;
  requestedAt: string; // ISO string
  approvedBy?: string;
  approvedDate?: string; // ISO string
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  receiver: string;
  workspace: string;
  content: string;
  createdAt: string;
  read: boolean;
}

// Add to src/types.ts
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

// ==================== BLACKLIST ====================
export interface BlacklistEntry {
  id: string;
  fullName: string;
  phoneNumber: string;
  reason: string;
  dateAdded: string;
  addedBy: string;
  notes: string;
  status: 'Blocked' | 'Approved';
  createdAt?: string;
  updatedAt?: string;
}

// ==================== GUARANTOR ====================
export interface Guarantor {
  id: string;
  guarantorName: string;
  phoneNumber: string;
  customerName: string;
  customerId: string;
  assignmentDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired';
  createdAt?: string;
  updatedAt?: string;
}

// ==================== NON BORROWER ====================
export interface NonBorrower {
  id: string;
  fullName: string;
  phoneNumber: string;
  workPosition: string;
  company: string;
  notes: string;
  dateAdded: string;
  createdAt?: string;
  updatedAt?: string;
}
// Add these types after the existing interfaces in src/types.ts

// ==================== EARLY PAYMENT CLOSURE ====================
export interface EarlyPaymentRecord {
  id: string;
  customerName: string;
  phoneNumber: string;
  loanId?: string;
  totalInstallments: number;
  currentInstallment: number;
  status: 'Partial' | 'Fully Closed' | 'Pending';
  receipts: PaymentReceipt[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  financeVerifiedBy?: string;
  financeVerifiedAt?: string;
}

export interface PaymentReceipt {
  id: string;
  installmentNumber: number;
  receiptUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface EarlyPaymentSettings {
  id: string;
  autoReminderDays: number;
  reminderMessage: string;
  financeApprovalRequired: boolean;
  updatedBy: string;
  updatedAt: string;
}
// ==================== NOTIFICATIONS ====================
// ==================== NOTIFICATIONS ====================
export interface Notification {
  id: string;
  userId: string;
  type: 'personal_message' | 'group_message' | 'mention' | 'admin_announcement' | 'finance_approval' | 'system_alert';
  title: string;
  message: string;
  read: boolean;
  relatedId?: string;
  relatedType?: 'chat' | 'customer' | 'leave' | 'attendance' | 'payment';
  createdAt: string;
  readAt?: string;
}