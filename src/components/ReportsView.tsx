import { useState, useMemo } from 'react';
import { Customer, CustomerStatus, STATUS_LIST, STATUS_COLORS, User, AIConfig, OfficerAIPermission } from '../types';
import { getTodayDateString } from '../services/db';
import { FileSpreadsheet, Search, Filter, ArrowRight, Download, CheckCircle, Calendar, AlertCircle, Sparkles, RefreshCw, FileText } from 'lucide-react';
import { useLanguage } from '../services/language';
import { soundService } from '../services/sound';
import { dbService } from '../services/db';
import AIExportButton from './AIExportButton';

interface ReportsViewProps {
  customers: Customer[];
  currentUser?: User;
  aiConfig?: AIConfig | null;
  officerPermissions?: OfficerAIPermission[];
}

// Helper for date and time formatting
const formatDateWithTime = (dateStr?: string, isDateOnly = false) => {
  if (!dateStr || dateStr === 'N/A' || dateStr === 'None') return 'None';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    
    if (isDateOnly) {
      return dateStr; // Avoid timezone shift on dates without time
    }

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

type DateFilterType = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function ReportsView({ 
  customers,
  currentUser,
  aiConfig = null,
  officerPermissions = []
}: ReportsViewProps) {
  const { t, language } = useLanguage();
  const todayStr = getTodayDateString(); // "2026-05-30"

  // Filter States
  const [activeFilter, setActiveFilter] = useState<DateFilterType>('all');

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const isZewdneh = !!(currentUser?.fullName?.toLowerCase().includes('zewd') || currentUser?.phoneNumber?.toLowerCase().includes('zewd'));
  const isReportAllowed = isZewdneh || (
    aiConfig?.featuresEnabled !== false &&
    aiConfig?.aiReportSummarizationEnabled !== false &&
    officerPermissions?.find(p => p.phoneNumber === currentUser?.phoneNumber)?.aiReportsAllowed === true
  );

  const handleGenerateReportSummary = async () => {
    setLoadingSummary(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/report-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customers: filteredList,
          activeFilter,
          counters,
          language // Pass the current language code EN/AM/OM!
        })
      });

      if (!res.ok) {
        throw new Error('Summary Generation network interruption.');
      }

      const data = await res.json();
      setAiSummary(data.summary);
      soundService.playSuccessChime();

      // Log AI Usage Telemetry
      if (currentUser) {
        await dbService.addAIUsageLog(
          currentUser.fullName,
          currentUser.phoneNumber,
          'REPORT_SUMMARIZATION',
          `Generated summary insights for standard report folder.`
        );
      }

    } catch (err: any) {
      alert('Failed to formulate AI Summary: ' + err.message);
    } finally {
      setLoadingSummary(false);
    }
  };
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [tabSearch, setTabSearch] = useState('');

  // Sift Customers relative to selected Date ranges
  const filteredList = useMemo(() => {
    const today = new Date(todayStr);

    let startRange: Date | null = null;
    let endRange: Date | null = null;

    if (activeFilter === 'today') {
      startRange = new Date(todayStr + 'T00:00:00Z');
      endRange = new Date(todayStr + 'T23:59:59Z');
    } else if (activeFilter === 'yesterday') {
      const yesterdayDate = new Date(todayStr);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
      startRange = new Date(yesterdayStr + 'T00:00:00Z');
      endRange = new Date(yesterdayStr + 'T23:59:59Z');
    } else if (activeFilter === 'week') {
      // Past 7 Days
      const weekAgo = new Date(todayStr);
      weekAgo.setDate(weekAgo.getDate() - 6);
      startRange = new Date(weekAgo.toISOString().split('T')[0] + 'T00:00:00Z');
      endRange = new Date(todayStr + 'T23:59:59Z');
    } else if (activeFilter === 'month') {
      // Past 30 Days
      const monthAgo = new Date(todayStr);
      monthAgo.setDate(monthAgo.getDate() - 29);
      startRange = new Date(monthAgo.toISOString().split('T')[0] + 'T00:00:00Z');
      endRange = new Date(todayStr + 'T23:59:59Z');
    } else if (activeFilter === 'custom') {
      startRange = new Date((customStart || '2026-05-01') + 'T00:00:00Z');
      endRange = new Date((customEnd || todayStr) + 'T23:59:59Z');
    }

    // Filter by customer updatedDate or addedDate falling within the active date bracket
    return customers.filter(cust => {
      let inDateRange = true;
      if (activeFilter !== 'all' && startRange && endRange) {
        const custTime = new Date(cust.updatedDate || cust.addedDate);
        inDateRange = custTime >= startRange && custTime <= endRange;
      }

      // Also support localized search box filter by Name, Phone, Notes or Officer Sponsor
      if (tabSearch.trim()) {
        const query = tabSearch.trim().toLowerCase();
        const matchesSearch = 
          cust.name.toLowerCase().includes(query) || 
          cust.phoneNumber.toLowerCase().includes(query) ||
          (cust.notes && cust.notes.toLowerCase().includes(query)) ||
          (cust.addedBy && cust.addedBy.toLowerCase().includes(query));
        return inDateRange && matchesSearch;
      }

      return inDateRange;
    });

  }, [customers, activeFilter, customStart, customEnd, tabSearch, todayStr]);

  // Dynamically calculate status counters relative to the active report dates
  const counters = useMemo(() => {
    const acc = {
      total: filteredList.length,
      'Renewal Processing': 0,
      Completed: 0,
      Paid: 0,
      Rejected: 0,
      Waiting: 0,
    };

    filteredList.forEach(c => {
      if (acc[c.status] !== undefined) {
        acc[c.status]++;
      }
    });

    return acc;
  }, [filteredList]);

  // Client-Side CSV Export logic
  const handleExportCSV = (fileType: 'csv' | 'excel') => {
    if (filteredList.length === 0) {
      alert(t('No dynamic portfolio accounts discovered inside the selected date filters.'));
      return;
    }

    // Compose row headers (No Phone Number column as requested)
    const headers = [t('Customer Name'), t('Workflow State'), t('Officer Sponsor'), t('Date Registered'), t('Latest Status Shift'), t('Guarantor/Officer Observations')];
    
    // Rows mapping
    const rows = filteredList.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.status}"`,
      `"${c.addedBy}"`,
      `"${formatDateWithTime(c.addedDate)}"`,
      `"${formatDateWithTime(c.updatedDate)}"`,
      `"${(c.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);

    let blob: Blob;

    if (fileType === 'excel') {
      // Excel XML-compatible HTML representation for a much cleaner, formatted layout of columns
      const nowStr = new Date().toLocaleString();
      const titleRow = `<tr><td colspan="6" style="font-size: 16px; font-weight: bold; color: #1e1b4b; padding: 12px; background-color: #f5f3ff; border: 1px solid #ddd; text-align: center;">⚡ SECOND ROUND TRACKER - PORTFOLIO EXPORT REPORT ⚡</td></tr>`;
      const metadataRows = `
        <tr><td style="font-weight: bold; color: #475569; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">Compiled On:</td><td colspan="5" style="color: #0f172a; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">${nowStr}</td></tr>
        <tr><td style="font-weight: bold; color: #475569; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">Portfolio Segment:</td><td colspan="5" style="color: #0f172a; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">${activeFilter.toUpperCase()}</td></tr>
        <tr><td style="font-weight: bold; color: #475569; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">Total Records:</td><td colspan="5" style="color: #0f172a; padding: 6px; border: 1px solid #ddd; background-color: #f8fafc;">${filteredList.length}</td></tr>
        <tr><td colspan="6" style="height: 12px; border: none;"></td></tr>
      `;

      const headerCols = headers.map(h => `<th style="background-color: #8B5CF6; color: white; font-weight: bold; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 11px;">${h}</th>`).join('');
      const bodyRows = filteredList.map(c => {
        const rowCells = [
          c.name,
          c.status,
          c.addedBy,
          formatDateWithTime(c.addedDate),
          formatDateWithTime(c.updatedDate),
          c.notes || ''
        ];
        return `<tr>${rowCells.map(cell => `<td style="padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 11px;">${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`;
      }).join('');

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <style>
            table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; }
          </style>
        </head>
        <body>
          <table>
            ${titleRow}
            ${metadataRows}
            <tr>${headerCols}</tr>
            ${bodyRows}
          </table>
        </body>
        </html>
      `;

      blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    } else {
      // Standard CSV format
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Set appropriate filename extension
    const extension = fileType === 'excel' ? 'xls' : 'csv';
    link.setAttribute('download', `second_round_tracker_report_${activeFilter}_${todayStr}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="reports_view_panel">
      {/* View Header */}
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold font-sans text-[#0B1330] flex items-center gap-2">
          <FileSpreadsheet className="w-5.5 h-5.5 text-[#8B5CF6]" />
          {t('Credit Reports & Exports Station')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('Perform dynamic auditing, extract data cohorts, and export spreadsheets for executive credit summaries.')}
        </p>
      </div>

      {/* Date Filter Selection Panel */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4 font-sans">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 font-sans">
          <Filter className="w-4 h-4 text-gray-400" />
          {t('Select Financial Date Filters:')}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as DateFilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                activeFilter === f
                  ? 'bg-linear-to-r from-[#8B5CF6] to-[#C4B5FD] text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {f === 'all' ? t('All Portfolio Records') : f === 'week' ? t('Past 7 Days') : f === 'month' ? t('Past 30 Days') : t(f)}
            </button>
          ))}
        </div>

        {/* Custom Range select inputs if selected */}
        {activeFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-50 max-w-md animate-fade-in">
            <div>
              <label className="text-3xs font-black text-gray-400 uppercase">{t('Start Auditing Date')}</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="text-3xs font-black text-gray-400 uppercase">{t('End Auditing Date')}</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-xs p-2.5 rounded-lg mt-1 font-bold text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Counter KPI Grid (refreshes based on range filtered) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Total card */}
        <div className="bg-[#0B1330] text-white p-4 rounded-xl border border-[#0B1330] shadow-xs">
          <span className="text-3xs font-black text-slate-300 uppercase block leading-none">{t('Filtered Total')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans">{counters.total}</span>
        </div>

        {/* Processing card */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs border-t-4 border-t-[#8B5CF6]">
          <span className="text-3xs font-black text-gray-400 uppercase block leading-none">{t('Renewal Processing')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans text-gray-800">{counters['Renewal Processing']}</span>
        </div>

        {/* Completed card */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs border-t-4 border-t-[#22C55E]">
          <span className="text-3xs font-black text-gray-400 uppercase block leading-none">{t('Completed')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans text-[#22C55E]">{counters['Completed']}</span>
        </div>

        {/* Paid card */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs border-t-4 border-t-[#4F46E5]">
          <span className="text-3xs font-black text-gray-400 uppercase block leading-none">{t('Paid')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans text-[#4F46E5]">{counters['Paid']}</span>
        </div>

        {/* Rejected card */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs border-t-4 border-t-[#EF4444]">
          <span className="text-3xs font-black text-gray-400 uppercase block leading-none">{t('Rejected')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans text-[#EF4444]">{counters['Rejected']}</span>
        </div>

        {/* Waiting card */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs border-t-4 border-t-[#F59E0B]">
          <span className="text-3xs font-black text-gray-400 uppercase block leading-none">{t('Waiting')}</span>
          <span className="text-2xl font-black mt-2.5 block tracking-tight font-sans text-[#F59E0B]">{counters['Waiting']}</span>
        </div>
      </div>

      {/* Audit List panel with internal search box & Spreadsheets Export controls */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
        
        {/* Search & Export button controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-50 pb-4">
          
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('Search customer names...')}
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-2xs p-2 pl-9 rounded-lg focus:outline-hidden font-bold"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0 font-sans">
            {isReportAllowed && (
              <button
                onClick={handleGenerateReportSummary}
                disabled={loadingSummary || filteredList.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-950 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                {loadingSummary ? t('Summarizing...') : t('Generate AI Report Summary')}
              </button>
            )}
            <button
              onClick={() => handleExportCSV('csv')}
              className="flex-1 sm:flex-none px-4 py-2 bg-linear-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold rounded-xl hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-shadow"
            >
              <Download className="w-4 h-4" />
              {t('Export CSV Spreadsheet')}
            </button>
            <button
              onClick={() => handleExportCSV('excel')}
              className="flex-1 sm:flex-none px-4 py-2 bg-linear-to-r from-teal-500 to-[#8B5CF6] text-white text-xs font-bold rounded-xl hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-shadow"
            >
              <Download className="w-4 h-4" />
              {t('Export Excel Sheets')}
            </button>
          </div>

        </div>

        {/* AI Report Summary Insights Block */}
        {isReportAllowed && (loadingSummary || aiSummary) && (
          <div className="p-4 bg-linear-to-br from-slate-50 to-indigo-50/20 border border-slate-200 rounded-2xl space-y-2.5 animate-fade-in select-none">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-850 text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] animate-pulse shrink-0" />
                Gemini Multi-portfolio Intelligence Summary
              </span>
              <button 
                onClick={() => setAiSummary(null)}
                className="text-[8px] uppercase font-black text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                close
              </button>
            </div>
            
            {loadingSummary ? (
              <div className="py-8 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#8B5CF6]" />
                Formulating executive portfolio diagnostic analysis...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] leading-relaxed text-slate-755 text-slate-700 whitespace-pre-line font-medium">
                  {aiSummary}
                </div>
                {aiSummary && (
                  <AIExportButton
                    title="Portfolio Intelligence Summary"
                    textRaw={aiSummary}
                    metadata={{ officer: currentUser?.fullName || 'Digaf Officer', section: 'Portfolio Reports' }}
                    size="sm"
                    isZewdneh={isZewdneh}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Detailed Table Grid rendering */}
        {filteredList.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-400 bg-slate-50/50 rounded-xl border border-dashed border-gray-200">
            {t('No dynamic portfolio accounts discovered inside the selected date filters.')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-[#F8FAFC] text-gray-400 uppercase text-3xs font-black tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-3 pl-5">{t('Customer Name')}</th>
                  <th className="p-3">{t('Phone Number')}</th>
                  <th className="p-3">{t('Workflow State')}</th>
                  <th className="p-3">{t('Officer Sponsor')}</th>
                  <th className="p-3">{t('Date Registered')}</th>
                  <th className="p-3">{t('Latest Status Shift')}</th>
                  <th className="p-3 pr-5">{t('Guarantor/Officer Observations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50" id="reports_table_body">
                {filteredList.map(cust => {
                  const colors = STATUS_COLORS[cust.status];
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/30 transition-colors" id={`report_row_${cust.id}`}>
                      <td className="p-3 pl-5 font-bold text-[#0B1330]">{cust.name}</td>
                      <td className="p-3 font-mono font-semibold text-gray-500">{cust.phoneNumber}</td>
                      <td className="p-3">
                        <span className={`${colors.bg} ${colors.text} text-4xs font-black px-2 py-0.5 rounded-full border ${colors.border}`}>
                          {t(cust.status)}
                        </span>
                      </td>
                      <td className="p-3 text-3xs font-bold text-gray-600">{cust.addedBy || 'System'}</td>
                      <td className="p-3 font-mono text-gray-400 scale-95 origin-left">
                        <div>{cust.addedDate ? formatDateWithTime(cust.addedDate) : 'N/A'}</div>
                        <div className="text-[9px] text-gray-500 font-sans font-medium mt-0.5">by {cust.addedBy || 'System'}</div>
                      </td>
                      <td className="p-3 font-mono text-gray-400 scale-95 origin-left">
                        <div>{cust.updatedDate ? formatDateWithTime(cust.updatedDate) : 'N/A'}</div>
                        {cust.updatedBy && (
                          <div className="text-[9px] text-[#8B5CF6] font-sans font-extrabold mt-0.5">by {cust.updatedBy}</div>
                        )}
                      </td>
                      <td className={`p-3 pr-5 text-3xs italic max-w-xs truncate ${
                        cust.notes && cust.notes.toLowerCase().includes('the date is not same')
                          ? 'text-red-600 bg-red-50/50 font-extrabold font-sans'
                          : cust.notes && cust.notes.toLowerCase().includes('bulk imported')
                          ? 'text-emerald-600 bg-emerald-50/50 font-extrabold font-sans'
                          : 'text-gray-500'
                      }`} title={cust.notes}>
                        {cust.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
