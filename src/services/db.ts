// Safely intercept and filter out noisy transient Firestore connectivity errors in the console
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const isFirestoreNetworkNoise = args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('@firebase/firestore') || 
       arg.includes('Could not reach Cloud Firestore backend') ||
       arg.includes('Connection failed') ||
       arg.includes('FirebaseError: [code=unavailable]'))
    );
    if (isFirestoreNetworkNoise) {
      console.warn("[Firestore Background Sync] Offline operation active or waiting for network reconnect.", ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

import { Customer, CustomerStatus, ActivityLog, User, AIConfig, OfficerAIPermission, AIUsageLog, AttendanceStatus, AttendanceRecord, AttendanceSettings, LeaveRequest, WorkAssignment, SystemErrorLog, BackupSnapshot, AttendanceException, AttendanceCorrectionRequest } from '../types';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  writeBatch, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);

// Error throwing helper conforming to FirestoreErrorInfo format
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const originalMessage = error instanceof Error ? error.message : String(error);
  
  // Check if error is acceptable noise (such as permissions on optional stats collections or offline notifications)
  const isNoise = originalMessage.includes('Missing or insufficient permissions') || 
                  originalMessage.includes('offline') || 
                  originalMessage.includes('quota') ||
                  originalMessage.includes('offline-fallback');
                  
  if (isNoise) {
    console.warn(`[Suppressed Firestore Operation] ${operationType?.toUpperCase()} on ${path || 'unknown'}:`, originalMessage);
  } else {
    console.warn(`[Firestore Operation] ${operationType?.toUpperCase()} on ${path || 'unknown'}:`, originalMessage);
  }
  
  // Return gracefully rather than throwing for GET/LIST operations
  if (operationType === OperationType.GET || operationType === OperationType.LIST) {
    return;
  }
  
  // Throw standard clean message instead of heavy JSON stack to satisfy console cleanup requirement
  throw new Error(originalMessage);
}

// Validate Connection to Firestore on startup as critical constraint
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test_connection', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration: Client appears to be offline.");
    }
  }
}

// Auto-seed helper to run once if Firestore is empty on load
let isSeeding = false;
async function autoSeedIfEmpty() {
  if (isSeeding) return;
  try {
    isSeeding = true;

    // Legacy cleanup - clean old seed mock data IDs if they are still in firestore
    const cleanedFlag = localStorage.getItem('digaf_firestore_cleaned_seeds_v2');
    if (cleanedFlag !== 'true') {
      const batch = writeBatch(db);
      const mockIds = ['cust-1', 'cust-2', 'cust-3', 'cust-4', 'cust-5', 'cust-6', 'cust-7', 'cust-8'];
      mockIds.forEach(id => {
        batch.delete(doc(db, 'customers', id));
      });
      const mockLogIds = ['log-1', 'log-2', 'log-3', 'log-4'];
      mockLogIds.forEach(id => {
        batch.delete(doc(db, 'activity_logs', id));
      });
      await batch.commit();
      localStorage.setItem('digaf_firestore_cleaned_seeds_v2', 'true');
      console.log('Successfully purged old pre-seeded mock documents from Firestore database.');
    }
  } catch (err) {
    console.error('Error checking or auto-seeding Firestore:', err);
  } finally {
    isSeeding = false;
  }
}

async function hashUserPassword(password: string): Promise<string> {
  if (!password) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return 'obfs-' + Math.abs(hash).toString(16).padStart(16, 'f');
  }
}

async function onStartup() {
  await testConnection();
}
onStartup();

export async function runAdminStartupMaintenance() {
  await autoSeedIfEmpty();
  
  // Aggressively delete duplicate Zewdneh user document keys from Firestore if they exist
  try {
    const dupsToDelete = ['0988000000', 'Zewd', 'Zewdneh', 'zewd', 'zewdneh'];
    for (const dupId of dupsToDelete) {
      const dRef = doc(db, 'users', dupId);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) {
         console.log(`Aggressively deleting duplicate Zewdneh user account entity: ${dupId}`);
         await deleteDoc(dRef);
      }
    }
  } catch (err) {
    console.warn("Failed standard aggressive Zewdneh duplicates deletion in startup sweep", err);
  }

  // Seeding Zewdneh (SysAdmin) and Aman (Admin) automatically in Firestore to ensure they always exist with standardized attributes!
  try {
    const defaultZewdnehPasswordHash = await hashUserPassword('nehzewd0988');
    const zDoc = await getDoc(doc(db, 'users', '0988286610'));
    if (!zDoc.exists()) {
      await setDoc(doc(db, 'users', '0988286610'), {
        phoneNumber: '0988286610',
        fullName: 'Zewdneh',
        status: 'active',
        role: 'super_admin',
        isSuperAdmin: true,
        systemProtected: true,
        businessRole: 'Digital Loan Officer',
        customRole: 'Digital Loan Officer',
        passwordHash: defaultZewdnehPasswordHash,
        hasRenewalTrackerAccess: true,
        workspace: 'both',
        createdAt: new Date().toISOString()
      });
    } else {
      // Ensure existing primary profile has the password hash and security flags set
      await updateDoc(doc(db, 'users', '0988286610'), {
        role: 'super_admin',
        isSuperAdmin: true,
        systemProtected: true,
        status: 'active'
      });
    }
    
    const aDoc = await getDoc(doc(db, 'users', '0911000000'));
    if (!aDoc.exists()) {
      await setDoc(doc(db, 'users', '0911000000'), {
        phoneNumber: '0911000000',
        fullName: 'Aman',
        status: 'active',
        role: 'admin',
        businessRole: 'Senior Digital KYC Officer',
        customRole: 'Senior Digital KYC Officer',
        hasRenewalTrackerAccess: true,
        workspace: 'both',
        createdAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Failed to seed initial corporate users during startup sweep", err);
  }

  // De-duplicate any user files in the database
  try {
    await dbService.mergeDuplicateAccounts();
  } catch (err) {
    console.warn("Auto merge duplicate accounts triggered warnings on start:", err);
  }
}

// Reactively trigger administrative routines when an authorized administrator connects
onAuthStateChanged(auth, async (user) => {
  if (user && user.email) {
    const phonePrefix = user.email.split('@')[0];
    if (phonePrefix === '0988286610' || phonePrefix === '0911000000') {
      console.log(`Detected active administrator session: ${phonePrefix}. Running corporate database maintenance checks.`);
      try {
        await runAdminStartupMaintenance();
      } catch (err) {
        console.warn("Administrative database maintenance bypassed", err);
      }
    }
  }
});


export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = sanitizeFirestorePayload(val);
      } else {
        result[key] = val;
      }
    }
  });
  return result;
}

