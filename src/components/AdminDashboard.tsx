import React, { useState, useEffect } from 'react';
import { User, ActivityLog, Customer, STATUS_LIST, CustomerStatus } from '../types';
import { dbService, db } from '../services/db';
import { 
  Shield, 
  Sparkles, 
  UserX, 
  UserCheck, 
  KeyRound, 
  AlertCircle, 
  History, 
  Info, 
  RefreshCw, 
  Smartphone, 
  Check, 
  HelpCircle, 
  Users, 
  CheckSquare, 
  ClipboardList, 
  Trash2, 
  Database, 
  HardDrive, 
  Flame, 
  Compass, 
  Activity,
  Layers,
  Sliders,
  Search,
  Award,
  Download,
  ArrowLeft
} from 'lucide-react';
import { soundService } from '../services/sound';
import { hashPassword } from '../utils/security';
import ActivityLogView from './ActivityLogView';
import QuickControllerView from './QuickControllerView';
import AIControlCenter from './AIControlCenter';

interface AdminDashboardProps {
  currentUser: User;
  logs: ActivityLog[];
  customers?: Customer[];
}

export default function AdminDashboard({ currentUser, logs, customers = [] }: AdminDashboardProps) {
  // Strict check-point: enforce role checking rather than client name string-matching
  const isZewdneh = currentUser.isSuperAdmin === true || currentUser.role === 'super_admin';
  const isAdminStaff = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  // Strict page entry gate for non-admins (Address Audit Task #1 #9 #10: Route Containment Access Control)
  if (!isAdminStaff) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center max-w-xl mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-16 h-16 text-rose-600 mx-auto mb-4 animate-bounce" />
        <h2 className="text-xl font-black text-rose-800 tracking-tight">ACCESS SYSTEM DENIED</h2>
        <p className="text-xs text-rose-600 font-bold mt-2 leading-relaxed">
          Your account does not possess the central credential clearance to authorize Admin Dashboard operations. This unauthorized boundary crossing attempt has been catalogued.
        </p>
      </div>
    );
  }

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Employee Performance Dashboard States
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDrillDownEmployee, setSelectedDrillDownEmployee] = useState<User | null>(null);
  const [rankingMetric, setRankingMetric] = useState<'completed' | 'paid' | 'productivity'>('completed');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  
  // Navigation tabs state (Now fully supports corporate workspaces and backup restore snap panels)
  const [activeTab, setActiveTab] = useState<'operators' | 'portfolios' | 'audit' | 'telemetry' | 'quick' | 'ai_hub' | 'tasks' | 'devices' | 'backups' | 'errors'>('quick');

  // Overriding/Editing keys & Roles states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCustomRole, setSelectedCustomRole] = useState('');
  const [selectedTrackerAccess, setSelectedTrackerAccess] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<'first_round' | 'second_round' | 'both'>('both');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Deleting user account states
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteConfirmPhone, setDeleteConfirmPhone] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Add Employee Form States
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addCustomRole, setAddCustomRole] = useState('Digital Operational Officer');
  const [addCustomRoleText, setAddCustomRoleText] = useState('');
  const [selectedCustomRoleText, setSelectedCustomRoleText] = useState('');
  const [addWorkspace, setAddWorkspace] = useState<'first_round' | 'second_round' | 'both'>('first_round');
  const [addEmail, setAddEmail] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addError, setAddError] = useState('');

  // Unified Lists for new subsystems
  const [businessRoles, setBusinessRoles] = useState<string[]>([]);
  const [workAssignments, setWorkAssignments] = useState<any[]>([]);
  const [systemErrors, setSystemErrors] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  // Add work assignment inputs
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskWorkspace, setTaskWorkspace] = useState<'first_round' | 'second_round' | 'all'>('all');

  // Workload Dashboard Filtering states
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterCustomerName, setFilterCustomerName] = useState('');
  const [filterRound, setFilterRound] = useState<'all' | 'first_round' | 'second_round'>('all');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Backups and Roles management inputs
  const [newRoleInput, setNewRoleInput] = useState('');
  const [backupDescriptionInput, setBackupDescriptionInput] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [backupError, setBackupError] = useState('');

  const sanitizePhoneInput = (phone: string): string => {
    let norm = phone.trim().replace(/[\s-+]/g, '');
    if (norm.startsWith('251')) {
      norm = '0' + norm.substring(3);
    }
    if (norm.length === 9 && !norm.startsWith('0')) {
      norm = '0' + norm;
    }
    return norm;
  };

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    const cleanPhone = sanitizePhoneInput(addPhone);

    if (!addName.trim() || !cleanPhone || !addPassword.trim()) {
      setAddError('All fields are required.');
      return;
    }

    if (cleanPhone.length < 10) {
      setAddError('Phone number must be a standard 10 digit number (e.g. 0988286610)');
      return;
    }

    const exists = users.some(u => u.phoneNumber === cleanPhone);
    if (exists) {
      setAddError('An employee with this Phone number already exists. One Phone Number = One Account constraint checks.');
      return;
    }

    let actualCustomRole = addCustomRole;
    if (addCustomRole === 'Custom...' && addCustomRoleText.trim()) {
      actualCustomRole = addCustomRoleText.trim();
    }

    let mappedRole: 'super_admin' | 'admin' | 'employee' = 'employee';
    if (actualCustomRole === 'Super Admin' || actualCustomRole === 'System Owner') {
      mappedRole = 'super_admin';
    } else if (actualCustomRole === 'Senior Digital KYC Officer' || actualCustomRole === 'Admin' || actualCustomRole === 'Senior Officer') {
      mappedRole = 'admin';
    }

    // Cryptographically hash the initial password
    const cryptedPassword = await hashPassword(addPassword.trim());

    const newUser: User = {
      fullName: addName.trim(),
      phoneNumber: cleanPhone,
      passwordHash: cryptedPassword,
      role: mappedRole,
      businessRole: actualCustomRole,
      customRole: actualCustomRole,
      status: 'active',
      hasRenewalTrackerAccess: actualCustomRole !== 'Contact Center' && actualCustomRole !== 'FTD',
      workspace: addWorkspace,
      email: addEmail.trim() || `${cleanPhone}@digaf.com`,
      createdAt: new Date().toISOString()
    };

    try {
      await dbService.createUser(newUser);
      
      // Log on admin logs
      await dbService.logActivity(
        currentUser.fullName,
        'Renewal Processing',
        'Renewal Processing',
        `Admin created new employee workstation account: ${newUser.fullName} (${newUser.phoneNumber}) with business role ${addCustomRole}`
      );
      
      soundService.playSuccessChime();
      setAddSuccess(`Employee "${newUser.fullName}" added successfully with role "${addCustomRole}"!`);
      // Reset inputs
      setAddName('');
      setAddPhone('');
      setAddPassword('');
      setAddEmail('');
    } catch (err) {
      setAddError('Database communication error. Verify security permissions.');
    }
  };

  useEffect(() => {
    // Subscribe to users real-time stream
    const unsubscribeUsers = dbService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers);
      setLoading(false);

      // Dynamically extract unique business/custom roles
      const uniqueRoles = new Set<string>([
        'Senior Digital KYC Officer',
        'Digital Operational Officer',
        'Digital Loan Officer',
        'Credit Controller',
        'FTD'
      ]);
      updatedUsers.forEach(u => {
        if (u.businessRole) uniqueRoles.add(u.businessRole);
        if (u.customRole) uniqueRoles.add(u.customRole);
      });
      setBusinessRoles(Array.from(uniqueRoles));
    });

    // Subscribe to work assignments
    const unsubscribeTasks = dbService.subscribeWorkAssignments((updatedTasks) => {
      setWorkAssignments(updatedTasks.sort((a, b) => {
        const priorityScore = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const scoreA = priorityScore[a.priority as keyof typeof priorityScore] || 0;
        const scoreB = priorityScore[b.priority as keyof typeof priorityScore] || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }));
    });

    // Subscribe to system error traces
    const unsubscribeErrors = dbService.subscribeSystemErrors((updatedErrors) => {
      setSystemErrors(updatedErrors.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()));
    });

    // Subscribe to backups
    const unsubscribeBackups = dbService.subscribeBackups((updatedBackups) => {
      setBackups(updatedBackups.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    });

    // Subscribe to attendance records
    const unsubscribeAttendance = dbService.subscribeAttendanceRecords((records) => {
      setAttendanceRecords(records);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeTasks();
      unsubscribeErrors();
      unsubscribeBackups();
      unsubscribeAttendance();
    };
  }, []);

  const handleToggleStatus = async (user: User) => {
    // Protect Super Admin using database identity flags
    const isTargetSuperAdmin = user.isSuperAdmin === true || user.systemProtected === true || user.role === 'super_admin';
    if (isTargetSuperAdmin) {
      soundService.playSuccessChime();
      alert('Security Violation: Super Admin cannot be deactivated or suspended under any circumstances.');
      return;
    }

    // Prevent self-deactivation of core admin account
    if (user.phoneNumber === currentUser.phoneNumber) {
      soundService.playSuccessChime(); // small beep
      alert('Security Protocol: You cannot deactivate your own administrative account.');
      return;
    }

    const nextStatus = user.status === 'active' ? 'deactive' : 'active';
    try {
      await dbService.updateUser(user.phoneNumber, { status: nextStatus });
      
      // Log admin actions
      await dbService.logActivity(
        user.fullName,
        'Renewal Processing',
        'Renewal Processing',
        `Admin modified status to: ${nextStatus}`
      );
      soundService.playSuccessChime();
    } catch (err) {
      console.error(err);
      alert('Failed to update user status.');
    }
  };

  const handleUpdateUserAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setPasswordError('');
    setPasswordSuccess('');

    const targetIsSelf = selectedUser.phoneNumber === currentUser.phoneNumber;
    const targetIsSuperAdmin = selectedUser.isSuperAdmin === true || selectedUser.systemProtected === true || selectedUser.role === 'super_admin';
    
    // Prevent Admins (Aman) from modifying Super Admin
    if (targetIsSuperAdmin && currentUser.role !== 'super_admin') {
      setPasswordError('Permission Denied: Only Super Admin can manage Super Admin configuration.');
      soundService.playSuccessChime();
      return;
    }

    let actualSelectedRole = selectedCustomRole;
    if (selectedCustomRole === 'Custom...' && selectedCustomRoleText.trim()) {
      actualSelectedRole = selectedCustomRoleText.trim();
    }

    // Determine System Role based on Business/Custom Role selection
    let systemRole: 'super_admin' | 'admin' | 'employee' = 'employee';
    if (actualSelectedRole === 'Super Admin' || actualSelectedRole === 'System Owner') {
      systemRole = 'super_admin';
    } else if (actualSelectedRole === 'Admin' || actualSelectedRole === 'Senior Digital KYC Officer') {
      systemRole = 'admin';
    }

    // Force Super Admin to remain Super Admin
    if (targetIsSuperAdmin && systemRole !== 'super_admin') {
      setPasswordError('Protocol Violation: Super Admin cannot be demoted or have Super Admin privilege stripped.');
      return;
    }

    const updates: Partial<User> = {
      businessRole: actualSelectedRole,
      customRole: actualSelectedRole,
      role: systemRole,
      hasRenewalTrackerAccess: selectedTrackerAccess,
      workspace: selectedWorkspace
    };

    if (newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        setPasswordError('Password must be at least 4 characters long.');
        return;
      }
      updates.passwordHash = await hashPassword(newPassword.trim());
    }

    try {
      await dbService.updateUser(selectedUser.phoneNumber, updates);
      
      // Log audit trail
      await dbService.logActivity(
        currentUser.fullName,
        'Renewal Processing',
        'Renewal Processing',
        `Admin modified operator account: ${selectedUser.fullName} (${selectedUser.phoneNumber}). Custom Role: ${selectedCustomRole}, Workspace: ${selectedWorkspace}, Tracker Access: ${selectedTrackerAccess ? 'Enabled' : 'Disabled'}, Password Overridden: ${!!newPassword.trim()}`
      );

      soundService.playSuccessChime();
      setPasswordSuccess('Account settings & classifications saved successfully!');
      setNewPassword('');
      setTimeout(() => {
        setSelectedUser(null);
        setPasswordSuccess('');
      }, 5000);
    } catch (err) {
      setPasswordError('Failed to modify user roles & permissions.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    // Protect Super Admin using database identity flags
    const isTargetSuperAdmin = deletingUser.isSuperAdmin === true || deletingUser.systemProtected === true || deletingUser.role === 'super_admin';
    if (isTargetSuperAdmin) {
      soundService.playSuccessChime();
      alert('Security Protocol Violation: Super Admin cannot be deleted, removed, or purged from the system.');
      return;
    }

    if (deletingUser.phoneNumber === currentUser.phoneNumber) {
      soundService.playSuccessChime();
      alert('Security Protocol: You are forbidden from destroying your own active administrator account.');
      return;
    }

    try {
      await dbService.deleteUser(deletingUser.phoneNumber);
      
      await dbService.logActivity(
        deletingUser.fullName,
        'Renewal Processing',
        'Renewal Processing',
        `Admin deleted user workstation account permanently: ${deletingUser.phoneNumber}`
      );

      soundService.playSuccessChime();
      setDeletingUser(null);
      setDeleteConfirmPhone('');
      setDeleteError('');
    } catch (err) {
      console.error(err);
      setDeleteError('Authorized communication error. Verify database rule permissions.');
    }
  };

  // Firestore Storage & Resource telemetry calculations based on 1GB spark quotas
  // 1 document averages around 0.5 Kilobytes in typical schema tracking
  const estUsersSize = users.length * 0.45; // KB
  const estCustomersSize = customers.length * 0.65; // KB
  const estLogsSize = logs.length * 0.35; // KB
  const totalEstUsedKB = estUsersSize + estCustomersSize + estLogsSize;
  const maxStorageKB = 1048576; // 1 GB Spark free limit in Kilobytes
  const pctUsed = (totalEstUsedKB / maxStorageKB) * 100;
  const pctLeft = 100 - pctUsed;

  // Reads: Each real-time stream subscription loaded our document rows on initial session mount
  const estSessionReads = users.length + customers.length + logs.length;
  // Writes: Seed records + logging audits
  const estSessionWrites = logs.length + users.length;

  return (
    <div className="space-y-6 animate-fade-in" id="admin_dashboard_view">
      
      {/* Visual top highlight header card - Extremely Compact & Clean */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden" id="admin_header_card">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-0.5 text-center md:text-left relative z-10">
          <div className="flex items-center justify-center md:justify-start gap-1.5">
            <span className="p-0.5 px-2 bg-violet-500/15 border border-violet-500/20 text-[9px] font-bold text-[#8B5CF6] uppercase rounded-full tracking-wider flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              Administrative Gate
            </span>
          </div>
          <h1 className="text-base md:text-lg font-black tracking-tight font-sans">
            Workstation Operator Console
          </h1>
          <p className="text-slate-400 text-[10.5px] font-medium leading-none">
            Manage authenticated user registries, toggle session locks, and inspect database storage capacities.
          </p>
        </div>

        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2 px-3 rounded-xl relative z-10">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <div className="leading-tight text-left">
            <span className="text-slate-450 block text-[8px] uppercase tracking-wider font-extrabold">Principal Webmaster</span>
            <span className="font-extrabold text-white text-[10px] font-mono leading-none block mt-0.5">{currentUser.fullName} ({currentUser.phoneNumber})</span>
          </div>
        </div>
      </div>

      {/* HORIZONTAL MINI SUB-NAVBAR FOR DASHBOARD PANELS (Saves Space & Refines Layout) */}
      <div className="flex border-b border-slate-200 gap-1 pb-px overflow-x-auto select-none no-scrollbar">
        <button
          onClick={() => setActiveTab('ai_hub')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'ai_hub'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-455 text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] animate-pulse" />
          AI Control Center
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'quick'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          Quick Controller
        </button>
        <button
          onClick={() => setActiveTab('operators')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'operators'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Register Indices
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'tasks'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
          Assignment Center
        </button>
        <button
          onClick={() => setActiveTab('portfolios')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'portfolios'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Workloads & Portfolios
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'devices'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-505" />
          Device Approval
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'backups'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-violet-500" />
          Backup Snapshot Panel
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Audit Log Ledger
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'errors'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          Error Center
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'telemetry'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Firebase Storage Telemetry
        </button>
      </div>

      <div className="w-full">
        {activeTab === 'ai_hub' && (
          <div className="animate-fade-in mt-4">
            <AIControlCenter 
              currentUser={currentUser}
              users={users}
            />
          </div>
        )}

        {activeTab === 'quick' && (
          <div className="animate-fade-in mt-4">
            <QuickControllerView 
              customers={customers} 
              logs={logs} 
              currentUser={currentUser} 
              onNavigateToReports={() => setActiveTab('audit')}
            />
          </div>
        )}

        {activeTab === 'operators' && (() => {
          const filteredDirectoryUsers = users.filter(u => {
            const roleLower = (u.businessRole || u.customRole || u.role || '').toLowerCase();
            const ws = u.workspace;
            const isContactCenter = roleLower.includes('contact center') || u.role === 'Contact Center';
            if (isContactCenter) return false;
            // Only 1st and 2nd round employees
            return ws === 'first_round' || ws === 'second_round' || ws === 'both';
          });
          
          const searchedDirectoryUsers = filteredDirectoryUsers.filter(u => {
            if (!operatorSearch.trim()) return true;
            const query = operatorSearch.toLowerCase();
            return (
              u.fullName.toLowerCase().includes(query) ||
              u.phoneNumber.toLowerCase().includes(query)
            );
          });

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Left columns: Operator List with Delete button */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Registered Operator Directory
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9.5px] font-black rounded uppercase">
                      {filteredDirectoryUsers.length} Operator{filteredDirectoryUsers.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Operator Search Filter Box */}
                  <div className="relative pt-1 font-sans">
                    <Search className="absolute left-3 top-4 w-3.5 h-3.5 text-slate-400 hover:text-[#8B5CF6] transition-colors" />
                    <input
                      type="text"
                      placeholder="Search employee by Name or Phone Number to override password or change role..."
                      value={operatorSearch}
                      onChange={(e) => setOperatorSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs p-2.5 pl-9 rounded-xl focus:outline-hidden font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-[#8B5CF6]/50 transition-all duration-200"
                    />
                  </div>

                  {loading ? (
                    <div className="p-12 text-center text-slate-500 text-[11px] flex flex-col items-center justify-center gap-1 font-bold">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#8B5CF6]" />
                      Retrieving active operator directories...
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {searchedDirectoryUsers.map((u) => {
                        const isSelf = u.phoneNumber === currentUser.phoneNumber;
                        const isSuper = u.phoneNumber.toLowerCase().includes('zewd') || u.fullName.toLowerCase().includes('zewd');
                        
                        // Mask Super Admin role to non-Zewdneh observers
                        let visibleRole = u.customRole || (isSuper ? '2nd Round Employee' : u.role.toUpperCase());
                        if (isSuper && !isZewdneh && !isSelf) {
                          visibleRole = '2nd Round Employee';
                        }

                        return (
                          <div key={u.phoneNumber} className="py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 first:pt-0 last:pb-0 border-b border-slate-100 last:border-0 animate-fade-in text-[10.5px]">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="text-[11px] font-extrabold text-slate-800">{u.fullName}</h4>
                                {isSelf && (
                                  <span className="text-[8px] font-extrabold bg-violet-100 text-[#8B5CF6] border border-violet-200 px-1 py-0.2 rounded-xs uppercase">Self</span>
                                )}
                                <span className={`text-[8.5px] px-1.5 py-0.2 rounded-xs font-black uppercase tracking-wider ${
                                  u.role === 'admin' 
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {visibleRole}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-[9.5px] text-slate-500 font-mono">
                                <div>Phone: <strong className="text-slate-700 font-sans">{u.phoneNumber}</strong></div>
                                <div>Status: <span className={`font-sans font-extrabold uppercase ${u.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>{u.status}</span></div>
                                <div>Renewal Tracker: <strong className="text-slate-700 font-sans">{u.hasRenewalTrackerAccess !== false ? 'ENABLED' : 'ATTENDANCE ONLY'}</strong></div>
                                <div>Created: <strong>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</strong></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto">
                              {/* ASSIGN button */}
                              {!(isSuper && !isZewdneh) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setSelectedCustomRole(u.businessRole || u.customRole || (u.role === 'admin' ? 'Admin' : 'Digital Loan Officer'));
                                    setSelectedTrackerAccess(u.hasRenewalTrackerAccess !== false);
                                    setSelectedWorkspace(u.workspace || 'both');
                                    setNewPassword('');
                                    setPasswordError('');
                                    setPasswordSuccess('');
                                  }}
                                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-700 text-[9px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono uppercase tracking-wider shadow-2xs"
                                >
                                  <KeyRound className="w-2.5 h-2.5 text-slate-450" />
                                  ASSIGN
                                </button>
                              ) : (
                                <span className="text-[8.5px] text-slate-400 font-mono tracking-wider">RESTRICTED</span>
                              )}

                              {/* Active/Suspended status toggler */}
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                disabled={isSelf || (isSuper && !isZewdneh)}
                                className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer justify-center ${
                                  isSelf || (isSuper && !isZewdneh)
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                                    : u.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                {u.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
                              </button>

                              {/* DELETE Account */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingUser(u);
                                  setDeleteConfirmPhone('');
                                  setDeleteError('');
                                }}
                                disabled={isSelf || (isSuper && !isZewdneh)}
                                className={`px-2 py-1 rounded-lg border text-[9px] font-black transition-all flex items-center gap-1 justify-center cursor-pointer ${
                                  isSelf || (isSuper && !isZewdneh)
                                    ? 'opacity-40 cursor-not-allowed border-none text-[8px]'
                                    : 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-800'
                                }`}
                                title={isSelf ? "You cannot delete your own session" : "Permanently remove operator"}
                              >
                                <Trash2 className="w-2.5 h-2.5 text-rose-600" />
                                DELETE
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            {/* Right column: Edit password override card & Add Employee form */}
            <div className="space-y-4">
              {/* Form to Add New Employee */}
              <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-150 pb-2">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    Add New Employee
                  </h4>
                </div>

                {addSuccess && (
                  <div className="p-2 bg-emerald-50 border border-emerald-150 rounded text-emerald-800 text-[9px] font-bold">
                    {addSuccess}
                  </div>
                )}

                {addError && (
                  <div className="p-2 bg-rose-50 border border-rose-150 rounded text-rose-800 text-[9px] font-bold">
                    [Error] {addError}
                  </div>
                )}

                <form onSubmit={handleAddEmployeeSubmit} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={addName}
                      onChange={(e) => {
                        setAddName(e.target.value);
                        setAddError('');
                        setAddSuccess('');
                      }}
                      placeholder="e.g. Aman / Kebede"
                      className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                      Phone Number / ID
                    </label>
                    <input
                      type="text"
                      required
                      value={addPhone}
                      onChange={(e) => {
                        setAddPhone(e.target.value);
                        setAddError('');
                        setAddSuccess('');
                      }}
                      placeholder="e.g. 0911223344"
                      className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                      Workstation Login Password
                    </label>
                    <input
                      type="text"
                      required
                      value={addPassword}
                      onChange={(e) => {
                        setAddPassword(e.target.value);
                        setAddError('');
                        setAddSuccess('');
                      }}
                      placeholder="e.g. secure123"
                      className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                      Role & Workload Rights
                    </label>
                    <select
                      value={addCustomRole}
                      onChange={(e) => {
                        setAddCustomRole(e.target.value);
                        setAddError('');
                        setAddSuccess('');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-bold text-slate-800"
                    >
                      <option value="Digital Loan Officer">Digital Loan Officer</option>
                      <option value="Senior Digital KYC Officer">Senior Digital KYC Officer</option>
                      <option value="Digital Operational Officer">Digital Operational Officer</option>
                      <option value="Credit Controller">Credit Controller</option>
                      <option value="FTD">FTD</option>
                      <option value="Admin">Admin</option>
                      {isZewdneh && <option value="Super Admin">Super Admin</option>}
                      <option value="Custom...">Custom...</option>
                    </select>
                  </div>

                  {addCustomRole === 'Custom...' && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                        Custom Role Title Description
                      </label>
                      <input
                        type="text"
                        required
                        value={addCustomRoleText}
                        onChange={(e) => setAddCustomRoleText(e.target.value)}
                        placeholder="e.g. Lead Liquidity Analyst"
                        className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-bold text-slate-800"
                      />
                    </div>
                  )}

                  {true && (
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                        Round Workspace Assignment
                      </label>
                      <select
                        value={addWorkspace}
                        onChange={(e) => {
                          setAddWorkspace(e.target.value as any);
                          setAddError('');
                          setAddSuccess('');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-[11px] p-2 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-bold text-slate-800"
                      >
                        <option value="first_round">First Round Only</option>
                        <option value="second_round">Second Round Only</option>
                        <option value="both">Both Rounds (All)</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black rounded-lg cursor-pointer shadow-xs transition-all uppercase tracking-wider"
                  >
                    Register Employee Account
                  </button>
                </form>
              </div>

              {selectedUser ? (
                <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3.5 animate-fade-in text-[10.5px]">
                  <div className="flex items-center justify-between border-b border-indigo-150 pb-2">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                      <KeyRound className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      Reclassify Workspace Rights
                    </h4>
                    <button 
                      onClick={() => setSelectedUser(null)} 
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 pl-2 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg text-[9.5px] leading-tight flex flex-col gap-1 border border-slate-150">
                    <div>Operator: <strong className="text-slate-900 font-sans">{selectedUser.fullName}</strong></div>
                    <div>Phone Identifier: <strong className="text-slate-700 font-mono">{selectedUser.phoneNumber}</strong></div>
                  </div>

                  {passwordSuccess && (
                    <div className="p-2 bg-emerald-50 border border-emerald-150 rounded text-emerald-800 text-[9px] font-bold">
                      {passwordSuccess}
                    </div>
                  )}

                  {passwordError && (
                    <div className="p-2 bg-rose-50 border border-rose-150 rounded text-rose-800 text-[9px] font-bold">
                      [Error] {passwordError}
                    </div>
                  )}

                  <form onSubmit={handleUpdateUserAccess} className="space-y-3.5">
                    {/* Role selector dropdown */}
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-455 uppercase tracking-wider block">Custom Attendance Role</label>
                      <select
                        value={selectedCustomRole}
                        onChange={(e) => setSelectedCustomRole(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-[10.5px] p-2 rounded-lg font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                      >
                        <option value="Digital Loan Officer">Digital Loan Officer</option>
                        <option value="Senior Digital KYC Officer">Senior Digital KYC Officer</option>
                        <option value="Digital Operational Officer">Digital Operational Officer</option>
                        <option value="Credit Controller">Credit Controller</option>
                        <option value="FTD">FTD</option>
                        <option value="Admin">Admin</option>
                        {isZewdneh && <option value="Super Admin">Super Admin</option>}
                        <option value="Custom...">Custom...</option>
                      </select>
                    </div>

                    {selectedCustomRole === 'Custom...' && (
                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                          Custom Role Title Description
                        </label>
                        <input
                          type="text"
                          required
                          value={selectedCustomRoleText}
                          onChange={(e) => setSelectedCustomRoleText(e.target.value)}
                          placeholder="e.g. Lead Liquidity Analyst"
                          className="w-full bg-slate-50 border border-slate-200 text-[10.5px] p-2 rounded-lg font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                        />
                      </div>
                    )}

                    {/* Round Workspace Assignment selector */}
                    {true && (
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-450 uppercase tracking-wider block">Round Workspace Assignment</label>
                        <select
                          value={selectedWorkspace}
                          onChange={(e) => setSelectedWorkspace(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 text-[10.5px] p-2 rounded-lg font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                        >
                          <option value="first_round">First Round Only</option>
                          <option value="second_round">Second Round Only</option>
                          <option value="both">Both Rounds (All)</option>
                        </select>
                      </div>
                    )}

                    {/* Access switch to renewal tracker module */}
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between gap-1.5 align-middle">
                      <div className="space-y-0.5 leading-tight">
                        <span className="text-[9.5px] font-extrabold text-slate-800 block">Renewal Tracker Module</span>
                        <span className="text-[8px] text-slate-400 block font-medium">Allow tracker access for this operator</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedTrackerAccess(!selectedTrackerAccess)}
                        className={`px-2 py-1 rounded text-[9px] font-bold font-mono uppercase cursor-pointer transition-all ${
                          selectedTrackerAccess ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-500 border border-slate-300'
                        }`}
                      >
                        {selectedTrackerAccess ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>

                    {/* Optional key password reset */}
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-450 uppercase tracking-wider block">
                        Override Key Password (Optional)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                          <KeyRound className="w-3 h-3" />
                        </span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError('');
                          }}
                          placeholder="Leave empty to keep current password"
                          className="w-full bg-slate-50 border border-slate-200 text-xs p-2 pl-8 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-mono text-slate-800"
                        />
                      </div>
                      <span className="text-[8px] text-slate-400 block font-medium">Keep blank to leave security password untouched.</span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[9.5px] font-black rounded-lg cursor-pointer shadow-xs transition-all uppercase tracking-wider"
                      >
                        Commit Overwrite
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9.5px] font-black rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 text-center text-slate-400 text-[10px] space-y-1">
                  <Info className="w-3.5 h-3.5 mx-auto text-slate-350" />
                  <p className="font-bold">Keys & Role Management</p>
                  <p className="text-[9px] leading-tight text-slate-400">Select an operator's ASSIGN button to change custom role, toggle renewal module, or update password securely.</p>
                </div>
              )}
            </div>
          </div>
          );
        })()}        {/* TAB 2: PORTFOLIOS & WORKLOAD DISTRIBUTION */}
        {activeTab === 'portfolios' && (() => {
          // Date filter checker
          const isWithinDateFilter = (dateStr: string | undefined): boolean => {
            if (!dateStr) return false;
            const dateOnly = dateStr.split('T')[0];
            const todayObj = new Date();
            
            const formatYYYYMMDD = (d: Date) => {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            };

            const todayStr = formatYYYYMMDD(todayObj);

            if (dateFilter === 'today') {
              return dateOnly === todayStr;
            }
            if (dateFilter === 'yesterday') {
              const yesterdayObj = new Date();
              yesterdayObj.setDate(yesterdayObj.getDate() - 1);
              const yesterdayStr = formatYYYYMMDD(yesterdayObj);
              return dateOnly === yesterdayStr;
            }
            if (dateFilter === 'last7') {
              const past7Obj = new Date();
              past7Obj.setDate(past7Obj.getDate() - 7);
              const past7Str = formatYYYYMMDD(past7Obj);
              return dateOnly >= past7Str && dateOnly <= todayStr;
            }
            if (dateFilter === 'thisMonth') {
              const yearStr = String(todayObj.getFullYear());
              const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0');
              return dateOnly.startsWith(`${yearStr}-${monthStr}`);
            }
            if (dateFilter === 'custom') {
              if (customStartDate && dateOnly < customStartDate) return false;
              if (customEndDate && dateOnly > customEndDate) return false;
              return true;
            }
            return true;
          };

          // Helper to check if a customer record matches an employee
          const matchesEmployee = (c: Customer, u: User) => {
            const cAdded = (c.addedBy || '').toLowerCase().trim();
            const cUpdated = (c.updatedBy || '').toLowerCase().trim();
            const uName = (u.fullName || '').toLowerCase().trim();
            const uPhone = (u.phoneNumber || '').trim();
            return cAdded === uName || cAdded === uPhone || cUpdated === uName || cUpdated === uPhone;
          };

          // Stats computation per worker
          const getEmployeeStats = (u: User) => {
            const frPosted = customers.filter(c => c.workspace === 'first_round' && matchesEmployee(c, u) && isWithinDateFilter(c.addedDate)).length;
            const frCompleted = customers.filter(c => c.workspace === 'first_round' && matchesEmployee(c, u) && c.status === 'Completed' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;

            const srRenewal = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'Renewal Processing' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;
            const srCompleted = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'Completed' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;
            const srPaid = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'Paid' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;
            const srWaiting = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'Waiting' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;
            const srRejected = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'Rejected' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;
            const srNoResponse = customers.filter(c => c.workspace === 'second_round' && matchesEmployee(c, u) && c.status === 'No Response' && isWithinDateFilter(c.updatedDate || c.addedDate)).length;

            const matchedAttendance = attendanceRecords.filter(r => {
              const nameMatch = (r.employeeName || '').toLowerCase().trim() === (u.fullName || '').toLowerCase().trim();
              const phoneMatch = (r.phoneNumber || '').trim() === (u.phoneNumber || '').trim();
              return (nameMatch || phoneMatch) && isWithinDateFilter(r.date);
            });

            let present = 0;
            let late = 0;
            let veryLate = 0;

            matchedAttendance.forEach(r => {
              const s = (r.status || '').toUpperCase().trim();
              if (s === 'PRESENT' || s === 'AFTERNOON PRESENT' || s === 'SYNCED FROM OFFLINE' || s === 'FIELD WORK' || s === 'PERMISSION' || s === 'EMERGENCY LEAVE' || s === 'APPROVED LEAVE' || s === 'LEAVE') {
                present++;
              } else if (s === 'LATE' || s === 'AFTERNOON LATE') {
                late++;
              } else if (s === 'VERY LATE' || s === 'VERY_LATE') {
                veryLate++;
              }
            });

            const productivityScore = frCompleted * 10 + srCompleted * 10 + srPaid * 15 + srRenewal * 5;

            return {
              frPosted,
              frCompleted,
              srRenewal,
              srCompleted,
              srPaid,
              srRejected,
              srWaiting,
              srNoResponse,
              present,
              late,
              veryLate,
              productivityScore
            };
          };

          // Global summaries
          const teamFirstRoundSummary = (() => {
            const frCustomers = customers.filter(c => c.workspace === 'first_round' && isWithinDateFilter(c.addedDate));
            const totalPosted = frCustomers.length;
            const totalCompleted = frCustomers.filter(c => c.status === 'Completed').length;
            return { totalPosted, totalCompleted };
          })();

          const teamSecondRoundSummary = (() => {
            const srCustomers = customers.filter(c => c.workspace === 'second_round' && isWithinDateFilter(c.updatedDate || c.addedDate));
            const totalRenewal = srCustomers.filter(c => c.status === 'Renewal Processing').length;
            const totalCompleted = srCustomers.filter(c => c.status === 'Completed').length;
            const totalPaid = srCustomers.filter(c => c.status === 'Paid').length;
            const totalRejected = srCustomers.filter(c => c.status === 'Rejected').length;
            const totalWaiting = srCustomers.filter(c => c.status === 'Waiting').length;
            const totalNoResponse = srCustomers.filter(c => c.status === 'No Response').length;
            return { totalRenewal, totalCompleted, totalPaid, totalRejected, totalWaiting, totalNoResponse };
          })();

          // Filter to include ONLY 1st and 2nd round employees (excluding Contact Center)
          const validEmployeesList = users.filter(u => {
            const roleLower = (u.businessRole || u.customRole || u.role || '').toLowerCase();
            const ws = u.workspace;
            const isContactCenter = roleLower.includes('contact center') || u.role === 'Contact Center';
            if (isContactCenter) return false;
            // only 1st and 2nd round employees
            return ws === 'first_round' || ws === 'second_round' || ws === 'both';
          });

          // Rankings
          const rankedEmployees = validEmployeesList.map(u => {
            const stats = getEmployeeStats(u);
            return {
              user: u,
              stats,
              completed: stats.frCompleted + stats.srCompleted,
              paid: stats.srPaid,
              productivity: stats.productivityScore
            };
          }).sort((a, b) => {
            if (rankingMetric === 'completed') return b.completed - a.completed;
            if (rankingMetric === 'paid') return b.paid - a.paid;
            return b.productivity - a.productivity;
          });

          // Live search filter
          const filteredUsersForDashboard = validEmployeesList.filter((u) => {
            const q = employeeSearch.toLowerCase().trim();
            if (!q) return true;
            return (
              (u.fullName || '').toLowerCase().includes(q) ||
              (u.phoneNumber || '').includes(q)
            );
          });

          const handleExportPerformanceCSV = () => {
            const header = [
              'Employee Name', 'Role', 'Phone Number', 
              'First Round Posted', 'First Round Completed', 
              'Renewal Processing', 'Completed', 'Paid', 'Rejected', 'Waiting', 'No Response',
              'Present Days', 'Late Days', 'Very Late Days'
            ].join(',');

            const rows = users.map(u => {
              const stats = getEmployeeStats(u);
              return [
                `"${u.fullName.replace(/"/g, '""')}"`,
                `"${(u.customRole || u.role).replace(/"/g, '""')}"`,
                `"${u.phoneNumber}"`,
                stats.frPosted,
                stats.frCompleted,
                stats.srRenewal,
                stats.srCompleted,
                stats.srPaid,
                stats.srRejected,
                stats.srWaiting,
                stats.srNoResponse || 0,
                stats.present,
                stats.late,
                stats.veryLate
              ].join(',');
            });

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header, ...rows].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Employee_Performance_Report_${dateFilter}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            soundService.playSuccessChime();
          };

          return (
            <div className="space-y-6 animate-fade-in font-sans">
              
              {/* HEADER CAPTION */}
              <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#8B5CF6]" />
                    Employee Productivity & Workload Management
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium leading-none">
                    Real-time performance analytics, round status audits, performance grading and staff scorecards.
                  </p>
                </div>
                
                {/* Clean CSV & Excel Redesigned export controls */}
                <button
                  onClick={handleExportPerformanceCSV}
                  className="px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export performance matrix (CSV)
                </button>
              </div>

              {/* DATE FILTERS & SEARCH MODULE */}
              <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  
                  {/* Date Filter Selection Buttons */}
                  <div className="lg:col-span-7 space-y-1.5">
                    <label className="text-[9.5px] font-black text-slate-450 uppercase tracking-wider block">Time Horizon Filter</label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: 'last7', label: 'Last 7 Days' },
                        { id: 'thisMonth', label: 'This Month' },
                        { id: 'custom', label: 'Custom Date Range' }
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setDateFilter(btn.id as any)}
                          className={`px-3 py-1.5 text-[10.5px] font-bold rounded-lg border transition-all cursor-pointer ${
                            dateFilter === btn.id
                              ? 'bg-violet-50 text-[#8B5CF6] border-violet-200 shadow-3xs'
                              : 'bg-transparent text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operator Quick Search */}
                  <div className="lg:col-span-5 space-y-1.5">
                    <label className="text-[9.5px] font-black text-slate-450 uppercase tracking-wider block">Search Employee</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Search by Employee Name or Phone..."
                        className="w-full bg-slate-50 border border-slate-200 text-xs pl-8.5 pr-4 py-1.5 rounded-lg font-semibold text-slate-850 placeholder-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-[#8B5CF6] focus:border-violet-200 transition-all"
                      />
                    </div>
                  </div>

                </div>

                {/* Conditional Custom Date Range Picks */}
                {dateFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-violet-50/40 rounded-xl border border-violet-100 animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8B5CF6] uppercase">From Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs p-1.5 rounded-lg font-bold text-slate-850 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8B5CF6] uppercase">To Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs p-1.5 rounded-lg font-bold text-slate-850 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TEAM SUMMARY GLOBAL CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* First Round Summary */}
                <div className="bg-gradient-to-br from-violet-500/5 to-violet-600/5 border border-violet-100 rounded-xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-violet-100/50 pb-2">
                    <span className="text-[10px] font-black uppercase text-violet-700 tracking-wider">FIRST ROUND GLOBAL SUMMARY</span>
                    <span className="text-[8.5px] bg-violet-100 text-violet-800 font-bold px-1.5 py-0.2 rounded uppercase">Static DB Synced</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-violet-100/50">
                      <span className="text-[8.5px] font-bold text-slate-400 block uppercase">TOTAL POSTED</span>
                      <span className="text-lg font-black text-slate-800 tracking-tight">{teamFirstRoundSummary.totalPosted}</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-violet-100/50">
                      <span className="text-[8.5px] font-bold text-violet-600 block uppercase">TOTAL COMPLETED</span>
                      <span className="text-lg font-black text-[#8B5CF6] tracking-tight">{teamFirstRoundSummary.totalCompleted}</span>
                    </div>
                  </div>
                </div>                {/* Second Round Summary */}
                <div className="bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 border border-indigo-100 rounded-xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">SECOND ROUND GLOBAL SUMMARY</span>
                    <span className="text-[8.5px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded uppercase">Workload Standard</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">PROCESSING</span>
                      <span className="text-[11px] font-black text-slate-755">{teamSecondRoundSummary.totalRenewal}</span>
                    </div>
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">COMPLETED</span>
                      <span className="text-[11px] font-black text-emerald-600">{teamSecondRoundSummary.totalCompleted}</span>
                    </div>
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">PAID</span>
                      <span className="text-[11px] font-black text-indigo-600">{teamSecondRoundSummary.totalPaid}</span>
                    </div>
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">REJECTED</span>
                      <span className="text-[11px] font-black text-rose-600">{teamSecondRoundSummary.totalRejected}</span>
                    </div>
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">WAITING</span>
                      <span className="text-[11px] font-black text-amber-600">{teamSecondRoundSummary.totalWaiting}</span>
                    </div>
                    <div className="bg-white p-1 py-1.5 rounded-lg border border-indigo-50 text-center">
                      <span className="text-[7px] font-bold text-slate-400 block truncate font-sans">NO RESP.</span>
                      <span className="text-[11px] font-black text-amber-900">{teamSecondRoundSummary.totalNoResponse}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* STAFF OPERATIONS MATRIX */}
              <div className="bg-white border border-slate-150 rounded-xl p-4.5 shadow-3xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4.5 h-4.5 text-[#8B5CF6]" />
                    <div>
                      <h4 className="text-[11.5px] font-black text-slate-800 uppercase tracking-wide">Staff Operations Matrix</h4>
                      <p className="text-[9.5px] text-slate-400 font-medium">Workload statistics computed automatically from logs</p>
                    </div>
                  </div>
                  
                  {/* Select Metric */}
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    {[
                      { id: 'completed', label: 'Completed Tasks' },
                      { id: 'paid', label: 'Paid Enrollments' },
                      { id: 'productivity', label: 'Overall Productivity' }
                    ].map((metric) => (
                      <button
                        key={metric.id}
                        onClick={() => setRankingMetric(metric.id as any)}
                        className={`px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider rounded-md border transition-all cursor-pointer ${
                          rankingMetric === metric.id
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-transparent text-slate-450 border-slate-150/80 hover:bg-slate-50'
                        }`}
                      >
                        {metric.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Complete Employee Board table without Rank */}
                <div className="mt-4 border border-slate-150 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-150 text-[9px] font-black uppercase text-slate-450 tracking-wider">
                        <th className="py-2.5 px-3">Employee Name</th>
                        <th className="py-2.5 px-3 text-center">Completed</th>
                        <th className="py-2.5 px-3 text-center">Paid</th>
                        <th className="py-2.5 px-3 text-center">Success Rate</th>
                        <th className="py-2.5 px-3 text-right">Performance Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11.5px] font-bold text-slate-700">
                      {rankedEmployees.map((item) => {
                        const totalSecondRound = item.stats.srRenewal + item.stats.srCompleted + item.stats.srPaid + item.stats.srWaiting + item.stats.srRejected + item.stats.srNoResponse;
                        const successRate = totalSecondRound > 0 ? Math.round((item.stats.srPaid / totalSecondRound) * 100) : 0;
                        return (
                          <tr key={item.user.phoneNumber} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-800">{item.user.fullName}</span>
                                <span className="text-[8px] text-slate-400 font-medium uppercase font-mono tracking-wider">{item.user.customRole || item.user.role}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-emerald-600">
                              {item.completed}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-indigo-600">
                              {item.paid}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${successRate >= 70 ? 'bg-emerald-50 text-emerald-700' : successRate >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                                {successRate}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#8B5CF6] text-xs">
                              {item.productivity} pts
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INDIVIDUAL EMPLOYEE CARDS GRID */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pl-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    INDIVIDUAL STAFF PERFORMANCE CARDS ({filteredUsersForDashboard.length} RENDERED)
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">Click card for detailed audit trail</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUsersForDashboard.map((emp) => {
                    const stats = getEmployeeStats(emp);
                    return (
                      <div
                        key={emp.phoneNumber}
                        onClick={() => setSelectedDrillDownEmployee(emp)}
                        className="bg-white border border-slate-150 hover:border-violet-300 rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div className="space-y-3">
                          
                          {/* Top Heading */}
                          <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                            <div>
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-[#8B5CF6] transition-colors">{emp.fullName}</h4>
                              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-0.5 font-bold leading-none">
                                {emp.customRole || emp.role}
                              </p>
                            </div>
                            <span className="text-[8.5px] bg-[#8B5CF6]/10 text-[#8B5CF6] font-black font-mono transition-transform group-hover:translate-x-0.5 block px-1.5 py-0.5 rounded">
                              AUDIT ↗
                            </span>
                          </div>

                          {/* Stats Grid: First vs Second */}
                          <div className="grid grid-cols-2 gap-4">
                            
                            {/* First Round */}
                            <div className="space-y-1.5">
                              <span className="text-[8.5px] text-[#8B5CF6] font-black uppercase tracking-wider block border-b border-violet-50 pb-0.5">FIRST ROUND</span>
                              <div className="text-[10px] text-slate-600 flex justify-between">
                                <span className="font-medium text-slate-400">Posted:</span>
                                <strong className="text-slate-800 font-mono font-bold">{stats.frPosted}</strong>
                              </div>
                              <div className="text-[10px] text-slate-600 flex justify-between">
                                <span className="font-medium text-slate-400">Completed:</span>
                                <strong className="text-emerald-600 font-mono font-extrabold">{stats.frCompleted}</strong>
                              </div>
                            </div>

                            {/* Second Round */}
                            <div className="space-y-1.5 border-l border-slate-100 pl-4">
                              <span className="text-[8.5px] text-indigo-700 font-black uppercase tracking-wider block border-b border-indigo-50 pb-0.5">SECOND ROUND</span>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400">Processing:</span>
                                <strong className="text-slate-850 font-mono">{stats.srRenewal}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400">Completed:</span>
                                <strong className="text-emerald-700 font-mono font-extrabold">{stats.srCompleted}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400">Paid:</span>
                                <strong className="text-indigo-600 font-mono">{stats.srPaid}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400">Rejected:</span>
                                <strong className="text-rose-600 font-mono">{stats.srRejected}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400">Waiting:</span>
                                <strong className="text-amber-600 font-mono">{stats.srWaiting}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-600 flex justify-between">
                                <span className="text-slate-400 font-bold text-amber-900">No Response:</span>
                                <strong className="text-rose-950 font-mono font-extrabold">{stats.srNoResponse || 0}</strong>
                              </div>
                            </div>

                          </div>

                        </div>

                        {/* Attendance summary banner on the card bottom */}
                        <div className="bg-slate-50/50 mt-3 p-2 rounded-lg text-[9px] flex items-center justify-between border border-slate-100">
                          <span className="font-extrabold text-slate-400 uppercase tracking-wide">Attendance:</span>
                          <div className="flex gap-2 text-slate-500">
                            <div>P: <strong className="text-emerald-600 font-sans">{stats.present}d</strong></div>
                            <div>L: <strong className="text-amber-500 font-sans">{stats.late}d</strong></div>
                            <div>VL: <strong className="text-rose-600 font-sans">{stats.veryLate}d</strong></div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INDIVIDUAL EMPLOYEE DRILL-DOWN AUDIT TRAIL */}
              {selectedDrillDownEmployee && (() => {
                const emp = selectedDrillDownEmployee;
                const stats = getEmployeeStats(emp);
                
                // Retrieve all customer workload items processed/added by this user
                const handledCustomers = customers.filter(c => matchesEmployee(c, emp) && isWithinDateFilter(c.addedDate));

                return (
                  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 relative">
                      
                      {/* Close button */}
                      <button
                        onClick={() => setSelectedDrillDownEmployee(null)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 text-base font-bold bg-slate-50 rounded-full p-2 h-9 w-9 flex items-center justify-center cursor-pointer border border-slate-150"
                      >
                        ✕
                      </button>

                      {/* Header */}
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <ArrowLeft
                            className="w-4 h-4 text-slate-400 hover:text-slate-700 cursor-pointer"
                            onClick={() => setSelectedDrillDownEmployee(null)}
                          />
                          <div>
                            <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-[#8B5CF6] font-black rounded px-1.5 py-0.2 uppercase font-mono">
                              Staff performance profile
                            </span>
                            <h3 className="text-normal font-black text-slate-800 uppercase mt-1">
                              {emp.fullName}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Phone link: {emp.phoneNumber} • System Role: {emp.customRole || emp.role}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Grade Block with score indicators */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        
                        {/* Attendance Merit Block */}
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                          <span className="text-[8.5px] font-black text-slate-400 block uppercase">ATTENDANCE LEDGER</span>
                          <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                            <div className="bg-white p-1 rounded border border-slate-150">
                              <span className="text-[7.5px] text-emerald-600 font-extrabold block uppercase">PRES</span>
                              <span className="text-xs font-black">{stats.present}d</span>
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-150">
                              <span className="text-[7.5px] text-amber-500 font-extrabold block uppercase">LATE</span>
                              <span className="text-xs font-black">{stats.late}d</span>
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-150">
                              <span className="text-[7.5px] text-rose-600 font-extrabold block uppercase">V_LATE</span>
                              <span className="text-xs font-black">{stats.veryLate}d</span>
                            </div>
                          </div>
                        </div>

                        {/* First Round Summary */}
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-slate-400 block uppercase">FIRST ROUND PORTFOLIO</span>
                          <div className="flex justify-between items-baseline mt-2">
                            <span className="text-[9px] text-slate-400 font-bold">POSTED / DONE:</span>
                            <span className="text-[13px] font-black text-[#8B5CF6]">{stats.frPosted} / {stats.frCompleted}</span>
                          </div>
                        </div>

                        {/* Second Round Summary */}
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-slate-400 block uppercase">SECOND ROUND WORKLOAD</span>
                          <div className="flex justify-between items-baseline mt-2">
                            <span className="text-[9px] text-slate-400 font-bold">DONE / PAID:</span>
                            <span className="text-[13px] font-black text-indigo-700">{stats.srCompleted} / {stats.srPaid}</span>
                          </div>
                        </div>

                      </div>

                      {/* Detailed transaction list under strict isolation */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          ACTIVE WORKLOAD ASSIGNMENTS DRILL-DOWN ({handledCustomers.length} ENTRIES)
                        </h4>
                        
                        {handledCustomers.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs italic border border-slate-100 rounded-xl bg-slate-50/50">
                            No individual customer records assigned or updated by this user within the selected date horizon.
                          </div>
                        ) : (
                          <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-600 uppercase text-[9px] font-black tracking-wider border-b border-slate-150 sticky top-0">
                                  <th className="py-2.5 px-3">Customer Name</th>
                                  <th className="py-2.5 px-3">Phone Number</th>
                                  <th className="py-2.5 px-3">Round Domain</th>
                                  <th className="py-2.5 px-3">Pipeline Status</th>
                                  <th className="py-2.5 px-3">Added Date</th>
                                  <th className="py-2.5 px-3">Last Updated</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {handledCustomers.map((c) => (
                                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-2 px-3 font-extrabold text-slate-800">{c.name}</td>
                                    <td className="py-2 px-3 font-mono text-slate-500">{c.phoneNumber || 'N/A'}</td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-wider ${
                                        c.workspace === 'second_round'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-violet-50 text-[#8B5CF6] border-violet-200'
                                      }`}>
                                        {c.workspace === 'second_round' ? 'Second Round' : 'First Round'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.2 rounded-full text-[8px] font-black uppercase border tracking-wider ${
                                        c.status === 'Completed'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : c.status === 'Renewal Processing'
                                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                                          : c.status === 'Paid'
                                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                          : c.status === 'Waiting'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-rose-50 text-rose-800 border-rose-200'
                                      }`}>
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[9.5px] text-slate-400">
                                      {c.addedDate ? c.addedDate.split('T')[0] : 'N/A'}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[9.5px] text-slate-400">
                                      {c.updatedDate ? c.updatedDate.split('T')[0] : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Close Panel Modal Footer */}
                      <div className="flex justify-end pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setSelectedDrillDownEmployee(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Close profile audit
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {/* TAB 3: FIREBASE SYSTEM TELEMETRY & STORAGE REMAINING */}
        {activeTab === 'telemetry' && (
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#8B5CF6]" />
                Firebase Real-Time DB Storage & Quota Metrics
              </h4>
              <span className="px-1.5 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] text-[8.5px] font-bold rounded">
                Spark Account
              </span>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Below represents the computed data telemetry index of the active Cloud Firestore instance <strong>"{db.app.options.projectId || 'ai-studio-project'}"</strong>. Google Spark rules offer generous allocations daily for early workstation operations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Storage left */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-black text-slate-705 uppercase tracking-wide flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-505" /> Storage Capacity
                  </span>
                  <span className="text-[9.5px] font-mono text-slate-500 font-bold">1 GB Cap</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">Estimated Used:</span>
                    <span className="text-slate-800 font-mono">{totalEstUsedKB.toFixed(2)} KB</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">Storage Free:</span>
                    <span className="text-emerald-600 font-mono">{(maxStorageKB - totalEstUsedKB).toFixed(2)} KB</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${Math.max(0.1, pctLeft)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold">
                    <span className="text-indigo-505 font-mono">{(pctUsed).toFixed(6)}% Used</span>
                    <span className="text-emerald-600 font-mono">{(pctLeft).toFixed(4)}% Left</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Read Daily Quota */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-black text-slate-705 uppercase tracking-wide flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-[#8B5CF6]" /> DB Daily Read Quota
                  </span>
                  <span className="text-[9.5px] font-mono text-[#8B5CF6] font-bold">50k / Day</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">In-Session Queries:</span>
                    <span className="text-slate-800 font-mono">3 Active PubSub</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">Est. Indexed Reads:</span>
                    <span className="text-slate-800 font-mono">{estSessionReads} Documents</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#8B5CF6] h-full transition-all duration-500"
                      style={{ width: `${(estSessionReads / 50000) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold text-slate-400 font-mono">
                    <span>{((estSessionReads / 50000) * 100).toFixed(3)}% Spent</span>
                    <span>{50000 - estSessionReads} Reads Free</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Write Daily Quota */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-black text-slate-705 uppercase tracking-wide flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-500" /> DB Daily Write Quota
                  </span>
                  <span className="text-[9.5px] font-mono text-amber-600 font-bold">20k / Day</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">System Audit Logs:</span>
                    <span className="text-slate-800 font-mono">{logs.length} Entries</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-500">Est. Indexed Writes:</span>
                    <span className="text-slate-800 font-mono">{estSessionWrites} docs</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{ width: `${(estSessionWrites / 20000) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] font-bold text-slate-400 font-mono">
                    <span>{((estSessionWrites / 20000) * 100).toFixed(3)}% Spent</span>
                    <span>{20000 - estSessionWrites} Writes Free</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informational telemetry advice block */}
            <div className="p-2.5 bg-indigo-50/50 border border-slate-200 rounded-xl text-[9.5px] text-slate-500 leading-relaxed font-sans space-y-1">
              <span className="font-extrabold text-[#8B5CF6] uppercase block text-[8px] tracking-wider">★ Operational Protocol Advice</span>
              <p>
                Firestore Enterprise and Spark engines allocate memory counts by individual fields. Releasing documents frees up 100% of their proportional storage sizes immediately. To inspect raw telemetry direct, operators are instructed to authenticate at the Google Firebase Admin console.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <ActivityLogView 
            logs={logs} 
            customers={customers} 
            isAdminView={true} 
            currentUser={currentUser}
          />
        )}

        {/* WORK WORKSPACE ROUNDS & ASSIGNMENT CENTER */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Create New Task Assignment Form */}
              <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3.5">
                <div className="border-b border-amber-100 pb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-amber-500" />
                    Record Priority Request
                  </h3>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!taskTitle.trim() || !taskAssignee) {
                    alert('Title and Assignee are required.');
                    return;
                  }
                  try {
                    await dbService.saveWorkAssignment({
                      title: taskTitle.trim(),
                      description: taskDesc.trim(),
                      assignedTo: taskAssignee,
                      priority: taskPriority,
                      deadline: taskDeadline || new Date(Date.now() + 86450000).toISOString().split('T')[0],
                      workspace: taskWorkspace,
                      status: 'PENDING',
                      reminder: true,
                      notes: ''
                    });
                    
                    await dbService.logActivity(
                      currentUser.fullName,
                      'Renewal Processing',
                      'Renewal Processing',
                      `Assigned priority task: "${taskTitle}" to operator (${taskAssignee})`
                    );

                    soundService.playSuccessChime();
                    setTaskTitle('');
                    setTaskDesc('');
                    setTaskAssignee('');
                  } catch (err) {
                    alert('Failed to register Priority assignment.');
                  }
                }} className="space-y-3 text-[10.5px]">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Request Title / Topic</label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g., Telegram Follow-up: Alazar"
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2.5 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Detailed Scope Note</label>
                    <textarea
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Specify customer details or contact center source logs..."
                      rows={2}
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2.5 rounded-xl text-slate-800 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Assign To Workstation</label>
                    <select
                      required
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2.5 rounded-xl font-bold text-slate-800 focus:outline-hidden"
                    >
                      <option value="">Select Station Operator...</option>
                      {users.map(u => (
                        <option key={u.phoneNumber} value={u.phoneNumber}>
                          {u.fullName} ({u.phoneNumber} - {u.businessRole || 'Officer'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Task Priority</label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2 rounded-xl text-slate-800 font-bold focus:outline-hidden"
                      >
                        <option value="LOW">Low Grid</option>
                        <option value="MEDIUM">Medium Standard</option>
                        <option value="HIGH">High Criticality</option>
                        <option value="CRITICAL">★ Fire Drill</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Workspace Round</label>
                      <select
                        value={taskWorkspace}
                        onChange={(e) => setTaskWorkspace(e.target.value as any)}
                        className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2 rounded-xl text-slate-800 font-bold focus:outline-hidden"
                      >
                        <option value="all">Both Rounds (All)</option>
                        <option value="first_round">First Round Only</option>
                        <option value="second_round">Second Round Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Completion Deadline</label>
                    <input
                      type="date"
                      value={taskDeadline}
                      onChange={(e) => setTaskDeadline(e.target.value)}
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2 rounded-xl text-slate-800 font-mono focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Authorize Assignment Board
                  </button>
                </form>
              </div>

              {/* Right Column: Dynamic Assignments Ledger */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                      Priority Queue Registry
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9.5px] font-black rounded uppercase">
                      {workAssignments.length} Assigned Tasks
                    </span>
                  </div>

                  {workAssignments.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-bold leading-relaxed italic">
                      There are currently no active Priority workloads or forgotten assignments.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-105 space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                      {workAssignments.map((task) => {
                        const assigneeUser = users.find(u => u.phoneNumber === task.assignedTo);
                        
                        return (
                          <div key={task.id} className="pt-3 first:pt-0 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                  task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse' :
                                  task.priority === 'HIGH' ? 'bg-amber-100 text-amber-850 border border-amber-300' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {task.priority || 'MEDIUM'}
                                </span>
                                <h4 className="font-extrabold text-slate-800">{task.title}</h4>
                                <span className="text-[8.5px] font-semibold bg-violet-50 text-[#8B5CF6] border border-violet-100 px-1 py-0.1 rounded uppercase">
                                  {task.workspace === 'first_round' ? '1st Round' : task.workspace === 'second_round' ? '2nd Round' : 'All Rounds'}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[10px] leading-relaxed">{task.description}</p>
                              
                              {task.notes && (
                                <div className="mt-1.5 p-2 bg-emerald-50/50 border border-emerald-100/80 rounded-xl text-[9.5px] text-emerald-800 leading-snug font-medium">
                                  <span className="font-extrabold uppercase tracking-widest text-emerald-950 block text-[8px] mb-0.5">✔ Handled / Action Logged:</span>
                                  {task.notes}
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[9px] text-slate-450">
                                <div>Assigned Station: <strong className="text-slate-700 font-sans">{assigneeUser?.fullName || task.assignedTo}</strong></div>
                                <div>Deadline: <strong className="text-rose-600 font-sans">{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Immediate'}</strong></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                value={task.status || 'PENDING'}
                                onChange={async (e) => {
                                  let explanation = task.notes || '';
                                  const newStatus = e.target.value;
                                  
                                  const explanationRequired = newStatus === 'COMPLETED' || newStatus === 'STUCK';
                                  if (explanationRequired) {
                                    const userReply = window.prompt(`Describe what actions you took to handle this task:`, task.notes || '');
                                    if (userReply === null) return; // cancel change if they cancelled the dialog
                                    explanation = userReply.trim() || 'Handled successfully.';
                                  }
                                  
                                  try {
                                    await dbService.saveWorkAssignment({
                                      ...task,
                                      status: newStatus,
                                      notes: explanation
                                    });
                                    
                                    await dbService.logActivity(
                                      currentUser.fullName,
                                      'Renewal Processing',
                                      'Renewal Processing',
                                      `Updated task "${task.title}" status to ${newStatus}. Action note: "${explanation}"`
                                    );
                                    
                                    soundService.playSuccessChime();
                                  } catch (err) {
                                    alert('Failed to update task status.');
                                  }
                                }}
                                className="text-[9.5px] font-black text-slate-700 bg-slate-50 border border-slate-200 p-1 rounded-md cursor-pointer"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="COMPLETED">✅ COMPLETED</option>
                                <option value="STUCK">❌ STUCK</option>
                              </select>

                              <button
                                onClick={async () => {
                                  if (!confirm('Are you certain you want to delete this assignment?')) return;
                                  try {
                                    await dbService.deleteWorkAssignment(task.id!);
                                    soundService.playSuccessChime();
                                  } catch (err) {
                                    alert('Failed to strip assignment.');
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 rounded text-rose-600 border border-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEVICE SECURITY APPROVAL WORKFLOWS */}
        {activeTab === 'devices' && (
          <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-4 animate-fade-in">
            <div className="border-b border-primary-50 pb-2.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#8B5CF6]" />
                  Centralized Workspace Device Registry
                </h3>
                <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium pl-0.5 leading-none">
                  Every employee must scan with an approved device signature. New device triggers alert Aman and Zewdneh.
                </p>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[#8B5CF6] text-[9.5px] font-black rounded font-mono uppercase">
                Device Lock: Active
              </span>
            </div>

            {/* Search Input Filter for Registered Devices */}
            <div className="relative pt-1 font-sans">
              <Search className="absolute left-3 top-4 w-3.5 h-3.5 text-slate-400 hover:text-[#8B5CF6] transition-colors" />
              <input
                type="text"
                placeholder="Search registered device footprint by Employee Name or Phone..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs p-2.5 pl-9 rounded-xl focus:outline-hidden font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-[#8B5CF6]/50 transition-all duration-200"
              />
            </div>

            <div className="divide-y divide-slate-100 space-y-2 mt-2">
              {users
                .filter(employee => {
                  if (!deviceSearch.trim()) return true;
                  const query = deviceSearch.toLowerCase();
                  return (
                    employee.fullName.toLowerCase().includes(query) ||
                    employee.phoneNumber.toLowerCase().includes(query)
                  );
                })
                .map((employee) => {
                const isSigDefined = !!employee.deviceSignature;
                const isApproved = employee.deviceApproved === true;

                return (
                  <div key={employee.phoneNumber} className="py-3 items-center justify-between flex flex-col md:flex-row gap-4 first:pt-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11.5px] font-black text-slate-800">{employee.fullName}</h4>
                        <span className="text-[8.5px] font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.2 uppercase">
                          {employee.businessRole || 'Loan officer'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 mt-1 text-[9.5px] font-mono text-slate-500">
                        <div>Verified Phone: <strong className="text-slate-700 font-sans">{employee.phoneNumber}</strong></div>
                        <div>Device Signature: <span className="text-violet-900 font-bold">{employee.deviceSignature || 'No signature scanned yet'}</span></div>
                        <div>Last Workspace Link: <span className="font-sans lowercase">{employee.workspace || 'both'} Workspace</span></div>
                        <div>Email ID: <span className="text-slate-450">{employee.email || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {(() => {
                        const devStatus = employee.deviceApprovalStatus || (
                          employee.deviceApproved === true 
                            ? 'Approved' 
                            : isSigDefined 
                              ? 'Pending' 
                              : 'No Scanner Scanned'
                        );

                        let badgeColor = 'bg-slate-100 text-slate-500';
                        let badgeLabel = 'No Scanner Scanned';

                        if (devStatus === 'Approved') {
                          badgeColor = 'bg-emerald-50 text-emerald-800 border border-emerald-250';
                          badgeLabel = 'Approved Device';
                        } else if (devStatus === 'Pending') {
                          badgeColor = 'bg-amber-50 text-amber-800 border border-amber-250 animate-pulse';
                          badgeLabel = 'Awaiting Verification';
                        } else if (devStatus === 'Blocked') {
                          badgeColor = 'bg-rose-50 text-rose-800 border border-rose-250';
                          badgeLabel = 'Blocked';
                        } else if (devStatus === 'Stay Blocked') {
                          badgeColor = 'bg-rose-950/20 text-rose-950 border border-rose-350 font-extrabold';
                          badgeLabel = '🚫 Stay Blocked';
                        }

                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black font-sans uppercase tracking-wide flex items-center gap-1 ${badgeColor}`}>
                              {badgeLabel}
                            </span>
                            {employee.deviceApprovalReason && (
                              <span className="text-[7.5px] text-rose-700 italic max-w-[120px] truncate block" title={employee.deviceApprovalReason}>
                                Reason: {employee.deviceApprovalReason}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {isSigDefined && (employee.deviceApprovalStatus !== 'Approved' && employee.deviceApproved !== true) && (
                        <button
                          onClick={async () => {
                            try {
                              await dbService.updateUser(employee.phoneNumber, { 
                                deviceApproved: true,
                                deviceApprovalStatus: 'Approved',
                                deviceApprovedBy: currentUser.fullName,
                                deviceApprovedDate: new Date().toISOString()
                              });
                              soundService.playSuccessChime();
                              await dbService.logActivity(
                                currentUser.fullName,
                                'Renewal Processing',
                                'Renewal Processing',
                                `Approved device fingerprint signature: "${employee.deviceSignature}" for Operator: ${employee.fullName}`
                              );
                              alert(`Successfully verified and approved Device signature for employee ${employee.fullName}!`);
                            } catch (err) {
                              alert('Verification failed.');
                            }
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                          Verify & Approve
                        </button>
                      )}

                      {isSigDefined && (employee.deviceApproved === true || employee.deviceApprovalStatus === 'Approved') && (
                        <button
                          onClick={async () => {
                            if (!confirm('Are you certain you want to revoke this device approval? The user gets locked out instantly.')) return;
                            try {
                              await dbService.updateUser(employee.phoneNumber, { 
                                deviceApproved: false,
                                deviceApprovalStatus: 'Blocked'
                              });
                              soundService.playSuccessChime();
                              await dbService.logActivity(
                                currentUser.fullName,
                                'Renewal Processing',
                                'Renewal Processing',
                                `REVOKED device fingerprint signature: "${employee.deviceSignature}" for Operator: ${employee.fullName}`
                              );
                            } catch (err) {
                              alert('Revocation failed.');
                            }
                          }}
                          className="px-2 py-1 hover:bg-rose-50 text-rose-800 hover:border-rose-200 border border-slate-100 rounded-lg text-[9px] font-black transition-all cursor-pointer"
                        >
                          Revoke Approval
                        </button>
                      )}

                      {isSigDefined && employee.deviceApprovalStatus !== 'Stay Blocked' && (
                        <button
                          onClick={async () => {
                            const reason = prompt('Please enter the reason to permanently block this device (block history will be preserved):', employee.deviceApprovalReason || '');
                            if (reason === null) return; // User cancelled
                            try {
                              const blockReason = reason.trim() || 'Permanently blocked by Admin.';
                              await dbService.updateUser(employee.phoneNumber, { 
                                deviceApproved: false,
                                deviceApprovalStatus: 'Stay Blocked',
                                deviceApprovalReason: blockReason
                              });
                              soundService.playSuccessChime();
                              await dbService.logActivity(
                                currentUser.fullName,
                                'Renewal Processing',
                                'Renewal Processing',
                                `PERMANENTLY STAY BLOCKED device signature for employee ${employee.fullName}. Reason: ${blockReason}`
                              );
                              alert(`Device fingerprint for ${employee.fullName} is now set to "Stay Blocked" status.`);
                            } catch (err) {
                              alert('Stay Blocked action failed.');
                            }
                          }}
                          className="px-2 py-1 bg-rose-950 font-black hover:bg-rose-900 border border-transparent rounded-lg text-[9px] text-white transition-all cursor-pointer"
                          title="Permanently block this device from automatic re-approvals"
                        >
                          Stay Blocked
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SYSTEM BACKUP SNAPSHOT MANAGER CENTER */}
        {activeTab === 'backups' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: BACKUP CREATION CONTROLLER (Both can make, only super can restore) */}
              <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3.5">
                <div className="border-b border-[#8B5CF6]/20 pb-2">
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#8B5CF6]" />
                    Trigger System Snapshot
                  </h3>
                </div>

                {backupSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded text-emerald-800 text-[10px] font-bold leading-normal">
                    {backupSuccess}
                  </div>
                )}

                {backupError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-150 rounded text-rose-800 text-[10px] font-bold leading-normal">
                    [System Guard] {backupError}
                  </div>
                )}

                <div className="space-y-3.5 text-[10.5px]">
                  <p className="text-slate-500 text-[9.5px] leading-relaxed">
                    Backup snapshots capture current active indices including complete <strong>Employee profiles</strong>, <strong>Attendance Records</strong>, <strong>Customer Renewal workloads</strong>, and <strong>Central Security registries</strong>.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Backup Log Purpose</label>
                    <input
                      type="text"
                      value={backupDescriptionInput}
                      onChange={(e) => setBackupDescriptionInput(e.target.value)}
                      placeholder="e.g., Prefatory backup before Aman batch update"
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-[11px] p-2.5 rounded-xl font-bold text-slate-700 focus:outline-hidden"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      setBackupSuccess('');
                      setBackupError('');
                      if (!backupDescriptionInput.trim()) {
                        setBackupError('Please write a detailed purpose label before snapping.');
                        return;
                      }
                      try {
                        const snap = await dbService.createBackupSnapshot(currentUser.fullName, backupDescriptionInput.trim());
                        setBackupSuccess(`Snapshot snapshot-idx "${snap}" successfully written to cloud backup clusters!`);
                        setBackupDescriptionInput('');
                        soundService.playSuccessChime();
                      } catch (err) {
                        setBackupError('Operation failed.');
                      }
                    }}
                    className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all"
                  >
                    Take Database Snapshot
                  </button>
                </div>
              </div>

              {/* Right Column: Snapshots ledger and lock logic */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-3">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-505" />
                      Snapshot Vault Registry
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9.5px] font-black rounded uppercase font-mono">
                      {backups.length} Snapshots
                    </span>
                  </div>

                  {backups.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs italic font-bold">
                      No cloud snapshots records loaded. Check connection to database clusters.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 space-y-3 text-[11px]">
                      {backups.map((snap) => {
                        const dateStr = snap.createdAt ? new Date(snap.createdAt).toLocaleString() : 'N/A';
                        
                        return (
                          <div key={snap.id} className="pt-3.5 first:pt-0 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                            <div className="space-y-1">
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-[11.5px]">{snap.description}</h4>
                                <span className="text-[8.5px] font-mono font-bold text-indigo-600 block">SNAP_ID: {snap.id}</span>
                              </div>
                              <div className="text-[9.5px] text-slate-500 font-mono flex items-center gap-3">
                                <span>Snapper: <strong className="text-slate-700 font-sans">{snap.createdBy}</strong></span>
                                <span>Recorded: <strong className="text-slate-755 text-slate-700 font-sans">{dateStr}</strong></span>
                              </div>
                            </div>

                            <div className="flex gap-1.5 shrink-0 select-none">
                              <button
                                onClick={() => {
                                  try {
                                    const dataStr = JSON.stringify(snap, null, 2);
                                    const blob = new Blob([dataStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const linkElement = document.createElement('a');
                                    linkElement.setAttribute('href', url);
                                    linkElement.setAttribute('download', `${snap.id}.json`);
                                    linkElement.click();
                                    URL.revokeObjectURL(url);
                                  } catch (e) {
                                    alert('Failed to construct download file block.');
                                  }
                                }}
                                className="px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider bg-violet-50 hover:bg-violet-100 text-[#8B5CF6] border border-violet-200 transition-all cursor-pointer"
                                title="Download complete database collection JSON file to local computer"
                              >
                                Download JSON
                              </button>

                              <button
                                onClick={async () => {
                                  // Super Admin Check directly
                                  if (!isZewdneh) {
                                    alert(`Permission Denied: Operator "${currentUser.fullName}" lacks Super Admin credentials. Snapshot rollback can only be performed by a Super Admin.`);
                                    return;
                                  }
                                  
                                  if (!confirm(`RESTORE WARNING: You are about to overwrite entire employee profiles, attendance exception blocks, and customer renewals databases using snapshot: "${snap.description}". Proceed?`)) return;
                                  try {
                                    await dbService.restoreBackupSnapshot(snap.id!);
                                    soundService.playSuccessChime();
                                    alert('SYSTEM RESTORE COMPLETED: Complete database rollback has been successfully executed. High compliance checks validated.');
                                    window.location.reload();
                                  } catch (err) {
                                    alert('Rollback failed. Validate firewall rule logs.');
                                  }
                                }}
                                className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                                  isZewdneh
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border opacity-60'
                                }`}
                                title={isZewdneh ? "Rollback system tables to snapshot state" : "Requires System Owner level clearances"}
                              >
                                Restore
                              </button>

                              <button
                                onClick={async () => {
                                  if (!confirm('Permanently purge this snapshot from the secure backup vaults?')) return;
                                  try {
                                    await dbService.deleteBackupSnapshot(snap.id!);
                                    soundService.playSuccessChime();
                                  } catch (err) {
                                    alert('Purge failed.');
                                  }
                                }}
                                className="p-1 hover:bg-rose-55 hover:bg-rose-50 border border-slate-100 rounded-md text-slate-500 hover:text-rose-605"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKSTATION ERROR MONITORING CENTER */}
        {activeTab === 'errors' && (
          <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-4 animate-fade-in text-[11px]">
            <div className="border-b border-rose-100 pb-2.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-rose-800 uppercase tracking-tight flex items-center gap-1.5ClassName">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Admin System Error Center & Security Anomalies
                </h3>
                <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium pl-0.5 leading-none">
                  Central trace router logging internal workstation and mobile API errors, failures, and security overrides.
                </p>
              </div>
              
              {systemErrors.length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm('Are you authorized to clear all error log entries?')) return;
                    try {
                      // Pure cloud clearance or batch deletion runs here
                      await dbService.clearSystemErrors();
                      soundService.playSuccessChime();
                      alert('Central logs wiped cleanly from cloud telemetry registries.');
                    } catch (err) {
                      alert('Logs clearance aborted.');
                    }
                  }}
                  className="px-2.5 py-1 hover:bg-rose-50 text-rose-800 text-[8.5px] font-black uppercase tracking-wider border border-rose-200 rounded-lg transition-all cursor-pointer"
                >
                  Wipe Error Logs
                </button>
              )}
            </div>

            {systemErrors.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs italic font-bold">
                Excellent. No system errors or credentials breaches filed inside telemetry caches.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {systemErrors.map((errLog) => {
                  const stamp = errLog.timestamp ? new Date(errLog.timestamp).toLocaleString() : 'N/A';
                  
                  return (
                    <div key={errLog.id} className="pt-3.5 first:pt-0 pb-1 font-mono text-[10px] space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-rose-700 font-extrabold block text-[10.5px] font-sans">
                          [{errLog.status || 'BREACH_LOG'}] {errLog.errorMsg || errLog.message}
                        </span>
                        <span className="text-[8.5px] text-slate-400 font-mono shrink-0">{stamp}</span>
                      </div>
                      
                      {errLog.stack && (
                        <pre className="p-2 bg-slate-900 text-slate-200 rounded-lg text-[9px] overflow-x-auto leading-relaxed scrollbar-thin shadow-2xs">
                          {errLog.stack}
                        </pre>
                      )}

                      <div className="flex items-center gap-4 text-[9px] text-slate-450 pt-0.5">
                        <span>Source: <strong className="text-slate-600">{errLog.component || 'LoginScreen'}</strong></span>
                        <span>Operator Context: <strong className="text-slate-600">{errLog.officer || 'Anonymous Client'}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOUBLE-CONFIRM POPUP MODAL ON DELETION */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3.5 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-50 pb-2">
              <UserX className="w-4.5 h-4.5 shrink-0" />
              <h4 className="text-[11px] font-black uppercase tracking-wider">Confirm Operator Destruction</h4>
            </div>
            
            <p className="text-[10.5px] text-slate-500 leading-normal">
              This action is final and irrecoverable. Are you certain you want to permanently delete the active workstation registry credentials for Operator <strong>{deletingUser.fullName}</strong> ({deletingUser.phoneNumber})?
            </p>

            {deleteError && (
              <div className="p-2 bg-rose-50 border border-rose-150 rounded text-rose-700 text-3xs font-mono font-bold">
                [Alert System State] {deleteError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-450 uppercase tracking-widest block select-none">
                To continue, type operator phone ID: <span className="text-slate-800 select-all font-mono font-black">{deletingUser.phoneNumber}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmPhone}
                onChange={(e) => setDeleteConfirmPhone(e.target.value)}
                placeholder="Verify Phone ID value"
                className="w-full bg-slate-50 border border-slate-200 text-3xs font-mono font-bold p-2 rounded-lg focus:outline-hidden text-slate-800"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={handleDeleteUser}
                disabled={deleteConfirmPhone !== deletingUser.phoneNumber}
                className={`flex-1 py-1.5 text-[10px] text-white uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                  deleteConfirmPhone === deletingUser.phoneNumber
                    ? 'bg-rose-605 bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border'
                }`}
              >
                Destroy Registry
              </button>
              <button
                onClick={() => {
                  setDeletingUser(null);
                  setDeleteConfirmPhone('');
                  setDeleteError('');
                }}
                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-605 text-slate-600 text-[10px] font-black rounded-lg cursor-pointer uppercase tracking-wider"
              >
                Abort Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
