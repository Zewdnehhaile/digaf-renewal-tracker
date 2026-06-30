// src/pages/attendance.tsx
import React, { useEffect, useState } from 'react';
import AttendancePage from './AttendancePage';
import { User } from '../types';

export default function Attendance() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Get user from localStorage (same way App.tsx does it)
    const saved = localStorage.getItem('digaf_remembered_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm">Loading attendance desk...</p>
          <p className="text-slate-400 text-xs mt-2">Please log in first</p>
        </div>
      </div>
    );
  }

  return <AttendancePage currentUser={currentUser} />;
}