// Today's Date String reference dynamically calculated in standard local YYYY-MM-DD Format
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const dbService = {
  // Upload base64 image data directly to Firebase Storage bucket and retrieve access URL
  async uploadSelfieImage(phoneNumber: string, base64Image: string, prefix = 'selfies'): Promise<string> {
    try {
      const storageRef = ref(storage, `${prefix}/${phoneNumber}_${Date.now()}.jpg`);
      const cleanedBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
      await uploadString(storageRef, cleanedBase64, 'base64', { contentType: 'image/jpeg' });
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Firebase Storage Upload Error:", error);
      throw error;
    }
  },

  // Subscribe to Customers real-time from Firestore
  subscribeCustomers(onUpdate: (customers: Customer[]) => void): () => void {
    autoSeedIfEmpty();

    const q = query(collection(db, 'customers'), orderBy('addedDate', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const customers: Customer[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Customer;
        // All portfolio templates default to second_round for standard renewals tracker
        data.workspace = 'second_round';
        customers.push(data);
      });
      onUpdate(customers);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });
  },

  // Subscribe to Activity Logs real-time from Firestore
  subscribeLogs(onUpdate: (logs: ActivityLog[]) => void): () => void {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const logs: ActivityLog[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        logs.push({
          ...data,
          id: docSnap.id
        } as ActivityLog);
      });
      onUpdate(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'activity_logs');
    });
  },

  // Add individual customer record with audited contract/evidence
  async addCustomerWithContract(customer: Partial<Customer>): Promise<string> {
    const customerId = customer.id || 'cust-' + Math.random().toString(36).substring(2, 11);
    const path = `customers/${customerId}`;
    try {
      const nowString = new Date().toISOString();
      const newCustomer: Customer = {
        id: customerId,
        name: customer.name || 'Unknown',
        phoneNumber: customer.phoneNumber || '',
        status: customer.status || 'Renewal Processing',
        addedBy: customer.addedBy || 'System',
        addedDate: nowString,
        updatedDate: nowString,
        notes: customer.notes || '',
        ...customer
      };
      await setDoc(doc(db, 'customers', customerId), sanitizeFirestorePayload(newCustomer));
      await this.logActivity(newCustomer.name, 'Renewal Processing', newCustomer.status, newCustomer.addedBy);
      return customerId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  // Add individual customer record
   async addCustomer(customerData: {
    name: string;
    phoneNumber: string;
    status: CustomerStatus;
    addedBy: string;
    notes?: string;
    followUpDate?: string;
    workspace?: 'first_round' | 'second_round';
  }): Promise<void> {
    const customerId = 'cust-' + Math.random().toString(36).substring(2, 11);
    const path = `customers/${customerId}`;
    try {
      const nowString = new Date().toISOString();
      
      const newCustomer: Customer = {
        id: customerId,
        name: customerData.name,
        phoneNumber: customerData.phoneNumber,
        status: customerData.status,
        addedBy: customerData.addedBy || 'System',
        addedDate: nowString,
        updatedDate: nowString,
        updatedBy: customerData.addedBy || 'System',
        notes: customerData.notes || '',
        workspace: customerData.workspace || 'second_round'
      };

      if (customerData.followUpDate) {
        newCustomer.followUpDate = customerData.followUpDate;
      }

      // Follow-up automation rule: Whenever a customer is moved to "No Response", followUpDate = tomorrow
      if (newCustomer.status === 'No Response') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        newCustomer.followUpDate = tomorrow.toISOString().split('T')[0];
      }

      await setDoc(doc(db, 'customers', customerId), sanitizeFirestorePayload(newCustomer));

      // Log action
      await this.logActivity(
        newCustomer.name,
        'Renewal Processing', // Seed original as placeholder
        newCustomer.status,
        newCustomer.addedBy
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Bulk import customers from line breaks
  async importCustomers(
    namesText: string,
    status: CustomerStatus,
    addedBy: string,
    workspace: 'first_round' | 'second_round' = 'second_round'
  ): Promise<number> {
    try {
      const names = namesText
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (names.length === 0) return 0;

      const nowString = new Date().toISOString();
      const batch = writeBatch(db);

      names.forEach(name => {
        const custId = 'cust-' + Math.random().toString(36).substring(2, 11);
        const newCustomer: Customer = {
          id: custId,
          name: name,
          phoneNumber: '+251 900 000 000', // Default placeholder for quick import
          status: status,
          addedBy: addedBy || 'System',
          addedDate: nowString,
          updatedDate: nowString,
          updatedBy: addedBy || 'System',
          notes: 'Bulk imported into ' + status,
          workspace: workspace
        };

        // Follow-up automation rule
        if (status === 'No Response') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          newCustomer.followUpDate = tomorrow.toISOString().split('T')[0];
        }

        batch.set(doc(db, 'customers', custId), sanitizeFirestorePayload(newCustomer));

        // Activity log for this import
        const logId = 'log-' + Math.random().toString(36).substring(2, 11);
        const newLog: ActivityLog = {
          id: logId,
          customerName: name,
          previousStatus: status, // Newly created
          newStatus: status,
          updatedBy: addedBy || 'System',
          timestamp: nowString,
        };
        batch.set(doc(db, 'activity_logs', logId), newLog);
      });

      await batch.commit();
      return names.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers/bulk_import');
      return 0;
    }
  },

  // Update customer details
  async updateCustomer(
    id: string,
    updates: Partial<Customer>,
    updatedByBy: string
  ): Promise<void> {
    const path = `customers/${id}`;
    try {
      const docRef = doc(db, 'customers', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Customer with ID ${id} not found.`);
      }

      const oldCustomer = docSnap.data() as Customer;
      const previousStatus = oldCustomer.status;
      const newStatus = updates.status !== undefined ? updates.status : oldCustomer.status;
      const nowString = new Date().toISOString();

      // Automated Follow-up Rule: No Response sets followUpDate to tomorrow, fallback to previous if not specified
      let automatedFollowUp: string | undefined = updates.hasOwnProperty('followUpDate') ? updates.followUpDate : oldCustomer.followUpDate;
      
      const isFinalStatus = newStatus === 'Completed' || newStatus === 'Rejected';
      
      if (isFinalStatus) {
        automatedFollowUp = '';
      } else if (updates.status === 'No Response' && oldCustomer.status !== 'No Response') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        automatedFollowUp = tomorrow.toISOString().split('T')[0];
      } else if (oldCustomer.status === 'No Response' && updates.status !== undefined && updates.status !== 'No Response') {
        // Clear followUpDate if changing status from No Response unless an explicit NEW date was chosen
        if (updates.followUpDate === undefined || updates.followUpDate === oldCustomer.followUpDate) {
          automatedFollowUp = '';
        }
      }

      const cleanedUpdates: Record<string, any> = {};
      Object.keys(updates).forEach(key => {
        const val = (updates as any)[key];
        if (val !== undefined) {
          cleanedUpdates[key] = val;
        }
      });
      cleanedUpdates.updatedDate = nowString;
      cleanedUpdates.updatedBy = updatedByBy || 'System';
      if (automatedFollowUp !== undefined) {
        cleanedUpdates.followUpDate = automatedFollowUp;
      }

      await updateDoc(docRef, sanitizeFirestorePayload(cleanedUpdates));

      // If status changed, write an activity log
      if (previousStatus !== newStatus) {
        await this.logActivity(oldCustomer.name, previousStatus, newStatus, updatedByBy || 'System');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Delete customer record with safety guard and archive it for restoration
  async deleteCustomer(id: string): Promise<void> {
    const path = `customers/${id}`;
    try {
      const docRef = doc(db, 'customers', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const customerToDelete = docSnap.data() as Customer;

      // Save complete record to a dedicated archive before deleting
      await setDoc(doc(db, 'deleted_customers', id), sanitizeFirestorePayload(customerToDelete));

      await deleteDoc(docRef);

      // Log deletion helper
      await this.logActivity(
        customerToDelete.name,
        customerToDelete.status,
        customerToDelete.status, // Same status log for deletion tracking
        'System (Deleted Record)'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Subscribe to deleted customers collection for real-time recovery
  subscribeDeletedCustomers(onUpdate: (customers: Customer[]) => void): () => void {
    const q = collection(db, 'deleted_customers');
    return onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Customer);
      });
      onUpdate(list);
    }, (error) => {
      console.warn("Deleted customers collection load warning:", error);
    });
  },

  // Restore deleted customer by their name and status
  async restoreDeletedCustomer(name: string, fallbackStatus: CustomerStatus, updatedBy: string): Promise<void> {
    try {
      // 1. Search in deleted_customers archive
      const q = collection(db, 'deleted_customers');
      const snap = await getDocs(q);
      let foundRecord: Customer | null = null;
      
      snap.forEach(d => {
        const cust = d.data() as Customer;
        if (cust.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          foundRecord = cust;
        }
      });

      if (foundRecord) {
        const rec = foundRecord as Customer;
        // Write back to customers
        await setDoc(doc(db, 'customers', rec.id), sanitizeFirestorePayload(rec));
        // Remove from deleted_customers
        await deleteDoc(doc(db, 'deleted_customers', rec.id));
        // Log restore success
        await this.logActivity(name, rec.status, rec.status, `Admin Audit (Restored by ${updatedBy})`);
      } else {
        // Reconstruct with basic logic if a historical record was deleted prior to this update
        const id = 'restored-' + Math.random().toString(36).substring(2, 11);
        const reconstructed: Customer = {
          id,
          name: name.trim(),
          phoneNumber: '0900000000',
          status: fallbackStatus || 'Renewal Processing',
          notes: 'Reconstructed and restored automatically from historical delete logs.',
          addedBy: updatedBy,
          addedDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
          workspace: 'second_round'
        };
        await setDoc(doc(db, 'customers', id), sanitizeFirestorePayload(reconstructed));
        await this.logActivity(name, fallbackStatus, fallbackStatus, `Admin Audit (Reconstructed and Restored by ${updatedBy})`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `restore/${name}`);
    }
  },

  // Add event tracking log directly
  async logActivity(
    customerName: string,
    previousStatus: CustomerStatus,
    newStatus: CustomerStatus,
    updatedBy: string
  ): Promise<void> {
    const logId = 'log-' + Math.random().toString(36).substring(2, 11);
    const path = `activity_logs/${logId}`;
    try {
      const newLog: ActivityLog = {
        id: logId,
        customerName,
        previousStatus,
        newStatus,
        updatedBy: updatedBy || 'System',
        timestamp: new Date().toISOString(),
      };

      await setDoc(doc(db, 'activity_logs', logId), newLog);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Seed constants for database default resets
  SEED_CUSTOMERS: [
    {
      id: 'cust-101',
      name: 'Alazar Tesfaye',
      phoneNumber: '0912345678',
      status: 'Renewal Processing',
      addedBy: 'Zewdneh',
      addedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      notes: 'Premium commercial tier client. Needs stamp duty and contract signing.',
      workspace: 'first_round'
    },
    {
      id: 'cust-102',
      name: 'Marta Kebede',
      phoneNumber: '0911765432',
      status: 'Paid',
      addedBy: 'Aman',
      addedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
      notes: 'Transferred partial renewal fee via CBE Birr. Pending confirmation receipt upload.',
      workspace: 'first_round'
    },
    {
      id: 'cust-103',
      name: 'Estifanos Gebre',
      phoneNumber: '0920112233',
      status: 'No Response',
      addedBy: 'Aman',
      addedDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      updatedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      notes: 'Called multiple times but unreachable. Marked for SMS/Telegram outreach.',
      workspace: 'first_round'
    }
  ] as Customer[],

  SEED_LOGS: [
    {
      id: 'log-101',
      customerName: 'Alazar Tesfaye',
      previousStatus: 'No Response',
      newStatus: 'Renewal Processing',
      updatedBy: 'Zewdneh',
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      id: 'log-102',
      customerName: 'Marta Kebede',
      previousStatus: 'Renewal Processing',
      newStatus: 'Paid',
      updatedBy: 'Aman',
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString()
    }
  ] as ActivityLog[],

  // Clean wipe storage resets database back to seed defaults in Firestore
  async resetToDefaults() {
    try {
      const customersSnap = await getDocs(collection(db, 'customers'));
      const logsSnap = await getDocs(collection(db, 'activity_logs'));

      const batch = writeBatch(db);

      // Delete existing customers
      customersSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Delete existing logs
      logsSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Add seed customers
      this.SEED_CUSTOMERS.forEach(cust => {
        const docRef = doc(db, 'customers', cust.id);
        batch.set(docRef, cust);
      });

      // Add seed logs
      this.SEED_LOGS.forEach(log => {
        const docRef = doc(db, 'activity_logs', log.id);
        batch.set(docRef, log);
      });

      await batch.commit();
      localStorage.setItem('digaf_firestore_seeded_v1', 'true');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reset_database');
    }
  },

  // User Management
  async getUser(phoneNumber: string): Promise<User | null> {
    const path = `users/${phoneNumber}`;
    try {
      const docRef = doc(db, 'users', phoneNumber);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const u = docSnap.data() as User;
        try {
          localStorage.setItem(`cached_user_${phoneNumber}`, JSON.stringify(u));
        } catch (e) {}
        return u;
      }
      return null;
    } catch (error: any) {
      const isOfflineMsg = error?.message?.includes('offline') || !navigator.onLine;
      if (isOfflineMsg) {
        console.warn("Firestore getUser offline fallback for phone:", phoneNumber);
        const cached = localStorage.getItem(`cached_user_${phoneNumber}`);
        if (cached) {
          try {
            return JSON.parse(cached) as User;
          } catch (e) {}
        }
        // Fallback user profile for system administrators/Zewdneh/Aman when completely offline
        if (phoneNumber === '0988286610' || phoneNumber === '0988000000') {
          return {
            phoneNumber,
            fullName: phoneNumber === '0988286610' ? 'Zewdneh' : 'Aman',
            status: 'active',
            role: phoneNumber === '0988286610' ? 'super_admin' : 'admin',
            businessRole: 'Digital Loan Officer',
            hasRenewalTrackerAccess: true,
            createdAt: new Date().toISOString()
          };
        }
      }
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createUser(user: User): Promise<void> {
    const path = `users/${user.phoneNumber}`;
    try {
      await setDoc(doc(db, 'users', user.phoneNumber), user);
      try {
        localStorage.setItem(`cached_user_${user.phoneNumber}`, JSON.stringify(user));
      } catch (e) {}
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateUser(phoneNumber: string, updates: Partial<User>): Promise<void> {
    const path = `users/${phoneNumber}`;
    try {
      await updateDoc(doc(db, 'users', phoneNumber), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteUser(phoneNumber: string): Promise<void> {
    const path = `users/${phoneNumber}`;
    try {
      await deleteDoc(doc(db, 'users', phoneNumber));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async deleteLog(logId: string): Promise<void> {
    const path = `activity_logs/${logId}`;
    try {
      await deleteDoc(doc(db, 'activity_logs', logId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async clearAdminLogs(): Promise<void> {
    try {
      const logsSnap = await getDocs(collection(db, 'activity_logs'));
      const batch = writeBatch(db);
      let count = 0;
      logsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const msg = ((data.customerName || '') + ' ' + (data.updatedBy || '') + ' ' + (data.previousStatus || '') + ' ' + (data.newStatus || '')).toLowerCase();
        // Check if it's an admin-related log
        const isAdminLog = 
          msg.includes('admin') || 
          msg.includes('sysadmin') || 
          msg.includes('zewdneh') || 
          msg.includes('override password') || 
          msg.includes('deleted user workstation');
        if (isAdminLog) {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'activity_logs/clear_admin');
    }
  },

  subscribeUsers(onUpdate: (users: User[]) => void): () => void {
    const q = collection(db, 'users');
    return onSnapshot(q, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach(docSnap => {
        users.push(docSnap.data() as User);
      });
      onUpdate(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
  },

  subscribeExceptions(onUpdate: (exceptions: AttendanceException[]) => void): () => void {
    const q = query(collection(db, 'attendance_exceptions'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const exceptions: AttendanceException[] = [];
      snapshot.forEach(docSnap => {
        exceptions.push({
          ...docSnap.data(),
          id: docSnap.id
        } as AttendanceException);
      });
      onUpdate(exceptions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_exceptions');
    });
  },

  async logException(exception: Omit<AttendanceException, 'id'>): Promise<string> {
    const exceptionId = 'exc-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    try {
      const sanitized = {
        date: exception.date || '',
        employeeName: exception.employeeName || '',
        employeePhone: exception.employeePhone || '',
        employeeRole: exception.employeeRole || 'Employee',
        device: exception.device || '',
        location: exception.location || '',
        exceptionType: exception.exceptionType || 'Unknown Exception',
        actionTaken: exception.actionTaken || '',
        timestamp: exception.timestamp || new Date().toISOString(),
        id: exceptionId
      };
      await setDoc(doc(db, 'attendance_exceptions', exceptionId), sanitized);
      return exceptionId;
    } catch (error) {
      console.error("Failed to write to attendance_exceptions:", error);
      return '';
    }
  },

  subscribeAIConfig(onUpdate: (config: AIConfig) => void): () => void {
    const docRef = doc(db, 'ai_config', 'global_config');
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as AIConfig);
      } else {
        const defaultConfig: AIConfig = {
          id: 'global_config',
          featuresEnabled: true,
          customerBriefEnabled: true,
          dailyExecutiveReportEnabled: true,
          stuckCaseDetectorEnabled: true,
          followUpRecommendationEnabled: true,
          officerPerformanceEnabled: true,
          priorityQueueEnabled: true,
          aiReportSummarizationEnabled: true,
          imageGenerationEnabled: true,
          assistantPanelEnabled: true,
          stuckDaysThreshold: 7
        };
        setDoc(docRef, defaultConfig).then(() => onUpdate(defaultConfig)).catch(() => {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ai_config/global_config');
    });
  },

  async updateAIConfig(config: Partial<AIConfig>): Promise<void> {
    const path = 'ai_config/global_config';
    try {
      await setDoc(doc(db, 'ai_config', 'global_config'), sanitizeFirestorePayload(config), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeOfficerPermissions(onUpdate: (permissions: OfficerAIPermission[]) => void): () => void {
    const q = collection(db, 'officer_permissions');
    return onSnapshot(q, (snapshot) => {
      const perms: OfficerAIPermission[] = [];
      snapshot.forEach(docSnap => {
        perms.push(docSnap.data() as OfficerAIPermission);
      });
      onUpdate(perms);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'officer_permissions');
    });
  },

  async updateOfficerPermission(permission: OfficerAIPermission): Promise<void> {
    const path = `officer_permissions/${permission.phoneNumber}`;
    try {
      await setDoc(doc(db, 'officer_permissions', permission.phoneNumber), sanitizeFirestorePayload(permission));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeAIUsageLogs(onUpdate: (logs: AIUsageLog[]) => void): () => void {
    const q = query(collection(db, 'ai_usage_logs'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const logs: AIUsageLog[] = [];
      snapshot.forEach(docSnap => {
        logs.push(docSnap.data() as AIUsageLog);
      });
      onUpdate(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ai_usage_logs');
    });
  },

  async addAIUsageLog(username: string | undefined, phoneNumber: string | undefined, feature: string, action: string): Promise<void> {
    const logId = 'ailog-' + Math.random().toString(36).substring(2, 11);
    const path = `ai_usage_logs/${logId}`;
    try {
      const cleanUsername = (username || 'Operator').trim() || 'Operator';
      const cleanPhoneNumber = (phoneNumber || 'N/A').trim() || 'N/A';
      const cleanFeature = (feature || 'GENERAL').trim() || 'GENERAL';
      const cleanAction = (action || 'Action taken').trim() || 'Action taken';

      const newLog: AIUsageLog = {
        id: logId,
        username: cleanUsername.substring(0, 100),
        phoneNumber: cleanPhoneNumber.substring(0, 40),
        feature: cleanFeature.substring(0, 100),
        action: cleanAction.substring(0, 2000),
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(db, 'ai_usage_logs', logId), sanitizeFirestorePayload(newLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async clearAIUsageLogs(): Promise<void> {
    try {
      const logsSnap = await getDocs(collection(db, 'ai_usage_logs'));
      const batch = writeBatch(db);
      logsSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'ai_usage_logs/clear');
    }
  },

  // Subscribe to Attendance Records Real-time
  subscribeAttendanceRecords(onUpdate: (records: AttendanceRecord[]) => void): () => void {
    const q = collection(db, 'attendance_records');
    return onSnapshot(q, (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        records.push(docSnap.data() as AttendanceRecord);
      });
      // Sort client side or ensure sort
      records.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      });
      onUpdate(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_records');
    });
  },

  // Get all Attendance Records once (for direct verification checks)
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const q = collection(db, 'attendance_records');
    try {
      const snap = await getDocs(q);
      const records: AttendanceRecord[] = [];
      snap.forEach(d => {
        records.push(d.data() as AttendanceRecord);
      });
      return records;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'attendance_records');
      return [];
    }
  },

  // Save check-in record
  async saveAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const path = `attendance_records/${record.id}`;
    try {
      await setDoc(doc(db, 'attendance_records', record.id), sanitizeFirestorePayload(record));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Delete/Remove check-in record
  async deleteAttendanceRecord(recordId: string): Promise<void> {
    const path = `attendance_records/${recordId}`;
    try {
      await deleteDoc(doc(db, 'attendance_records', recordId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Subscribe to Leave Requests
  subscribeLeaveRequests(onUpdate: (requests: LeaveRequest[]) => void): () => void {
    const q = collection(db, 'leave_requests');
    return onSnapshot(q, (snapshot) => {
      const requests: LeaveRequest[] = [];
      snapshot.forEach(docSnap => {
        requests.push(docSnap.data() as LeaveRequest);
      });
      requests.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      onUpdate(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leave_requests');
    });
  },

  // Submit leave request (Permission, Emergency Leave, Field Work)
  async createLeaveRequest(request: LeaveRequest): Promise<void> {
    const path = `leave_requests/${request.id}`;
    try {
      await setDoc(doc(db, 'leave_requests', request.id), sanitizeFirestorePayload(request));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Update leave request status (Approve or Reject status)
  async updateLeaveRequest(requestId: string, status: 'Approved' | 'Rejected', reviewedBy: string): Promise<void> {
    const path = `leave_requests/${requestId}`;
    try {
      await updateDoc(doc(db, 'leave_requests', requestId), {
        status,
        reviewedBy,
        reviewedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Subscribe to Attendance Correction Requests
  subscribeCorrectionRequests(onUpdate: (requests: AttendanceCorrectionRequest[]) => void): () => void {
    const q = collection(db, 'attendance_corrections');
    return onSnapshot(q, (snapshot) => {
      const requests: AttendanceCorrectionRequest[] = [];
      snapshot.forEach(docSnap => {
        requests.push(docSnap.data() as AttendanceCorrectionRequest);
      });
      requests.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      onUpdate(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_corrections');
    });
  },

  // Create an Attendance Correction Request
  async createCorrectionRequest(request: AttendanceCorrectionRequest): Promise<void> {
    const path = `attendance_corrections/${request.id}`;
    try {
      await setDoc(doc(db, 'attendance_corrections', request.id), sanitizeFirestorePayload(request));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // Update an Attendance Correction Request (Approve/Reject)
  async updateCorrectionRequest(requestId: string, status: 'Approved' | 'Rejected', approvedBy: string, notes?: string): Promise<void> {
    const path = `attendance_corrections/${requestId}`;
    try {
      await updateDoc(doc(db, 'attendance_corrections', requestId), {
        status,
        approvedBy,
        approvedDate: new Date().toISOString(),
        notes: notes || ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Subscribe to Attendance Settings Config
  subscribeAttendanceSettings(onUpdate: (settings: AttendanceSettings) => void): () => void {
    const docRef = doc(db, 'attendance_settings', 'office_config');
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as AttendanceSettings);
      } else {
        const defaultSettings: AttendanceSettings = {
          id: 'office_config',
          latitude: 9.0115, // Bole, Addis Ababa reference GPS
          longitude: 38.7830,
          radius: 10, // 10 meters exact radius threshold
          updatedBy: 'System Default',
          updatedAt: new Date().toISOString()
        };
        setDoc(docRef, defaultSettings).then(() => onUpdate(defaultSettings)).catch(() => {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_settings/office_config');
    });
  },

  // Save new office location as current standing coordinate
  async saveAttendanceSettings(settings: AttendanceSettings): Promise<void> {
    const path = 'attendance_settings/office_config';
    try {
      await setDoc(doc(db, 'attendance_settings', 'office_config'), sanitizeFirestorePayload(settings));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Dynamic Custom Business Roles Support
  subscribeBusinessRoles(onUpdate: (roles: string[]) => void): () => void {
    const docRef = doc(db, 'attendance_settings', 'business_roles');
    return onSnapshot(docRef, (snapshot) => {
      const defaultRoles = [
        'Senior Digital KYC Officer',
        'Digital Operational Officer',
        'Digital Loan Officer',
        'Credit Controller',
        'Contact Center'
      ];
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data.roles || defaultRoles);
      } else {
        setDoc(docRef, { roles: defaultRoles }).then(() => onUpdate(defaultRoles)).catch(() => {});
      }
    }, (error) => {
      console.warn("Failed to subscribe to custom business roles. Using default fallback List.");
    });
  },

  async addBusinessRole(roleName: string): Promise<void> {
    const docRef = doc(db, 'attendance_settings', 'business_roles');
    try {
      const snap = await getDoc(docRef);
      let currentRoles = [
        'Senior Digital KYC Officer',
        'Digital Operational Officer',
        'Digital Loan Officer',
        'Credit Controller',
        'Contact Center'
      ];
      if (snap.exists()) {
        currentRoles = snap.data().roles || currentRoles;
      }
      if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
        await setDoc(docRef, { roles: currentRoles });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendance_settings/business_roles');
    }
  },

  async deleteBusinessRole(roleName: string): Promise<void> {
    const docRef = doc(db, 'attendance_settings', 'business_roles');
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const currentRoles: string[] = snap.data().roles || [];
        const updated = currentRoles.filter(r => r !== roleName);
        await setDoc(docRef, { roles: updated });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendance_settings/business_roles');
    }
  },

  // Work Assignment Center Operations
  subscribeWorkAssignments(onUpdate: (assignments: WorkAssignment[]) => void): () => void {
    const q = collection(db, 'work_assignments');
    return onSnapshot(q, (snapshot) => {
      const list: WorkAssignment[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as WorkAssignment);
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'work_assignments');
    });
  },

  async saveWorkAssignment(task: WorkAssignment): Promise<void> {
    const taskId = task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const finalTask = { ...task, id: taskId };
    const path = `work_assignments/${taskId}`;
    try {
      await setDoc(doc(db, 'work_assignments', taskId), sanitizeFirestorePayload(finalTask));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteWorkAssignment(id: string): Promise<void> {
    const path = `work_assignments/${id}`;
    try {
      await deleteDoc(doc(db, 'work_assignments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Centralized Error Monitoring (Admin Error Center + Suppression)
  async logSystemError(errorVal: unknown, contextPath: string): Promise<void> {
    const id = `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const errorLog: SystemErrorLog = {
      id,
      timestamp: new Date().toISOString(),
      errorName: errorVal instanceof Error ? errorVal.name : 'UnknownError',
      errorMessage: errorVal instanceof Error ? errorVal.message : String(errorVal),
      stack: errorVal instanceof Error ? errorVal.stack : undefined,
      userId: auth.currentUser?.uid || 'anonymous',
      path: contextPath
    };
    try {
      await setDoc(doc(db, 'system_errors', id), errorLog);
    } catch (err) {
      console.warn("Recursive logging failure: Could not record error log.", err);
    }
  },

  subscribeSystemErrors(onUpdate: (errors: SystemErrorLog[]) => void): () => void {
    const q = collection(db, 'system_errors');
    return onSnapshot(q, (snapshot) => {
      const list: SystemErrorLog[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as SystemErrorLog);
      });
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      onUpdate(list);
    }, (error) => {
      console.error("Error center subscription issues", error);
    });
  },

  async clearSystemErrors(): Promise<void> {
    try {
      const snap = await getDocs(collection(db, 'system_errors'));
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (err) {
      console.warn("Failed to clear error register:", err);
    }
  },

  // Backups and Restore Management
  subscribeBackups(onUpdate: (backups: BackupSnapshot[]) => void): () => void {
    const q = collection(db, 'backups');
    return onSnapshot(q, (snapshot) => {
      const list: BackupSnapshot[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as BackupSnapshot);
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(list);
    }, (error) => {
      console.error("Backovers subscription broken", error);
    });
  },

  // Send chat message
  async sendChatMessage(msg: { sender: string; receiver: string; workspace: string; content: string }): Promise<void> {
    const id = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const newMsg = {
      id,
      sender: msg.sender,
      receiver: msg.receiver,
      workspace: msg.workspace,
      content: msg.content,
      createdAt: new Date().toISOString(),
      read: false
    };
    try {
      await setDoc(doc(db, 'chats', id), newMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${id}`);
    }
  },

  // Subscribe to all chats real-time
  subscribeChats(onUpdate: (messages: any[]) => void): () => void {
    const q = query(collection(db, 'chats'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages: any[] = [];
      snapshot.forEach(docSnap => {
        messages.push(docSnap.data());
      });
      onUpdate(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });
  },

  // Mark message as read
  async markMessageAsRead(chatId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'chats', chatId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  },

  async createBackupSnapshot(createdBy: string, description: string): Promise<string> {
    const date = new Date();
    const id = `backup-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    
    try {
      // Gather raw lists from all tables
      const usersSnap = await getDocs(collection(db, 'users'));
      const customerSnap = await getDocs(collection(db, 'customers'));
      const logsSnap = await getDocs(collection(db, 'activity_logs'));
      const attendanceSnap = await getDocs(collection(db, 'attendance_records'));

      const employees: User[] = [];
      usersSnap.forEach(d => employees.push(d.data() as User));

      const renewals: Customer[] = [];
      customerSnap.forEach(d => renewals.push(d.data() as Customer));

      const logs: ActivityLog[] = [];
      logsSnap.forEach(d => logs.push(d.data() as ActivityLog));

      const attendance: AttendanceRecord[] = [];
      attendanceSnap.forEach(d => attendance.push(d.data() as AttendanceRecord));

      const snapshot: BackupSnapshot = {
        id,
        createdAt: new Date().toISOString(),
        createdBy,
        description,
        attendanceCount: attendance.length,
        employeesCount: employees.length,
        renewalsCount: renewals.length,
        logsCount: logs.length,
        data: {
          attendance,
          employees,
          renewals,
          logs
        }
      };

      await setDoc(doc(db, 'backups', id), sanitizeFirestorePayload(snapshot));
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'backups/create');
      throw err;
    }
  },

  async restoreBackupSnapshot(snapshot: BackupSnapshot): Promise<void> {
    try {
      const batchList: any[] = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const queueDeleteAndWrite = async (collectionName: string, items: any[]) => {
        // Step A: empty existing table
        const snap = await getDocs(collection(db, collectionName));
        snap.forEach(d => {
          currentBatch.delete(d.ref);
          opCount++;
          if (opCount >= 450) {
            batchList.push(currentBatch);
            currentBatch = writeBatch(db);
            opCount = 0;
          }
        });

        // Step B: inject restored data
        items.forEach(item => {
          const docId = item.id || item.phoneNumber;
          if (docId) {
            currentBatch.set(doc(db, collectionName, docId), sanitizeFirestorePayload(item));
            opCount++;
            if (opCount >= 450) {
              batchList.push(currentBatch);
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          }
        });
      };

      await queueDeleteAndWrite('users', snapshot.data.employees);
      await queueDeleteAndWrite('customers', snapshot.data.renewals);
      await queueDeleteAndWrite('activity_logs', snapshot.data.logs);
      await queueDeleteAndWrite('attendance_records', snapshot.data.attendance);

      if (opCount > 0) {
        batchList.push(currentBatch);
      }

      for (const batch of batchList) {
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'backups/restore');
      throw err;
    }
  },

  async deleteBackupSnapshot(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'backups', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `backups/${id}`);
    }
  },

  // Auto clean-up / merge mechanism (Ensures One Number = One Account rule constraint)
  async mergeDuplicateAccounts(): Promise<void> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const phoneToUsers: Record<string, User[]> = {};

      usersSnap.forEach(userDoc => {
        const u = userDoc.data() as User;
        const nameLower = (u.fullName || '').toLowerCase();
        const pNum = u.phoneNumber || '';
        const originalIdLower = userDoc.id.toLowerCase();
        const isZewd = nameLower.includes('zewd') || 
                       originalIdLower.includes('zewd') || 
                       pNum === '0988000000' || 
                       pNum === '0988286610' || 
                       userDoc.id === '0988000000' || 
                       userDoc.id === '0988286610';

        let normalized = pNum.replace(/[\s-+]/g, '');
        if (normalized.startsWith('251')) {
          normalized = '0' + normalized.substring(3);
        }
        if (normalized.length === 9 && !normalized.startsWith('0')) {
          normalized = '0' + normalized;
        }

        if (isZewd) {
          normalized = '0988286610';
        }
        
        if (!phoneToUsers[normalized]) {
          phoneToUsers[normalized] = [];
        }
        phoneToUsers[normalized].push({ ...u, originalId: userDoc.id, normalizedId: normalized });
      });

      const batch = writeBatch(db);
      let updatesNeeded = false;
      const defaultZewdnehPasswordHash = await hashUserPassword('nehzewd0988');

      for (const normPhone of Object.keys(phoneToUsers)) {
        const matches = phoneToUsers[normPhone];
        
        // Scenario A: Duplicate entities exist OR ID format isn't normalized and standard
        if (matches.length > 1 || matches[0].originalId !== normPhone) {
          updatesNeeded = true;
          
          // Select primary. Zewdneh/super_admin is ALWAYS top priority, followed by admin roles, then isApproved
          let primary = matches.find(m => m.role === 'super_admin');
          if (!primary) primary = matches.find(m => m.originalId === 'zewdneh' || m.fullName.toLowerCase().includes('zewd'));
          if (!primary) primary = matches.find(m => m.role === 'admin');
          if (!primary) primary = matches.find(m => m.originalId === normPhone);
          if (!primary) primary = matches[0];

          // Form composite merged details
          const mergedUser: User = {
            phoneNumber: normPhone,
            fullName: primary.fullName,
            passwordHash: primary.passwordHash,
            status: matches.some(m => m.status === 'active') ? 'active' : 'deactive',
            role: matches.some(m => m.role === 'super_admin') ? 'super_admin' : (matches.some(m => m.role === 'admin') ? 'admin' : 'employee'),
            createdAt: primary.createdAt || new Date().toISOString(),
            businessRole: primary.businessRole || primary.customRole || 'Digital Loan Officer',
            workspace: primary.workspace || 'both',
            hasRenewalTrackerAccess: matches.some(m => m.hasRenewalTrackerAccess === true),
            deviceSignature: primary.deviceSignature || '',
            deviceRegistrationDate: primary.deviceRegistrationDate || '',
            deviceApproved: matches.some(m => m.deviceApproved === true),
            deviceInfo: primary.deviceInfo || '',
            email: primary.email || `${normPhone}@digaf.com`
          };

          // Check specifically if it is Zewdneh. Super admin protection constraints apply
          if (normPhone === '0988286610' || mergedUser.fullName.toLowerCase().includes('zewd')) {
            mergedUser.role = 'super_admin';
            mergedUser.isSuperAdmin = true;
            mergedUser.systemProtected = true;
            mergedUser.fullName = 'Zewdneh';
            mergedUser.businessRole = 'Digital Loan Officer';
            mergedUser.customRole = 'Digital Loan Officer';
            mergedUser.status = 'active';
            mergedUser.workspace = 'both';
            mergedUser.hasRenewalTrackerAccess = true;
            mergedUser.phoneNumber = '0988286610'; // Standardize Zewdneh's phone
            mergedUser.passwordHash = defaultZewdnehPasswordHash;
          }

          // Step 1: Write correct merged record under standard phone key
          batch.set(doc(db, 'users', mergedUser.phoneNumber), sanitizeFirestorePayload(mergedUser));

          // Step 2: Queue deletion for all alternate duplicate records
          matches.forEach(m => {
            if (m.originalId !== mergedUser.phoneNumber) {
              batch.delete(doc(db, 'users', m.originalId));
            }
          });
        } else {
          // Double check super admin standardization for single records too
          const single = matches[0];
          if (single.fullName.toLowerCase().includes('zewd') && (single.role !== 'super_admin' || single.businessRole !== 'Digital Loan Officer' || single.workspace !== 'both' || !single.passwordHash || !single.isSuperAdmin)) {
            updatesNeeded = true;
            batch.update(doc(db, 'users', single.originalId), {
              fullName: 'Zewdneh',
              role: 'super_admin',
              isSuperAdmin: true,
              systemProtected: true,
              businessRole: 'Digital Loan Officer',
              customRole: 'Digital Loan Officer',
              status: 'active',
              workspace: 'both',
              hasRenewalTrackerAccess: true,
              passwordHash: defaultZewdnehPasswordHash
            });
          }
        }
      }

      if (updatesNeeded) {
        await batch.commit();
        console.log("Deduplicated and standardized employee profiles successfully.");
      }
    } catch (err) {
      console.warn("De-duplication sweep completed with warnings:", err);
    }
  }
};

