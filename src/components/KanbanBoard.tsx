// src/components/KanbanBoard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, CustomerStatus, STATUS_LIST, STATUS_COLORS, User, ActivityLog, AIConfig, OfficerAIPermission } from '../types';
import { dbService, getTodayDateString } from '../services/db';
import { soundService } from '../services/sound';
// Add this import at the top with other imports
import { AlertCircle } from 'lucide-react';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Copy,
  Search,
  FileText,
  Users,
  Clock,
  RefreshCw,
  X,
  Calendar
} from 'lucide-react';
import { useLanguage } from '../services/language';

interface KanbanBoardProps {
  customers: Customer[];
  focusedStatus?: CustomerStatus;
  onAddLog: (name: string, prev: CustomerStatus, next: CustomerStatus, user: string) => void;
  currentUser?: User;
  logs?: ActivityLog[];
  aiConfig?: AIConfig | null;
  officerPermissions?: OfficerAIPermission[];
  currentWorkspace?: 'first_round' | 'second_round';
  onRefresh?: () => Promise<void>;
}

const formatDateWithTime = (dateStr?: string) => {
  if (!dateStr || dateStr === 'N/A' || dateStr === 'None') return 'None';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return dateStr;
  }
};

// Status colors matching First Round
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'Completed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Paid': 'bg-blue-100 text-blue-700 border-blue-200',
    'Waiting': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Rejected': 'bg-red-100 text-red-700 border-red-200',
    'No Response': 'bg-amber-100 text-amber-700 border-amber-200',
    'Renewal Processing': 'bg-violet-100 text-violet-700 border-violet-200'
  };
  return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
};

// Get button color - Like First Round
const getButtonColor = (status: string) => {
  const colors: Record<string, string> = {
    'Completed': 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
    'Paid': 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
    'Waiting': 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200',
    'Rejected': 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200',
    'No Response': 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
    'Renewal Processing': 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
  };
  return colors[status] || 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200';
};

