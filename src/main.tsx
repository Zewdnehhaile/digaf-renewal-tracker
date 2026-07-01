// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './services/language.tsx';
import './index.css';
import AttendancePage from './pages/AttendancePage';
import { User } from './types';
import { useState, useEffect } from 'react';

// Wrapper component to handle routing
function Root() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAttendancePage, setIsAttendancePage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we're on the attendance page
    const path = window.location.pathname;
    setIsAttendancePage(path === '/attendance');
    
    // Get current user from localStorage
    const saved = localStorage.getItem('digaf_remembered_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User;
        setCurrentUser(parsed);
      } catch {
        setCurrentUser(null);
      }
    }
    setLoading(false);
  }, []);

  // If still loading, show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8B5CF6] mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If on attendance page (with or without user - AttendancePage will handle redirect)
  if (isAttendancePage) {
    return (
      <StrictMode>
        <LanguageProvider>
          <AttendancePage 
            currentUser={currentUser || undefined}
            onBack={() => {
              window.location.href = '/';
            }}
          />
        </LanguageProvider>
      </StrictMode>
    );
  }

  // Default: show main app
  return (
    <StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);