import { useMemo, useState } from 'react';
import { Customer, ActivityLog, STATUS_COLORS, STATUS_LIST, CustomerStatus, User } from '../types';
import { dbService } from '../services/db';
import { CheckCircle2, AlertCircle, Search, Check, Sparkles, X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../services/language';

interface QuickControllerViewProps {
  customers: Customer[];
  logs: ActivityLog[]; // Kept for interface compatibility but retired from internal view
  currentUser?: User;
  onNavigateToReports?: () => void;
}

export default function QuickControllerView({
  customers,
  logs = [],
  currentUser,
  onNavigateToReports
}: QuickControllerViewProps) {
  const { t } = useLanguage();
  // Quick Controller & search states
  const [custSearch, setCustSearch] = useState('');
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [statusToApply, setStatusToApply] = useState<CustomerStatus>('Renewal Processing');
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const activeOfficer = useMemo(() => {
    const rawName = currentUser?.fullName || localStorage.getItem('digaf_active_officer') || 'Bound Operator';
    const isZewd = !!(currentUser?.fullName?.toLowerCase().includes('zewd') || currentUser?.phoneNumber?.toLowerCase().includes('zewd') || rawName.toLowerCase().includes('zewd'));
    if (isZewd) {
      return 'Zewdneh (SysAdmin)';
    }
    return rawName;
  }, [currentUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Search customers in real-time
  const searchedCustomers = useMemo(() => {
    if (!custSearch.trim()) return [];
    const query = custSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.phoneNumber && c.phoneNumber.includes(query))
    );
  }, [customers, custSearch]);

  const activeSelectedCust = useMemo(() => {
    if (!selectedCust) return null;
    return customers.find(c => c.id === selectedCust.id) || selectedCust;
  }, [customers, selectedCust]);

  const customerStatusLogs = useMemo(() => {
    if (!activeSelectedCust) return [];
    return logs
      .filter(l => l.customerName.toLowerCase() === activeSelectedCust.name.toLowerCase())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, activeSelectedCust]);

  const handleUpdateStatus = async () => {
    if (!activeSelectedCust) return;
    setIsUpdating(true);
    try {
      await dbService.updateCustomer(activeSelectedCust.id, { status: statusToApply }, activeOfficer);
      showToast(`Successfully transitioned ${activeSelectedCust.name} to "${statusToApply}" status.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error updating customer status in database.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200" id="officer-quick-controller">
      <style>{`
        @keyframes rainbowBlink {
          0%, 100% { color: #f43f5e; transform: scale(1.02); }
          20% { color: #a855f7; transform: scale(1.0); }
          40% { color: #3b82f6; transform: scale(1.02); }
          60% { color: #10b981; transform: scale(1.0); }
          80% { color: #f59e0b; transform: scale(1.02); }
        }
        .animate-blink-color {
          animation: rainbowBlink 2s infinite ease-in-out;
        }
      `}</style>

      {/* Toast Notification HUD banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce flex items-center gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 text-xs font-semibold">
          {toast.type === 'success' ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-50 text-gray-400 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* REFINED HEADER WITH BLINKING 1. FIND CUSTOMER ACCOUNTS AND DATE REFERENCE */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Active Operator info and Blinking Target Controller before system Time Reference */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-755 shrink-0">
              {t('Active Operator:')} <span className="font-extrabold text-indigo-350">{activeOfficer}</span>
            </div>
            
            {/* Blinking bold colored section heading to search easily */}
            <span className="text-[13px] font-black tracking-wide uppercase select-none animate-blink-color bg-slate-850 px-3.5 py-1.5 rounded-lg border border-slate-700 shadow-inner flex items-center gap-1.5">
              <span>★</span> {t('1. Find Customer Accounts')}
            </span>
          </div>

          {/* Time Reference */}
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 bg-slate-855 px-3.5 py-2 rounded-lg border border-slate-800 shrink-0 self-start lg:self-auto">
            <span>{t('System Time Reference:')}</span>
            <span className="bg-indigo-950 text-indigo-300 font-extrabold px-2 py-0.5 rounded border border-indigo-900 font-mono">2026-06-04</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* ONE-COLUMN GRID: Centered live search & modification */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-xs space-y-4">
          <div className="pb-2 border-b border-slate-100 flex justify-between items-center">
            <p className="text-3xs text-slate-400 font-medium">
              {t('Enter customer name or phone to begin actioning status transfers.')}
            </p>
            {onNavigateToReports && (
              <button
                type="button"
                onClick={onNavigateToReports}
                className="text-xs text-[#8B5CF6] hover:underline font-extrabold font-mono"
              >
                {t('Open Audit Reports')}
              </button>
            )}
          </div>

          {/* Quick search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={t('Search registered customer names or phone references...')}
              value={custSearch}
              onChange={(e) => {
                setCustSearch(e.target.value);
              }}
              className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 font-bold tracking-wide"
            />
            {custSearch && (
              <button
                type="button"
                onClick={() => {
                  setCustSearch('');
                  setSelectedCust(null);
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search result helper dropdown / view */}
          {custSearch && searchedCustomers.length > 0 && (
            <div className="max-h-52 overflow-y-auto border border-slate-150 rounded-lg divide-y divide-slate-100 bg-white shadow-md">
              {searchedCustomers.map((cust) => {
                const isCur = activeSelectedCust?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCust(cust);
                      setStatusToApply(cust.status);
                    }}
                    className={`p-3 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                       isCur ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="font-extrabold text-slate-800">{cust.name}</p>
                      <p className="text-3xs text-slate-500 font-mono mt-0.5">{cust.phoneNumber || t('Phone Number')}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-4xs font-black uppercase rounded-full ${STATUS_COLORS[cust.status]?.bg || 'bg-slate-100'} ${STATUS_COLORS[cust.status]?.text || 'text-slate-700'}`}>
                      {t(cust.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {custSearch && searchedCustomers.length === 0 && (
            <p className="text-xs text-slate-400 italic font-mono p-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              {t('No matching account records found. Please verify details...')}
            </p>
          )}

          {/* Selected customer action zone */}
          {activeSelectedCust ? (
            <div className="mt-4 p-5 bg-indigo-50/40 rounded-xl border border-indigo-100 shadow-inner space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-indigo-150">
                <div className="min-w-0">
                  <span className="text-4xs text-indigo-600 font-mono uppercase tracking-widest font-black block">{t('Active Account Targeted')}</span>
                  <h5 className="font-black text-slate-850 text-sm mt-0.5 truncate">{activeSelectedCust.name}</h5>
                  <p className="text-3xs text-slate-500 font-mono mt-0.5">{t('DB UID Ref:')} <span className="font-bold">{activeSelectedCust.id}</span></p>
                </div>
                <span className={`px-3 py-1 text-3xs font-black uppercase rounded-full shrink-0 ${STATUS_COLORS[activeSelectedCust.status]?.bg} ${STATUS_COLORS[activeSelectedCust.status]?.text} shadow-xs`}>
                  {t(activeSelectedCust.status)}
                </span>
              </div>

              {/* Connected Account Verification Ledger */}
              <div className="bg-gradient-to-r from-amber-50/95 to-white/95 border-l-4 border-l-amber-500 border border-amber-200/60 p-3.5 rounded-xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-900 font-extrabold uppercase tracking-widest font-sans">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Account Verification Ledger</span>
                  </div>
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isToday = activeSelectedCust.addedDate && activeSelectedCust.addedDate.split('T')[0] === todayStr;
                    return isToday ? (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-250 px-2 py-0.5 rounded-md font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Active Today
                      </span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-220 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                        Past Record
                      </span>
                    );
                  })()}
                </div>
                <div className="text-[11px] text-slate-700 font-sans space-y-1.5 leading-normal mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">📅</span>
                    <span className="font-semibold text-slate-400 w-20">Registered On:</span>
                    <span className="font-extrabold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-3xs">
                      {activeSelectedCust.addedDate ? new Date(activeSelectedCust.addedDate).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">👤</span>
                    <span className="font-semibold text-slate-400 w-20">By Officer:</span>
                    <span className="text-violet-700 font-extrabold bg-violet-50 border border-violet-105 px-1.5 py-0.5 rounded">
                      {activeSelectedCust.addedBy || 'System'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">📁</span>
                    <span className="font-semibold text-slate-400 w-20">Status:</span>
                    <span className="font-black text-slate-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide text-[10px]">
                      {activeSelectedCust.status}
                    </span>
                  </div>
                </div>

                {/* STATUS TRANSITION HISTORY TRAIL (WHO CHANGED THE STATUS AND WHEN) */}
                {customerStatusLogs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2">
                    <div className="text-[9px] text-amber-900 font-extrabold uppercase tracking-widest font-sans flex items-center gap-1">
                      <span className="text-xs">⏱</span>
                      <span>Status Change Timeline</span>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {customerStatusLogs.map((log) => {
                        const isCurState = activeSelectedCust.status === log.newStatus;
                        return (
                          <div key={log.id} className={`text-[10px] bg-white/95 border p-2 rounded-lg flex flex-col gap-1 shadow-3xs transition-shadow hover:shadow-2xs ${
                            isCurState ? 'border-indigo-200 bg-indigo-50/20' : 'border-amber-100/70'
                          }`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-slate-800 flex items-center gap-1 text-[9px] capitalize">
                                👤 {log.updatedBy}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 font-semibold text-[9px]">
                              {log.previousStatus === log.newStatus ? (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-1 rounded-sm">Registered Account</span>
                              ) : (
                                <>
                                  <span className="line-through text-slate-400 font-medium truncate max-w-[80px]">{log.previousStatus}</span>
                                  <span className="text-slate-400 font-bold">➔</span>
                                  <span className="font-black text-indigo-700 bg-indigo-50/50 px-1 rounded-sm truncate max-w-[95px]">{log.newStatus}</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3">
                <span className="text-[11px] font-black uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 inline text-indigo-600" /> {t('Apply Workflow Transition Stage')}
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {STATUS_LIST.map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setStatusToApply(stat)}
                      className={`px-3 py-2 text-3xs font-black uppercase rounded-lg text-left transition-all truncate border cursor-pointer ${
                        statusToApply === stat
                           ? 'bg-linear-to-r from-indigo-700 to-[#8B5CF6] border-indigo-700 text-white font-black shadow-md scale-102'
                           : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300'
                      }`}
                    >
                      {t(stat)}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isUpdating || activeSelectedCust.status === statusToApply}
                    onClick={handleUpdateStatus}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-3xs tracking-widest rounded-lg transition-all cursor-pointer disabled:opacity-40 text-center shadow-lg hover:shadow-indigo-200"
                  >
                    {isUpdating ? t('Transitioning DB...') : t('APPLY STAGE TRANSITION NOW')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCust(null);
                      setCustSearch('');
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    {t('Cancel Action')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              {t('Search for a customer account in the search bar above to trigger live transition controls')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

