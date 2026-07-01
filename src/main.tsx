// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './services/language.tsx';
import './index.css';
import AttendancePage from './pages/AttendancePage'; // <- Change this line
import { User } from './types';
import { useState, useEffect } from 'react';

// Wrapper component to handle routing
function Root() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAttendancePage, setIsAttendancePage] = useState(false);

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
  }, []);

  // If on attendance page and user is logged in
  if (isAttendancePage && currentUser) {
    return (
      <StrictMode>
        <LanguageProvider>
          <AttendancePage 
            currentUser={currentUser} 
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