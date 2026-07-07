import { useState, useEffect, useMemo } from 'react';
import { Customer, ActivityLog, CustomerStatus, STATUS_LIST, User, AIConfig, OfficerAIPermission } from './types';
import { dbService, getTodayDateString } from './services/db';
import { useLanguage } from './services/language';
import DigafLogo, { DigafIcon } from './components/DigafLogo';
import FirstRoundQueue from './components/FirstRound/FirstRoundQueue';
import CompletedLoans from './components/FirstRound/CompletedLoans';
import FirstRoundReports from './components/FirstRound/FirstRoundReports';
import FirstRoundSettings from './components/FirstRound/FirstRoundSettings';
import DashboardView from './components/DashboardView';
import KanbanBoard from './components/KanbanBoard';
import FollowUpToday from './components/FollowUpToday';
import ReportsView from './components/ReportsView';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import EarlyPaymentClosure from './components/EarlyPaymentClosure';
import NotificationBell from './components/NotificationBell';
import ChatRoom from './components/ChatRoom';
import BlacklistManager from './components/BlacklistManager';
import GuarantorManager from './components/GuarantorManager';
import NonBorrowerRegistry from './components/NonBorrowerRegistry';
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
  Sun,
  Moon,
  Eye,
  Sliders,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  Users,
  Monitor,
} from 'lucide-react';

