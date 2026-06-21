import React, { useState, useMemo } from 'react';
import { Customer, CustomerStatus, STATUS_LIST, STATUS_COLORS, User, ActivityLog, AIConfig, OfficerAIPermission } from '../types';
import { dbService, getTodayDateString } from '../services/db';
import { soundService } from '../services/sound';
import { Search, Plus, Calendar, FileEdit, Trash2, Import, UserPlus, Check, X, MoveHorizontal, AlertTriangle, Sparkles, RefreshCw, Zap, Bot } from 'lucide-react';
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

export default function KanbanBoard({
  customers,
  focusedStatus,
  onAddLog,
  currentUser,
  logs = [],
  aiConfig = null,
  officerPermissions = [],
  currentWorkspace = 'first_round'
}: KanbanBoardProps) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const [loadingBrief, setLoadingBrief] = useState(false);
  const [aiBriefData, setAiBriefData] = useState<{
    currentSituation?: string;
    keyEvents?: string[];
    riskFactors?: string;
    recommendedNextAction?: string;
  } | null>(null);

  const handleCloseEdit = () => {
    setEditingCustomer(null);
    setAiBriefData(null);
    setLoadingBrief(false);
  };

  const isZewdneh = !!(currentUser?.fullName?.toLowerCase().includes('zewd') || currentUser?.phoneNumber?.toLowerCase().includes('zewd'));
  const isBriefAllowed = isZewdneh || (
    aiConfig?.featuresEnabled !== false &&
    aiConfig?.customerBriefEnabled !== false &&
    officerPermissions?.find(p => p.phoneNumber === currentUser?.phoneNumber)?.customerBriefAllowed === true
  );

  const handleGenerateBrief = async (customer: Customer) => {
    setLoadingBrief(true);
    setAiBriefData(null);
    try {
      const associatedLogs = logs.filter(l => l.customerName === customer.name);
      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, logs: associatedLogs })
      });
      if (!res.ok) throw new Error('AI engine communication breakdown.');
      const data = await res.json();
      setAiBriefData(data);
      soundService.playSuccessChime();

      await dbService.addAIUsageLog(
        currentUser?.fullName || 'Operator',
        currentUser?.phoneNumber || 'N/A',
        'CUSTOMER_BRIEF',
        `Generated intelligence brief for customer: ${customer.name}`
      );
    } catch (err: any) {
      alert('Failed to retrieve AI brief: ' + err.message);
    } finally {
      setLoadingBrief(false);
    }
  };

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

  const [columnSearch, setColumnSearch] = useState<Record<CustomerStatus, string>>(() => {
    const init: any = {};
    STATUS_LIST.forEach(st => { init[st] = ''; });
    return init;
  });

  const [columnBulkText, setColumnBulkText] = useState<Record<CustomerStatus, string>>(() => {
    const init: any = {};
    STATUS_LIST.forEach(st => { init[st] = ''; });
    return init;
  });

  const [showAddForm, setShowAddForm] = useState<CustomerStatus | null>(null);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<CustomerStatus>('Renewal Processing');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editEvidenceImage, setEditEvidenceImage] = useState<string | null>(null);
  const [editLoanAmount, setEditLoanAmount] = useState('');
  const [editServiceFee, setEditServiceFee] = useState('');
  const [editContractDueDate, setEditContractDueDate] = useState('');

  const [bulkStatusMsg, setBulkStatusMsg] = useState<Record<CustomerStatus, { type: 'success' | 'error'; text: string } | null>>(() => {
    const init: any = {};
    STATUS_LIST.forEach(st => { init[st] = null; });
    return init;
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingCustIds, setUpdatingCustIds] = useState<Record<string, boolean>>({});
  const [completedFilterToday, setCompletedFilterToday] = useState(true);
  const [showOverdueAll, setShowOverdueAll] = useState(false);
  const [importingStatus, setImportingStatus] = useState<CustomerStatus | null>(null);
  const [deletingStatus, setDeletingStatus] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const overdueCountAll = useMemo(() => {
    const todayStr = getTodayDateString();
    return customers.filter(c => {
      const isFinalized = c.status === 'Completed' || c.status === 'Rejected';
      return c.followUpDate && c.followUpDate < todayStr && !isFinalized;
    }).length;
  }, [customers]);

  const deletingCustomerObj = useMemo(() => {
    return customers.find(c => c.id === deletingId) || null;
  }, [customers, deletingId]);

  const isFieldEdited = useMemo(() => {
    if (!editingCustomer) return false;
    return (
      editName.trim() !== editingCustomer.name.trim() ||
      editPhone.trim() !== editingCustomer.phoneNumber.trim() ||
      editStatus !== editingCustomer.status ||
      editNotes.trim() !== (editingCustomer.notes || '').trim() ||
      editFollowUp !== (editingCustomer.followUpDate || '') ||
      (editEvidenceImage || null) !== (editingCustomer.evidenceImage || null) ||
      editLoanAmount !== (editingCustomer.loanAmount || '') ||
      editServiceFee !== (editingCustomer.serviceFee || '') ||
      editContractDueDate !== (editingCustomer.contractDueDate || '')
    );
  }, [editingCustomer, editName, editPhone, editStatus, editNotes, editFollowUp, editEvidenceImage, editLoanAmount, editServiceFee, editContractDueDate]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: CustomerStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    try {
      await dbService.updateCustomer(id, { status: targetStatus }, activeOfficer);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkImport = async (status: CustomerStatus) => {
    const text = columnBulkText[status]?.trim();
    if (!text) return;

    setImportingStatus(status);
    setBulkStatusMsg(prev => ({ ...prev, [status]: null }));

    try {
      const inputNames = text
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (inputNames.length === 0) {
        setImportingStatus(null);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const todayCustomers = customers.filter(c => c.addedDate && c.addedDate.split('T')[0] === todayStr);
      const todayNames = new Set(todayCustomers.map(c => c.name.trim().toLowerCase()));

      const uniqueInputs: string[] = [];
      const skippedDuplicates: string[] = [];

      inputNames.forEach(rawName => {
        const lower = rawName.trim().toLowerCase();
        if (todayNames.has(lower)) {
          skippedDuplicates.push(rawName.trim());
        } else {
          uniqueInputs.push(rawName.trim());
          todayNames.add(lower);
        }
      });

      if (uniqueInputs.length === 0) {
        setBulkStatusMsg(prev => ({
          ...prev,
          [status]: {
            type: 'error',
            text: `All ${inputNames.length} name(s) already registered today. Duplicates not allowed.`
          }
        }));
        setImportingStatus(null);
        return;
      }

      const cleanText = uniqueInputs.join('\n');
      const count = await dbService.importCustomers(cleanText, status, activeOfficer, currentWorkspace);

      if (count > 0) {
        soundService.playBulkCompleteChime();
        setColumnBulkText(prev => ({ ...prev, [status]: '' }));

        let msg = `✅ Successfully loaded ${count} client account${count > 1 ? 's' : ''}.`;
        if (skippedDuplicates.length > 0) {
          msg += ` Skipped ${skippedDuplicates.length} duplicate(s): ${skippedDuplicates.join(', ')}`;
        }

        setBulkStatusMsg(prev => ({
          ...prev,
          [status]: {
            type: 'success',
            text: msg
          }
        }));

        setTimeout(() => {
          setBulkStatusMsg(prev => ({ ...prev, [status]: null }));
        }, 6000);
      }
    } catch (err) {
      console.error(err);
      setBulkStatusMsg(prev => ({
        ...prev,
        [status]: {
          type: 'error',
          text: '❌ Smart directory import failed. Please try again.'
        }
      }));
    } finally {
      setImportingStatus(null);
    }
  };

  const handleBringToToday = async (matchedName: string, targetStatus: CustomerStatus) => {
    try {
      const prevCustObj = customers.find(c => c.name.trim().toLowerCase() === matchedName.trim().toLowerCase());
      await dbService.addCustomer({
        name: matchedName,
        phoneNumber: prevCustObj?.phoneNumber || '+251 900 000 000',
        status: targetStatus,
        addedBy: activeOfficer,
        notes: `Brought to today's active pipeline. Previously registered on ${formatDateWithTime(prevCustObj?.addedDate)} by ${prevCustObj?.addedBy || 'System'}.`,
      });
      soundService.playSuccessChime();

      setColumnBulkText(prev => {
        const textStr = prev[targetStatus] || '';
        const lines = textStr
          .split('\n')
          .map(n => n.trim())
          .filter(n => n.length > 0 && n.toLowerCase() !== matchedName.trim().toLowerCase());
        return {
          ...prev,
          [targetStatus]: lines.join('\n')
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddManualCustomer = async (status: CustomerStatus) => {
    const trimmedName = newCustName.trim();
    if (!trimmedName) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isDuplicate = customers.some(
      c => c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        c.addedDate && c.addedDate.split('T')[0] === todayStr
    );
    if (isDuplicate) {
      setAddFormError(`A customer with the name "${trimmedName}" already exists on today's date. Duplication on the same date is not allowed.`);
      return;
    }

    try {
      await dbService.addCustomer({
        name: trimmedName,
        phoneNumber: newCustPhone.trim() || '+251 900 000 000',
        status: status,
        addedBy: activeOfficer,
        notes: newCustNotes.trim(),
        workspace: currentWorkspace
      });

      soundService.playSuccessChime();
      setNewCustName('');
      setNewCustPhone('');
      setNewCustNotes('');
      setAddFormError(null);
      setShowAddForm(null);
    } catch (err) {
      console.error(err);
      setAddFormError('Database creation error.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditFormError('Account legal name is required.');
      return;
    }

    const editingCustomerDateStr = editingCustomer.addedDate ? editingCustomer.addedDate.split('T')[0] : new Date().toISOString().split('T')[0];
    const isDuplicate = customers.some(
      c => c.id !== editingCustomer.id &&
        c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        c.addedDate && c.addedDate.split('T')[0] === editingCustomerDateStr
    );
    if (isDuplicate) {
      setEditFormError(`A customer with the name "${trimmedName}" already exists on this record's date. Duplicate records for the same day are not allowed.`);
      return;
    }

    try {
      await dbService.updateCustomer(editingCustomer.id, {
        name: trimmedName,
        phoneNumber: editPhone.trim(),
        status: editStatus,
        notes: editNotes.trim(),
        followUpDate: editFollowUp,
        evidenceImage: editEvidenceImage || '',
        loanAmount: editLoanAmount,
        serviceFee: editServiceFee,
        contractDueDate: editContractDueDate
      }, activeOfficer);

      setEditingCustomer(null);
      setEditFormError(null);
    } catch (err) {
      console.error(err);
      setEditFormError('Failed to modify card details.');
    }
  };

  const handleOpenAddForm = (status: CustomerStatus) => {
    setAddFormError(null);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustNotes('');
    setShowAddForm(status);
  };

  const handleCloseAddForm = () => {
    setAddFormError(null);
    setShowAddForm(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    setDeletingStatus(deletingId);
    try {
      await dbService.deleteCustomer(deletingId);
      setDeletingId(null);
      setToastMessage({ type: 'success', text: '✅ Customer deleted successfully!' });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage({ type: 'error', text: '❌ Failed to delete customer.' });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDeletingStatus(null);
    }
  };

  const handleOpenEdit = (c: Customer) => {
    setEditFormError(null);
    setEditingCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phoneNumber);
    setEditStatus(c.status);
    setEditNotes(c.notes || '');
    setEditFollowUp(c.followUpDate || '');
    setEditEvidenceImage(c.evidenceImage || null);
    setEditLoanAmount(c.loanAmount || '');
    setEditServiceFee(c.serviceFee || '');
    setEditContractDueDate(c.contractDueDate || '');
  };

  return (
    <div className="space-y-6" id="kanban_board_component">
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl animate-fade-in max-w-md ${toastMessage.type === 'success'
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            )}
            <span className="font-bold text-sm">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Officer Control Panel */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[#0B1330] font-sans flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
            Workflow Management Console
          </h3>
          <p className="text-2xs text-gray-400 mt-0.5">Secure workstation terminal bound directly to this PC. Actions are permanent and non-repudiable.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setShowOverdueAll(!showOverdueAll);
              soundService.playSuccessChime();
            }}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-3xs ${showOverdueAll
              ? 'bg-rose-50 border-rose-300 text-rose-700 font-black ring-1 ring-rose-250'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOverdueAll ? 'bg-rose-600 animate-ping' : 'bg-rose-500'}`} />
            {t('Overdue All')} ({overdueCountAll})
          </button>

          <span className="hidden sm:inline-block w-px h-5 bg-slate-200 mx-1" />

          <label className="text-xs font-semibold text-gray-500 font-sans shrink-0">Terminal Identity:</label>
          <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 text-xs px-3 py-1.5 rounded-lg text-gray-800 font-bold font-mono">
            <span>{activeOfficer || 'Unbound Operator'}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm font-black scale-90">BOUND</span>
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className={focusedStatus ? "max-w-3xl mx-auto" : "overflow-x-auto pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-200"}>
        <div className={focusedStatus ? "" : "flex gap-4 min-w-[1600px] lg:min-w-none"}>

          {STATUS_LIST.filter(status => !focusedStatus || status === focusedStatus).map(status => {
            const searchStr = columnSearch[status]?.toLowerCase() || '';
            const allColCustomers = customers.filter(c => c.status === status);

            let rawColCustomers = allColCustomers;
            if (status === 'Completed' && completedFilterToday) {
              const todayStr = getTodayDateString();
              rawColCustomers = allColCustomers.filter(c => {
                const updateDateVal = c.updatedDate || c.addedDate || '';
                return updateDateVal.includes(todayStr);
              });
            }

            if (showOverdueAll) {
              const todayStr = getTodayDateString();
              rawColCustomers = rawColCustomers.filter(c => {
                const isFinalized = c.status === 'Completed' || c.status === 'Rejected';
                return c.followUpDate && c.followUpDate < todayStr && !isFinalized;
              });
            }

            const filteredCustomers = rawColCustomers.filter(c =>
              c.name.toLowerCase().includes(searchStr) ||
              c.phoneNumber.includes(searchStr)
            );

            const colors = STATUS_COLORS[status];

            return (
              <div
                key={status}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
                className={focusedStatus
                  ? "w-full bg-[#F8FAFC] rounded-2xl border border-gray-200/60 p-6 transition-colors flex flex-col min-h-[680px]"
                  : "flex-1 w-80 bg-[#F8FAFC] rounded-2xl border border-gray-200/60 p-4 transition-colors flex flex-col shrink-0 min-h-[680px]"}
                id={`kanban_column_${status.toLowerCase().replace(/\s+/g, '_')}`}
              >
                {/* Column Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full ${colors.accent}`} />
                    <div className="flex flex-col">
                      <h4 className="text-sm font-extrabold text-[#0B1330] font-sans uppercase">
                        {t(status)}
                      </h4>
                      {status === 'Completed' && (
                        <span className="text-[9px] text-slate-500 font-bold -mt-0.5">
                          {completedFilterToday ? t("Showing Today's Only") : t("Showing All-Time")}
                        </span>
                      )}
                    </div>
                    <span className={`${colors.bg} ${colors.text} text-3xs font-extrabold font-mono px-2 py-0.5 rounded-full border ${colors.border}`}>
                      {status === 'Completed'
                        ? `${rawColCustomers.length} ${t('Today')} / ${allColCustomers.length} ${t('Total')}`
                        : `${rawColCustomers.length} ${t('Records')}`
                      }
                    </span>
                  </div>

                  {focusedStatus && (
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-gray-200 shadow-3xs self-start sm:self-auto block select-none">
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${viewMode === 'cards'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {t('Pipeline Cards')}
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${viewMode === 'table'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {t('Ledger Table')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Search & Filter */}
                <div className="space-y-2 mb-3">
                  {status === 'Completed' && (
                    <div className="flex items-center justify-between bg-white border border-gray-200/80 p-1.5 rounded-xl text-[10px] font-bold shadow-3xs">
                      <button
                        type="button"
                        onClick={() => setCompletedFilterToday(true)}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[10px] font-black uppercase ${completedFilterToday
                          ? 'bg-[#8B5CF6] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-850'
                          }`}
                      >
                        Today's Completed ({allColCustomers.filter(c => {
                          const updateDateVal = c.updatedDate || c.addedDate || '';
                          return updateDateVal.includes(getTodayDateString());
                        }).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletedFilterToday(false)}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center text-[10px] font-black uppercase ${!completedFilterToday
                          ? 'bg-[#8B5CF6] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-850'
                          }`}
                      >
                        All-Time ({allColCustomers.length})
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${status}...`}
                      value={columnSearch[status]}
                      onChange={(e) => setColumnSearch(prev => ({ ...prev, [status]: e.target.value }))}
                      className="w-full bg-white border border-gray-200 text-2xs p-2 pl-8.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6]"
                    />
                  </div>
                </div>

                {/* Bulk Import */}
                {(() => {
                  const enteredNames = (columnBulkText[status] || '')
                    .split('\n')
                    .map(n => n.trim())
                    .filter(n => n.length > 0);
                  const linesCount = enteredNames.length;
                  return (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 mb-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider font-sans">
                            Smart Importer
                          </span>
                        </div>
                        {linesCount > 0 && (
                          <span className="text-[9px] text-[#8B5CF6] font-extrabold bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full animate-fade-in">
                            {linesCount} Names Detected
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <textarea
                          rows={2}
                          placeholder="Paste lists here (one name per line)&#10;Ahmed Ibrahim&#10;Belay Tekle..."
                          value={columnBulkText[status] || ''}
                          onChange={(e) => setColumnBulkText(prev => ({ ...prev, [status]: e.target.value }))}
                          className="w-full bg-white border border-gray-200 text-3xs p-2 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] placeholder-slate-400"
                        />
                        {linesCount > 0 && (
                          <button
                            onClick={() => setColumnBulkText(prev => ({ ...prev, [status]: '' }))}
                            className="absolute right-2 bottom-2 text-slate-400 hover:text-slate-600 font-bold p-1 text-4xs bg-slate-50 border border-slate-100 rounded-sm transition-all cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {(() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const globalMatches = customers.filter(c =>
                          enteredNames.some(input => input.toLowerCase() === c.name.trim().toLowerCase())
                        );

                        if (globalMatches.length === 0) return null;

                        return (
                          <div className="bg-gradient-to-r from-amber-50/95 to-slate-50 border-l-4 border-l-amber-500 border border-slate-200 rounded-xl p-3.5 space-y-3 animate-fade-in shadow-xs">
                            <div className="flex items-center justify-between border-b border-amber-200/40 pb-2">
                              <div className="flex items-center gap-2 text-xs text-amber-900 font-extrabold font-sans uppercase tracking-wider">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                                <span>Registered Portfolio Matches ({globalMatches.length})</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-3xs">
                                Verification Check
                              </span>
                            </div>

                            <div className="max-h-44 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
                              {globalMatches.map((matchedCust) => {
                                const isToday = matchedCust.addedDate && matchedCust.addedDate.split('T')[0] === todayStr;
                                return (
                                  <div key={matchedCust.id} className="bg-white border border-slate-200 p-3 rounded-lg flex flex-col gap-2 shadow-3xs hover:border-indigo-400 transition-colors duration-200">
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                      <span className="font-extrabold text-slate-900 text-xs tracking-tight">{matchedCust.name}</span>
                                      {isToday ? (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-250 px-2 py-0.5 rounded-md font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                          Active Today
                                        </span>
                                      ) : (
                                        <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-220 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1 shrink-0">
                                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                          Past Record
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-sans space-y-1 my-0.5 leading-normal">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-block text-xs">📅</span>
                                        <span className="font-semibold text-slate-500 w-20">Registered:</span>
                                        <span className="font-extrabold text-slate-800 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">{formatDateWithTime(matchedCust.addedDate)}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-block text-xs">👤</span>
                                        <span className="font-semibold text-slate-500 w-20">By Officer:</span>
                                        <span className="text-violet-700 font-extrabold bg-violet-50 border border-violet-105 px-1.5 py-0.5 rounded">{matchedCust.addedBy || 'System'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-block text-xs">📁</span>
                                        <span className="font-semibold text-slate-500 w-20">Status:</span>
                                        <span className="font-black text-slate-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide text-[10px]">{matchedCust.status}</span>
                                      </div>
                                    </div>

                                    {!isToday && (
                                      <button
                                        type="button"
                                        onClick={() => handleBringToToday(matchedCust.name, status)}
                                        className="mt-1 w-full py-1.5 text-center bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black uppercase rounded-lg text-2xs tracking-wider cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
                                        Re-register "{matchedCust.name}" on Today's Worklist
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {bulkStatusMsg[status] && (
                        <div className={`p-2 rounded-xl text-3xs font-extrabold leading-normal border flex items-start gap-1 ${bulkStatusMsg[status]?.type === 'error'
                          ? 'bg-rose-50 text-rose-800 border-rose-220/60'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-220/60'
                          }`}>
                          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${bulkStatusMsg[status]?.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`} />
                          <span>{bulkStatusMsg[status]?.text}</span>
                        </div>
                      )}

                      {linesCount === 0 ? (
                        <span className="text-[9px] text-slate-450 leading-relaxed font-sans block pl-1">
                          📋 Paste text from Excel/WhatsApp. Names will load as live workstation folders.
                        </span>
                      ) : (
                        <div className="text-[9px] text-emerald-600 font-bold pl-1 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          Click below to load {linesCount} clients directly here.
                        </div>
                      )}

                      <button
                        onClick={() => handleBulkImport(status)}
                        disabled={linesCount === 0 || importingStatus === status}
                        className={`w-full py-1.5 rounded-xl text-white text-3xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-3xs ${importingStatus === status
                          ? 'bg-amber-500 cursor-wait'
                          : linesCount === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#8B5CF6] hover:bg-[#7C3AED]'
                          }`}
                      >
                        {importingStatus === status ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Import className="w-3 h-3" />
                            Execute Smart Import
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}

                {/* Add Customer Button */}
                {showAddForm !== status ? (
                  <button
                    onClick={() => handleOpenAddForm(status)}
                    className="w-full py-2 mb-4 rounded-xl border border-dashed border-gray-300 hover:border-[#8B5CF6] text-gray-500 hover:text-[#8B5CF6] text-2xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    {t('New Customer')}
                  </button>
                ) : (
                  <div className="bg-white p-3 rounded-xl border border-purple-200 mb-4 space-y-2.5 animate-fade-in shadow-2xs font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-black text-purple-700 uppercase">{t('New Customer Data')}</span>
                      <button onClick={handleCloseAddForm} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                    </div>
                    {addFormError && (
                      <div className="p-2 rounded-lg text-3xs font-extrabold bg-rose-50 border border-rose-100 text-rose-700 leading-normal flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{addFormError}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder={t('Customer Legal Name *')}
                      value={newCustName}
                      onChange={(e) => {
                        setNewCustName(e.target.value);
                        setAddFormError(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 text-2xs p-1.5 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] font-semibold"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number (e.g. +251 9...)"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-2xs p-1.5 rounded-md"
                    />
                    <textarea
                      rows={2}
                      placeholder="Officer assessment notes..."
                      value={newCustNotes}
                      onChange={(e) => setNewCustNotes(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-2xs p-1.5 rounded-md"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddManualCustomer(status)}
                        className="flex-1 py-1 px-2.5 bg-[#8B5CF6] text-white rounded-md text-3xs font-bold hover:bg-[#8B5CF6]/90 cursor-pointer"
                      >
                        Register
                      </button>
                      <button
                        onClick={handleCloseAddForm}
                        className="py-1 px-2.5 bg-gray-100 text-gray-600 rounded-md text-3xs font-medium hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer List - Table View */}
                {focusedStatus && viewMode === 'table' ? (
                  <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-xs flex-1">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-sans">
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Client Portfolio</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Metrics</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Follow-Up Schedule</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Move Stage Action</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider text-right font-sans">Settings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCustomers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-xs text-slate-400 italic font-sans">
                                No customer records in this pipeline yet.
                              </td>
                            </tr>
                          ) : (
                            filteredCustomers.map(cust => (
                              <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 align-top max-w-xs">
                                  <div className="font-extrabold text-slate-900 text-xs">{cust.name}</div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50/70 py-0.5 px-2 rounded-md border border-indigo-100">
                                      {cust.phoneNumber}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">Recorded by {cust.addedBy || 'Officer'}</span>
                                  </div>
                                  {cust.notes && (
                                    <div className={`text-[10px] italic mt-2 pl-2 border-l-2 leading-relaxed font-sans ${cust.notes.toLowerCase().includes('the date is not same')
                                      ? 'text-red-600 border-red-500 font-bold bg-red-50/50 p-1.5 rounded-r-md'
                                      : cust.notes.toLowerCase().includes('bulk imported')
                                        ? 'text-emerald-600 border-emerald-500 font-bold bg-emerald-50/50 p-1.5 rounded-r-md'
                                        : 'text-slate-500 border-slate-200'
                                      }`}>
                                      "{cust.notes}"
                                    </div>
                                  )}
                                </td>

                                <td className="p-3 align-top font-mono text-3xs text-slate-500 space-y-0.5">
                                  <div>Added: {cust.addedDate ? formatDateWithTime(cust.addedDate) : 'N/A'}</div>
                                  <div>Updated: {cust.updatedDate ? formatDateWithTime(cust.updatedDate) : 'N/A'}</div>
                                </td>

                                <td className="p-3 align-top">
                                  {cust.followUpDate ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-lg font-bold">
                                      <Calendar className="w-2.5 h-2.5 text-amber-500" />
                                      {cust.followUpDate}
                                    </span>
                                  ) : (
                                    <span className="text-4xs text-slate-300 italic font-mono">Unscheduled</span>
                                  )}
                                </td>

                                {/* Status Transition Buttons - Fixed with loading states */}
                                <td className="p-3 align-top">
                                  <div className="flex flex-wrap gap-1.5 items-center max-w-[320px]">
                                    {STATUS_LIST.filter(st => st !== status).map(targetStatus => {
                                      const isUpdating = !!updatingCustIds[cust.id];
                                      const targetColors = STATUS_COLORS[targetStatus] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
                                      const shortenedLabel = targetStatus === 'No Response' ? 'No' : targetStatus.split(' ')[0];
                                      return (
                                        <button
                                          key={targetStatus}
                                          disabled={isUpdating}
                                          onClick={async () => {
                                            if (isUpdating) return;
                                            // Set loading state
                                            setUpdatingCustIds(prev => ({ ...prev, [cust.id]: true }));
                                            try {
                                              await dbService.updateCustomer(cust.id, { status: targetStatus }, activeOfficer);
                                              soundService.playSuccessChime();
                                              // Clear loading state immediately after success
                                              setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                              // Show success toast
                                              setToastMessage({ type: 'success', text: `✅ Moved to ${targetStatus}` });
                                              setTimeout(() => setToastMessage(null), 3000);
                                            } catch (err) {
                                              console.error(err);
                                              // Clear loading state even on error
                                              setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                              setToastMessage({ type: 'error', text: `❌ Failed to move to ${targetStatus}` });
                                              setTimeout(() => setToastMessage(null), 3000);
                                            }
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border ${isUpdating
                                              ? 'opacity-40 bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                              : `${targetColors.bg} ${targetColors.text} ${targetColors.border} hover:scale-105 active:scale-95 shadow-3xs cursor-pointer`
                                            }`}
                                          title={isUpdating ? 'Updating...' : `Move to ${targetStatus}`}
                                        >
                                          {isUpdating ? (
                                            <span className="flex items-center gap-1">
                                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                              Wait...
                                            </span>
                                          ) : (
                                            shortenedLabel
                                          )}
                                        </button>
                                      );
                                    })}

                                    <button
                                      disabled={!!updatingCustIds[cust.id]}
                                      onClick={async () => {
                                        setUpdatingCustIds(prev => ({ ...prev, [cust.id]: true }));
                                        try {
                                          const today = getTodayDateString();
                                          const d = new Date(today);
                                          d.setDate(d.getDate() - 1);
                                          const yyyy = d.getFullYear();
                                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                                          const dd = String(d.getDate()).padStart(2, '0');
                                          const yesterdayStr = `${yyyy}-${mm}-${dd}`;
                                          await dbService.updateCustomer(cust.id, { followUpDate: yesterdayStr }, activeOfficer);
                                          soundService.playSuccessChime();
                                          setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                          setToastMessage({ type: 'success', text: '✅ Marked as Overdue' });
                                          setTimeout(() => setToastMessage(null), 3000);
                                        } catch (err) {
                                          console.error(err);
                                          setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                          setToastMessage({ type: 'error', text: '❌ Failed to mark as Overdue' });
                                          setTimeout(() => setToastMessage(null), 3000);
                                        }
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-3xs font-extrabold uppercase tracking-tight transition-all border ${!!updatingCustIds[cust.id]
                                          ? 'opacity-40 bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:scale-105 active:scale-95 shadow-3xs cursor-pointer'
                                        }`}
                                      title="Mark follow-up as Overdue"
                                    >
                                      {!!updatingCustIds[cust.id] ? (
                                        <span className="flex items-center gap-1">
                                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                          Wait...
                                        </span>
                                      ) : (
                                        t('Overdue')
                                      )}
                                    </button>
                                  </div>
                                </td>

                                {/* Edit & Delete buttons */}
                                <td className="p-3 align-top text-right space-y-1 whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenEdit(cust)}
                                    className="px-2.5 py-1.5 bg-violet-50 text-[#8B5CF6] hover:bg-violet-100 text-3xs font-bold rounded-lg cursor-pointer transition-colors block w-full text-center"
                                  >
                                    Edit Note
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(cust.id)}
                                    disabled={deletingStatus === cust.id}
                                    className={`px-2.5 py-1.5 text-3xs font-bold rounded-lg cursor-pointer transition-colors block w-full text-center ${deletingStatus === cust.id
                                      ? 'bg-gray-200 text-gray-400 cursor-wait'
                                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                      }`}
                                  >
                                    {deletingStatus === cust.id ? (
                                      <span className="flex items-center justify-center gap-1">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        Deleting...
                                      </span>
                                    ) : (
                                      'Delete'
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Card View */
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-8 text-3xs text-gray-400 bg-white/40 border border-dashed border-gray-200 rounded-xl">
                        No matching records
                      </div>
                    ) : (
                      filteredCustomers.map(cust => (
                        <div
                          key={cust.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, cust.id)}
                          className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer relative group border-l-4"
                          style={{ borderLeftColor: colors.accent }}
                          id={`customer_card_${cust.id}`}
                        >
                          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                            <span className="text-3xs text-gray-300 pointer-events-none">&#9776;</span>
                          </div>

                          <div className="pr-4">
                            <h5 className="text-xs font-bold text-[#0B1330] font-sans truncate">
                              {cust.name}
                            </h5>
                            <p className="text-3xs font-mono font-bold text-gray-500 mt-0.5">
                              {cust.phoneNumber}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 mt-2 pt-2 border-t border-gray-50 gap-1 text-3xs text-gray-400">
                            <div>
                              <span className="block font-semibold scale-90 -ml-2 text-gray-300">ADDED</span>
                              <span>{cust.addedDate ? formatDateWithTime(cust.addedDate) : 'N/A'}</span>
                            </div>
                            <div className="text-right">
                              <span className="block font-semibold scale-90 -mr-2 text-gray-300">UPDATED</span>
                              <span>{cust.updatedDate ? formatDateWithTime(cust.updatedDate) : 'N/A'}</span>
                            </div>
                          </div>

                          {cust.notes && (
                            <p className={`text-3xs p-2 rounded-md mt-2 italic line-clamp-2 ${cust.notes.toLowerCase().includes('the date is not same')
                              ? 'text-red-700 bg-red-50 border border-red-200 font-semibold font-sans'
                              : cust.notes.toLowerCase().includes('bulk imported')
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold font-sans'
                                : 'text-gray-500 bg-gray-50/70'
                              }`}>
                              "{cust.notes}"
                            </p>
                          )}

                          {cust.followUpDate && (
                            <div className="mt-2 text-3xs bg-amber-50 border border-amber-200 text-amber-800 p-1 rounded-md flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              <span>Follow: <strong>{cust.followUpDate}</strong></span>
                            </div>
                          )}

                          <div className="mt-2.5 flex items-center gap-1">
                            <span className="text-3xs bg-[#8B5CF6]/10 text-[#8B5CF6] font-extrabold px-1.5 py-0.5 rounded-sm">
                              Officer: {cust.addedBy || 'Officer'}
                            </span>
                          </div>

                          {/* Quick Transition Pills */}
                          <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col gap-1.5">
                            <span className="text-4xs font-black text-gray-400 uppercase tracking-widest block">Quick Transition Pills</span>
                            <div className="flex flex-wrap gap-1">
                              {STATUS_LIST.filter(st => st !== status).map(targetStatus => {
                                const isUpdating = !!updatingCustIds[cust.id];
                                return (
                                  <button
                                    key={targetStatus}
                                    disabled={isUpdating}
                                    onClick={async () => {
                                      if (isUpdating) return;
                                      setUpdatingCustIds(prev => ({ ...prev, [cust.id]: true }));
                                      try {
                                        await dbService.updateCustomer(cust.id, { status: targetStatus }, activeOfficer);
                                        soundService.playSuccessChime();
                                        setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                      } catch (err) {
                                        console.error(err);
                                        setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-4xs font-extrabold transition-all uppercase tracking-tight scale-95 ${isUpdating
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                      : 'bg-gray-100 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6] text-gray-600 cursor-pointer'
                                      }`}
                                  >
                                    {isUpdating ? '⏳' : `➔ ${targetStatus.split(' ')[0]}`}
                                  </button>
                                );
                              })}

                              <button
                                disabled={!!updatingCustIds[cust.id]}
                                onClick={async () => {
                                  setUpdatingCustIds(prev => ({ ...prev, [cust.id]: true }));
                                  try {
                                    const today = getTodayDateString();
                                    const d = new Date(today);
                                    d.setDate(d.getDate() - 1);
                                    const yyyy = d.getFullYear();
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const yesterdayStr = `${yyyy}-${mm}-${dd}`;
                                    await dbService.updateCustomer(cust.id, { followUpDate: yesterdayStr }, activeOfficer);
                                    soundService.playSuccessChime();
                                    setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                  } catch (err) {
                                    console.error(err);
                                    setUpdatingCustIds(prev => ({ ...prev, [cust.id]: false }));
                                  }
                                }}
                                className={`px-1.5 py-0.5 rounded text-4xs font-extrabold transition-all uppercase tracking-tight scale-95 ${!!updatingCustIds[cust.id]
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer border border-rose-100 font-extrabold'
                                  }`}
                              >
                                {!!updatingCustIds[cust.id] ? '⏳' : `➔ ${t('Overdue')}`}
                              </button>
                            </div>
                          </div>

                          {/* Card Actions Footer */}
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEdit(cust)}
                              className="text-3xs text-gray-500 hover:text-[#8B5CF6] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <FileEdit className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => setDeletingId(cust.id)}
                              disabled={deletingStatus === cust.id}
                              className={`text-3xs font-bold flex items-center gap-1 cursor-pointer ${deletingStatus === cust.id
                                ? 'text-gray-400 cursor-wait'
                                : 'text-gray-400 hover:text-red-600'
                                }`}
                            >
                              {deletingStatus === cust.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-xl w-full transition-all ${isBriefAllowed && (aiBriefData || loadingBrief) ? 'max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6' : 'max-w-md space-y-4'}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="text-sm font-bold text-[#0B1330] font-sans flex items-center gap-1.5">
                  <FileEdit className="w-4 h-4 text-[#8B5CF6]" />
                  Modify Customer Account Details
                </h4>
                <button onClick={handleCloseEdit} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                {editFormError && (
                  <div className="p-2.5 rounded-xl text-3xs font-extrabold bg-rose-50 border border-rose-100 text-rose-700 leading-normal flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{editFormError}</span>
                  </div>
                )}

                <div>
                  <label className="text-3xs font-black text-gray-400 uppercase">Customer Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setEditFormError(null); }}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>

                <div>
                  <label className="text-3xs font-black text-gray-400 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>

                <div>
                  <label className="text-3xs font-black text-gray-400 uppercase">Credit Flow Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CustomerStatus)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6] font-bold"
                  >
                    {STATUS_LIST.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-3xs font-black text-gray-400 uppercase">Action Follow-Up Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={editFollowUp}
                    onChange={(e) => setEditFollowUp(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>

                <div>
                  <label className="text-3xs font-black text-gray-400 uppercase">Credit Officer Observation Notes</label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-50">
                <button onClick={handleCloseEdit} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer">
                  Go Back
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer ${isFieldEdited
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {isFieldEdited ? 'Apply Changes (Edited)' : 'Apply Changes (OK)'}
                </button>
              </div>
            </div>

            {/* AI Brief */}
            {isBriefAllowed && (aiBriefData || loadingBrief) && (
              <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-3.5 flex flex-col justify-between h-full select-none">
                <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                  <h5 className="text-[10.5px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] animate-pulse" />
                    Digaf Smart Brief Analyzer
                  </h5>
                  {aiBriefData && (
                    <span className="text-[7.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-black uppercase tracking-widest leading-none">synced</span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 max-h-[385px] scrollbar-thin rounded-lg">
                  {loadingBrief ? (
                    <div className="p-16 text-center text-slate-400 text-[10.5px] font-bold flex flex-col items-center justify-center gap-1.5 h-full">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#8B5CF6]" />
                      Auditing status history logs and notes...
                    </div>
                  ) : aiBriefData ? (
                    <div className="space-y-4 divide-y divide-slate-100 text-[11px] animate-fade-in text-slate-700">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider font-sans">Current Situation</span>
                        <p className="leading-relaxed font-semibold text-slate-900">{aiBriefData.currentSituation}</p>
                      </div>
                      <div className="space-y-1 pt-3">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider font-sans">Historical Milestones</span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 font-medium">
                          {aiBriefData.keyEvents && aiBriefData.keyEvents.map((evt: string, idx: number) => (
                            <li key={idx}>{evt}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-1 pt-3">
                        <span className="text-[9px] font-bold uppercase text-rose-500 block tracking-wider flex items-center gap-1 font-sans">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Active Risk Assessments
                        </span>
                        <p className="leading-relaxed text-slate-600 font-medium">{aiBriefData.riskFactors}</p>
                      </div>
                      <div className="space-y-1 pt-3">
                        <span className="text-[9px] font-bold uppercase text-[#8B5CF6] block tracking-wider flex items-center gap-1 font-sans">
                          <Zap className="w-3 h-3 shrink-0 text-amber-500 animate-pulse" />
                          Prescribing Next Action
                        </span>
                        <p className="leading-relaxed p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl font-bold text-slate-800">{aiBriefData.recommendedNextAction}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleGenerateBrief(editingCustomer)}
                    disabled={loadingBrief}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 inline shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                    {loadingBrief ? 'Synthesizing Brief...' : '⚡ Re-Generate Smart Brief'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && deletingCustomerObj && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-xl max-w-sm w-full space-y-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-50 border border-rose-100 mb-3">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <h4 className="text-sm font-bold text-[#0B1330] font-sans">
                Confirm Account Record Deletion?
              </h4>
              <p className="text-2xs text-gray-400 mt-2">
                This will permanently delete <strong>{deletingCustomerObj.name}</strong> ({deletingCustomerObj.phoneNumber}) from column <em>{deletingCustomerObj.status}</em>. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer">
                No, Keep Record
              </button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors" id="confirm_delete_button">
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}