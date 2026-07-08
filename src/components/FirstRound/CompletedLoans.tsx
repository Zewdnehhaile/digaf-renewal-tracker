// src/components/FirstRound/CompletedLoans.tsx
import React, { useState, useEffect } from 'react';
import { User, FirstRoundApplicant } from '../../types';
import { dbService } from '../../services/db';
import { CheckCircle, Trash2, Copy, Search, Archive, AlertCircle } from 'lucide-react';

interface CompletedLoansProps {
  currentUser: User;
  view?: 'all' | 'today';
  applicants?: FirstRoundApplicant[];
}

export default function CompletedLoans({ currentUser, view = 'today', applicants: propApplicants }: CompletedLoansProps) {
  const [completed, setCompleted] = useState<FirstRoundApplicant[]>(propApplicants || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const todayCompleted = completed.filter(a => a.completedAt?.split('T')[0] === today);

  // Use data from parent instead of fetching
  useEffect(() => {
    if (propApplicants) {
      setCompleted(propApplicants.filter((a: any) => a.status === 'completed'));
      setLoading(false);
    }
  }, [propApplicants]);

  const filtered = completed
    .filter(a => {
      if (view === 'today') {
        return a.completedAt?.split('T')[0] === today;
      }
      return true;
    })
    .filter(a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.referenceId.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header for 'today' view */}
      {view === 'today' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-500" />
              Today's Completed
            </h2>
            <p className="text-sm text-slate-500">Successfully reviewed applicants today</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-600">
              {todayCompleted.length} Today
            </div>
          </div>
        </div>
      )}

      {/* Header for 'all' view */}
      {view === 'all' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-500" />
              Total Completed
            </h2>
            <p className="text-sm text-slate-500">All successfully reviewed applicants</p>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-600">
            {completed.length} Total
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search completed applicants..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No completed loans yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((applicant) => (
            <div
              key={applicant.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-800">{applicant.name}</h4>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200">
                      {applicant.completedAt?.split('T')[0] === today ? 'COMPLETED TODAY' : 'COMPLETED'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p><span className="font-medium">Bank:</span> {applicant.bank || 'N/A'}</p>
                    <p><span className="font-medium">Position:</span> {applicant.position || 'N/A'}</p>
                    <p><span className="font-medium">Branch:</span> {applicant.branch || 'N/A'}</p>
                    <p><span className="font-medium">Phone:</span> {applicant.phoneNumber || 'N/A'}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">REF: {applicant.referenceId}</span>
                    <span>Logged by: {applicant.createdByName}</span>
                    <span>Completed: {applicant.completedAt ? new Date(applicant.completedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => navigator.clipboard.writeText(
                      `Name: ${applicant.name}\nBank: ${applicant.bank}\nPosition: ${applicant.position}\nBranch: ${applicant.branch}\nPhone: ${applicant.phoneNumber}\nREF: ${applicant.referenceId}`
                    )}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${applicant.name} from completed loans?`)) return;
                      try {
                        await dbService.deleteFirstRoundApplicant(applicant.id);
                        setCompleted(prev => prev.filter(a => a.id !== applicant.id));
                        alert('Record deleted successfully!');
                      } catch (error) {
                        console.error('Error deleting:', error);
                        alert('Failed to delete record.');
                      }
                    }}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}