export default function App() {
  // ===== ALL HOOKS MUST COME FIRST =====
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentRound, setCurrentRound] = useState<'first' | 'second'>('second');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<'both' | 'first_round' | 'second_round'>('both');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bounceBranding, setBounceBranding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  // Authenticated state with automatic remember-me logic
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    localStorage.removeItem('digaf_active_officer');
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

  const [inactivityNotice, setInactivityNotice] = useState<string>('');
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Core synchronized application state
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Add this function after setCustomers
  const refreshCustomers = async () => {
    const updated = await dbService.getCustomers();
    setCustomers(updated);
  };
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [officerPermissions, setOfficerPermissions] = useState<OfficerAIPermission[]>([]);
  const [firstRoundPendingCount, setFirstRoundPendingCount] = useState(0);
  const [firstRoundCompletedCount, setFirstRoundCompletedCount] = useState(0);
  const [firstRoundCompletedToday, setFirstRoundCompletedToday] = useState(0);
  const isZewdneh = currentUser?.role === 'super_admin';
  const isAdminStaff = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  // ===== ALL useEffect HOOKS =====
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

  // Auto-reload mechanism
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
            .catch(() => { });
        }, 15000);

        return () => clearInterval(checkInterval);
      })
      .catch(() => { });
  }, []);

  // Trigger bouncing animation for title brand after 10 minutes
  useEffect(() => {
    const bounceTimer = setTimeout(() => {
      setBounceBranding(true);
    }, 10 * 60 * 1000);
    return () => clearTimeout(bounceTimer);
  }, []);

  // Auto-redirect First Round users to their queue
  useEffect(() => {
    if (!currentUser) return;

    // If user is First Round only (not admin/super_admin)
    if (currentUser.workspace === 'first_round' &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'super_admin') {
      setCurrentRound('first');
      setActiveTab('first_round_queue');
    }
  }, [currentUser]);




  // Automatically monitor page interaction inputs for secure logout
  useEffect(() => {
    if (!currentUser) return;

    const handleResetActivity = () => {
      setLastActivity(Date.now());
    };

    const targetEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'click', 'touchstart'];
    targetEvents.forEach((ev) => {
      window.addEventListener(ev, handleResetActivity);
    });

    //const activityTracker = setInterval(() => {
    //const elapsedMs = Date.now() - lastActivity;
    //const timeoutMs = 10 * 60 * 1000;

    //if (elapsedMs >= timeoutMs) {
    //  localStorage.removeItem('digaf_remembered_session');
    //setCurrentUser(null);
    //setInactivityNotice('Your session has automatically logged out due to inactivity.');
    //setActiveTab('dashboard');
    // }
    // }, 4000);

    return () => {
      targetEvents.forEach((ev) => {
        window.removeEventListener(ev, handleResetActivity);
      });
      //clearInterval(activityTracker);
    };
  }, [currentUser, lastActivity]);

  // Subscribe to Real-Time PubSub MongoDB Streams
  useEffect(() => {
    // ONLY run if user is logged in
    if (!currentUser) return;

    let isMounted = true;

    console.log('User logged in - loading data...');

    // Load customers IMMEDIATELY
    const unsubCustomers = dbService.subscribeCustomers(async (updatedCustomers) => {
      if (!isMounted) return;
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

    // Load logs IMMEDIATELY
    const unsubLogs = dbService.subscribeLogs((updatedLogs) => {
      if (!isMounted) return;
      setLogs(updatedLogs);
    });

    // Load AI config IMMEDIATELY
    const unsubAIConfig = dbService.subscribeAIConfig((loadedConfig) => {
      if (!isMounted) return;
      setAiConfig(loadedConfig);
    });

    // Load permissions IMMEDIATELY
    const unsubPermissions = dbService.subscribeOfficerPermissions((loadedPerms) => {
      if (!isMounted) return;
      setOfficerPermissions(loadedPerms);
    });

    return () => {
      isMounted = false;
      unsubCustomers();
      unsubLogs();
      unsubAIConfig();
      unsubPermissions();
    };
  }, [currentUser]);

  // Fetch First Round counts
  // Fetch First Round counts
  // Fetch First Round counts
  useEffect(() => {
    const fetchFirstRoundCounts = async () => {
      try {
        const data = await dbService.getFirstRoundApplicants();
        const today = new Date().toISOString().split('T')[0];

        const pending = data.filter((a: any) => a.status === 'pending').length;

        // Total completed (all time)
        const totalCompleted = data.filter((a: any) => a.status === 'completed').length;

        // Today's completed
        const todayCompleted = data.filter((a: any) =>
          a.status === 'completed' &&
          a.completedAt?.split('T')[0] === today
        ).length;

        setFirstRoundPendingCount(pending);
        setFirstRoundCompletedCount(totalCompleted); // All time
        setFirstRoundCompletedToday(todayCompleted); // Today only
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };
    fetchFirstRoundCounts();
    const interval = setInterval(fetchFirstRoundCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  // ===== ALL useMemo HOOKS =====
  const secureCustomersForUser = useMemo(() => {
    if (!currentUser) return [];

    // Admins and super admins see everything based on filter
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      if (selectedRoundFilter !== 'both') {
        return customers.filter(c => c.workspace === selectedRoundFilter)
          .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
      }
      return customers.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
    }

    // ALL OTHER USERS see ALL customers, sorted newest first
    return customers.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
  }, [customers, currentUser, selectedRoundFilter]);

  const statsSummary = {
    followUpCount: secureCustomersForUser.filter(c => {
      if (!c.followUpDate) return false;
      const isFinalized = c.status === 'Completed' || c.status === 'Rejected';
      const todayString = getTodayDateString();
      return c.followUpDate <= todayString && !isFinalized;
    }).length,
    statusCounts: STATUS_LIST.reduce((acc, status) => {
      if (status === 'Completed') {
        const todayStr = getTodayDateString();
        acc[status] = secureCustomersForUser.filter(c => c.status === status && c.updatedDate.includes(todayStr)).length;
      } else {
        acc[status] = secureCustomersForUser.filter(c => c.status === status).length;
      }
      return acc;
    }, {} as Record<string, number>)
  };

  // ===== HELPER FUNCTIONS =====
  const handleNavigate = (id: string) => {
    if (id === 'kanban') {
      setActiveTab('stage-Renewal-Processing');
    } else {
      setActiveTab(id);
    }
    setMobileMenuOpen(false);
  };

  const handleLoginSuccess = (user: User, remember: boolean) => {
    setCurrentUser(user);
    setInactivityNotice('');
    setLastActivity(Date.now());
    localStorage.setItem('digaf_remembered_session', JSON.stringify(user));
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
    localStorage.removeItem('digaf_cached_users');
    setCurrentUser(null);
    setInactivityNotice('');
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

  // ===== SIDEBAR ITEMS =====
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
    {
      id: 'early_payment',
      label: 'Early Payment Closure',
      icon: Coins,
      badge: null,
      badgeColor: ''
    },
    {
      id: 'blacklist',
      label: 'Blacklist Manager',
      icon: ShieldAlert,
      badge: null,
      badgeColor: ''
    },
    {
      id: 'guarantor',
      label: 'Guarantor Manager',
      icon: UserCheck,
      badge: null,
      badgeColor: ''
    },
    {
      id: 'nonborrower',
      label: 'Non-Borrower Registry',
      icon: Users,
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



  const chatItems = [
    {
      id: 'chat',
      label: 'Staff Chat Room',
      icon: MessageSquare,
      badge: null,
      badgeColor: ''
    }
  ];

  // ===== CONDITIONAL RETURNS (AFTER ALL HOOKS) =====


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
              className={`p-1.5 px-2.5 border rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${eyeComfort > 0 || screenDimming > 0
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

  // ===== MAIN RENDER =====
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans transition-colors duration-300" id="app_root_layout">
      {renderComfortOverlays()}

      {/* 1. TOP HEADER BRANDBAR */}
      <header className="bg-white text-[#0B1330] border-b border-slate-200/80 sticky top-0 z-40 px-5 py-3.5 flex items-center justify-between shadow-xs transition-colors duration-300">
        <div className="flex items-center gap-3">
          <DigafLogo />
          <span className="hidden md:inline-block w-px h-6 bg-slate-200 mx-2" />
          <div className="hidden md:flex items-center gap-0.5 ml-2 px-3.5 py-1.5 bg-slate-100/50 border border-slate-200/50 rounded-xl leading-none transition-all">
            {"Second Round Tracker".split("").map((char, idx) => {
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
                  className={`text-sm lg:text-base font-black tracking-tight uppercase font-sans select-none ${colorClass} ${bounceBranding ? 'animate-letter-bounce' : ''
                    }`}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
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

          <div className="relative shrink-0">
            <button
              onClick={() => setShowComfortPanel(!showComfortPanel)}
              className={`p-1.5 px-2.5 border rounded-lg shadow-3xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${eyeComfort > 0 || screenDimming > 0
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
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowComfortPanel(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 text-left animate-fade-in font-sans space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      {t('Visual Comfort Options')}
                    </span>
                    <button
                      onClick={() => { setEyeComfort(0); setScreenDimming(0); }}
                      className="text-[9px] font-black text-rose-600 uppercase hover:underline cursor-pointer bg-none border-none p-0"
                    >
                      {t('Reset')}
                    </button>
                  </div>
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
              <NotificationBell userId={currentUser.phoneNumber} userName={currentUser.fullName} />
              <button
                onClick={handleLogout}
                className="p-1 px-3 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 text-slate-600 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 uppercase"
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

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer text-slate-755"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. CORE GRID CONTAINER */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Navigation Sidebar panel */}
        <aside
          className={`
            bg-white text-slate-800 w-full md:w-64 border-r border-slate-200/80 flex flex-col justify-between shrink-0 transition-all duration-300 z-30
            ${mobileMenuOpen ? 'fixed inset-0 top-[57px]' : 'hidden md:flex'}
          `}
          id="sidebar_navigation"
        >
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
                    {/* 1st Round Section - ONLY show if user's workspace is 'first_round' or 'both' */}
                    {(currentUser?.workspace === 'first_round' || currentUser?.workspace === 'both') && (
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
                    )}

                    {/* 2nd Round Section - ONLY show if user's workspace is 'second_round' or 'both' */}
                    {(currentUser?.workspace === 'second_round' || currentUser?.workspace === 'both') && (
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
                    )}
                  </nav>
                </div>
                {currentRound === 'first' ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                      {language === 'am' ? 'ባለፉት የስራ ደረጃዎች' : language === 'om' ? 'PIPELINE STAGES' : 'PIPELINE STAGES'}
                    </div>
                    <nav className="space-y-1">
                      {[
                        { id: 'first_round_queue', label: 'First Round Queue', icon: RefreshCw, badge: String(firstRoundPendingCount), badgeColor: 'bg-violet-100 text-[#8B5CF6] border border-violet-200 shadow-3xs' },
                        { id: 'first_round_completed', label: 'Total Completed', icon: CheckCircle2, badge: String(firstRoundCompletedCount), badgeColor: 'bg-emerald-100 text-[#10B981] border border-emerald-200 shadow-3xs' },
                        { id: 'first_round_completed_today', label: "Today's Completed", icon: CalendarClock, badge: String(firstRoundCompletedToday), badgeColor: 'bg-amber-100 text-amber-800 border border-amber-200 shadow-3xs' },
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
                            {isActive && (
                              <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                            )}
                            <div className="flex items-center gap-2 bg-transparent">
                              <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                              <span className="truncate max-w-[145px] text-left leading-normal">
                                {t(item.label)}
                              </span>
                            </div>
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
                ) : (
                  <>
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
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                              )}
                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="text-left leading-normal">{t(item.label)}</span>
                              </div>
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
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#4F46E5] rounded-full" />
                              )}
                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'text-[#4F46E5] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="truncate max-w-[145px] text-left leading-normal">
                                  {t(item.label)}
                                </span>
                              </div>
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
                              {isActive && (
                                <span className="absolute left-2.5 w-1.25 h-4.5 bg-[#8B5CF6] rounded-full" />
                              )}
                              <div className="flex items-center gap-2 bg-transparent">
                                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'}`} />
                                <span className="text-left leading-normal">{t(item.label)}</span>
                              </div>
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

            {/* Category 4: Attendance Desk */}

            {/* Category 5: Communications */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-3 py-1">
                {language === 'am' ? 'መልእክት' : language === 'om' ? 'KUNYEE CHAT' : 'COMMUNICATIONS'}
              </div>
              <nav className="space-y-1">
                {/* Chat Room Link */}
                <button
                  key="chat"
                  onClick={() => handleNavigate('chat')}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border relative pl-8 ${activeTab === 'chat'
                    ? 'bg-violet-50 text-[#8B5CF6] border-violet-100/50 shadow-3xs'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950'
                    }`}
                >


                  <div className="flex items-center gap-2 bg-transparent">
                    <MessageSquare className={`w-4 h-4 shrink-0 transition-transform ${activeTab === 'chat' ? 'text-[#8B5CF6] scale-102 stroke-[2.2px]' : 'text-slate-400'
                      }`} />
                    <span className="text-left leading-normal">{t('Staff Chat Room')}</span>
                  </div>
                </button>

                {/* Attendance Desk Link */}
                <button
                  onClick={() => {
                    const userJson = JSON.stringify(currentUser);
                    localStorage.setItem('digaf_remembered_session', userJson);
                    sessionStorage.setItem('digaf_attendance_user', userJson);
                    window.location.href = '/attendance';
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-[12.5px] font-semibold tracking-tight transition-all cursor-pointer border bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950 pl-8"
                >
                  <div className="flex items-center gap-2 bg-transparent">
                    <CalendarClock className="w-4 h-4 text-slate-400" />
                    <span className="text-left leading-normal">{t('Attendance Desk')}</span>
                  </div>
                  <span className="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">→</span>
                </button>
              </nav>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
            <div className="flex items-center gap-2 bg-violet-50/70 p-2.5 rounded-xl border border-violet-100/60 text-xs">
              <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <div className="flex items-center gap-[1.5px] font-sans">
                {"powered by ዘውድ".split("").map((char, idx) => {
                  const letterColors = [
                    "text-emerald-500", "text-emerald-600", "text-teal-500", "text-teal-600",
                    "text-cyan-500", "text-cyan-600", "text-sky-500", "text-sky-600",
                    "text-blue-500", "text-blue-600"
                  ];
                  const colorClass = letterColors[idx % letterColors.length];
                  if (char === " ") return <span key={idx} className="w-1" />;
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
          {/* Admin Workspace Round Controller - REMOVED for Executive Dashboard */}
          {/* 
{(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
  <div className="mb-6 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs animate-fade-in">
    ...
  </div>
)}
*/}

          {currentRound === 'first' && activeTab === 'first_round_queue' && (
            <FirstRoundQueue currentUser={currentUser!} />
          )}

          {currentRound === 'first' && activeTab === 'first_round_completed' && (
            <CompletedLoans currentUser={currentUser!} view="all" />
          )}

          {currentRound === 'first' && activeTab === 'first_round_completed_today' && (
            <CompletedLoans currentUser={currentUser!} view="today" />
          )}

          {currentRound === 'first' && activeTab === 'first_round_reports' && (
            <FirstRoundReports currentUser={currentUser!} />
          )}

          {currentRound === 'first' && activeTab === 'first_round_settings' && (
            <FirstRoundSettings currentUser={currentUser!} />
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
              onRefresh={refreshCustomers}
              currentWorkspace={currentRound === 'second' ? 'second_round' : 'first_round'}
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

          {activeTab === 'blacklist' && (
            <BlacklistManager currentUser={currentUser!} />
          )}

          {activeTab === 'guarantor' && (
            <GuarantorManager currentUser={currentUser!} />
          )}

          {activeTab === 'nonborrower' && (
            <NonBorrowerRegistry currentUser={currentUser!} />
          )}

          {activeTab === 'admin' && isAdminStaff && (
            <AdminDashboard
              currentUser={currentUser!}
              logs={logs}
              customers={customers}
            />
          )}



        </main>
      </div>

      {/* Chat Overlay - MOVED HERE */}
      {activeTab === 'chat' && (
        <div className="fixed inset-0 z-[100] bg-white animate-fade-in">
          <div className="relative h-full">
            {/* Close button to go back */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className="absolute top-4 left-4 z-[101] p-2 bg-white/80 hover:bg-white rounded-full shadow-lg border border-slate-200 transition-all"
              title="Back to Dashboard"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
            <ChatRoom currentUser={currentUser!} />
          </div>
        </div>
      )}

      {/* AI Assistant - REMOVED */}
    </div>
  );
}
