// src/pages/AttendancePage.tsx
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import AttendanceModule from '../components/AttendanceModule';
import { ArrowLeft } from 'lucide-react';

interface AttendancePageProps {
  currentUser?: User;
  onBack?: () => void;
}

export default function AttendancePage({ currentUser: propUser, onBack }: AttendancePageProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(propUser || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If user was passed as prop, use it
    if (propUser) {
      setCurrentUser(propUser);
      setLoading(false);
      return;
    }

    // Check sessionStorage first (for cross-tab)
    const sessionUser = sessionStorage.getItem('digaf_attendance_user');
    if (sessionUser) {
      try {
        const parsed = JSON.parse(sessionUser);
        setCurrentUser(parsed);
        // Clean up
        sessionStorage.removeItem('digaf_attendance_user');
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse session user:', e);
      }
    }

    // Otherwise try to get from localStorage
    const saved = localStorage.getItem('digaf_remembered_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
      } catch (e) {
        console.error('Failed to parse user session:', e);
      }
    }
    setLoading(false);
  }, [propUser]);

  // If still loading, show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm font-medium">Loading attendance desk...</p>
        </div>
      </div>
    );
  }

  // If no user found, redirect to login
  if (!currentUser) {
    window.location.href = '/';
    return null;
  }

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