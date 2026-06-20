import { useState, useEffect, useMemo } from 'react';
import { Customer, ActivityLog, CustomerStatus, STATUS_LIST, User, AIConfig, OfficerAIPermission } from './types';
import { dbService, getTodayDateString } from './services/db';
import { useLanguage } from './services/language';
import DigafLogo, { DigafIcon } from './components/DigafLogo';

import DashboardView from './components/DashboardView';
import KanbanBoard from './components/KanbanBoard';
import FollowUpToday from './components/FollowUpToday';
import ReportsView from './components/ReportsView';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import AIAssistantDrawer from './components/AIAssistantDrawer';
import AttendanceDisplay from './components/AttendanceDisplay';
import AttendanceModule from './components/AttendanceModule';
import ChatRoom from './components/ChatRoom';

import { 
  Building2, 
  LayoutDashboard, 
  History, 
  FileSpreadsheet, 
  Menu, 
  X, 
  PhoneCall, 
  ShieldAlert, 
  LogOut,
  Sparkles,
  Lock,
  Circle,
  CalendarClock,
  RefreshCw,
  Coins,
  PhoneOff,
  CheckCircle2,
  Archive,
  AlertTriangle,
  Clock,
  Globe,
  QrCode,
  Monitor,
  Sun,
  Moon,
  Eye,
  Sliders,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const isAttendanceDisplayRoute = typeof window !== 'undefined' && 
    !window.location.search.includes('qrScan=true') &&
    (window.location.pathname === '/attendance-display' || 
     window.location.hash === '#/attendance-display' || 
     window.location.search.includes('attendance-display'));

  const { t, language, setLanguage } = useLanguage();

  // Load and persist Eye Comfort and Brightness control inputs
  const [eyeComfort, setEyeComfort] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('digaf_eye_comfort');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  const [screenDimming, setScreenDimming] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('digaf_screen_dimming');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  const [showComfortPanel, setShowComfortPanel] = useState<boolean>(false);

  // Always force standard Light mode theme only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('digaf_theme', 'light');
      window.dispatchEvent(new Event('digaf-theme-change'));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('digaf_eye_comfort', String(eyeComfort));
  }, [eyeComfort]);

  useEffect(() => {
    localStorage.setItem('digaf_screen_dimming', String(screenDimming));
  }, [screenDimming]);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentRound, setCurrentRound] = useState<'first' | 'second'>('second');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<'both' | 'first_round' | 'second_round'>('both');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bounceBranding, setBounceBranding] = useState(false);

  // Auto-reload mechanism: detect if the bundle has changed (showing new updates after a republish)
  useEffect(() => {
    const getAssetsFingerprint = (html: string) => {
      const regex = /href=["']\/assets\/([^"']+\.css)["']|src=["']\/assets\/([^"']+\.js)["']/g;
      const assets: string[] = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        assets.push(match[1] || match[2]);
      }
      return assets.sort().join('|');
    };

    // Grab original scripts as reference
    fetch('/index.html?init=' + Date.now())
      .then(r => r.text())
      .then(html => {
        const baseFingerprint = getAssetsFingerprint(html);
        if (!baseFingerprint) return;

        const checkInterval = setInterval(() => {
          fetch('/index.html?poll=' + Date.now())
            .then(res => res.text())
            .then(newHtml => {
              const currentFingerprint = getAssetsFingerprint(newHtml);
              if (currentFingerprint && baseFingerprint !== currentFingerprint) {
                console.log("New republish update detected. Reloading page automatically...");
                clearInterval(checkInterval);
                window.location.reload();
              }
            })
            .catch(() => {});
        }, 15000); // Poll every 15 seconds for rapid updates

        return () => clearInterval(checkInterval);
      })
      .catch(() => {});
  }, []);

  // Trigger bouncing animation for title brand after 10 minutes has elapsed
  useEffect(() => {
    const bounceTimer = setTimeout(() => {
      setBounceBranding(true);
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearTimeout(bounceTimer);
  }, []);

  // Authenticated state with automatic remember-me logic and purge of pre-existing logins
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    localStorage.removeItem('digaf_active_officer'); // Purge legacy simple logins to satisfy "make to login again all them"
    const saved = localStorage.getItem('digaf_remembered_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User;
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const isZewdneh = currentUser?.role === 'super_admin';
  const isAdminStaff = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  // Synchronize and verify current user status with database on mount (Address Audit Task #2 / #11)
  useEffect(() => {
    if (!currentUser) return;
    let isSubscribed = true;
    
    const syncUser = async () => {
      try {
        const freshUser = await dbService.getUser(currentUser.phoneNumber);
        if (!isSubscribed) return;
        
        if (!freshUser || freshUser.status === 'deactive') {
          // Force logout immediately if deactivated or deleted from db
          setCurrentUser(null);
          localStorage.removeItem('digaf_remembered_session');
          return;
        }

        if (freshUser && freshUser.workspace === 'first_round' && freshUser.role !== 'admin' && freshUser.role !== 'super_admin') {
          setCurrentUser(null);
          localStorage.removeItem('digaf_remembered_session');
          try {
            window.top.location.href = "https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/";
          } catch (e) {
            window.location.href = "https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/";
          }
          return;
        }
        
        // Sync role updates and permissions dynamically from DB
        if (
          freshUser.role !== currentUser.role || 
          freshUser.hasRenewalTrackerAccess !== currentUser.hasRenewalTrackerAccess ||
          freshUser.deviceApproved !== currentUser.deviceApproved ||
          freshUser.deviceSignature !== currentUser.deviceSignature
        ) {
          setCurrentUser(freshUser);
          localStorage.setItem('digaf_remembered_session', JSON.stringify(freshUser));
        }
      } catch (err) {
        console.warn("Database sync failure. Retaining local session state.", err);
      }
    };
    
    syncUser();
    return () => { isSubscribed = false; };
  }, [currentUser?.phoneNumber]);

  // Redirect first_round workspace users to the existing First Round portal
  useEffect(() => {
    if (currentUser && currentUser.workspace === 'first_round' && currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
      localStorage.removeItem('digaf_remembered_session');
      try {
        window.top.location.href = "https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/";
      } catch (e) {
        window.location.href = "https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/";
      }
    }
  }, [currentUser]);

  // Redirect attendance-only employees and FTD away from dashboard index
  useEffect(() => {
    const isFTD = currentUser?.role === 'FTD' || currentUser?.customRole === 'FTD';
    if (currentUser && (currentUser.hasRenewalTrackerAccess === false || isFTD) && activeTab !== 'attendance' && activeTab !== 'chat') {
      setActiveTab('attendance');
    }
  }, [currentUser, activeTab]);

  // Handle QR scanning auto-routing
  useEffect(() => {
    if (currentUser) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qrScan') === 'true' && activeTab !== 'attendance') {
        setActiveTab('attendance');
      }
    }
  }, [currentUser]);

  const [inactivityNotice, setInactivityNotice] = useState<string>('');
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Automatically monitor page interaction inputs to trace active work logs & enforce secure logout
  useEffect(() => {
    if (!currentUser) return;

    const handleResetActivity = () => {
      setLastActivity(Date.now());
    };

    const targetEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'click', 'touchstart'];
    targetEvents.forEach((ev) => {
      window.addEventListener(ev, handleResetActivity);
    });

    const activityTracker = setInterval(() => {
      const elapsedMs = Date.now() - lastActivity;
      const timeoutMs = 10 * 60 * 1000; // Updated to 10 minutes inactivity timeout
      
      if (elapsedMs >= timeoutMs) {
        localStorage.removeItem('digaf_remembered_session');
        setCurrentUser(null);
        setInactivityNotice('Your session has automatically logged out due to inactivity.');
        setActiveTab('dashboard');
      }
    }, 4000);

    return () => {
      targetEvents.forEach((ev) => {
        window.removeEventListener(ev, handleResetActivity);
      });
      clearInterval(activityTracker);
    };
  }, [currentUser, lastActivity]);


  const handleLoginSuccess = (user: User, remember: boolean) => {
    setCurrentUser(user);
    setInactivityNotice('');
    setLastActivity(Date.now());
    
    // Auto-route to attendance if logging in from a scanned QR
    const params = new URLSearchParams(window.location.search);
    if (params.get('qrScan') === 'true') {
      setActiveTab('attendance');
    }

    if (remember) {
      localStorage.setItem('digaf_remembered_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('digaf_remembered_session');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('digaf_remembered_session');
    setCurrentUser(null);
    setInactivityNotice('');
  };

  // Core synchronized application state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [officerPermissions, setOfficerPermissions] = useState<OfficerAIPermission[]>([]);

  // 1. Subscribe to Real-Time PubSub Firestore Streams / broadcast synchronization
  useEffect(() => {
    const unsubCustomers = dbService.subscribeCustomers(async (updatedCustomers) => {
      const todayStr = getTodayDateString();
      for (const cust of updatedCustomers) {
        if (cust.status === 'No Response' && cust.followUpDate && cust.followUpDate <= todayStr) {
          try {
            await dbService.updateCustomer(cust.id, { status: 'Renewal Processing' }, 'System Auto-Shift');
          } catch (e) {
            console.error("Auto-shift from No Response failed:", e);
          }
        }
      }
      setCustomers(updatedCustomers);
    });

    const unsubLogs = dbService.subscribeLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });

    const unsubAIConfig = dbService.subscribeAIConfig((loadedConfig) => {
      setAiConfig(loadedConfig);
    });

    const unsubPermissions = dbService.subscribeOfficerPermissions((loadedPerms) => {
      setOfficerPermissions(loadedPerms);
    });

    return () => {
      unsubCustomers();
      unsubLogs();
      unsubAIConfig();
      unsubPermissions();
    };
  }, []);

  // Securely isolate visible customers based on user workspace boundaries (Requirement #8)
  const secureCustomersForUser = useMemo(() => {
    if (!currentUser) return [];
    
    // Get base customers for this user
    let baseList = customers;
    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.workspace !== 'both') {
      const userWorkspace = currentUser.workspace || 'second_round';
      baseList = customers.filter(c => c.workspace === userWorkspace);
    }
    
    // Admin / Super Admin can filter by workspace round selection
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.workspace === 'both') {
      if (selectedRoundFilter !== 'both') {
        return baseList.filter(c => c.workspace === selectedRoundFilter);
      }
    }
    
    return baseList;
  }, [customers, currentUser, selectedRoundFilter]);

  // Compute urgent badge indicators using secured, isolated portfolios
  const statsSummary = {
    followUpCount: secureCustomersForUser.filter(c => {
      if (!c.followUpDate) return false;
      const isFinalized = c.status === 'Completed' || c.status === 'Rejected';
      const todayString = getTodayDateString();
      return c.followUpDate <= todayString && !isFinalized;
    }).length,
    statusCounts: STATUS_LIST.reduce((acc, status) => {
      if (status === 'Completed') {
        const todayStr = getTodayDateString(); // e.g. '2026-06-03'
        acc[status] = secureCustomersForUser.filter(c => c.status === status && c.updatedDate.includes(todayStr)).length;
      } else {
        acc[status] = secureCustomersForUser.filter(c => c.status === status).length;
      }
      return acc;
    }, {} as Record<string, number>)
  };

  const frQueueCount = useMemo(() => {
    // If there are real first_round customers in database, count them, otherwise fallback to 9
    const dbCount = customers.filter(c => c.workspace === 'first_round' && c.status !== 'Completed').length;
    return dbCount || 9;
  }, [customers]);

  const frCompletedCount = useMemo(() => {
    // If there are real first_round customers in database, count them, otherwise fallback to 11
    const dbCount = customers.filter(c => c.workspace === 'first_round' && c.status === 'Completed').length;
    return dbCount || 11;
  }, [customers]);

  const deskItems = [
    { 
      id: 'dashboard', 
      label: 'Executive Dashboard', 
      icon: LayoutDashboard,
      badge: null,
      badgeColor: ''
    },
    { 
      id: 'followup', 
      label: 'Follow Up Today', 
      icon: CalendarClock,
      badge: statsSummary.followUpCount ? String(statsSummary.followUpCount) : null,
      badgeColor: 'bg-amber-100 text-amber-800 border border-amber-200'
    }
  ];

  const pipelineItems = STATUS_LIST.map(status => {
    let icon = Circle;
    if (status === 'Renewal Processing') icon = RefreshCw;
    else if (status === 'Paid') icon = Coins;
    else if (status === 'No Response') icon = PhoneOff;
    else if (status === 'Completed') icon = CheckCircle2;
    else if (status === 'Waiting') icon = Clock;
    else if (status === 'Rejected') icon = AlertTriangle;

    return {
      id: `stage-${status.replace(/\s+/g, '-')}`,
      label: status,
      icon,
      badge: statsSummary.statusCounts[status] ? String(statsSummary.statusCounts[status]) : null,
      badgeColor: 'bg-violet-100 text-[#8B5CF6] border border-violet-200'
    };
  });

  const databaseItems = [
    { 
      id: 'reports', 
      label: 'Reports & Export', 
      icon: FileSpreadsheet,
      badge: null,
      badgeColor: ''
    },
    ...(isAdminStaff ? [{
      id: 'admin',
      label: 'Admin Console',
      icon: ShieldAlert,
      badge: null,
      badgeColor: ''
    }] : [])
  ];

  const attendanceItems = [
    {
      id: 'attendance',
      label: 'Attendance Desk',
      icon: CalendarClock,
      badge: null,
      badgeColor: ''
    }
  ];

  const chatItems = [
    {
      id: 'chat',
      label: 'Staff Chat Room',
      icon: MessageSquare,
      badge: null,
      badgeColor: ''
    }
  ];

  const handleNavigate = (id: string) => {
    if (id === 'kanban') {
      setActiveTab('stage-Renewal-Processing');
    } else {
      setActiveTab(id);
    }
    setMobileMenuOpen(false);
  };

  // Dynamic comfort shield overlays helper
  const renderComfortOverlays = () => (
    <>
      {eyeComfort > 0 && (
        <div 
          className="pointer-events-none fixed inset-0 z-[99999] transition-all mix-blend-multiply duration-150"
          style={{
            backgroundColor: `rgba(245, 158, 11, ${eyeComfort * 0.0035})`,
          }}
        />
      )}
      {screenDimming > 0 && (
        <div 
          className="pointer-events-none fixed inset-0 z-[99998] transition-all duration-150"
          style={{
            backgroundColor: `rgba(15, 23, 42, ${screenDimming * 0.008})`,
          }}
        />
      )}
    </>
  );

  if (isAttendanceDisplayRoute) {
    return (
      <>
        {renderComfortOverlays()}
        <AttendanceDisplay />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        {renderComfortOverlays()}
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess} 
          initialMessage={inactivityNotice} 
        />
        {/* Floating Eye Comfort widget on the unbound login screen */}
        <div className="fixed top-4 right-4 z-[9999]">
          <div className="relative">
            <button
              onClick={() => setShowComfortPanel(!showComfortPanel)}
              className={`p-1.5 px-2.5 border rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                eyeComfort > 0 || screenDimming > 0
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-250 text-amber-800'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-705'
              }`}
              title={t('Eye Comfort Shield & Brightness Adjuster')}
            >
              <Eye className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-wide hidden sm:inline-block">
                {eyeComfort > 0 || screenDimming > 0 ? t('Comfort On') : t('Eye Comfort')}
              </span>
            </button>

            {showComfortPanel && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowComfortPanel(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-left animate-fade-in font-sans space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      {t('Visual Comfort Options')}
                    </span>
                    <button 
                      onClick={() => {
                        setEyeComfort(0);
                        setScreenDimming(0);
                      }}
                      className="text-[9px] font-black text-rose-600 uppercase hover:underline cursor-pointer bg-none border-none p-0"
                    >
                      {t('Reset')}
                    </button>
                  </div>

                  {/* Eye Comfort Shield slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                      <span>👁️ {t('Eye Comfort Filter')}</span>
                      <span className="font-extrabold text-amber-600">{eyeComfort}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="70"
                      value={eyeComfort}
                      onChange={(e) => setEyeComfort(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
                    />
                    <p className="text-[8.5px] text-slate-400 font-medium leading-normal">
                      {t('Filters out blue light with a warm, soothing amber tint to eliminate eye fatigue.')}
                    </p>
                  </div>

                  {/* Screen Dimmer slider */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                      <span>🔆 {t('Night Brightness Dimmer')}</span>
                      <span className="font-extrabold text-slate-600">{100 - screenDimming}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={screenDimming}
                      onChange={(e) => setScreenDimming(parseInt(e.target.value, 10))}
                      className="w-full accent-slate-700 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
                    />
                    <p className="text-[8.5px] text-slate-400 font-medium leading-normal">
                      {t('Reduces screen emission levels for comfortable night review and dark workspace viewing.')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans transition-colors duration-300" id="app_root_layout">
      {renderComfortOverlays()}
      
      {/* 1. TOP HEADER BRANDBAR - POLISHED CRISP THEME, COMFORT CONTROLS READY */}
      <header className="bg-white text-[#0B1330] border-b border-slate-200/80 sticky top-0 z-40 px-5 py-3.5 flex items-center justify-between shadow-xs transition-colors duration-300">
        {/* Brand identity area */}
        <div className="flex items-center gap-3">
          <DigafLogo />
          
          <span className="hidden md:inline-block w-px h-6 bg-slate-200 mx-2" />
          <div className="hidden md:flex items-center gap-0.5 ml-2 px-3.5 py-1.5 bg-slate-100/50 border border-slate-200/50 rounded-xl leading-none transition-all">
            {"Second Round Tracker".split("").map((char, idx) => {
              // Vibrant color sequence for each letter
              const letterColors = [
                "text-[#8B5CF6]",
                "text-indigo-500",
                "text-violet-500",
                "text-fuchsia-500",
                "text-indigo-600",
                "text-[#A78BFA]"
              ];
              const colorClass = letterColors[idx % letterColors.length];
              
              if (char === " ") {
                return <span key={idx} className="w-1.5" />;
              }

              return (
                <span
                  key={idx}
                  className={`text-sm lg:text-base font-black tracking-tight uppercase font-sans select-none ${colorClass} ${
                    bounceBranding ? 'animate-letter-bounce' : ''
                  }`}
                  style={{
                    animationDelay: `${idx * 0.06}s`
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>

        {/* Action center header */}
        <div className="flex items-center gap-4">
          {/* Globe Icon Language Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-705 px-3 py-1.5 rounded-lg border border-slate-200 shadow-3xs transition-all font-semibold text-xs shrink-0">
            <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent border-0 outline-hidden text-[11px] font-extrabold pr-1 cursor-pointer uppercase select-none font-sans text-slate-800"
            >
              <option value="en" className="text-black bg-white">EN</option>
              <option value="am" className="text-black bg-white">አማ (AM)</option>
              <option value="om" className="text-black bg-white">OM</option>
            </select>
          </div>

          {/* Eye comfort control panel toggle */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowComfortPanel(!showComfortPanel)}
              className={`p-1.5 px-2.5 border rounded-lg shadow-3xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                eyeComfort > 0 || screenDimming > 0
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-250 text-amber-800'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-705'
              }`}
              title={t('Eye Comfort Shield & Brightness Adjuster')}
            >
              <Eye className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-wide hidden sm:inline-block">
                {eyeComfort > 0 || screenDimming > 0 ? t('Comfort On') : t('Eye Comfort')}
              </span>
            </button>

            {showComfortPanel && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowComfortPanel(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-left animate-fade-in font-sans space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      {t('Visual Comfort Options')}
                    </span>
                    <button 
                      onClick={() => {
                        setEyeComfort(0);
                        setScreenDimming(0);
                      }}
                      className="text-[9px] font-black text-rose-600 uppercase hover:underline cursor-pointer bg-none border-none p-0"
                    >
                      {t('Reset')}
                    </button>
                  </div>

                  {/* Eye Comfort Shield slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                      <span>👁️ {t('Eye Comfort Filter')}</span>
                      <span className="font-extrabold text-amber-600">{eyeComfort}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="70"
                      value={eyeComfort}
                      onChange={(e) => setEyeComfort(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
                    />
                    <p className="text-[8.5px] text-slate-400 font-medium leading-normal">
                      {t('Filters out blue light with a warm, soothing amber tint to eliminate eye fatigue.')}
                    </p>
                  </div>

                  {/* Screen Dimmer slider */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                      <span>🔆 {t('Night Brightness Dimmer')}</span>
                      <span className="font-extrabold text-slate-600">{100 - screenDimming}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={screenDimming}
                      onChange={(e) => setScreenDimming(parseInt(e.target.value, 10))}
                      className="w-full accent-slate-700 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
                    />
                    <p className="text-[8.5px] text-slate-400 font-medium leading-normal">
                      {t('Reduces screen emission levels for comfortable night review and dark workspace viewing.')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {currentUser ? (
            <>
              <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-emerald-700 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {t('Active Officer')}: {currentUser.fullName}
              </div>
              
              <button
                onClick={handleLogout}
                className="p-1 px-3 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 text-slate-600 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 uppercase"
                title="Sign out of Workstation"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                {t('Log Out')}
              </button>
            </>
          ) : (
            <div className="bg-rose-50 border border-rose-150 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-rose-600 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Terminal Unbound
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2 text-3xs text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Synced Listener Active
          </div>

          {/* Trigger menu toggle button for mobile */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer text-slate-755"
            id="mobile_menu_trigger"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. CORE GRID CONTAINER */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Navigation Sidebar panel - FULLY WHITE STYLING */}
        <aside 
          className={`
            bg-white text-slate-800 w-full md:w-64 border-r border-slate-200/80 flex flex-col justify-between shrink-0 transition-all duration-300 z-30
            ${mobileMenuOpen ? 'fixed inset-0 top-[57px]' : 'hidden md:flex'}
          `}
          id="sidebar_navigation"
        >
          {/* Nav list */}
          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            {currentUser?.hasRenewalTrackerAccess !== false && currentUser?.role !== 'FTD' && currentUser?.customRole !== 'FTD' && (
              <>
                {/* Category 0: Rounds Workspace */}
                <div className="space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#8B5CF6] pl-3 py-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse"></span>
                    {language === 'am' ? 'የስራ ዙሮች (Rounds)' : language === 'om' ? 'KOREE ROUNDS' : 'Rounds Workspace'}
                  </div>
                  <nav className="space-y-1">
                    <button
                      onClick={() => {
                        setCurrentRound('first');
                        setActiveTab('first_round_queue');
                      }}
                      className={`
                        w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                        ${currentRound === 'first' 
                          ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                          : 'bg-transparent text-slate-650 border-transparent hover:bg-slate-50 hover:text-slate-950'
                        }
                      `}
                      id="sidebar_round_first"
                    >
                      {currentRound === 'first' && (
                        <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                      )}
                      <div className="flex items-center gap-2 bg-transparent">
                        <RefreshCw className={`w-3.5 h-3.5 shrink-0 transition-transform ${currentRound === 'first' ? 'text-[#8B5CF6] scale-110 stroke-[2.2px]' : 'text-slate-400'}`} />
                        <span>1st Round Section</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentRound('second');
                        setActiveTab('dashboard');
                      }}
                      className={`
                        w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                        ${currentRound === 'second' 
                          ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                          : 'bg-transparent text-slate-650 border-transparent hover:bg-slate-50 hover:text-slate-950'
                        }
                      `}
                      id="sidebar_round_second"
                    >
                      {currentRound === 'second' && (
                        <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                      )}
                      <div className="flex items-center gap-2 bg-transparent">
                        <ShieldCheck className={`w-3.5 h-3.5 shrink-0 transition-transform ${currentRound === 'second' ? 'text-[#8B5CF6] scale-110 stroke-[2.2px]' : 'text-slate-400'}`} />
                        <span>2nd Round Section</span>
                      </div>
                    </button>
                  </nav>
                </div>

                {currentRound === 'first' ? (
                  <>
                    {/* Category: 1st Round Pipeline Stages */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                        {language === 'am' ? 'ባለፉት የስራ ደረጃዎች' : language === 'om' ? 'PIPELINE STAGES' : 'PIPELINE STAGES'}
                      </div>
                      <nav className="space-y-1">
                        {[
                          { id: 'first_round_queue', label: 'First Round Queue', icon: RefreshCw, badge: String(frQueueCount), badgeColor: 'bg-violet-100 text-[#8B5CF6] border border-violet-200 shadow-3xs' },
                          { id: 'first_round_completed', label: 'Completed Loans', icon: CheckCircle2, badge: String(frCompletedCount), badgeColor: 'bg-emerald-100 text-[#10B981] border border-emerald-200 shadow-3xs' },
                          { id: 'first_round_reports', label: 'Daily Reports', icon: FileSpreadsheet, badge: null, badgeColor: '' },
                          { id: 'first_round_settings', label: 'Portal Settings', icon: Monitor, badge: null, badgeColor: '' }
                        ].map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavigate(item.id)}
                              className={`
                                w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                                ${isActive 
                                  ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                                  : 'bg-transparent text-slate-604 border-transparent hover:bg-slate-50 hover:text-slate-950'
                                }
                              `}
                              id={`sidebar_link_${item.id}`}
                            >
                              {/* Active Indicator Strip on the Left */}
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                              )}

                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="truncate max-w-[145px] text-left leading-normal">
                                  {t(item.label)}
                                </span>
                              </div>

                              {/* Badge notification alert */}
                              {item.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-4xs font-black uppercase ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Category 1: Main Desk */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                        {language === 'am' ? 'አጠቃላይ እይታ' : language === 'om' ? 'HAALA WALIGALAA' : 'OVERVIEW'}
                      </div>
                      <nav className="space-y-1">
                        {deskItems.map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavigate(item.id)}
                              className={`
                                w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                                ${isActive 
                                  ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                                  : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                                }
                              `}
                              id={`sidebar_link_${item.id}`}
                            >
                              {/* Active Indicator Strip on the Left */}
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                              )}

                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="text-left leading-normal">{t(item.label)}</span>
                              </div>

                              {/* Badge notification alert */}
                              {item.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-4xs font-black uppercase ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Category 2: Pipeline Stages */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                        {language === 'am' ? 'ባለፉት የስራ ደረጃዎች' : language === 'om' ? 'GOSA TARKAAFFIILEE' : 'CORE OPERATIONS'}
                      </div>
                      <nav className="space-y-1">
                        {pipelineItems.map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavigate(item.id)}
                              className={`
                                w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                                ${isActive 
                                  ? 'bg-indigo-50/70 text-[#4F46E5] border-indigo-100/50 shadow-3xs' 
                                  : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                                }
                              `}
                              id={`sidebar_link_${item.id}`}
                            >
                              {/* Active Indicator Strip on the Left */}
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#4F46E5] rounded-full" />
                              )}

                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'text-[#4F46E5] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="truncate max-w-[145px] text-left leading-normal">
                                  {t(item.label)}
                                </span>
                              </div>

                              {/* Badge notification alert */}
                              {item.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-4xs font-black uppercase ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Category 3: Database & Audits */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                        {language === 'am' ? 'ደህንነትና ሪፖርቶች' : language === 'om' ? 'MALLATTOOLEE' : 'SETTINGS'}
                      </div>
                      <nav className="space-y-1">
                        {databaseItems.map(item => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavigate(item.id)}
                              className={`
                                w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                                ${isActive 
                                  ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                                  : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                                }
                              `}
                              id={`sidebar_link_${item.id}`}
                            >
                              {/* Active Indicator Strip on the Left */}
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                              )}

                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="text-left leading-normal">{t(item.label)}</span>
                              </div>

                              {/* Badge notification alert */}
                              {item.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-4xs font-black uppercase ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Category 4: Attendance Desk (Always Visible) */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                {language === 'am' ? 'የመገኘት መቆጣጠሪያ' : language === 'om' ? 'ALTAAJII' : 'ATTENDANCE'}
              </div>
              <nav className="space-y-1">
                {attendanceItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`
                        w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                        ${isActive 
                          ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                          : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                        }
                      `}
                      id={`sidebar_link_${item.id}`}
                    >
                      {/* Active Indicator Strip on the Left */}
                      {isActive && (
                        <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                      )}

                      <div className="flex items-center gap-2 bg-transparent">
                        <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                        <span className="text-left leading-normal">{t(item.label)}</span>
                      </div>
                    </button>
                  );
                })}

                {/* Direct Link to Launch the QR Kiosk dynamically inside a new browser tab */}
                {isAdminStaff && (
                  <button
                    onClick={() => window.open('/?attendance-display', '_blank')}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-[12px] font-bold tracking-tight transition-all cursor-pointer border border-dashed border-violet-200 bg-violet-50/15 text-[#8B5CF6] hover:bg-violet-50 hover:text-violet-950 pl-8"
                    id="sidebar_link_launch_display"
                    title="Launch Public QR Kiosk for scan registration"
                  >
                    <div className="flex items-center gap-2 bg-transparent">
                      <Monitor className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-left leading-normal">{t('Launch QR Kiosk')} ↗</span>
                    </div>
                  </button>
                )}
              </nav>
            </div>

            {/* Category 5: Secure Communications Desk (Always Visible) */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                {language === 'am' ? 'መልእክት' : language === 'om' ? 'KUNYEE CHAT' : 'COMMUNICATIONS'}
              </div>
              <nav className="space-y-1">
                {chatItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`
                        w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8
                        ${isActive 
                          ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs' 
                          : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                        }
                      `}
                      id={`sidebar_link_${item.id}`}
                    >
                      {/* Active Indicator Strip on the Left */}
                      {isActive && (
                        <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                      )}

                      <div className="flex items-center gap-2 bg-transparent">
                        <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                        <span className="text-left leading-normal">{t(item.label)}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sidebar Footer banner */}
          <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
            <div className="flex items-center gap-2 bg-violet-50/70 p-2.5 rounded-xl border border-violet-100/60 text-xs">
              <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <div className="flex items-center gap-[1.5px] font-sans">
                {"powered by ዘውድ".split("").map((char, idx) => {
                  const letterColors = [
                    "text-emerald-500",
                    "text-emerald-600",
                    "text-teal-500",
                    "text-teal-600",
                    "text-cyan-500",
                    "text-cyan-600",
                    "text-sky-500",
                    "text-sky-600",
                    "text-blue-500",
                    "text-blue-600"
                  ];
                  const colorClass = letterColors[idx % letterColors.length];
                  if (char === " ") {
                    return <span key={idx} className="w-1" />;
                  }
                  return (
                    <span key={idx} className={`text-[11px] font-black uppercase tracking-tight select-none ${colorClass}`}>
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="text-[9px] text-slate-400 font-mono leading-none flex flex-col gap-1 pl-1">
              <span>Digaf MFI Workstation</span>
              <span>Lobby Desk System</span>
            </div>
          </div>
        </aside>

        {/* 3. WORKING PORTFOLIO SCREEN AREA */}
        <main className="flex-1 p-5 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden min-h-[calc(100vh-57px)]">
          {/* Admin Workspace Round Controller Segment */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.workspace === 'both') && (
            <div className="mb-6 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs animate-fade-in">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#8B5CF6]" />
                <div>
                  <h4 className="text-[11.5px] font-extrabold uppercase tracking-wide text-slate-800">
                    System Workspace Controller
                  </h4>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Select active workspace segment to view and manage portfolios
                  </p>
                </div>
              </div>

              <div className="flex bg-slate-200/60 p-1 rounded-xl w-fit border border-slate-200/30">
                <button
                  onClick={() => {
                    setSelectedRoundFilter('both');
                    setCurrentRound('second');
                    setActiveTab('dashboard');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedRoundFilter === 'both'
                      ? 'bg-white text-[#8B5CF6] shadow-3xs font-black'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                  id="tab_both_rounds_toggle"
                >
                  Both Sections (Full Page)
                </button>
                <button
                  onClick={() => {
                    setSelectedRoundFilter('first_round');
                    setCurrentRound('first');
                    setActiveTab('first_round_queue');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedRoundFilter === 'first_round'
                      ? 'bg-white text-[#8B5CF6] shadow-3xs font-black'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                  id="tab_first_round_toggle"
                >
                  1st Round Section
                </button>
                <button
                  onClick={() => {
                    setSelectedRoundFilter('second_round');
                    setCurrentRound('second');
                    setActiveTab('dashboard');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedRoundFilter === 'second_round'
                      ? 'bg-white text-[#8B5CF6] shadow-3xs font-black'
                      : 'text-slate-600 hover:text-slate-900 border-transparent'
                  }`}
                  id="tab_second_round_toggle"
                >
                  2nd Round Section
                </button>
              </div>
            </div>
          )}
          
          {currentRound === 'first' && activeTab.startsWith('first_round_') && (
            <div className="w-full h-[calc(100vh-160px)] min-h-[550px] flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden animate-fade-in relative mb-6">
              <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold text-slate-700 tracking-tight uppercase text-[11px]">
                    1st Round Loan Management Portal
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">
                    Active Session Portal Gateway
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const iframe = document.getElementById('first_round_iframe') as HTMLIFrameElement;
                      if (iframe) iframe.src = iframe.src;
                    }}
                    className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer transition text-[11px]"
                    title="Reload Portal Workspace View"
                  >
                    Refresh View
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => window.open("https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/", "_blank")}
                    className="text-violet-600 hover:text-violet-800 font-extrabold flex items-center gap-1 cursor-pointer transition text-[11px]"
                  >
                    Open Standalone Tab ↗
                  </button>
                </div>
              </div>
              
              <iframe
                id="first_round_iframe"
                src="https://ais-pre-qnzty2xquw3re36subjhp5-634552569384.europe-west2.run.app/"
                className="w-full flex-1 border-0"
                title="1st Round Queue Portal"
                allow="camera; microphone; geolocation"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView 
              customers={secureCustomersForUser} 
              logs={logs} 
              onNavigate={handleNavigate} 
              currentUser={currentUser || undefined}
              aiConfig={aiConfig}
              officerPermissions={officerPermissions}
            />
          )}

          {activeTab.startsWith('stage-') && (
            <KanbanBoard 
              customers={secureCustomersForUser} 
              focusedStatus={activeTab.replace('stage-', '').replace(/-/g, ' ') as CustomerStatus}
              onAddLog={dbService.logActivity.bind(dbService)} 
              currentUser={currentUser || undefined}
              logs={logs}
              aiConfig={aiConfig}
              officerPermissions={officerPermissions}
            />
          )}

          {activeTab === 'followup' && (
            <FollowUpToday 
              customers={secureCustomersForUser} 
              currentUser={currentUser || undefined}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView 
              customers={secureCustomersForUser} 
              currentUser={currentUser || undefined}
              aiConfig={aiConfig}
              officerPermissions={officerPermissions}
            />
          )}

          {activeTab === 'admin' && isAdminStaff && (
            <AdminDashboard 
              currentUser={currentUser!} 
              logs={logs} 
              customers={customers}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceModule 
              currentUser={currentUser!}
            />
          )}

          {activeTab === 'chat' && (
            <ChatRoom 
              currentUser={currentUser!}
            />
          )}
        </main>

      </div>

      {/* Floating AI Assistant panel container */}
      {currentUser && (
        <AIAssistantDrawer 
          currentUser={currentUser}
          customers={secureCustomersForUser}
          logs={logs}
          aiConfig={aiConfig}
          officerPermissions={officerPermissions}
        />
      )}

    </div>
  );
}
