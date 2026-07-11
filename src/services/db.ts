// src/services/db.ts
const API_BASE_URL = 'https://digaf-api.onrender.com/api';
//const API_BASE_URL = 'http://localhost:3000/api';
const toArray = (docs: any[]) => docs.map((doc: any) => {
  // If the document has both _id and id, preserve both
  // If it only has _id, use it as id
  // If it only has id, keep it
  const result = { ...doc };
  // Ensure id exists (use _id if id doesn't exist)
  if (!result.id && result._id) {
    result.id = result._id;
  }
  // Keep _id as well for reference
  return result;
});

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
  subscribeCustomers: (callback: (data: any[]) => void) => { dbService.getCustomers().then(callback); const i = setInterval(() => dbService.getCustomers().then(callback), 2000); return () => clearInterval(i); },
  addCustomer: async (customer: any) => { return await apiRequest('/customers', { method: 'POST', data: customer }); },
  updateCustomer: async (id: string, updates: any, reason?: string) => {
    try {
      return await apiRequest(`/customers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        data: { ...updates, reason }
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },
  // Add this method to dbService (after updateCustomer, around line 55):
  deleteCustomer: async (id: string) => {
    try {
      // The id passed is already the correct identifier
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

  // In src/services/db.ts, find the subscribeChats function (around line 80):
  // In db.ts, update the subscribeChats function:
  // In src/services/db.ts
  subscribeChats: (callback: (data: any[]) => void) => {

    const f = async () => {
      try {

        const d = await apiRequest('/chats');

        callback(toArray(d));
      } catch (error) {
        console.error('❌ Error fetching chats:', error);
        callback([]);
      }
    };
    f();
    const i = setInterval(f, 5000);
    return () => {

      clearInterval(i);
    };
  },

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

  // ==================== BLACKLIST ====================
  // ==================== BLACKLIST ====================
  getBlacklist: async () => {
    try {
      const data = await apiRequest('/reports/blacklist');
      return data;
    } catch (error) {
      console.error('Error fetching blacklist:', error);
      return [];
    }
  },

  // ==================== GUARANTORS ====================
  getGuarantors: async () => {
    try {
      const data = await apiRequest('/reports/guarantors');
      return data;
    } catch (error) {
      console.error('Error fetching guarantors:', error);
      return [];
    }
  },

  // ==================== NON BORROWERS ====================
  getNonBorrowers: async () => {
    try {
      const data = await apiRequest('/reports/non-borrowers');
      return data;
    } catch (error) {
      console.error('Error fetching non-borrowers:', error);
      return [];
    }
  },

  addBlacklistEntry: async (entry: any) => {
    try {
      const data = await apiRequest('/blacklist', {
        method: 'POST',
        data: entry
      });
      return data;
    } catch (error) {
      console.error('Error adding blacklist entry:', error);
      throw error;
    }
  },

  updateBlacklistEntry: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/blacklist/${id}`, {
        method: 'PUT',
        data: updates
      });
      return data;
    } catch (error) {
      console.error('Error updating blacklist entry:', error);
      throw error;
    }
  },

  deleteBlacklistEntry: async (id: string) => {
    try {
      const data = await apiRequest(`/blacklist/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting blacklist entry:', error);
      throw error;
    }
  },

  checkBlacklist: async (phoneNumber: string) => {
    try {
      const data = await apiRequest(`/blacklist/check/${encodeURIComponent(phoneNumber)}`);
      return data;
    } catch (error) {
      console.error('Error checking blacklist:', error);
      return null;
    }
  },

  // ==================== GUARANTORS ====================


  addGuarantor: async (guarantor: any) => {
    try {
      const data = await apiRequest('/guarantors', {
        method: 'POST',
        data: guarantor
      });
      return data;
    } catch (error) {
      console.error('Error adding guarantor:', error);
      throw error;
    }
  },

  updateGuarantor: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/guarantors/${id}`, {
        method: 'PUT',
        data: updates
      });
      return data;
    } catch (error) {
      console.error('Error updating guarantor:', error);
      throw error;
    }
  },

  deleteGuarantor: async (id: string) => {
    try {
      const data = await apiRequest(`/guarantors/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting guarantor:', error);
      throw error;
    }
  },

  checkDuplicateGuarantor: async (phoneNumber: string) => {
    try {
      const data = await apiRequest(`/guarantors/check/${encodeURIComponent(phoneNumber)}`);
      return data;
    } catch (error) {
      console.error('Error checking duplicate guarantor:', error);
      return null;
    }
  },
  importGuarantors: async (guarantors: any[]) => {
    try {
      const data = await apiRequest('/guarantors/import', {
        method: 'POST',
        data: { guarantors }
      });
      return data;
    } catch (error) {
      console.error('Error importing guarantors:', error);
      throw error;
    }
  },


  // ==================== NON BORROWERS ====================


  addNonBorrower: async (nonBorrower: any) => {
    try {
      const data = await apiRequest('/non-borrowers', {
        method: 'POST',
        data: nonBorrower
      });
      return data;
    } catch (error) {
      console.error('Error adding non-borrower:', error);
      throw error;
    }
  },

  updateNonBorrower: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/non-borrowers/${id}`, {
        method: 'PUT',
        data: updates
      });
      return data;
    } catch (error) {
      console.error('Error updating non-borrower:', error);
      throw error;
    }
  },

  deleteNonBorrower: async (id: string) => {
    try {
      const data = await apiRequest(`/non-borrowers/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting non-borrower:', error);
      throw error;
    }
  },
  // ==================== ACTIVE LOANS (MINDA) ====================

  getActiveLoans: async () => {
    try {
      const data = await apiRequest('/active-loans');
      return toArray(data);
    } catch (error) {
      console.error('Error fetching active loans:', error);
      return [];
    }
  },

  addActiveLoan: async (loan: any) => {
    try {
      const data = await apiRequest('/active-loans', {
        method: 'POST',
        data: loan
      });
      return data;
    } catch (error) {
      console.error('Error adding active loan:', error);
      throw error;
    }
  },

  updateActiveLoan: async (id: string, updates: any) => {
    try {
      const data = await apiRequest(`/active-loans/${id}`, {
        method: 'PUT',
        data: updates
      });
      return data;
    } catch (error) {
      console.error('Error updating active loan:', error);
      throw error;
    }
  },

  deleteActiveLoan: async (id: string) => {
    try {
      const data = await apiRequest(`/active-loans/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('Error deleting active loan:', error);
      throw error;
    }
  },

  importActiveLoans: async (loans: any[]) => {
    try {
      const data = await apiRequest('/active-loans/import', {
        method: 'POST',
        data: { loans }
      });
      return data;
    } catch (error) {
      console.error('Error importing active loans:', error);
      throw error;
    }
  },

  checkDuplicateActiveLoan: async (phoneNumber: string) => {
    try {
      const data = await apiRequest(`/active-loans/check/${encodeURIComponent(phoneNumber)}`);
      return data;
    } catch (error) {
      console.error('Error checking duplicate active loan:', error);
      return null;
    }
  },

  subscribeActiveLoans: (callback: (data: any[]) => void) => {
    const f = async () => {
      try {
        const data = await dbService.getActiveLoans();
        callback(toArray(data));
      } catch {
        callback([]);
      }
    };
    f();
    const i = setInterval(f, 5000);
    return () => clearInterval(i);
  },
  subscribeCorrectionRequests: (callback: (data: any[]) => void) => {
    callback([]);
    return () => { };
  },
  // Add these methods to dbService in src/services/db.ts

  // Get all leave requests
  getLeaveRequests: async () => {
    try {
      const data = await apiRequest('/leave-requests');
      return data;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return [];
    }
  },

  // Create a new leave request
  createLeaveRequest: async (leaveRequest: any) => {
    try {
      const data = await apiRequest('/leave-requests', {
        method: 'POST',
        data: leaveRequest
      });
      return data;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  },

  // Update a leave request (approve/reject)
  updateLeaveRequest: async (id: string, status: 'Approved' | 'Rejected', reviewedBy: string) => {
    try {
      const data = await apiRequest(`/leave-requests/${id}`, {
        method: 'PUT',
        data: { status, reviewedBy, reviewedAt: new Date().toISOString() }
      });
      return data;
    } catch (error) {
      console.error('Error updating leave request:', error);
      throw error;
    }
  },

  // Subscribe to leave requests (real-time updates)
  subscribeLeaveRequests: (callback: (data: any[]) => void) => {
    const f = async () => {
      try {
        const d = await dbService.getLeaveRequests();
        callback(d);
      } catch {
        callback([]);
      }
    };
    f();
    const i = setInterval(f, 10000);
    return () => clearInterval(i);
  },
  subscribeAttendanceExceptions: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeAttendanceCorrections: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeWorkAssignments: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  subscribeBackups: (callback: (data: any[]) => void) => { callback([]); return () => { }; },
  createGroupChat: async (groupData: any) => {
    try {
      return await apiRequest('/groups', { method: 'POST', data: groupData });
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  },
  getGroupChats: async () => {
    try {
      return await apiRequest('/groups');
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  },
  sendChatMessage: async (message: any) => {
    try {
      return await apiRequest('/chats', {
        method: 'POST',
        data: message
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  },

  markMessageAsRead: async (messageId: string) => {
    try {
      return await apiRequest(`/chats/${messageId}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  },
  deleteMessage: async (messageId: string) => {
    try {
      return await apiRequest(`/chats/${messageId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

};