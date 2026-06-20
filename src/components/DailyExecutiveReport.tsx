import React, { useState, useEffect } from 'react';
import { User, Customer, ActivityLog, AIConfig, OfficerAIPermission } from '../types';
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  Zap, 
  RefreshCw, 
  Clock, 
  ChevronRight, 
  ShieldCheck, 
  FileText,
  LineChart,
  BrainCircuit,
  PieChart
} from 'lucide-react';
import { dbService } from '../services/db';
import { soundService } from '../services/sound';
import { useLanguage } from '../services/language';
import AIExportButton from './AIExportButton';

interface DailyExecutiveReportProps {
  currentUser: User;
  customers: Customer[];
  logs: ActivityLog[];
  aiConfig: AIConfig | null;
  officerPermissions: OfficerAIPermission[];
}

interface ReportData {
  briefSummary?: string;
  pipelineHealthRatio?: string;
  stuckCasesCount?: number;
  stuckCasesRecommendations?: string;
  officerKpisHighlight?: string;
  priorityQueueList?: { name: string; phone: string; score: number; reason: string }[];
  strategicPrescription?: string;
}

export default function DailyExecutiveReport({ 
  currentUser, 
  customers, 
  logs, 
  aiConfig, 
  officerPermissions 
}: DailyExecutiveReportProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  // 1. Permissions verification
  const isZewdneh = !!(currentUser.fullName?.toLowerCase().includes('zewd') || currentUser.phoneNumber?.toLowerCase().includes('zewd'));
  
  // Is this feature globally enabled?
  const isGlobalEnabled = aiConfig?.featuresEnabled !== false && aiConfig?.dailyExecutiveReportEnabled !== false;
  
  // Specific permission for logged in user
  const officerPerm = officerPermissions?.find(p => p.phoneNumber === currentUser.phoneNumber);
  const isAllowed = isZewdneh || (isGlobalEnabled && (officerPerm?.aiReportsAllowed === true));

  const getExporterText = (data: ReportData) => {
    let output = "";
    if (data.briefSummary) {
      output += `### Pipeline Situation Assessment\n${data.briefSummary}\n\n`;
    }
    if (data.stuckCasesRecommendations) {
      output += `### Stuck Cases Analysis (${data.stuckCasesCount ?? 0} Stalled Assets)\n${data.stuckCasesRecommendations}\n\n`;
    }
    if (data.officerKpisHighlight) {
      output += `### Staff Performance & Volume Analysis\n${data.officerKpisHighlight}\n\n`;
    }
    if (data.strategicPrescription) {
      output += `### Strategic Action Prescriptions\n${data.strategicPrescription}\n\n`;
    }
    if (data.priorityQueueList && data.priorityQueueList.length > 0) {
      output += `### AI Priority Renewal Queue\n`;
      data.priorityQueueList.forEach((cust, idx) => {
        output += `• ${cust.name} (CRITICALITY: ${cust.score}) - ${cust.reason} [phone: ${cust.phone}]\n`;
      });
    }
    return output;
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/executive-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customers,
          logs,
          requestingUser: currentUser.fullName,
          language // Pass the current language code EN/AM/OM!
        })
      });

      if (!res.ok) {
        throw new Error('Communication failed with primary AI node.');
      }

      const data = await res.json();
      setReport(data);
      soundService.playSuccessChime();

      // Log AI Usage Telemetry
      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'EXECUTIVE_REPORT',
        `Generated Daily Executive Report and Pipeline Diagnostics.`
      );

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load once for Zewdneh on mount if enabled
  useEffect(() => {
    if (isAllowed && !report && !loading && customers.length > 0) {
      handleGenerateReport();
    }
  }, [isAllowed, customers.length]);

  if (!isAllowed) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4 font-sans select-none" id="executive_ai_diagnostics_panel">
      {/* Dynamic Title and Status Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[#8B5CF6] animate-pulse">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 leading-none">
              Operational AI Command Diagnostics
              <span className="text-[7.5px] bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 text-[#8B5CF6] border border-violet-250 px-1.5 py-0.2 rounded font-black tracking-widest uppercase">system ready</span>
            </h3>
            <p className="text-[9.5px] text-slate-400 mt-1 font-medium leading-none">Continuous audit of microfinance portfolios & staff workloads</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {report && !loading && (
            <AIExportButton
              title="Operational AI Diagnostics"
              textRaw={getExporterText(report)}
              metadata={{ officer: currentUser.fullName, target: 'Executive Board' }}
              size="sm"
            />
          )}

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-[10px] uppercase rounded-xl flex items-center gap-1.5 shadow-sm transition-transform cursor-pointer active:scale-95 disabled:opacity-40 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8B5CF6] shrink-0 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing Live Assets...' : 'Audit Live Portfolio'}
          </button>
        </div>
      </div>


      {loading ? (
        <div className="p-16 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#8B5CF6]" />
          <span className="text-xs uppercase tracking-wider text-slate-500 animate-pulse">Querying Gemini Neural Engine...</span>
          <p className="text-[9.5px] text-slate-400 max-w-sm leading-relaxed mt-0.5">Calculating stuck ratios, mapping officer action speeds, and generating priority queues...</p>
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in text-[11px] leading-relaxed">
          
          {/* Panel Left: Executive brief & Strategic Prescription */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* 1. Brief Summary */}
            <div className="bg-amber-50/25 border border-amber-500/15 p-4 rounded-2xl space-y-1.5">
              <span className="text-[8.5px] font-black uppercase text-amber-700 tracking-widest block flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Pipeline Situation Assessment
              </span>
              <p className="font-semibold text-slate-900 leading-normal">{report.briefSummary}</p>
            </div>

            {/* 2. Operational Metrics & Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stuck Case Detector block */}
              <div className="p-4 bg-rose-50/30 border border-rose-100 rounded-2xl space-y-1.5">
                <span className="text-[8.5px] font-black uppercase text-rose-500 tracking-widest block flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Stuck Case Detector
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-rose-600 leading-none">{report.stuckCasesCount ?? 0}</span>
                  <span className="text-[8px] text-rose-400 font-bold uppercase tracking-wider">stalled assets</span>
                </div>
                <p className="text-slate-650 pt-0.5 font-medium leading-normal">{report.stuckCasesRecommendations}</p>
              </div>

              {/* Staff KPI breakdown */}
              <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl space-y-1.5">
                <span className="text-[8.5px] font-black uppercase text-indigo-500 tracking-widest block flex items-center gap-1">
                  <LineChart className="w-3.5 h-3.5" />
                  Staff Performance & Volume Analysis
                </span>
                <p className="text-slate-650 font-medium leading-normal">{report.officerKpisHighlight}</p>
              </div>
            </div>

            {/* 3. Prescription */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
              <span className="text-[8.5px] font-black uppercase text-indigo-300 tracking-widest block flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Strategic Action prescriptions
              </span>
              <p className="text-slate-200 text-[10.5px] font-medium leading-relaxed">{report.strategicPrescription}</p>
            </div>
          </div>

          {/* Panel Right: Priority Renewal Queue */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3.5">
            <div className="space-y-3.5">
              <div className="border-b border-slate-200 pb-1.5">
                <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-widest block flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  AI PRIORITY RENEWAL QUEUE
                </span>
                <p className="text-[8.5px] text-slate-400 font-medium mt-0.5">Top prioritized customer files requiring collection today</p>
              </div>

              <div className="space-y-2.5 max-h-[290px] overflow-y-auto scrollbar-thin rounded">
                {report.priorityQueueList && report.priorityQueueList.length > 0 ? (
                  report.priorityQueueList.map((cust, idx) => (
                    <div key={idx} className="bg-white border border-slate-250 p-2.5 rounded-xl space-y-1 hover:border-[#8B5CF6] transition duration-150">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-905 text-slate-800 text-[10.5px] truncate max-w-[120px]">{cust.name}</span>
                        <span className="text-[8px] bg-indigo-50 text-[#8B5CF6] border border-indigo-100 px-1 py-0.2 rounded font-black font-mono leading-none">CRITICALITY: {cust.score}</span>
                      </div>
                      <p className="text-slate-500 text-[9px] leading-tight font-medium">{cust.reason}</p>
                      <span className="text-[7.5px] text-slate-400 font-mono block">📞 {cust.phone}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    Queue clear. No critical risks detected.
                  </div>
                )}
              </div>
            </div>

            {/* Total pipeline metrics brief strip */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-[9px] leading-none select-none">
              <span className="text-slate-400 font-bold uppercase font-mono">Pipeline health yield:</span>
              <span className="font-black text-emerald-600 uppercase font-mono">{report.pipelineHealthRatio || "98% (Premium)"}</span>
            </div>
          </div>

        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
          <PieChart className="w-10 h-10 text-slate-300" />
          <span className="text-xs uppercase tracking-wider text-slate-500 font-black">No Active AI Audit Loaded</span>
          <p className="text-[10px] text-slate-400 max-w-xs leading-normal font-medium mt-0.5">Click the "Audit Live Portfolio" button in the upper right to run automated diagnostics on your microfinance records.</p>
        </div>
      )}
    </div>
  );
}
