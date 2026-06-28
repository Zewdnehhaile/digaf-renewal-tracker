import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Customer, CustomerStatus, STATUS_LIST, STATUS_COLORS, User, ActivityLog, AIConfig, OfficerAIPermission } from '../types';
import { dbService, getTodayDateString } from '../services/db';
import { soundService } from '../services/sound';
import {
    Plus,
    Edit,
    Trash2,
    Copy,
    Search,
    FileText,
    Users,
    Clock,
    RefreshCw,
    X,
    CheckCircle,
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
    customers,
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
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');
    const [applicantText, setApplicantText] = useState('');
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [editFormData, setEditFormData] = useState<any>({});
    const [updatingCustIds, setUpdatingCustIds] = useState<Record<string, boolean>>({});
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
    
    // Ref to track if we're currently updating to prevent useEffect overwrites
    const isUpdatingRef = useRef(false);

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

    // Update local customers when prop changes - but preserve local updates during optimistic UI
    useEffect(() => {
        if (!isUpdatingRef.current) {
            setLocalCustomers(customers);
        }
    }, [customers]);

    // Filter customers - show newest first (like FirstRoundQueue)
    const filteredCustomers = useMemo(() => {
        let result = localCustomers;
        if (focusedStatus) {
            result = localCustomers.filter(c => c.status === focusedStatus);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.phoneNumber.includes(q)
            );
        }
        // Sort newest first (highest createdAt first)
        return [...result].sort((a, b) => {
            const dateA = a.addedDate || a.createdAt || '';
            const dateB = b.addedDate || b.createdAt || '';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [localCustomers, focusedStatus, searchQuery]);

    // Counts for header
    const statusCount = filteredCustomers.length;
    const statusName = focusedStatus || 'Renewal Processing';
    const isRenewalProcessing = focusedStatus === 'Renewal Processing' || !focusedStatus;

    // Add Customer - OPTIMIZED with local state update
    const handleAddApplicant = async () => {
        if (!applicantText.trim()) {
            setToastMessage({ type: 'error', text: '❌ Please enter applicant details.' });
            setTimeout(() => setToastMessage(null), 3000);
            return;
        }

        const lines = applicantText.split('\n').filter(line => line.trim());
        const newCustomers: any[] = [];
        const skippedDuplicates: string[] = [];

        const todayStr = new Date().toISOString().split('T')[0];
        const todayNames = new Set(
            localCustomers
                .filter(c => c.addedDate && c.addedDate.split('T')[0] === todayStr)
                .map(c => c.name.trim().toLowerCase())
        );

        if (inputMode === 'single') {
            const [name, phone, notes, ...rest] = lines;
            const nameTrim = name ? name.trim() : '';
            if (nameTrim && todayNames.has(nameTrim.toLowerCase())) {
                setToastMessage({ type: 'error', text: `❌ "${nameTrim}" already exists today.` });
                setTimeout(() => setToastMessage(null), 3000);
                return;
            }
            if (nameTrim) {
                newCustomers.push({
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
                        skippedDuplicates.push(nameTrim);
                    } else {
                        newCustomers.push({
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

        if (newCustomers.length === 0) {
            let errorMsg = '❌ All names already exist today.';
            if (skippedDuplicates.length > 0) {
                errorMsg += ` Skipped: ${skippedDuplicates.join(', ')}`;
            }
            setToastMessage({ type: 'error', text: errorMsg });
            setTimeout(() => setToastMessage(null), 3000);
            return;
        }

        try {
            isUpdatingRef.current = true;
            // OPTIMIZED: Add all customers in parallel
            const addedCustomers = await Promise.all(
                newCustomers.map(cust => dbService.addCustomer(cust))
            );

            // OPTIMISTIC UPDATE: Add to local state immediately (newest at top)
            const newCustomerObjects = addedCustomers.map((result, index) => ({
                ...newCustomers[index],
                id: result.id || result._id || `cust-${Date.now()}-${index}`,
                _id: result._id
            }));

            setLocalCustomers(prev => [...newCustomerObjects, ...prev]);

            setApplicantText('');
            setShowAddForm(false);
            let successMsg = `✅ ${newCustomers.length} applicant(s) added!`;
            if (skippedDuplicates.length > 0) {
                successMsg += ` Skipped ${skippedDuplicates.length}`;
            }
            setToastMessage({ type: 'success', text: successMsg });
            setTimeout(() => setToastMessage(null), 3000);
            isUpdatingRef.current = false;
        } catch (error) {
            console.error('Error adding applicants:', error);
            setToastMessage({ type: 'error', text: '❌ Failed to add applicant.' });
            setTimeout(() => setToastMessage(null), 3000);
            isUpdatingRef.current = false;
        }
    };

    // Delete - OPTIMIZED with local state update
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete ${name}?`)) return;

        // OPTIMISTIC UPDATE: Remove immediately
        isUpdatingRef.current = true;
        setLocalCustomers(prev => prev.filter(c => c.id !== id && c._id !== id));

        try {
            await dbService.deleteCustomer(id);
            setToastMessage({ type: 'success', text: '✅ Deleted!' });
            setTimeout(() => setToastMessage(null), 2000);
            isUpdatingRef.current = false;
        } catch (error) {
            console.error('Error deleting:', error);
            // Rollback on error
            setLocalCustomers(customers);
            setToastMessage({ type: 'error', text: '❌ Failed to delete.' });
            setTimeout(() => setToastMessage(null), 2000);
            isUpdatingRef.current = false;
        }
    };

    // Copy - Like First Round
    const handleCopy = async (customer: Customer) => {
        const text = `Name: ${customer.name}\nPhone: ${customer.phoneNumber}\nStatus: ${customer.status}\nAdded: ${customer.addedDate}\nNotes: ${customer.notes || 'N/A'}`;
        await navigator.clipboard.writeText(text);
        setToastMessage({ type: 'success', text: '📋 Copied!' });
        setTimeout(() => setToastMessage(null), 2000);
    };

    // Status change - OPTIMIZED with local state update
    const handleStatusChange = async (customerId: string, targetStatus: CustomerStatus, customerName: string) => {
        if (!confirm(`Move "${customerName}" to ${targetStatus}?`)) return;

        // Find the customer
        const customer = localCustomers.find(c => c.id === customerId || c._id === customerId);
        if (!customer) return;

        const oldStatus = customer.status;

        // OPTIMISTIC UPDATE: Update immediately
        isUpdatingRef.current = true;
        setLocalCustomers(prev =>
            prev.map(c =>
                (c.id === customerId || c._id === customerId)
                    ? { 
                        ...c, 
                        status: targetStatus, 
                        updatedDate: new Date().toISOString(), 
                        updatedBy: activeOfficer,
                        lastStatusChangedBy: activeOfficer,
                        lastStatusChangedAt: new Date().toISOString()
                    }
                    : c
            )
        );

        setUpdatingCustIds(prev => ({ ...prev, [customerId]: true }));
        try {
            await dbService.updateCustomer(customerId, { 
                status: targetStatus,
                lastStatusChangedBy: activeOfficer,
                lastStatusChangedAt: new Date().toISOString()
            }, activeOfficer);
            
            // Log the activity
            if (onAddLog) {
                onAddLog(customerName, oldStatus as CustomerStatus, targetStatus, activeOfficer);
            }
            soundService.playSuccessChime();
            setToastMessage({ type: 'success', text: `✅ Moved to ${targetStatus}` });
            setTimeout(() => setToastMessage(null), 2000);
            
            // Clear updating flag after a short delay
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 500);
        } catch (err) {
            console.error(err);
            // Rollback on error
            setLocalCustomers(prev =>
                prev.map(c =>
                    (c.id === customerId || c._id === customerId)
                        ? { ...c, status: oldStatus }
                        : c
                )
            );
            setToastMessage({ type: 'error', text: '❌ Failed' });
            setTimeout(() => setToastMessage(null), 2000);
            isUpdatingRef.current = false;
        } finally {
            setUpdatingCustIds(prev => ({ ...prev, [customerId]: false }));
        }
    };

    // Overdue - OPTIMIZED with local state update
    const handleOverdue = async (customerId: string, customerName: string) => {
        if (!confirm(`Mark "${customerName}" as Overdue?`)) return;

        const customer = localCustomers.find(c => c.id === customerId || c._id === customerId);
        if (!customer) return;

        const today = getTodayDateString();
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yesterdayStr = `${yyyy}-${mm}-${dd}`;

        // OPTIMISTIC UPDATE: Update immediately
        isUpdatingRef.current = true;
        setLocalCustomers(prev =>
            prev.map(c =>
                (c.id === customerId || c._id === customerId)
                    ? { 
                        ...c, 
                        followUpDate: yesterdayStr, 
                        updatedDate: new Date().toISOString(), 
                        updatedBy: activeOfficer,
                        lastEditedBy: activeOfficer,
                        lastEditedAt: new Date().toISOString()
                    }
                    : c
            )
        );

        setUpdatingCustIds(prev => ({ ...prev, [customerId]: true }));
        try {
            await dbService.updateCustomer(customerId, { 
                followUpDate: yesterdayStr,
                lastEditedBy: activeOfficer,
                lastEditedAt: new Date().toISOString()
            }, activeOfficer);
            soundService.playSuccessChime();
            setToastMessage({ type: 'success', text: '✅ Overdue!' });
            setTimeout(() => setToastMessage(null), 2000);
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 500);
        } catch (err) {
            console.error(err);
            // Rollback
            setLocalCustomers(prev =>
                prev.map(c =>
                    (c.id === customerId || c._id === customerId)
                        ? { ...c, followUpDate: customer.followUpDate }
                        : c
                )
            );
            setToastMessage({ type: 'error', text: '❌ Failed' });
            setTimeout(() => setToastMessage(null), 2000);
            isUpdatingRef.current = false;
        } finally {
            setUpdatingCustIds(prev => ({ ...prev, [customerId]: false }));
        }
    };

    // Edit - OPTIMIZED with local state update
    const handleEditSave = async () => {
        if (!editingCustomer) return;

        const customerId = editingCustomer.id || editingCustomer._id;

        // OPTIMISTIC UPDATE: Update immediately
        isUpdatingRef.current = true;
        setLocalCustomers(prev =>
            prev.map(c =>
                (c.id === customerId || c._id === customerId)
                    ? {
                        ...c,
                        ...editFormData,
                        updatedDate: new Date().toISOString(),
                        updatedBy: activeOfficer,
                        lastEditedBy: activeOfficer,
                        lastEditedAt: new Date().toISOString()
                    }
                    : c
            )
        );

        try {
            delete editFormData._id;
            await dbService.updateCustomer(customerId, {
                ...editFormData,
                lastEditedBy: activeOfficer,
                lastEditedAt: new Date().toISOString()
            }, activeOfficer);
            setEditingCustomer(null);
            setToastMessage({ type: 'success', text: '✅ Updated!' });
            setTimeout(() => setToastMessage(null), 2000);
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 500);
        } catch (error) {
            console.error('Error updating customer:', error);
            // Rollback
            setLocalCustomers(customers);
            setToastMessage({ type: 'error', text: '❌ Failed to update.' });
            setTimeout(() => setToastMessage(null), 2000);
            isUpdatingRef.current = false;
        }
    };

    // Only show Add Form for Renewal Processing
    const isRenewalProcessingPage = focusedStatus === 'Renewal Processing' || !focusedStatus;

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Toast Messages */}
            {toastMessage && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl animate-fade-in max-w-md ${toastMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}>
                    <div className="flex items-center gap-2">
                        {toastMessage.type === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                            <X className="w-5 h-5 text-rose-500" />
                        )}
                        <span className="font-bold text-sm">{toastMessage.text}</span>
                    </div>
                </div>
            )}

            {/* Header - Like First Round */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#8B5CF6]" />
                        {t(statusName)}
                    </h2>
                    <p className="text-sm text-slate-500">Manage customer renewal workflow</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-lg text-xs font-bold text-[#8B5CF6]">
                        {t('Total')}: {statusCount}
                    </div>
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

            {/* Add Form - Only for Renewal Processing */}
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
                            <button onClick={handleAddApplicant} className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                                Add Customer
                            </button>
                            <button onClick={() => { setShowAddForm(false); setApplicantText(''); }} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search - Like CompletedLoans */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${statusName} customers...`}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
                />
            </div>

            {/* Customers List - Like FirstRoundQueue */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No {statusName} records found</p>
                    <p className="text-sm">Add your first customer using the button above</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredCustomers.map((customer, index) => {
                        const isUpdating = !!updatingCustIds[customer.id || customer._id];
                        const customerId = customer.id || customer._id;
                        return (
                            <div key={customerId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                            <h4 className="font-bold text-slate-800">{customer.name}</h4>
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
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {customer.addedDate ? formatDateWithTime(customer.addedDate) : 'N/A'}
                                            </span>
                                            {customer.updatedDate && customer.updatedDate !== customer.addedDate && (
                                                <span className="flex items-center gap-1 text-amber-600">
                                                    <Edit className="w-3 h-3" />
                                                    Edited: {formatDateWithTime(customer.updatedDate)}
                                                    {customer.updatedBy && ` by ${customer.updatedBy}`}
                                                </span>
                                            )}
                                            {customer.lastStatusChangedBy && customer.lastStatusChangedAt && (
                                                <span className="flex items-center gap-1 text-indigo-600">
                                                    <RefreshCw className="w-3 h-3" />
                                                    Status changed: {formatDateWithTime(customer.lastStatusChangedAt)}
                                                    {customer.lastStatusChangedBy && ` by ${customer.lastStatusChangedBy}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Action Buttons - Like First Round */}
                                <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                                    {STATUS_LIST.filter(st => st !== customer.status).slice(0, 4).map(targetStatus => {
                                        const shortLabel = targetStatus === 'No Response' ? 'No' : targetStatus.split(' ')[0];
                                        const colorClass = getButtonColor(targetStatus);
                                        return (
                                            <button
                                                key={targetStatus}
                                                disabled={isUpdating}
                                                onClick={() => handleStatusChange(customerId, targetStatus, customer.name)}
                                                className={`px-3 py-1.5 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border ${colorClass} ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}
                                            >
                                                {isUpdating ? '⏳' : shortLabel}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => handleOverdue(customerId, customer.name)}
                                        className={`px-3 py-1.5 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:scale-105 active:scale-95 cursor-pointer`}
                                    >
                                        Overdue
                                    </button>
                                </div>

                                {/* Actions - Like First Round */}
                                <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                                    <button
                                        onClick={() => { setEditingCustomer(customer); setEditFormData({ ...customer }); }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(customerId, customer.name)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
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

            {/* Edit Modal - Like FirstRoundQueue */}
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