import { useMemo } from 'react';
import { Customer, ActivityLog, STATUS_COLORS, STATUS_LIST, CustomerStatus, User, AIConfig, OfficerAIPermission } from '../types';
import { getTodayDateString } from '../services/db';
import { CheckCircle2, AlertCircle, Clock, Users, Calendar, ArrowRightLeft, TrendingUp } from 'lucide-react';
import QuickControllerView from './QuickControllerView';
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

  // 1. Calculations for the 10 KPI Dashboard Cards
  const stats = useMemo(() => {
    const total = customers.length;
    
    // Status counters
    const statusCounts = STATUS_LIST.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<CustomerStatus, number>);

    let completedToday = 0;
    let followUpToday = 0;

    let overdueCount = 0;

    customers.forEach(cust => {
      // Increment state totals
      if (statusCounts[cust.status] !== undefined) {
        statusCounts[cust.status]++;
      }

      // Completed Today (using timezone-safe local date matching)
      if (cust.status === 'Completed') {
        const updateDateVal = cust.updatedDate || cust.addedDate;
        if (updateDateVal) {
          const updateDateObj = new Date(updateDateVal);
          const uYear = updateDateObj.getFullYear();
          const uMonth = String(updateDateObj.getMonth() + 1).padStart(2, '0');
          const uDay = String(updateDateObj.getDate()).padStart(2, '0');
          const uLocalDateStr = `${uYear}-${uMonth}-${uDay}`;
          if (uLocalDateStr === todayStr) {
            completedToday++;
          }
        }
      }

      // Follow up today count
      if (cust.followUpDate === todayStr) {
        followUpToday++;
      }

      // Overdue Follow-up count
      const isFinalized = cust.status === 'Completed' || cust.status === 'Rejected';
      if (cust.followUpDate && cust.followUpDate < todayStr && !isFinalized) {
        overdueCount++;
      }
    });

    // Pending Today: Renewal Processing + Paid + Waiting + No Response
    const pendingToday = 
      (statusCounts['Renewal Processing'] || 0) + 
      (statusCounts['Paid'] || 0) + 
      (statusCounts['Waiting'] || 0) +
      (statusCounts['No Response'] || 0);

    return {
      total,
      completedToday,
      pendingToday,
      statusCounts,
      followUpToday,
      overdueCount,
    };
  }, [customers, todayStr]);

  // 2. Data for Status Distribution Pie (Donut) Chart
  const pieData = useMemo(() => {
    const total = stats.total || 1;
    let accumulatedAngle = 0;

    return STATUS_LIST.map(status => {
      const count = stats.statusCounts[status];
      const percentage = Math.round((count / total) * 100);
      const angle = (count / total) * 360;
      
      const segment = {
        name: status,
        value: count,
        percent: percentage,
        startAngle: accumulatedAngle,
        endAngle: accumulatedAngle + angle,
        colors: STATUS_COLORS[status]
      };
      accumulatedAngle += angle;
      return segment;
    });
  }, [stats]);

  // Helpers to calculate SVG pie slice paths
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  // 3. Weekly Activity Bar Chart Data (last 7 days ending today)
  const activityData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const counts = dates.reduce((acc, date) => {
      acc[date] = 0;
      return acc;
    }, {} as Record<string, number>);

    logs.forEach(log => {
      const day = log.timestamp ? log.timestamp.split('T')[0] : '';
      if (counts[day] !== undefined) {
        counts[day]++;
      }
    });

    const maxCount = Math.max(...Object.values(counts), 1);

    return dates.map(date => {
      const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      return {
        date,
        label: dayLabel,
        count: counts[date],
        percent: (counts[date] / maxCount) * 100
      };
    });
  }, [logs, todayStr]);

  // 4. Completion Trend Spline Chart Data (cumulative completed count over the last 7 days)
  const trendData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    // For each date, find how many customers were completed on or before this date
    // Note: To make active dynamic trend, let's count aggregate historically
    return dates.map((date, index) => {
      let completedOnOrBefore = 0;
      customers.forEach(cust => {
        if (cust.status === 'Completed') {
          const finishedDay = cust.updatedDate ? cust.updatedDate.split('T')[0] : '';
          if (finishedDay && finishedDay <= date) {
            completedOnOrBefore++;
          }
        }
      });

      return {
        date,
        label: new Date(date).toLocaleDateString(language === 'en' ? 'en-US' : language === 'am' ? 'am-ET' : 'om-ET', { month: 'short', day: 'numeric' }),
        value: completedOnOrBefore
      };
    });
  }, [customers, todayStr, language]);

  // Calculate coordinates for Trend line chart SVG (width 500, height 120)
  const trendPoints = useMemo(() => {
    const values = trendData.map(d => d.value);
    const maxVal = Math.max(...values, 4); // avoid division by zero or super flat charts
    const minVal = 0;
    const range = maxVal - minVal;

    return trendData.map((data, idx) => {
      const x = (idx / (trendData.length - 1)) * 460 + 20; // range 20 to 480
      const y = 100 - ((data.value - minVal) / range) * 80; // range 20 to 100 (leaving padding)
      return { x, y, label: data.label, value: data.value };
    });
  }, [trendData]);

  const trendPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    return trendPoints.reduce((path, p, index) => {
      return path + `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    }, '');
  }, [trendPoints]);

  const trendAreaPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    const first = trendPoints[0];
    const last = trendPoints[trendPoints.length - 1];
    return `${trendPath} L ${last.x} 110 L ${first.x} 110 Z`;
  }, [trendPoints, trendPath]);

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard_view_container">
      {/* Header and Quick Summary */}
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



      {/* QUICK OPERATIONAL SEARCH & STATUS CONTROLLER */}
      <QuickControllerView 
        customers={customers} 
        logs={logs} 
        currentUser={currentUser} 
        onNavigateToReports={() => onNavigate('reports')} 
      />

      {/* The 9 High-Contrast Dashboard KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Total Customers */}
        <div 
          onClick={() => onNavigate('stage-Renewal-Processing')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#8B5CF6] hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-700 uppercase font-sans">{t('Total Registered Portfolio')}</span>
            <Users className="w-4 h-4 text-slate-500 group-hover:text-[#8B5CF6] transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {stats.total}
          </p>
          <p className="text-2xs text-slate-600 mt-2 font-semibold group-hover:text-[#8B5CF6] group-hover:underline">{t('All-time customer records')}</p>
        </div>

        {/* Card 2: Completed Today */}
        <div 
          onClick={() => onNavigate('stage-Completed')}
          className="bg-emerald-50/30 p-5 rounded-xl border border-emerald-200/60 shadow-xs hover:border-[#22C55E] hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-emerald-800 uppercase font-sans">{t('COMPLETED TODAY')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-700 mt-2 tracking-tight">
            {stats.completedToday}
          </p>
          <p className="text-2xs text-emerald-800 mt-2 font-semibold group-hover:underline">{t('Today only')}</p>
        </div>

        {/* Card 3: Follow Up Today */}
        <div 
          onClick={() => {
            localStorage.setItem('digaf_followup_subtab', 'today');
            onNavigate('followup');
          }}
          className="bg-amber-50/40 p-5 rounded-xl border border-amber-200 shadow-xs hover:border-amber-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-amber-800 uppercase font-sans">{t('Follow Up Today')}</span>
            <Calendar className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-3xl font-black text-amber-700 mt-2 tracking-tight">
            {stats.followUpToday}
          </p>
          <p className="text-2xs text-amber-900 mt-2 font-semibold group-hover:underline">{t('Today only')}</p>
        </div>

        {/* Card 4: Overdue All Portfolio Follow-ups */}
        <div 
          onClick={() => {
            localStorage.setItem('digaf_followup_subtab', 'overdue');
            onNavigate('followup');
          }}
          className="bg-rose-50 p-5 rounded-xl border border-rose-300 shadow-xs hover:border-rose-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-rose-800 uppercase font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
              {t('Overdue All')}
            </span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-3xl font-black text-rose-700 mt-2 tracking-tight">
            {stats.overdueCount}
          </p>
          <p className="text-2xs text-rose-800 mt-2 font-semibold group-hover:underline">{t('Lapsed actions requiring follow-up')}</p>
        </div>

        {/* Card 5: Renewal Processing Count */}
        <div 
          onClick={() => onNavigate('stage-Renewal-Processing')}
          className="bg-indigo-50/40 p-5 rounded-xl border border-indigo-200 shadow-xs hover:border-[#8B5CF6] hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-indigo-900 uppercase font-sans">{t('Renewal Processing')}</span>
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
          </div>
          <p className="text-3xl font-black text-indigo-950 mt-2 tracking-tight">
            {stats.statusCounts['Renewal Processing']}
          </p>
          <p className="text-2xs text-indigo-800 mt-2 font-semibold group-hover:underline">{t('Outstanding pipeline')}</p>
        </div>

        {/* Card 6: Paid Count */}
        <div 
          onClick={() => onNavigate('stage-Paid')}
          className="bg-purple-50 p-5 rounded-xl border border-purple-250 shadow-xs hover:border-purple-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-purple-900 uppercase font-sans">{t('Paid')}</span>
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
          </div>
          <p className="text-3xl font-black text-purple-950 mt-2 tracking-tight">
            {stats.statusCounts['Paid'] || 0}
          </p>
          <p className="text-2xs text-purple-800 mt-2 font-semibold group-hover:underline">{t('Outstanding pipeline')}</p>
        </div>

        {/* Card 7: No Response Count */}
        <div 
          onClick={() => onNavigate('stage-No-Response')}
          className="bg-amber-50/40 p-5 rounded-xl border border-amber-250 shadow-xs hover:border-amber-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-amber-900 uppercase font-sans">{t('No Response')}</span>
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
          </div>
          <p className="text-3xl font-black text-amber-950 mt-2 tracking-tight">
            {stats.statusCounts['No Response'] || 0}
          </p>
          <p className="text-2xs text-amber-800 mt-2 font-semibold group-hover:underline">{t('Dormant contacts')}</p>
        </div>

        {/* Card 8: Completed Count */}
        <div 
          onClick={() => onNavigate('stage-Completed')}
          className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-250 shadow-xs hover:border-emerald-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-emerald-900 uppercase font-sans">{t('Completed')}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          </div>
          <p className="text-3xl font-black text-emerald-800 mt-2 tracking-tight">
            {stats.statusCounts['Completed'] || 0}
          </p>
          <p className="text-2xs text-emerald-800 mt-2 font-semibold group-hover:underline">{t('Successful renewals')}</p>
        </div>

        {/* Card 9: Waiting Count */}
        <div 
          onClick={() => onNavigate('stage-Waiting')}
          className="bg-slate-100/50 p-5 rounded-xl border border-slate-250 shadow-xs hover:border-slate-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-700 uppercase font-sans">{t('Waiting')}</span>
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2 tracking-tight">
            {stats.statusCounts['Waiting'] || 0}
          </p>
          <p className="text-2xs text-slate-650 mt-2 font-semibold group-hover:underline">{t('Abandoned files')}</p>
        </div>

        {/* Card 10: Rejected Count */}
        <div 
          onClick={() => onNavigate('stage-Rejected')}
          className="bg-rose-50/40 p-5 rounded-xl border border-rose-250 shadow-xs hover:border-rose-600 hover:shadow-xs cursor-pointer transition-all duration-205 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-rose-900 uppercase font-sans">{t('Rejected')}</span>
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
          </div>
          <p className="text-3xl font-black text-rose-700 mt-2 tracking-tight">
            {stats.statusCounts['Rejected']}
          </p>
          <p className="text-2xs text-rose-800 mt-2 font-semibold group-hover:underline">{t('Final rejections')}</p>
        </div>
      </div>

      {/* Quick Action Hub panel */}
      <div className="bg-linear-to-r from-[#0B1330] to-[#1E293B] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-base font-bold font-sans">
            {t('Apply Workflow Transition Stage')}
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-lg">
            {t('Instantly apply pipeline transfers using the smart workspace controller.')}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => onNavigate('kanban')}
            className="px-5 py-2.5 rounded-lg bg-linear-to-r from-[#8B5CF6] to-[#C4B5FD] text-white font-semibold text-xs transition-transform hover:scale-[1.03] active:scale-[0.98] shadow-sm cursor-pointer"
          >
            {t('Open Kanban Pipeline')}
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium text-xs hover:bg-white/15 transition-colors cursor-pointer"
          >
            {t('Reports & Export')}
          </button>
        </div>
      </div>
    </div>
  );
}
