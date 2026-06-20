import React, { useState, useEffect } from 'react';
import { User, AIConfig, OfficerAIPermission, AIUsageLog } from '../types';
import { dbService } from '../services/db';
import { 
  Sparkles, 
  ToggleLeft, 
  ToggleRight, 
  Smartphone, 
  ShieldCheck, 
  History, 
  CheckCircle2, 
  Settings2, 
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  CalendarClock,
  Layers,
  FileCheck,
  UserCheck,
  Image,
  MessageSquare
} from 'lucide-react';
import { soundService } from '../services/sound';

interface AIControlCenterProps {
  currentUser: User;
  users: User[];
}

export default function AIControlCenter({ currentUser, users }: AIControlCenterProps) {
  // Config state
  const [activeConfig, setActiveConfig] = useState<AIConfig | null>(null);
  
  // Permissions state
  const [permissions, setPermissions] = useState<OfficerAIPermission[]>([]);
  
  // Logs state
  const [usageLogs, setUsageLogs] = useState<AIUsageLog[]>([]);
  const [logFilterQuery, setLogFilterQuery] = useState('');
  
  // Tabs for the Control Hub
  const [hubTab, setHubTab] = useState<'features' | 'staff' | 'logs' | 'assets'>('features');
  const [savingSettings, setSavingSettings] = useState(false);

  const [assetType, setAssetType] = useState('Avatar');
  const [assetPrompt, setAssetPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loadingAsset, setLoadingAsset] = useState(false);

  const handleGenerateAsset = async () => {
    if (!assetPrompt.trim()) return;
    setLoadingAsset(true);
    setImageUrl('');
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: assetPrompt,
          category: assetType,
          username: currentUser.fullName
        })
      });

      if (!res.ok) {
        throw new Error('Image Node was unresponsive.');
      }

      const data = await res.json();
      const mime = data.mimeType || 'image/jpeg';
      const b64Url = `data:${mime};base64,${data.base64}`;
      setImageUrl(b64Url);
      soundService.playSuccessChime();

      // Log AI telemetry
      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'IMAGE_GENERATION',
        `Synthesized a visual assets layer for: ${assetPrompt}`
      );

    } catch (err) {
      alert('Failed to synthesize avatar assets.');
    } finally {
      setLoadingAsset(false);
    }
  };

  useEffect(() => {
    // 1. Subscribe to AI configurations in real-time
    const unsubscribeConfig = dbService.subscribeAIConfig((loadedConfig) => {
      setActiveConfig(loadedConfig);
    });

    // 2. Subscribe to individual permissions
    const unsubscribePerms = dbService.subscribeOfficerPermissions((loadedPerms) => {
      setPermissions(loadedPerms);
    });

    // 3. Subscribe to usage logs
    const unsubscribeLogs = dbService.subscribeAIUsageLogs((loadedLogs) => {
      setUsageLogs(loadedLogs);
    });

    return () => {
      unsubscribeConfig();
      unsubscribePerms();
      unsubscribeLogs();
    };
  }, []);

  // Sync users with active permissions
  // If a new user is created and they have no permissions doc yet, Zewdneh can toggle, but let's map them cleanly
  const mappedStaffPermissions = users
    .filter(u => u.role !== 'admin') // Only show staff/officers
    .map(u => {
      const match = permissions.find(p => p.phoneNumber === u.phoneNumber);
      return {
        phoneNumber: u.phoneNumber,
        fullName: u.fullName,
        status: u.status,
        customerBriefAllowed: match ? match.customerBriefAllowed : false,
        imageGenerationAllowed: match ? match.imageGenerationAllowed : false,
        assistantPanelAllowed: match ? match.assistantPanelAllowed !== false : true,
        aiReportsAllowed: match ? match.aiReportsAllowed : false,
      } as OfficerAIPermission & { status: string };
    });

  const handleToggleGlobalAI = async () => {
    if (!activeConfig) return;
    try {
      const nextVal = !activeConfig.featuresEnabled;
      await dbService.updateAIConfig({ featuresEnabled: nextVal });
      dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'GLOBAL_TOGGLE',
        `Master AI integration was toggled ${nextVal ? 'ONLINE' : 'OFFLINE'}`
      );
      soundService.playSuccessChime();
    } catch (err) {
      alert('Fail to update config');
    }
  };

  const handleToggleFeature = async (field: keyof Omit<AIConfig, 'id' | 'stuckDaysThreshold'>) => {
    if (!activeConfig) return;
    try {
      const nextVal = !activeConfig[field];
      await dbService.updateAIConfig({ [field]: nextVal });
      dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        field.toUpperCase(),
        `Feature setting ${String(field)} updated to ${nextVal}`
      );
      soundService.playSuccessChime();
    } catch (err) {
      alert('Error updating feature switch');
    }
  };

  const handleUpdateThreshold = async (val: number) => {
    if (!activeConfig) return;
    try {
      await dbService.updateAIConfig({ stuckDaysThreshold: val });
    } catch {
      alert('Failed to update threshold');
    }
  };

  const handleToggleStaffPermission = async (
    staffPhone: string,
    staffName: string,
    field: keyof Omit<OfficerAIPermission, 'phoneNumber' | 'fullName'>
  ) => {
    const existingPerm = permissions.find(p => p.phoneNumber === staffPhone);
    const updatedPerm: OfficerAIPermission = existingPerm 
      ? { ...existingPerm }
      : {
          phoneNumber: staffPhone,
          fullName: staffName,
          customerBriefAllowed: false,
          imageGenerationAllowed: false,
          assistantPanelAllowed: true, // Default to true since chatbot is open by default
          aiReportsAllowed: false,
        };

    updatedPerm[field] = !updatedPerm[field];

    try {
      await dbService.updateOfficerPermission(updatedPerm);
      dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'PERMISSIONS_GRID',
        `Altered ${field} access for ${staffName} to: ${updatedPerm[field]}`
      );
      soundService.playSuccessChime();
    } catch (err) {
      alert('Failed to save staff exception state.');
    }
  };

  const handleWipeLogs = async () => {
    if (!window.confirm('Are you absolutely sure you want to clear all active AI Telemetry usage logs?')) return;
    try {
      await dbService.clearAIUsageLogs();
      soundService.playSuccessChime();
    } catch {
      alert('Failed to delete telemetry log entries.');
    }
  };

  const filteredLogs = usageLogs.filter(l => {
    const q = logFilterQuery.toLowerCase();
    return (
      (l.username || '').toLowerCase().includes(q) ||
      (l.phoneNumber || '').toLowerCase().includes(q) ||
      (l.feature || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white border border-slate-150 rounded-xl shadow-xs p-4 md:p-5 m-1 space-y-5" id="ai_layer_control_center">
      {/* Mini Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-50 border border-indigo-100 text-[#8B5CF6] rounded-lg">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider font-sans">
              Zewdneh AI Control Center
            </h3>
            <p className="text-[10px] text-slate-450 font-medium leading-none mt-0.5">
              Secure governance dashboard for granular staff capabilities, usage metrics, and threshold settings.
            </p>
          </div>
        </div>

        {/* Master Toggle Status indicator */}
        {activeConfig && (
          <button
            onClick={handleToggleGlobalAI}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-black text-[10.5px] uppercase shadow-3xs cursor-pointer transition-all ${
              activeConfig.featuresEnabled
                ? 'bg-emerald-50 text-emerald-805 border-emerald-200'
                : 'bg-rose-50 text-rose-805 border-rose-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeConfig.featuresEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            Master Layer: {activeConfig.featuresEnabled ? 'ONLINE' : 'OFFLINE'}
          </button>
        )}
      </div>

      {/* HORIZONTAL HUB BAR */}
      <div className="flex border-b border-slate-200 gap-1 pb-px overflow-x-auto select-none no-scrollbar">
        <button
          onClick={() => setHubTab('features')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            hubTab === 'features'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Enabled Capabilities ({activeConfig ? Object.keys(activeConfig).filter(k => k.endsWith('Enabled') && activeConfig[k as keyof AIConfig] === true).length : 0})
        </button>
        <button
          onClick={() => setHubTab('staff')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            hubTab === 'staff'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Staff Operational Access
        </button>
        <button
          onClick={() => setHubTab('logs')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            hubTab === 'logs'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          AI Audit Streams
        </button>
        <button
          onClick={() => setHubTab('assets')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            hubTab === 'assets'
              ? 'border-[#8B5CF6] text-slate-800 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          AI Operational Assets Generator
        </button>
      </div>

      {/* Main Tab Views */}
      <div className="space-y-4">
        
        {/* VIEW 1: FEATURES & CONFIGURE */}
        {hubTab === 'features' && activeConfig && (
          <div className="space-y-4 animate-fade-in">
            {/* Warning when disabled */}
            {!activeConfig.featuresEnabled && (
              <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl flex items-start gap-2 text-[10.5px] text-amber-800 font-semibold leading-snug">
                <AlertTriangle className="w-4 h-4 text-amber-650 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black uppercase tracking-wide text-[9px] mb-0.5">Master Toggle Offline</strong>
                  All server-side AI integrations, brief outputs, stuck case parameters, and floating assistants are completely disabled for workstation staff.
                </div>
              </div>
            )}

            {/* Grid of Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Customer Brief */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-[#8B5CF6]" /> Customer Brief Generator
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Generate context reports & historic logs summarized in one touch.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('customerBriefEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.customerBriefEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-350" />}
                </button>
              </div>

              {/* Stuck Case Detector */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Stuck Case Detector
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Tags portfolios left untouched or moving circular loop pathways.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('stuckCaseDetectorEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.stuckCaseDetectorEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-350" />}
                </button>
              </div>

              {/* Follow Up Recommendation */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-[#0F172A] block uppercase tracking-wide flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-indigo-500" /> Follow-Up Recommendations
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Smart suggestion queue detailing time parameters/actions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('followUpRecommendationEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.followUpRecommendationEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-350" />}
                </button>
              </div>

              {/* Daily Executive Report */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" /> Daily Executive Report
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Continuous summaries of performance & processing ratios.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('dailyExecutiveReportEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.dailyExecutiveReportEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-350" />}
                </button>
              </div>

              {/* AI Report Summarization */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-[#0F172A] block uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> AI Report Summarization
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Summarize charts directly to PDF/text metrics for files.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('aiReportSummarizationEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.aiReportSummarizationEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-slate-350" />}
                </button>
              </div>

              {/* AI Image Generation */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-violet-500" /> AI Image Generation
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Sleek poster/award generation celebrating renewal completions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('imageGenerationEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.imageGenerationEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-[#CBD5E1]" />}
                </button>
              </div>

              {/* AI Assistant Panel */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3 md:col-span-2">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-555 text-[#8B5CF6]" /> Officer Operations AI Assistant Panel
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Floating chatbot module directly answering query parameters, stats or active status counts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('assistantPanelEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.assistantPanelEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-[#CBD5E1]" />}
                </button>
              </div>

              {/* Officer Performance Analysis */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10.5px] font-black text-slate-800 block uppercase tracking-wide flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Officer KPI Performance Analysis
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">Measure process pace, follow-up ratios, conversion speed.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('officerPerformanceEnabled')}
                  className="cursor-pointer text-[#8B5CF6] hover:scale-105 transition-all shrink-0"
                >
                  {activeConfig.officerPerformanceEnabled ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9 text-[#CBD5E1]" />}
                </button>
              </div>
            </div>

            {/* Threshold Settings Section */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-[10.5px] font-black text-slate-800 uppercase tracking-wide">
                <Settings2 className="w-4 h-4 text-[#8B5CF6]" />
                Operating thresholds configurations
              </div>
              
              <div className="max-w-md space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-600">Stuck Case Detector Inactive Limit:</span>
                  <span className="bg-indigo-50 border border-indigo-100 text-[#8B5CF6] rounded px-1.5 py-0.5 font-mono">
                    {activeConfig.stuckDaysThreshold} Days
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={activeConfig.stuckDaysThreshold}
                    onChange={(e) => handleUpdateThreshold(parseInt(e.target.value))}
                    className="flex-1 accent-[#8B5CF6] h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] text-slate-400 font-bold w-12 text-right">Min 2 / Max 30</div>
                </div>
                <p className="text-[8.5px] text-slate-400 font-medium">
                  Trigger warning alert badges on any customer record residing inside the same stage for more than this threshold number of days.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: STAFF PERMISSIONS EXCEPTIONS */}
        {hubTab === 'staff' && (
          <div className="space-y-4 animate-fade-in text-slate-800">
            <div className="bg-slate-50/50 rounded-xl border border-slate-150 p-3 flex items-start gap-2.5 text-[10px] text-slate-600 leading-snug">
              <ShieldCheck className="w-4.5 h-4.5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-800 font-extrabold uppercase tracking-wide text-[8.5px] mb-0.5">Staff-by-Staff Operations Policy</strong>
                Every AI capability must be explicitly assigned to officers in this table. If deactivated, they will be barred from viewing or triggering that capability even if it is enabled globally.
              </div>
            </div>

            {mappedStaffPermissions.length === 0 ? (
              <div className="text-center py-12 text-[10px] text-slate-400 font-bold italic border border-dashed border-slate-200 rounded-xl">
                No active staff/officers are currently indexed in this workstation. Access cannot be altered.
              </div>
            ) : (
              <div className="border border-slate-150 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[8.5px] tracking-wider border-b border-slate-150">
                      <th className="p-3">Staff Operator</th>
                      <th className="p-3 text-center">Brief Gen</th>
                      <th className="p-3 text-center">Image Gen</th>
                      <th className="p-3 text-center">Reports</th>
                      <th className="p-3 text-center">AI Chatting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mappedStaffPermissions.map((staff) => (
                      <tr key={staff.phoneNumber} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-extrabold text-slate-800 block leading-tight">{staff.fullName}</span>
                          <span className="font-mono text-[9px] text-slate-400 block mt-0.5">{staff.phoneNumber}</span>
                        </td>
                        
                        {/* Brief */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStaffPermission(staff.phoneNumber, staff.fullName, 'customerBriefAllowed')}
                            className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer transition-all ${
                              staff.customerBriefAllowed 
                                ? 'bg-emerald-50 text-emerald-805 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {staff.customerBriefAllowed ? 'ALLOWED' : 'REVOKED'}
                          </button>
                        </td>

                        {/* Image */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStaffPermission(staff.phoneNumber, staff.fullName, 'imageGenerationAllowed')}
                            className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer transition-all ${
                              staff.imageGenerationAllowed 
                                ? 'bg-emerald-50 text-emerald-805 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {staff.imageGenerationAllowed ? 'ALLOWED' : 'REVOKED'}
                          </button>
                        </td>

                        {/* Reports */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStaffPermission(staff.phoneNumber, staff.fullName, 'aiReportsAllowed')}
                            className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer transition-all ${
                              staff.aiReportsAllowed 
                                ? 'bg-emerald-50 text-emerald-805 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {staff.aiReportsAllowed ? 'ALLOWED' : 'REVOKED'}
                          </button>
                        </td>

                        {/* AI Assistant Chatting */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleToggleStaffPermission(staff.phoneNumber, staff.fullName, 'assistantPanelAllowed')}
                            className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer transition-all ${
                              staff.assistantPanelAllowed 
                                ? 'bg-emerald-50 text-emerald-850 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {staff.assistantPanelAllowed ? 'ALLOWED' : 'REVOKED'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: AI USAGE TELEMETRY AUDIT */}
        {hubTab === 'logs' && (
          <div className="space-y-3 animate-fade-in">
            {/* Header / Search filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={logFilterQuery}
                  onChange={(e) => setLogFilterQuery(e.target.value)}
                  placeholder="Filter logs by officer/action..."
                  className="w-full bg-slate-50 border border-slate-250 p-1.5 pl-8 rounded-lg text-xs font-semibold focus:outline-hidden text-slate-800"
                />
              </div>

              <button
                onClick={handleWipeLogs}
                disabled={usageLogs.length === 0}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-800 text-[10px] font-black flex items-center justify-center gap-1.5 uppercase tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Flush AI Audits
              </button>
            </div>

            {/* List */}
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-[10.5px] text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl italic">
                No indexed AI telemetry records found matching your parameter criteria.
              </div>
            ) : (
              <div className="border border-slate-150 rounded-xl overflow-hidden text-slate-800">
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 font-mono text-[10px]">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-2.5 flex items-start justify-between gap-3 hover:bg-slate-50/70">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-sans font-black text-slate-800 block leading-tight">{log.username}</span>
                          <span className="text-[9px] text-slate-450">({log.phoneNumber})</span>
                        </div>
                        <div className="text-[9.5px] text-indigo-705 text-indigo-600 font-bold uppercase tracking-wider">
                          [{log.feature}] • {log.action}
                        </div>
                      </div>
                      <div className="text-right text-[8.5px] text-slate-400 font-semibold shrink-0">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: GEMINI ASSETS GENERATION STUDIO */}
        {hubTab === 'assets' && (
          <div className="space-y-4 animate-fade-in text-slate-800">
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-150 flex items-start gap-2.5 text-[10px] text-slate-600 leading-snug">
              <Sparkles className="w-4.5 h-4.5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-805 font-extrabold uppercase tracking-wide text-[8.5px] mb-0.5">Gemini Graphic Design Studio</strong>
                Generate vector icons, staff profile avatars, custom certificates or marketing campaign blueprints directly from clean textual parameters.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Form parameters */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block mb-1 font-sans">Asset Category</label>
                    <select 
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden"
                    >
                      <option value="Avatar">Avatars & Staff Profiles</option>
                      <option value="Icon">Portfolio Vector Icons & Badges</option>
                      <option value="Banner">Credit Campaign Banners</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block mb-1 font-sans">Visual prompts & Style Instructions</label>
                    <textarea 
                      placeholder="Describe the asset, e.g. 'A clean modern credit check shield badge with emerald sparkles'..."
                      value={assetPrompt}
                      onChange={(e) => setAssetPrompt(e.target.value)}
                      rows={5}
                      className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden resize-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAsset}
                  disabled={loadingAsset || !assetPrompt}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-extrabold uppercase tracking-wider text-[10px] rounded-lg cursor-pointer transition duration-150 disabled:opacity-40"
                >
                  {loadingAsset ? 'Synthesizing Graphic...' : 'Synthesize Vector Asset'}
                </button>
              </div>

              {/* Preview Window */}
              <div className="md:col-span-2 bg-[#0B1330] rounded-xl flex flex-col items-center justify-center p-6 border border-slate-300 min-h-[280px] text-center text-slate-400 relative overflow-hidden">
                {imageUrl ? (
                  <div className="space-y-4 w-full h-full flex flex-col items-center justify-center animate-fade-in select-none">
                    <div className="p-1.5 bg-white rounded-xl shadow-md border border-slate-100 max-w-[200px] max-h-[200px] overflow-hidden">
                      <img 
                        src={imageUrl} 
                        alt="AI Synthesized Asset" 
                        className="w-44 h-44 object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={imageUrl} 
                        download={`digaf_ai_${assetType.toLowerCase()}_asset.svg`}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg shadow-sm transition"
                      >
                        Download Asset Layout
                      </a>
                      <button 
                        onClick={() => { setImageUrl(''); setAssetPrompt(''); }}
                        className="px-4 py-2 bg-slate-800 text-slate-300 font-black text-[9px] uppercase tracking-wider rounded-lg hover:bg-slate-700 transition cursor-pointer"
                      >
                        Reset Workspace
                      </button>
                    </div>
                  </div>
                ) : loadingAsset ? (
                  <div className="flex flex-col items-center justify-center gap-2 select-none">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#8B5CF6]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#C4B5FD] animate-pulse">Running Generative Diffusion...</span>
                    <p className="text-[9px] text-slate-400 max-w-xs mt-1 leading-snug">Laying out curves, grading palette values, and bundling standalone SVG files...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 select-none">
                    <Image className="w-12 h-12 text-slate-700 mb-1" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Canvas Screen</span>
                    <p className="text-[9px] text-slate-500 max-w-xs leading-relaxed font-semibold">Generated vector artwork files will be compiled and displayed in high-contrast preview within this frame.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
