import { useMemo } from 'react';
import { Customer, ActivityLog, User, AIConfig, OfficerAIPermission } from '../types';
import { getTodayDateString } from '../services/db';
import { Users, UserCheck, Clock, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../services/language';

interface DashboardViewProps {
  customers: Customer[];
  logs: ActivityLog[];
  onNavigate: (view: string) => void;
  currentUser?: User;
  aiConfig?: AIConfig | null;
  officerPermissions?: OfficerAIPermission[];
}

export default function DashboardView({ 
  customers, 
  logs, 
  onNavigate, 
  currentUser,
  aiConfig = null,
  officerPermissions = []
}: DashboardViewProps) {
  const { t, language } = useLanguage();
  const todayStr = getTodayDateString();

  // Attendance stats (for executives)
  const attendanceStats = useMemo(() => {
    // This would come from your attendance records
    // Placeholder data for now - you can connect to actual attendance data
    return {
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
      leaveRequests: 0
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard_view_container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-sans text-slate-900">
            {t('Executive Dashboard')}
          </h2>
          <p className="text-sm text-slate-700 mt-1 font-bold">
            {t('Secure Enterprise Client Relations Manager')}
          </p>
        </div>
        <div className="text-xs bg-[#8B5CF6]/10 text-[#8B5CF6] px-3 py-1.5 rounded-full font-mono font-medium self-start flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#8B5CF6] rounded-full animate-ping"></span>
          {t('System Time Reference:')} {todayStr}
        </div>
      </div>

      {/* Attendance & Leave Stats - Executive View Only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wide text-slate-600 uppercase font-sans">{t('Present Today')}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{attendanceStats.presentToday}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t('Clocked in')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wide text-slate-600 uppercase font-sans">{t('Late Today')}</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{attendanceStats.lateToday}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t('Arrived late')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wide text-slate-600 uppercase font-sans">{t('Absent')}</span>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{attendanceStats.absentToday}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t('No check-in')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wide text-slate-600 uppercase font-sans">{t('Leave Requests')}</span>
            <Calendar className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{attendanceStats.leaveRequests}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{t('Pending approval')}</p>
        </div>
      </div>
    </div>
  );
}