// src/pages/AttendancePage.tsx
import React from 'react';
import { User } from '../types';
import AttendanceModule from '../components/AttendanceModule';
import { ArrowLeft } from 'lucide-react';

interface AttendancePageProps {
  currentUser: User;
  onBack?: () => void;
}

export default function AttendancePage({ currentUser, onBack }: AttendancePageProps) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              window.location.href = '/';
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
      <div className="max-w-7xl mx-auto">
        <AttendanceModule currentUser={currentUser} />
      </div>
    </div>
  );
}