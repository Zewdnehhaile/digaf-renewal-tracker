// src/components/FirstRound/FirstRoundReports.tsx
import React, { useState, useEffect } from 'react';
import { User, FirstRoundReport } from '../../types';
import { dbService } from '../../services/db';
import { 
  FileText, 
  Download, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Archive
} from 'lucide-react';

interface FirstRoundReportsProps {
  currentUser: User;
}

export default function FirstRoundReports({ currentUser }: FirstRoundReportsProps) {
  const [reports, setReports] = useState<FirstRoundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await dbService.getFirstRoundReports();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    try {
      await dbService.deleteFirstRoundReport(id);
      setReports(reports.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleExport = (report: FirstRoundReport, format: 'pdf' | 'excel' | 'csv') => {
    // Simple CSV export
    if (format === 'csv') {
      const headers = ['Name', 'Bank', 'Position', 'Branch', 'Phone', 'Reference ID', 'Completed At'];
      const rows = report.items.map(item => [
        item.name,
        item.bank || '',
        item.position || '',
        item.branch || '',
        item.phoneNumber || '',
        item.referenceId,
        item.completedAt || ''
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${report.reportDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      alert(`Export as ${format.toUpperCase()} coming soon!`);
    }
  };

  const totalPending = reports.reduce((sum, r) => sum + r.totalRecords, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#8B5CF6]" />
            Daily Reports
          </h2>
          <p className="text-sm text-slate-500">Archive completed applicants into daily reports</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-lg text-xs font-bold text-[#8B5CF6]">
            {reports.length} Reports
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-600">
            {totalPending} Archived
          </div>
        </div>
      </div>

      {/* Archive Alert */}
      {reports.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-amber-800">{totalPending} completed records ready to compile.</p>
              <p className="text-xs text-amber-600">Click "Archive Completed" to move them to historical reports</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black rounded-xl transition-all cursor-pointer">
            Archive Completed
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No reports generated yet</p>
          <p className="text-sm">Complete applicants and archive them to create reports</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-violet-50 rounded-xl">
                    <Calendar className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">
                      {new Date(report.reportDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {report.totalRecords} customers archived • Created by {report.createdBy || 'system'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleExport(report, 'csv')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport(report, 'excel')}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel
                  </button>
                  <button
                    onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    {expandedReport === report.id ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {expandedReport === report.id ? 'Hide' : 'Expand'}
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedReport === report.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 animate-fade-in">
                  <h5 className="text-xs font-bold text-slate-600 mb-3">Archived Customers</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.items.map((item) => (
                      <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <p className="text-slate-500">{item.bank || 'N/A'} • {item.position || 'N/A'}</p>
                          </div>
                          <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded">
                            {item.referenceId}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {item.branch && <span>{item.branch} • </span>}
                          {item.phoneNumber && <span>{item.phoneNumber}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}