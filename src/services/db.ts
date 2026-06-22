// src/services/db.ts
const API_BASE_URL = 'https://digaf-api.onrender.com/api';

const toArray = (docs: any[]) => docs.map((doc: any) => ({ id: doc._id || doc.id, ...doc }));

async function apiRequest(endpoint: string, options: any = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.data ? JSON.stringify(options.data) : undefined,
  });
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}

export function getTodayDateString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const auth: any = {
  currentUser: null,
  onAuthStateChanged: (callback: (user: any) => void) => {
    callback(null);
    return () => { };
  }
};

export const db: any = {};

export const dbService = {
  getUsers: async () => { try { const data = await apiRequest('/users'); return toArray(data); } catch { return []; } },
  getUser: async (identifier: string) => {
    try {
      const data = await apiRequest(`/users/${encodeURIComponent(identifier)}`);
      return data ? { id: data._id, ...data } : null;
    } catch { return null; }
  },
  createUser: async (user: any) => { const data = await apiRequest('/users', { method: 'POST', data: user }); return data; },
  updateUser: async (phone: string, updates: any) => { return await apiRequest(`/users/${encodeURIComponent(phone)}`, { method: 'PUT', data: updates }); },
  subscribeUsers: (callback: (data: any[]) => void) => { dbService.getUsers().then(callback); const i = setInterval(() => dbService.getUsers().then(callback), 10000); return () => clearInterval(i); },

  getCustomers: async () => { try { const data = await apiRequest('/customers'); return toArray(data); } catch { return []; } },
  subscribeCustomers: (callback: (data: any[]) => void) => { dbService.getCustomers().then(callback); const i = setInterval(() => dbService.getCustomers().then(callback), 10000); return () => clearInterval(i); },
  addCustomer: async (customer: any) => { return await apiRequest('/customers', { method: 'POST', data: customer }); },
  updateCustomer: async (id: string, updates: any, reason?: string) => { return await apiRequest(`/customers/${encodeURIComponent(id)}`, { method: 'PUT', data: { ...updates, reason } }); },
  // Add this method to dbService (after updateCustomer, around line 55):
  deleteCustomer: async (id: string) => {
    try {
      const data = await apiRequest(`/customers/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },
  // Add this method to dbService in src/services/db.ts
importCustomers: async (text: string, status: string, addedBy: string, workspace?: string) => {
  try {
    const data = await apiRequest('/customers/import', {
      method: 'POST',
      data: { text, status, addedBy, workspace }
    });
    return data;
  } catch (error) {
    console.error('Error importing customers:', error);
    throw error;
  }
},
  subscribeAttendanceRecords: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/attendance-records'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 10000); return () => clearInterval(i); },
  saveAttendanceRecord: async (record: any) => {
  try {
    const data = await apiRequest('/attendance-records', {
      method: 'POST',
      data: record
    });
    return data;
  } catch (error) {
    console.error('Error saving attendance record:', error);
    throw error;
  }
},
  subscribeAttendanceSettings: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/attendance-settings'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 10000); return () => clearInterval(i); },

  subscribeChats: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/chats'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 5000); return () => clearInterval(i); },

  subscribeLogs: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/activity-logs'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 10000); return () => clearInterval(i); },
  subscribeActivityLogs: (callback: (data: any[]) => void) => dbService.subscribeLogs(callback),

  subscribeAIConfig: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/ai-config'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 30000); return () => clearInterval(i); },
  subscribeOfficerPermissions: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/officer-permissions'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 30000); return () => clearInterval(i); },

  subscribeSystemErrors: (callback: (data: any[]) => void) => { const f = async () => { try { const d = await apiRequest('/system-errors'); callback(toArray(d)); } catch { callback([]); } }; f(); const i = setInterval(f, 30000); return () => clearInterval(i); },
  logSystemError: async (error: any, context?: string) => { try { return await apiRequest('/system-errors', { method: 'POST', data: { error: error.message || String(error), stack: error.stack, context, timestamp: new Date().toISOString() } }); } catch { return { id: `err-${Date.now()}` }; } },
  logActivity: async (action: string, details: any) => { try { return await apiRequest('/activity-logs', { method: 'POST', data: { action, details, timestamp: new Date().toISOString() } }); } catch { return { id: `log-${Date.now()}` }; } },

  // ==================== FIRST ROUND APPLICANTS ====================

  getFirstRoundApplicants: async () => {
    try {
      const data = await apiRequest('/first-round/applicants');
      return data;
    } catch (error) {
      console.error('Error fetching first round applicants:', error);
      return [];
    }
  },

  addFirstRoundApplicants: async (applicants: any[]) => {
    try {
      const data = await apiRequest('/first-round/applicants', {
        method: 'POST',
        data: applicants
      });
      return data;
    } catch (error) {
      console.error('Error adding applicants:', error);
      throw error;
    }
  },

  updateFirstRoundApplicant: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/first-round/applicants/${id}`, {
        method: 'PUT',
        data: updates
      });
      return data;
    } catch (error) {
      console.error('Error updating applicant:', error);
      throw error;
    }
  },

  deleteFirstRoundApplicant: async (id: string) => {
    try {
      const data = await apiRequest(`/first-round/applicants/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting applicant:', error);
      throw error;
    }
  },

  archiveFirstRoundApplicants: async (applicantIds: string[], reportDate?: string, createdBy?: string) => {
    try {
      const data = await apiRequest('/first-round/archive', {
        method: 'POST',
        data: { applicantIds, reportDate, createdBy }
      });
      return data;
    } catch (error) {
      console.error('Error archiving applicants:', error);
      throw error;
    }
  },

  getFirstRoundReports: async () => {
    try {
      const data = await apiRequest('/first-round/reports');
      return data;
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
  },

  deleteFirstRoundReport: async (id: string) => {
    try {
      const data = await apiRequest(`/first-round/reports/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  },


  subscribeCorrectionRequests: (callback: (data: any[]) => void) => {
    callback([]);
    return () => { };
  },
  subscribeLeaveRequests: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeAttendanceExceptions: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeAttendanceCorrections: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeWorkAssignments: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeBackups: (callback: (data: any[]) => void) => { callback([]); return () => { }; }
};