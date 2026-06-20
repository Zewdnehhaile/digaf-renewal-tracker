import { useMemo, useState } from 'react';
import { Customer, ActivityLog, CustomerStatus, STATUS_COLORS, STATUS_LIST, User } from '../types';
import { Clock, Search, RotateCcw, Sliders, X, Calendar, NotepadText, Check, Download, Trash2, AlertTriangle, Info } from 'lucide-react';
import { dbService } from '../services/db';
import { useLanguage } from '../services/language';

interface ActivityLogViewProps {
  logs: ActivityLog[];
  customers: Customer[];
  isAdminView?: boolean;
  currentUser?: User;
}

export default function ActivityLogView({ logs, customers, isAdminView = false, currentUser }: ActivityLogViewProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  // Lock binding read from PC environment with dynamic resolution
  const activeOfficer = useMemo(() => {
    if (currentUser?.fullName) return currentUser.fullName;
    const remembered = localStorage.getItem('digaf_remembered_session');
    if (remembered) {
      try {
        const parsed = JSON.parse(remembered);
        if (parsed && parsed.fullName) {
          return parsed.fullName;
        }
      } catch (e) {}
    }
    return localStorage.getItem('digaf_active_officer') || 'Bound Operator';
  }, [currentUser]);

  // Verify if it is Zewdneh accessing
  const isZewdneh = useMemo(() => {
    const term = 'zewd';
    const hasZewd = (str?: string) => str?.toLowerCase().includes(term);
    return hasZewd(currentUser?.fullName) ||
           hasZewd(currentUser?.phoneNumber) ||
           hasZewd(localStorage.getItem('digaf_active_officer') || '') ||
           hasZewd(activeOfficer);
  }, [currentUser, activeOfficer]);

  // Toast confirmation state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Custom Inline Confirmation Modal State (Bypasses iframe blocked window.confirm)
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    onConfirm: () => {}
  });

  // Action manager for targeted customer updates from log search
  const [activeCustomerForAction, setActiveCustomerForAction] = useState<Customer | null>(null);
  const [editStatus, setEditStatus] = useState<CustomerStatus>('Renewal Processing');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [updatingCustIds, setUpdatingCustIds] = useState<Record<string, boolean>>({});

  // Sift and search historical logs matching customer names or officers
  const filteredLogs = useMemo(() => {
    const s = searchTerm.toLowerCase();
    if (!s) return logs;
    return logs.filter(log => 
      log.customerName.toLowerCase().includes(s) || 
      log.updatedBy.toLowerCase().includes(s) ||
      log.previousStatus.toLowerCase().includes(s) ||
      log.newStatus.toLowerCase().includes(s)
    );
  }, [logs, searchTerm]);

  // Handle immediate status override back-synchronization from Audit logs
  const handleSaveActionChanges = async () => {
    if (!activeCustomerForAction) return;

    try {
      await dbService.updateCustomer(activeCustomerForAction.id, {
        status: editStatus,
        notes: editNotes,
        followUpDate: editFollowUp
      }, activeOfficer);
      
      setSaveSuccess(true);
      showToast(`Successfully updated ${activeCustomerForAction.name}'s status to ${editStatus}.`, 'success');
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveCustomerForAction(null);
      }, 800);
    } catch (err) {
      console.error(err);
      showToast('Error modifying customer profile records.', 'error');
    }
  };

  // Clean wipe trigger for mock demo (non-destructive local recovery helper)
  const handleResetStorage = () => {
    setDialog({
      isOpen: true,
      title: 'Reset Entire Database',
      message: 'Are you sure you want to clear all data in the database and start fresh with empty lists? This will restore initial template mock records.',
      confirmText: 'Reset Database',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await dbService.resetToDefaults();
          showToast('Database wiped and reset to default mock records.', 'success');
        } catch (e) {
          console.error(e);
          showToast('Failed to reset database.', 'error');
        } finally {
          setDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const [clearingAdmin, setClearingAdmin] = useState(false);
  
  const handleClearAdminLogs = async () => {
    setDialog({
      isOpen: true,
      title: 'Wipe Administrative Action Entries',
      message: 'Are you sure you want to permanently clear all administrative action logs? This deletes password overrides, operator modifications, and account destruction logs from the database, keeping only standard customer events.',
      confirmText: 'Wipe Admin Logs',
      variant: 'warning',
      onConfirm: async () => {
        setClearingAdmin(true);
        try {
          await dbService.clearAdminLogs();
          showToast('Administrative activity logs permanently purged. Standard customer event trail is preserved.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Failed to clear administrative action logs.', 'error');
        } finally {
          setClearingAdmin(false);
          setDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteLog = async (logId: string) => {
    setDialog({
      isOpen: true,
      title: 'Confirm Audit Record Destruction',
      message: 'Delete this single audit log permanently from the MFI database ledger? This action is irreversible.',
      confirmText: 'Delete Permanently',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await dbService.deleteLog(logId);
          showToast('Audit log record deleted successfully from the ledger.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Failed to delete specific audit log.', 'error');
        } finally {
          setDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExportLogsCSV = () => {
    // Filter out rows done by admin
    const cleanLogs = filteredLogs.filter(log => {
      const msg = ((log.customerName || '') + ' ' + (log.updatedBy || '') + ' ' + (log.previousStatus || '') + ' ' + (log.newStatus || '')).toLowerCase();
      const isAdminLog = 
        msg.includes('admin') || 
        msg.includes('sysadmin') || 
        msg.includes('zewdneh') || 
        msg.includes('override password') || 
        msg.includes('deleted user workstation');
      return !isAdminLog;
    });

    const headers = ['Timestamp & Date', 'Customer Name', 'Previous Status', 'New Status', 'Officer Initiator'];
    const rows = cleanLogs.map(log => [
      new Date(log.timestamp).toLocaleString('en-US'),
      log.customerName,
      log.previousStatus,
      log.newStatus,
      log.updatedBy
    ]);

    // Format as CSV
    const csvContent = "\uFEFF" + [
      headers.join(','), 
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `digaf_mfi_clean_audit_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="activity_logs_view">
      {/* Toast Notification HUD banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce flex items-center gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 text-xs font-semibold">
          {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-50 text-gray-400 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-[#0B1330] flex items-center gap-2">
            <Clock className="w-5.5 h-5.5 text-[#8B5CF6]" />
            {t('Audit Log Ledger')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('Chronological log of all credit renewals, status transitions, and officer actions')}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {isAdminView && isZewdneh && (
            <>
              {/* Export logs CSV */}
              <button
                onClick={handleExportLogsCSV}
                className="px-3.5 py-2 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/15 text-[#8B5CF6] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export Logs (Excluding Admin Actions)"
              >
                <Download className="w-4 h-4" />
                Export Clean Logs CSV
              </button>

              {/* Clear Admin Logs */}
              <button
                onClick={handleClearAdminLogs}
                disabled={clearingAdmin}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Clear Administrative Actions Logs"
              >
                <Trash2 className="w-4 h-4 text-amber-600" />
                {clearingAdmin ? 'Clearing...' : 'Clear Admin Logs'}
              </button>
            </>
          )}

          {/* Reset database mock button helper */}
          <button
            onClick={handleResetStorage}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-rose-500" />
            {t('Clear All Mock/Real Data')}
          </button>
        </div>
      </div>

      {/* Search Input bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('Search customer names...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-200 text-xs p-3.5 pl-10 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6]"
        />
        {searchTerm && (
          <span className="absolute right-3.5 top-3 bg-amber-500 text-white text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded-sm shadow-xs animate-pulse">
            {t('Active search filter applied')}
          </span>
        )}
      </div>

      {/* Logs Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-10 text-center text-xs text-gray-400">
          {t('No activity records matched search parameters')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-[#F8FAFC] text-gray-400 uppercase text-3xs font-black tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-4 pl-6">{t('Timestamp & Date')}</th>
                  <th className="p-4">{t('Customer Name')}</th>
                  <th className="p-4">{t('Action Path Change')}</th>
                  <th className="p-4">{t('Officer Initiator')}</th>
                  <th className="p-4 pr-6 text-right">{t('Workflow Shortcut')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50" id="audit_table_body">
                {filteredLogs.map(log => {
                  const prevColor = STATUS_COLORS[log.previousStatus] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', accent: 'bg-gray-500' };
                  const nextColor = STATUS_COLORS[log.newStatus] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', accent: 'bg-gray-500' };

                  // Find matched customer record if present
                  const matchedCustomer = customers.find(
                    c => c.name.toLowerCase() === log.customerName.toLowerCase()
                  );

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors" id={`log_row_${log.id}`}>
                      <td className="p-4 pl-6 font-mono font-medium text-gray-500">
                        {new Date(log.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="p-4 font-bold text-[#0B1330]">
                        {log.customerName}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.previousStatus === log.newStatus ? (
                            <span className={`${nextColor.bg} ${nextColor.text} text-3xs font-bold px-2 py-0.5 rounded-full border ${nextColor.border}`}>
                              {log.newStatus} (Created)
                            </span>
                          ) : (
                            <>
                              <span className={`${prevColor.bg} ${prevColor.text} text-3xs font-bold px-2 py-0.5 rounded-full border ${prevColor.border} opacity-50`}>
                                {log.previousStatus}
                              </span>
                              <span className="text-gray-300 font-bold">➔</span>
                              <span className={`${nextColor.bg} ${nextColor.text} text-3xs font-bold px-2 py-0.5 rounded-full border ${nextColor.border}`}>
                                {log.newStatus}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-3xs bg-gray-100 text-gray-700 px-2 py-1 rounded-sm font-bold">
                          {log.updatedBy}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {matchedCustomer ? (
                          <div className="flex items-center justify-end gap-2">
                            {/* Direct Inline Status Changer */}
                            <select
                              value={matchedCustomer.status}
                              disabled={updatingCustIds[matchedCustomer.id]}
                              onChange={async (e) => {
                                const targetSt = e.target.value as CustomerStatus;
                                if (updatingCustIds[matchedCustomer.id]) return;
                                setUpdatingCustIds(prev => ({ ...prev, [matchedCustomer.id]: true }));
                                try {
                                  await dbService.updateCustomer(matchedCustomer.id, { status: targetSt }, activeOfficer);
                                } catch (err) {
                                  console.error('Error changing status from list:', err);
                                } finally {
                                  setUpdatingCustIds(prev => ({ ...prev, [matchedCustomer.id]: false }));
                                }
                              }}
                              className={`bg-white border border-gray-200 hover:border-violet-300 text-[10px] font-bold py-1 px-2.5 rounded-lg text-slate-700 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] transition-colors ${
                                updatingCustIds[matchedCustomer.id] ? 'opacity-40 cursor-not-allowed bg-gray-100' : ''
                              }`}
                            >
                              {STATUS_LIST.map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => {
                                setActiveCustomerForAction(matchedCustomer);
                                setEditStatus(matchedCustomer.status);
                                setEditNotes(matchedCustomer.notes || '');
                                setEditFollowUp(matchedCustomer.followUpDate || '');
                              }}
                              className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 border border-violet-100 text-[#8B5CF6] rounded-lg text-3xs font-black transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Override Details"
                            >
                              {t('Details')}
                            </button>

                            {isAdminView && isZewdneh && (
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-3xs font-bold transition-all cursor-pointer flex items-center justify-center"
                                title="Delete Single Audit Log"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-4xs text-gray-400 font-mono italic">No Active Record</span>

                            <button
                              onClick={async () => {
                                if (!confirm(t(`Are you sure you want to restore the deleted customer "${log.customerName}"?`))) return;
                                try {
                                  await dbService.restoreDeletedCustomer(log.customerName, log.newStatus || 'Renewal Processing', activeOfficer);
                                  showToast(`Successfully restored "${log.customerName}" back to the active workstation!`, 'success');
                                } catch (e) {
                                  console.error("Failed to restore customer:", e);
                                  showToast('Failed to execute customer recovery.', 'error');
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-600 rounded-lg text-3xs font-black transition-all cursor-pointer inline-flex items-center gap-1 uppercase tracking-wider shadow-3xs"
                              title="Redo / Restore this deleted customer back into the system database"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-500" />
                              Redo Restore
                            </button>

                            {isAdminView && isZewdneh && (
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-3xs font-bold transition-all cursor-pointer flex items-center justify-center"
                                title="Delete Single Audit Log"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. LIVE SHORTCUT CUSTOMER POPUP ACTION DESK */}
      {activeCustomerForAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl max-w-md w-full space-y-4">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-extrabold text-[#0B1330] font-sans flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#8B5CF6]" />
                Audit Shortcut Desk: {activeCustomerForAction.name}
              </h4>
              <button 
                onClick={() => setActiveCustomerForAction(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h5 className="text-sm font-bold text-[#0B1330]">Changes Applied Successfully</h5>
                <p className="text-3xs text-gray-400 font-mono">Synchronizing real-time to MFI cloud...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 p-2.5 rounded-lg text-4xs font-mono text-gray-500 leading-normal flex items-center gap-2">
                  <span>Current: <strong>{activeCustomerForAction.status}</strong></span>
                  <span>•</span>
                  <span>Signing: <strong>{activeOfficer}</strong></span>
                </div>

                <div>
                  <label className="text-4xs font-black text-gray-400 uppercase tracking-widest block mb-1">Override Status Column</label>
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
                  <label className="text-4xs font-black text-gray-400 uppercase tracking-widest block mb-1">Follow-Up Date</label>
                  <input
                    type="date"
                    value={editFollowUp}
                    onChange={(e) => setEditFollowUp(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6] font-bold"
                  />
                </div>

                <div>
                  <label className="text-4xs font-black text-gray-400 uppercase tracking-widest block mb-1">Officer Progress Notes</label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 focus:ring-1 focus:ring-[#8B5CF6]"
                    placeholder="Enter observation records..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-gray-50">
                  <button
                    onClick={() => setActiveCustomerForAction(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveActionChanges}
                    className="px-4 py-2 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:shadow-xs cursor-pointer inline-flex items-center gap-1"
                  >
                    Save Override
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Custom Double Confirmation Dialog Modal Overlay */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-[#0B1330]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <AlertTriangle className={`w-5 h-5 shrink-0 ${
                dialog.variant === 'danger' ? 'text-rose-500' : 
                dialog.variant === 'warning' ? 'text-amber-500' : 'text-[#8B5CF6]'
              }`} />
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0B1330]">
                {dialog.title}
              </h4>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              {dialog.message}
            </p>

            <div className="flex gap-2.5 justify-end pt-2 border-t border-gray-50">
              <button
                type="button"
                onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-3xs font-black uppercase tracking-wider rounded-lg cursor-pointer transition-colors"
                id="cancel-dialog-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await dialog.onConfirm();
                }}
                className={`px-3.5 py-2 text-white text-3xs font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all shadow-sm ${
                  dialog.variant === 'danger' ? 'bg-rose-500 hover:bg-rose-600' :
                  dialog.variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#8B5CF6] hover:bg-[#7c4fe0]'
                }`}
                id="confirm-dialog-button"
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Disclaimer info */}
      <div className="text-4xs text-gray-400 leading-relaxed font-mono text-center">
        CONFIDENTIAL AUDIT LEDGER - DIGAF MICROFINANCE INSTITUTION
      </div>
    </div>
  );
}
