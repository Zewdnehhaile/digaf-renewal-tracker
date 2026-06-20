import { useMemo, useState } from 'react';
import { Customer, CustomerStatus, STATUS_COLORS, User } from '../types';
import { dbService, getTodayDateString } from '../services/db';
import { Calendar, Phone, Check, RefreshCw, AlertCircle, FileSpreadsheet, NotepadText } from 'lucide-react';
import { soundService } from '../services/sound';
import { useLanguage } from '../services/language';

const getTomorrowDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface FollowUpTodayProps {
  customers: Customer[];
  currentUser?: User;
}

export default function FollowUpToday({ customers, currentUser }: FollowUpTodayProps) {
  const { t } = useLanguage();
  const todayStr = getTodayDateString();
  
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
    return localStorage.getItem('digaf_active_officer') || '';
  }, [currentUser]);

  // Filter customers slated for follow-up today, including past left-over items that are not finalized
  const followUpList = useMemo(() => {
    return customers.filter(cust => {
      if (!cust.followUpDate) return false;
      const isFinalized = cust.status === 'Completed' || cust.status === 'Rejected';
      return cust.followUpDate <= todayStr && !isFinalized;
    });
  }, [customers, todayStr]);

  // Handle active sub-tab for granular follow-ups
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'today' | 'overdue'>(() => {
    const saved = localStorage.getItem('digaf_followup_subtab');
    if (saved === 'today' || saved === 'overdue' || saved === 'all') {
      localStorage.removeItem('digaf_followup_subtab'); // consume it
      return saved;
    }
    return 'all';
  });

  const overdueList = useMemo(() => {
    return followUpList.filter(cust => cust.followUpDate && cust.followUpDate < todayStr);
  }, [followUpList, todayStr]);

  const todayList = useMemo(() => {
    return followUpList.filter(cust => cust.followUpDate === todayStr);
  }, [followUpList, todayStr]);

  const displayedList = useMemo(() => {
    if (activeSubTab === 'today') return todayList;
    if (activeSubTab === 'overdue') return overdueList;
    return followUpList;
  }, [activeSubTab, todayList, overdueList, followUpList]);

  const [isBulkRescheduling, setIsBulkRescheduling] = useState(false);

  const handleRescheduleOverdueToToday = async () => {
    if (isBulkRescheduling || overdueList.length === 0) return;
    setIsBulkRescheduling(true);
    try {
      const promises = overdueList.map(cust => 
        dbService.updateCustomer(cust.id, { followUpDate: todayStr }, activeOfficer)
      );
      await Promise.all(promises);
      soundService.playBulkCompleteChime();
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkRescheduling(false);
    }
  };

  const formattedTodayHuman = useMemo(() => {
    try {
      const d = new Date(todayStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  }, [todayStr]);

  // Inline Quick Notes save helper
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [updatingCustIds, setUpdatingCustIds] = useState<Record<string, boolean>>({});

  // Bulk shift states
  const [showConfirmBulk, setShowConfirmBulk] = useState(false);
  const [isBulkPostponing, setIsBulkPostponing] = useState(false);

  const startNotesEdit = (id: string, currentValMessage: string) => {
    setEditingNotesId(id);
    setTempNotes(currentValMessage);
  };

  const saveNotesEdit = async (id: string) => {
    try {
      await dbService.updateCustomer(id, { notes: tempNotes }, activeOfficer);
      setEditingNotesId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChangeInline = async (id: string, targetStatus: CustomerStatus) => {
    if (updatingCustIds[id]) return;
    setUpdatingCustIds(prev => ({ ...prev, [id]: true }));
    try {
      // Clear follow up date if they successfully change from No Response to active / completed
      const updates: Partial<Customer> = { status: targetStatus };
      if (targetStatus !== 'No Response') {
        updates.followUpDate = ''; // cleared
      }
      await dbService.updateCustomer(id, updates, activeOfficer);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCustIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handlePostponeIndividual = async (id: string) => {
    if (updatingCustIds[id]) return;
    setUpdatingCustIds(prev => ({ ...prev, [id]: true }));
    try {
      const tomorrowStr = getTomorrowDateString();
      await dbService.updateCustomer(id, { followUpDate: tomorrowStr }, activeOfficer);
      soundService.playSuccessChime();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCustIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleBringIndividualToToday = async (id: string) => {
    if (updatingCustIds[id]) return;
    setUpdatingCustIds(prev => ({ ...prev, [id]: true }));
    try {
      await dbService.updateCustomer(id, { followUpDate: todayStr }, activeOfficer);
      soundService.playSuccessChime();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCustIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handlePostponeAll = async () => {
    if (isBulkPostponing || followUpList.length === 0) return;
    setIsBulkPostponing(true);
    try {
      const tomorrowStr = getTomorrowDateString();
      const promises = followUpList.map(cust => 
        dbService.updateCustomer(cust.id, { followUpDate: tomorrowStr }, activeOfficer)
      );
      await Promise.all(promises);
      soundService.playBulkCompleteChime();
      setShowConfirmBulk(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBulkPostponing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="follow_up_today_view">
      {/* View Header */}
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold font-sans text-[#0B1330] flex items-center gap-2">
          <Calendar className="w-5.5 h-5.5 text-[#8B5CF6]" />
          {t('Follow Up Today Desk')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('Displays all automated and manually scheduled credit follow-ups due on today\'s bank date.')}
        </p>
      </div>

      {/* Date Reference Badge & Officer Context info */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 rounded-xl gap-4 font-sans">
        <div className="text-xs text-gray-600">
          {t('Active Query Date:')} <strong className="text-[#8B5CF6] font-mono text-xs">{todayStr}</strong> {formattedTodayHuman ? `(${formattedTodayHuman})` : ''}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{t('Signing changes as:')}</span>
          <span className="bg-[#8B5CF6] text-white px-3 py-1 rounded-full font-bold text-3xs uppercase shadow-sm">
            {t('Officer: ')} {activeOfficer}
          </span>
        </div>
      </div>

      {/* THREE-ROUND INTERACTIVE SUB-TAB CHANNELS */}
      {followUpList.length > 0 && (
        <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full max-w-md font-sans border border-slate-200 shadow-3xs">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-white text-[#8B5CF6] shadow-2xs font-black scale-102'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('All Active Due')} ({followUpList.length})
          </button>
          <button
            onClick={() => setActiveSubTab('today')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'today'
                ? 'bg-white text-amber-600 shadow-2xs font-black scale-102'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t("Today's Due")} ({todayList.length})
          </button>
          <button
            onClick={() => setActiveSubTab('overdue')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer relative ${
              activeSubTab === 'overdue'
                ? 'bg-white text-rose-600 shadow-2xs font-black scale-102'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('Overdue All')} ({overdueList.length})
            {overdueList.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* DYNAMIC ACTION CHANNELS FOR OVERDUE ACCOUNTS */}
      {overdueList.length > 0 && (activeSubTab === 'overdue' || activeSubTab === 'all') && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl gap-4 font-sans animate-fade-in shadow-3xs">
          <div className="space-y-0.5 text-left">
            <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5 uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
              {t('Overdue Follow-ups Flagged')}
            </h4>
            <p className="text-3xs text-rose-700/80">
              {t('You have')} {overdueList.length} {t('unfinished renewals whose scheduled follow-up dates are in the past. Clean them now!')}
            </p>
          </div>
          <button
            onClick={handleRescheduleOverdueToToday}
            disabled={isBulkRescheduling}
            className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-3xs font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide animate-pulse"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBulkRescheduling ? 'animate-spin' : ''}`} />
            {isBulkRescheduling ? t('Wait...') : t('Bring Overdue All to Today')}
          </button>
        </div>
      )}

      {followUpList.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl gap-4 font-sans" id="bulk_carry_forward_card">
          <div className="space-y-0.5 text-left">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              {t('Incomplete Today\'s Queue Carry-Forward')}
            </h4>
            <p className="text-3xs text-slate-500">
              {t('Bulk route the remaining')} {followUpList.length} {t('incomplete credit renewals to tomorrow\'s daily queue list.')}
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            {showConfirmBulk ? (
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs border border-amber-200 p-1.5 rounded-lg justify-between shadow-xs">
                <span className="text-4xs font-bold text-amber-800 px-1">{t('Postpone all')} {followUpList.length} {t('items?')}</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={handlePostponeAll} 
                    disabled={isBulkPostponing}
                    className="px-2.5 py-1 bg-amber-600 text-white text-3xs font-black rounded-md hover:bg-amber-700 cursor-pointer shadow-xs transition-colors"
                  >
                    {isBulkPostponing ? t('Wait...') : t('Carry Forward')}
                  </button>
                  <button 
                    onClick={() => setShowConfirmBulk(false)} 
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-3xs font-bold rounded-md hover:bg-gray-200 cursor-pointer"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowConfirmBulk(true)}
                className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-3xs font-black rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                {t('Carry Forward All to Tomorrow')}
              </button>
            )}
          </div>
        </div>
      )}

      {followUpList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-12 text-center max-w-lg mx-auto space-y-4 font-sans">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 text-emerald-500">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1330]">{t('All Caught Up!')}</h3>
          <p className="text-xs text-gray-400">
            {t('You run cleanly finished lists. No scheduled operations are due immediately.')}
          </p>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-12 text-center max-w-lg mx-auto space-y-4 font-sans animate-fade-in">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 text-slate-400">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1330]">{t('Overdue All')} - {t('All Clean!')}</h3>
          <p className="text-xs text-gray-400">
            {activeSubTab === 'overdue'
              ? t('All past-due followups have been successfully sorted or rescheduled!')
              : t('No scheduled followups are assigned for today.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="followup_grid_deck">
          {displayedList.map(cust => {
            const colors = STATUS_COLORS[cust.status];
            
            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between hover:border-[#C4B5FD] transition-all border-l-4 font-sans"
                style={{ borderLeftColor: colors.accent }}
              >
                {/* Header info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#0B1330] truncate">{cust.name}</h4>
                    <span className={`${colors.bg} ${colors.text} text-3xs font-black px-2 py-0.5 rounded-full border ${colors.border}`}>
                      {t(cust.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <a
                      href={`tel:${cust.phoneNumber}`}
                      className="text-xs font-mono font-bold text-[#8B5CF6] hover:underline flex items-center gap-1 bg-[#8B5CF6]/5 px-2.5 py-1 rounded-lg"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      {cust.phoneNumber}
                    </a>
                    {cust.followUpDate && cust.followUpDate < todayStr ? (
                      <span className="text-3xs bg-rose-50 border border-rose-220 text-rose-700 font-extrabold px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 animate-pulse shadow-3xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                        {t('OVERDUE:')} {cust.followUpDate}
                      </span>
                    ) : (
                      <span className="text-3xs text-gray-400 font-mono">{t('Scheduled:')} {cust.followUpDate}</span>
                    )}
                  </div>
                </div>

                {/* Notes observation pad */}
                <div className="mt-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between mb-1.5 border-b border-slate-200/50 pb-1">
                    <span className="text-3xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      <NotepadText className="w-3 h-3 text-slate-400" />
                      {t('Officer Call Notes')}
                    </span>
                    {editingNotesId !== cust.id && (
                      <button
                        onClick={() => startNotesEdit(cust.id, cust.notes || '')}
                        className="text-4xs text-[#8B5CF6] hover:underline font-bold uppercase transition cursor-pointer"
                      >
                        [ {t('Edit Call Log')} ]
                      </button>
                    )}
                  </div>

                  {editingNotesId === cust.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-2xs focus:ring-1 focus:ring-[#8B5CF6] focus:outline-hidden font-bold"
                        placeholder={t('Enter observation records...')}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => saveNotesEdit(cust.id)}
                          className="px-2 py-1 bg-[#8B5CF6] text-white text-3xs font-bold rounded-md hover:bg-[#8B5CF6]/90 cursor-pointer"
                        >
                          {t('Save Log')}
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-600 text-3xs font-medium rounded-md hover:bg-gray-300 cursor-pointer"
                        >
                          {t('Cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-2xs leading-relaxed italic ${
                      cust.notes && cust.notes.toLowerCase().includes('the date is not same')
                        ? 'text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg font-bold font-sans'
                        : cust.notes && cust.notes.toLowerCase().includes('bulk imported')
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg font-bold font-sans'
                        : 'text-gray-600'
                    }`}>
                      {cust.notes ? `"${cust.notes}"` : t('No notations logged yet. Click edit log above to log phone conversation details.')}
                    </p>
                  )}
                </div>

                {/* Inline Status update flow */}
                <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-2">
                  <span className="text-4xs font-black text-gray-400 uppercase tracking-widest block font-sans">
                    {t('Action Call Outcome Status')} {updatingCustIds[cust.id] && `(${t('Wait...')})`}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={updatingCustIds[cust.id]}
                      onClick={() => handleStatusChangeInline(cust.id, 'Completed')}
                      className={`px-2.5 py-1.5 rounded-md text-3xs font-black transition ${
                        updatingCustIds[cust.id]
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                      }`}
                    >
                      {updatingCustIds[cust.id] ? t('Wait...') : t('Completed Approval')}
                    </button>
                    <button
                      disabled={updatingCustIds[cust.id]}
                      onClick={() => handleStatusChangeInline(cust.id, 'Paid')}
                      className={`px-2.5 py-1.5 rounded-md text-3xs font-black transition ${
                        updatingCustIds[cust.id]
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer'
                      }`}
                    >
                      {updatingCustIds[cust.id] ? t('Wait...') : t('Paid Old Debt')}
                    </button>

                    <button
                      disabled={updatingCustIds[cust.id]}
                      onClick={() => handleStatusChangeInline(cust.id, 'Renewal Processing')}
                      className={`px-2.5 py-1.5 rounded-md text-3xs font-black transition ${
                        updatingCustIds[cust.id]
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                          : 'bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer'
                      }`}
                    >
                      {updatingCustIds[cust.id] ? t('Wait...') : t('Re-Process')}
                    </button>
                    <button
                      disabled={updatingCustIds[cust.id]}
                      onClick={() => handlePostponeIndividual(cust.id)}
                      className={`px-2.5 py-1.5 rounded-md text-3xs font-black transition ${
                        updatingCustIds[cust.id]
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/50 hover:bg-amber-100 cursor-pointer'
                      }`}
                    >
                      {updatingCustIds[cust.id] ? t('Wait...') : t('Defer to Tomorrow')}
                    </button>
                    {cust.followUpDate && cust.followUpDate < todayStr && (
                      <button
                        type="button"
                        disabled={updatingCustIds[cust.id]}
                        onClick={() => handleBringIndividualToToday(cust.id)}
                        className={`px-2.5 py-1.5 rounded-md text-3xs font-black transition ${
                          updatingCustIds[cust.id]
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-40'
                            : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer flex items-center gap-1 shadow-xs border border-rose-500'
                        }`}
                      >
                        <RefreshCw className="w-2.5 h-2.5 animate-spin-slow shrink-0" />
                        {t('Bring to Today')}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