export default function KanbanBoard({
  customers: propCustomers,
  focusedStatus,
  onAddLog,
  currentUser,
  logs = [],
  aiConfig = null,
  officerPermissions = [],
  currentWorkspace = 'first_round',
  onRefresh
}: KanbanBoardProps) {
  const { t } = useLanguage();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');
  const [applicantText, setApplicantText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [filterType, setFilterType] = useState<'all' | 'today'>('all');
  const [blacklistedCustomers, setBlacklistedCustomers] = useState<Set<string>>(new Set());
  const [addingCustomers, setAddingCustomers] = useState(false);
  const activeOfficer = useMemo(() => {
    if (currentUser?.fullName) return currentUser.fullName;
    const remembered = localStorage.getItem('digaf_remembered_session');
    if (remembered) {
      try {
        const parsed = JSON.parse(remembered);
        if (parsed && parsed.fullName) {
          return parsed.fullName;
        }
      } catch (e) { }
    }
    return localStorage.getItem('digaf_active_officer') || 'System';
  }, [currentUser]);

  // Get today's date string
  const today = new Date().toISOString().split('T')[0];

  // Fetch customers from MongoDB - like FirstRoundQueue
  const fetchCustomers = async () => {
    try {
      const data = await dbService.getCustomers();
      // Filter by workspace
      let filtered = data.filter((c: any) => c.workspace === currentWorkspace);
      if (focusedStatus) {
        filtered = filtered.filter((c: any) => c.status === focusedStatus);
      }

      // Ensure all customers have an id field
      const normalized = filtered.map((c: any) => {
        if (!c.id && c._id) {
          return { ...c, id: c._id };
        }
        return c;
      });

      setCustomers(normalized);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [focusedStatus, currentWorkspace]);


  useEffect(() => {
    const checkBlacklist = async () => {
      const blacklisted = new Set<string>();
      for (const customer of customers) {
        const check = await dbService.checkBlacklist(customer.phoneNumber);
        if (check && check.status === 'Blocked') {
          blacklisted.add(customer.id || customer._id);
        }
      }
      setBlacklistedCustomers(blacklisted);
    };
    if (customers.length > 0) {
      checkBlacklist();
    }
  }, [customers]);
  // Filter customers by search and date filter
  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q)
      );
    }

    // Date filter - like CompletedLoans
    if (filterType === 'today') {
      result = result.filter(c => {
        const addedDate = c.addedDate?.split('T')[0] || '';
        const updatedDate = c.updatedDate?.split('T')[0] || '';
        return addedDate === today || updatedDate === today;
      });
    }

    // Sort newest first
    return [...result].sort((a, b) => {
      const dateA = a.addedDate || a.createdAt || '';
      const dateB = b.addedDate || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [customers, searchQuery, filterType, today]);

  // Counts for header - like CompletedLoans
  const totalCount = customers.length;
  const todayCount = customers.filter(c => {
    const addedDate = c.addedDate?.split('T')[0] || '';
    const updatedDate = c.updatedDate?.split('T')[0] || '';
    return addedDate === today || updatedDate === today;
  }).length;

  const statusName = focusedStatus || 'Renewal Processing';
  const isRenewalProcessing = focusedStatus === 'Renewal Processing' || !focusedStatus;

  // Add Customer - with Blacklist check and duplicate detection with status
  const handleAddApplicant = async () => {
    setAddingCustomers(true);
    if (!applicantText.trim()) {
      alert('❌ Please enter applicant details.');
      setAddingCustomers(false);
      return;
    }

    const lines = applicantText.split('\n').filter(line => line.trim());
    let newCustomers: any[] = [];
    const skippedDuplicates: string[] = [];

    const allCustomers = propCustomers || customers;
    const allNames = new Set(
      allCustomers.map(c => c.name.trim().toLowerCase())
    );

    // Store status info for duplicate detection
    const existingCustomerMap = new Map();
    allCustomers.forEach(c => {
      existingCustomerMap.set(c.name.trim().toLowerCase(), c.status);
    });

    if (inputMode === 'single') {
      const [name, phone, notes, ...rest] = lines;
      const nameTrim = name ? name.trim() : '';
      if (nameTrim && allNames.has(nameTrim.toLowerCase())) {
        const existingStatus = existingCustomerMap.get(nameTrim.toLowerCase());
        alert(`❌ "${nameTrim}" already exists with status "${existingStatus}".\n\nYou cannot add duplicate customers.`);
        return;
      }
      if (nameTrim) {
        // BLACKLIST CHECK
        const blacklistCheck = await dbService.checkBlacklist(nameTrim);
        if (blacklistCheck && blacklistCheck.status === 'Blocked') {
          alert(`⚠️ Customer "${nameTrim}" exists in Blacklist!\n\nReason: ${blacklistCheck.reason}\n\nThis customer cannot be added unless approved by Admin.`);
          return;
        }

        newCustomers.push({
          id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: nameTrim,
          phoneNumber: phone || '+251 900 000 000',
          status: 'Renewal Processing',
          addedBy: activeOfficer,
          addedDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
          notes: notes || '',
          workspace: currentWorkspace,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      lines.forEach(name => {
        const nameTrim = name.trim();
        if (nameTrim) {
          if (todayNames.has(nameTrim.toLowerCase())) {
            const existingStatus = existingCustomerMap.get(nameTrim.toLowerCase());
            skippedDuplicates.push(`${nameTrim} (${existingStatus})`);
          } else {
            // BLACKLIST CHECK for bulk mode
            // Note: For bulk, we'll check after processing all names
            newCustomers.push({
              id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: nameTrim,
              phoneNumber: '+251 900 000 000',
              status: 'Renewal Processing',
              addedBy: activeOfficer,
              addedDate: new Date().toISOString(),
              updatedDate: new Date().toISOString(),
              notes: '',
              workspace: currentWorkspace,
              createdAt: new Date().toISOString()
            });
            todayNames.add(nameTrim.toLowerCase());
          }
        }
      });
    }

    // For bulk mode, check blacklist after processing all names
    if (inputMode === 'bulk' && newCustomers.length > 0) {
      let blockedCustomers: string[] = [];
      for (const customer of newCustomers) {
        const check = await dbService.checkBlacklist(customer.name);
        if (check && check.status === 'Blocked') {
          blockedCustomers.push(customer.name);
        }
      }
      if (blockedCustomers.length > 0) {
        alert(`⚠️ The following customers exist in Blacklist:\n\n${blockedCustomers.join('\n')}\n\nThese customers cannot be added unless approved by Admin.`);
        // Remove blocked customers from the list
        const blockedSet = new Set(blockedCustomers);
        newCustomers = newCustomers.filter(c => !blockedSet.has(c.name));
        if (newCustomers.length === 0) return;
      }
    }

    if (newCustomers.length === 0) {
      let errorMsg = '❌ All names already exist today.';
      if (skippedDuplicates.length > 0) {
        errorMsg += ` Skipped: ${skippedDuplicates.join(', ')}`;
      }
      alert(errorMsg);
      return;
    }

    try {
      // OPTIMISTIC UPDATE - Show customers immediately
      setCustomers(prev => [...newCustomers, ...prev]);

      // Then save to database in background
      await Promise.all(
        newCustomers.map(cust => dbService.addCustomer(cust))
      );

      setApplicantText('');
      setShowAddForm(false);

      let successMsg = `✅ ${newCustomers.length} applicant(s) added successfully!`;
      if (skippedDuplicates.length > 0) {
        successMsg += `\n\nSkipped duplicates:\n${skippedDuplicates.join('\n')}`;
      }
      alert(successMsg);

      // Refresh to update counts
      await fetchCustomers();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error adding applicants:', error);
      alert('❌ Failed to add applicant. Please try again.');
    }
    finally {
      setAddingCustomers(false); // <-- ADD THIS LINE
    }
  };

  // Delete - Fixed for customers with string _id
  // Delete - Fixed to handle both ObjectId and string IDs
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      // Find the customer by either id or _id
      let customer = customers.find(c => c.id === id);
      if (!customer) {
        customer = customers.find(c => c._id === id);
      }

      if (!customer) {
        alert('❌ Customer not found.');
        console.log('Customer not found with ID:', id);
        return;
      }

      console.log('Found customer:', customer);
      console.log('Customer id:', customer.id);
      console.log('Customer _id:', customer._id);

      // Use the id field if it exists and starts with 'cust-', otherwise use _id
      let deleteId = customer.id;

      // If id doesn't exist or doesn't start with 'cust-', use _id
      if (!deleteId || !deleteId.startsWith('cust-')) {
        deleteId = customer._id;
      }

      if (!deleteId) {
        alert('❌ Customer has no valid ID.');
        return;
      }

      console.log('Deleting with ID:', deleteId);

      await dbService.deleteCustomer(deleteId);
      setCustomers(prev => prev.filter(c => c.id !== deleteId && c._id !== deleteId));
      alert('✅ Customer deleted successfully!');

      // Refresh to update counts
      await fetchCustomers();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('❌ Failed to delete customer.');
    }
  };

  // Copy
  // Replace the handleCopy function with this:
  const handleCopy = async (customer: Customer) => {
    const text = customer.name;
    await navigator.clipboard.writeText(text);

    // Show temporary feedback without alert
    const button = document.activeElement as HTMLElement;
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = '✅ Copied!';
      button.style.color = '#10B981';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.color = '';
      }, 1500);
    }
  };

  // Status change - with proper refresh
  const handleStatusChange = async (customerId: string, targetStatus: CustomerStatus, customerName: string) => {
    if (!confirm(`Move "${customerName}" to ${targetStatus}?`)) return;

    const customer = customers.find(c => c.id === customerId || c._id === customerId);
    if (!customer) return;

    const oldStatus = customer.status;

    // Optimistic update
    setCustomers(prev =>
      prev.map(c =>
        (c.id === customerId || c._id === customerId)
          ? { ...c, status: targetStatus, updatedDate: new Date().toISOString() }
          : c
      )
    );

    try {
      const updateId = customer.id || customer._id;
      await dbService.updateCustomer(updateId, {
        status: targetStatus,
        lastStatusChangedBy: activeOfficer,
        lastStatusChangedAt: new Date().toISOString(),
        updatedBy: activeOfficer,  // Add this line
        updatedDate: new Date().toISOString()  // Also ensure updatedDate is set
      }, activeOfficer);

      if (onAddLog) {
        onAddLog(customerName, oldStatus as CustomerStatus, targetStatus, activeOfficer);
      }
      soundService.playSuccessChime();
      alert(`✅ Moved to ${targetStatus}`);

      // Refresh to update counts and sidebar
      await fetchCustomers();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
      // Rollback
      setCustomers(prev =>
        prev.map(c =>
          (c.id === customerId || c._id === customerId)
            ? { ...c, status: oldStatus }
            : c
        )
      );
      alert('❌ Failed to update status.');
    }
  };

  // Overdue - with proper refresh
  const handleOverdue = async (customerId: string, customerName: string) => {
    if (!confirm(`Mark "${customerName}" as Overdue?`)) return;

    const customer = customers.find(c => c.id === customerId || c._id === customerId);
    if (!customer) return;

    const todayStr = getTodayDateString();
    const d = new Date(todayStr);
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;

    setCustomers(prev =>
      prev.map(c =>
        (c.id === customerId || c._id === customerId)
          ? { ...c, followUpDate: yesterdayStr, updatedDate: new Date().toISOString() }
          : c
      )
    );

    try {
      const updateId = customer.id || customer._id;
      await dbService.updateCustomer(updateId, {
        followUpDate: yesterdayStr,
        lastEditedBy: activeOfficer,
        lastEditedAt: new Date().toISOString()
      }, activeOfficer);
      soundService.playSuccessChime();
      alert('✅ Marked as Overdue!');

      // Refresh to update counts
      await fetchCustomers();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
      setCustomers(prev =>
        prev.map(c =>
          (c.id === customerId || c._id === customerId)
            ? { ...c, followUpDate: customer.followUpDate }
            : c
        )
      );
      alert('❌ Failed to mark as overdue.');
    }
  };

  // Edit - with proper refresh and blacklist check
  const handleEditSave = async () => {
    if (!editingCustomer) return;

    const customerId = editingCustomer.id || editingCustomer._id;

    // BLACKLIST CHECK - Check if the edited phone number is blacklisted
    if (editFormData.phoneNumber && editFormData.phoneNumber !== editingCustomer.phoneNumber) {
      const blacklistCheck = await dbService.checkBlacklist(editFormData.phoneNumber);
      if (blacklistCheck && blacklistCheck.status === 'Blocked') {
        alert(`⚠️ This phone number "${editFormData.phoneNumber}" exists in Blacklist!\n\nReason: ${blacklistCheck.reason}\n\nThis customer cannot be updated unless approved by Admin.`);
        return;
      }
    }

    setCustomers(prev =>
      prev.map(c =>
        (c.id === customerId || c._id === customerId)
          ? { ...c, ...editFormData, updatedDate: new Date().toISOString() }
          : c
      )
    );

    try {
      delete editFormData._id;
      await dbService.updateCustomer(customerId, {
        ...editFormData,
        lastEditedBy: activeOfficer,
        lastEditedAt: new Date().toISOString(),
        updatedBy: activeOfficer,  // Add this line
        updatedDate: new Date().toISOString()  // Also ensure updatedDate is set
      }, activeOfficer);
      setEditingCustomer(null);
      alert('✅ Customer updated successfully!');

      // Refresh to update counts
      await fetchCustomers();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      setCustomers(prev =>
        prev.map(c =>
          (c.id === customerId || c._id === customerId)
            ? { ...c, ...editingCustomer }
            : c
        )
      );
      alert('❌ Failed to update customer.');
    }
  };

  const isRenewalProcessingPage = focusedStatus === 'Renewal Processing' || !focusedStatus;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Like CompletedLoans with All/Today buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B5CF6]" />
            {t(statusName)}
          </h2>
          <p className="text-sm text-slate-500">Manage customer renewal workflow</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* All button - like CompletedLoans */}
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all'
              ? 'bg-violet-500 text-white'
              : 'bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100'
              }`}
          >
            All: {totalCount}
          </button>

          {/* Today button - like CompletedLoans */}
          <button
            onClick={() => setFilterType('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'today'
              ? 'bg-emerald-500 text-white'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
              }`}
          >
            Today: {todayCount}
          </button>

          {isRenewalProcessingPage && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {isRenewalProcessingPage && showAddForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
          <h3 className="text-sm font-black text-slate-800 mb-4">Add New Customers</h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('single')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${inputMode === 'single' ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Single Customer
            </button>
            <button
              onClick={() => setInputMode('bulk')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${inputMode === 'bulk' ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Bulk Paste Mode
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {inputMode === 'single' ? 'Customer Details' : 'Paste Names (one per line)'}
              </label>
              <textarea
                value={applicantText}
                onChange={(e) => setApplicantText(e.target.value)}
                placeholder={inputMode === 'single' ? "Full Name\nPhone Number\nNotes" : "Ahmed Ibrahim\nBelay Tekle\nKirubel Tibebu"}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-mono text-sm min-h-[150px]"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddApplicant}
                disabled={addingCustomers}
                className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCustomers ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Customers'
                )}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setApplicantText(''); }}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${statusName} customers (${filterType === 'today' ? 'Today only' : 'All records'})...`}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

      {/* Customers List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">
            {filterType === 'today' ? `No ${statusName} records today` : `No ${statusName} records found`}
          </p>
          <p className="text-sm">
            {filterType === 'today' ? 'Check back later for today\'s activity' : 'Add your first customer using the button above'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCustomers.map((customer, index) => {
            const customerId = customer.id || customer._id;
            const isToday = customer.addedDate?.split('T')[0] === today ||
              customer.updatedDate?.split('T')[0] === today;

            return (
              <div key={customerId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      <h4 className="font-bold text-slate-800">{customer.name}</h4>
                      {blacklistedCustomers.has(customer.id || customer._id) && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full border border-red-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          BLACKLISTED
                        </span>
                      )}
                      {isToday && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p><span className="font-medium">Phone:</span> {customer.phoneNumber}</p>
                      <p><span className="font-medium">Status:</span>
                        <span className={`inline-block ml-1 px-2 py-0.5 rounded text-[10px] font-black ${getStatusColor(customer.status)}`}>
                          {customer.status}
                        </span>
                      </p>
                      {customer.notes && (
                        <p className="text-slate-600 italic">"{customer.notes}"</p>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span><span className="font-medium">Added by:</span> {customer.addedBy || activeOfficer}</span>
                      {customer.updatedBy && (
                        <span><span className="font-medium">Last edit by:</span> {customer.updatedBy}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {customer.addedDate ? formatDateWithTime(customer.addedDate) : 'N/A'}
                      </span>
                      {customer.updatedDate && customer.updatedDate !== customer.addedDate && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Edit className="w-3 h-3" />
                          Edited: {formatDateWithTime(customer.updatedDate)}
                        </span>
                      )}
                      {customer.followUpDate && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Calendar className="w-3 h-3" />
                          Follow-up: {formatDateWithTime(customer.followUpDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                  {STATUS_LIST.filter(st => st !== customer.status).map(targetStatus => {
                    const shortLabel = targetStatus === 'No Response' ? 'No' : targetStatus.split(' ')[0];
                    const colorClass = getButtonColor(targetStatus);
                    const isBlacklisted = blacklistedCustomers.has(customer.id || customer._id);
                    return (
                      <button
                        key={targetStatus}
                        onClick={() => handleStatusChange(customer._id || customer.id, targetStatus, customer.name)}
                        disabled={isBlacklisted}
                        className={`px-3 py-1.5 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border ${colorClass} ${isBlacklisted ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handleOverdue(customer._id || customer.id, customer.name)}
                    className="px-3 py-1.5 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Overdue
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                  <button
                    onClick={() => { setEditingCustomer(customer); setEditFormData({ ...customer }); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(customer._id || customer.id, customer.name)}
                    disabled={blacklistedCustomers.has(customer.id || customer._id)}
                    className={`px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${blacklistedCustomers.has(customer.id || customer._id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  <button
                    onClick={() => handleCopy(customer)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-auto"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800">Edit Customer</h3>
              <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Full Name"
                className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
              />
              <input
                type="text"
                value={editFormData.phoneNumber || ''}
                onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                placeholder="Phone Number"
                className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
              />
              <select
                value={editFormData.status || 'Renewal Processing'}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold"
              >
                {STATUS_LIST.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <input
                type="date"
                value={editFormData.followUpDate || ''}
                onChange={(e) => setEditFormData({ ...editFormData, followUpDate: e.target.value })}
                placeholder="Follow-up Date"
                className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
              />
              <textarea
                value={editFormData.notes || ''}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Notes"
                className="w-full p-2 border border-slate-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleEditSave} className="flex-1 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black rounded-xl transition-all cursor-pointer">
                Save Changes
              </button>
              <button onClick={() => setEditingCustomer(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}