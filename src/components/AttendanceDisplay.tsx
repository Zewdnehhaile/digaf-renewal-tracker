import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { dbService } from '../services/db';
import { AttendanceRecord, AttendanceSettings } from '../types';
import { 
  Clock, 
  CheckCircle2, 
  MapPin, 
  ShieldCheck, 
  Tv, 
  Info, 
  AlertTriangle,
  RefreshCw,
  Sliders,
  Calendar,
  Users
} from 'lucide-react';

function getTodayEAT(d: Date = new Date()): Date {
  const localTime = d.getTime();
  const localOffset = d.getTimezoneOffset() * 60000;
  const utc = localTime + localOffset;
  const eatOffset = 3; // East Africa Time is UTC+3
  return new Date(utc + (3600000 * eatOffset));
}

function getTodayLocalDateString(d: Date = getTodayEAT()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AttendanceDisplay() {
  const [currentTime, setCurrentTime] = useState(getTodayEAT());
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  
  // Simulation / Testing Controls
  const [simulateMode, setSimulateMode] = useState<boolean>(false);
  const [simulatedWindow, setSimulatedWindow] = useState<'Morning' | 'Afternoon'>('Morning');
  const [simulatedDay, setSimulatedDay] = useState<'Weekday' | 'Saturday'>('Weekday');

  useEffect(() => {
    // Clock tick
    const clockTimer = setInterval(() => {
      setCurrentTime(getTodayEAT());
    }, 1000);

    // Subscribe to Settings
    const unsubscribeSettings = dbService.subscribeAttendanceSettings((updatedSettings) => {
      setSettings(updatedSettings);
    });

    // Subscribe to Check-in activity to show real-time scan success list
    const unsubscribeRecords = dbService.subscribeAttendanceRecords((records) => {
      // Filter records for today (true date YYYY-MM-DD or based on simulation)
      const todayStr = getTodayLocalDateString();
      const todayRecords = records.filter(r => r.date === todayStr);
      setRecentRecords(todayRecords.slice(0, 5)); // show top 5
    });

    return () => {
      clearInterval(clockTimer);
      unsubscribeSettings();
      unsubscribeRecords();
    };
  }, []);

  // Format Helper
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Determine current active window details based on TRUE time or SIMULATION
  const getActiveWindowDetails = () => {
    const dayOfWeek = simulatedDay === 'Saturday' ? 6 : currentTime.getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    let activeWindow: 'Morning' | 'Afternoon' | 'Closed' = 'Closed';
    let label = 'Operational Closed';
    let timeRange = '';
    let description = 'No check-in session is current active.';

    if (simulateMode) {
      if (simulatedWindow === 'Morning') {
        activeWindow = 'Morning';
        const dummyMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        const isLate = dummyMinutes > (8 * 60 + 40);
        label = 'Morning Scan Portal';
        timeRange = isLate ? 'Late Comer Registration (08:41 - 12:00)' : '08:00 - 08:40 (On-Time)';
        description = isLate 
          ? 'Scanning is active. Late check-ins register you as Late.'
          : 'Please align your device to scan and check-in present.';
      } else {
        if (simulatedDay === 'Saturday') {
          activeWindow = 'Closed';
          label = 'Operational Closed';
          timeRange = 'Saturdays have no Afternoon scans';
          description = 'Saturday operational rules are in effect (Morning Only).';
        } else {
          activeWindow = 'Afternoon';
          label = 'Afternoon Scan Portal';
          timeRange = '12:00 - 14:30';
          description = 'Normal afternoon checkout & scanning hours active.';
        }
      }
    } else {
      // Calculate real time
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const morningStart = 8 * 60; // 08:00
      const morningEnd = 12 * 60;   // 12:00 (stays open for late checking)

      const afternoonStart = 12 * 60;   // 12:00
      const afternoonEnd = 14 * 60 + 30; // 14:30

      if (isSunday) {
        activeWindow = 'Closed';
        label = 'Operational Closed (Sunday)';
        timeRange = 'Closed All Day';
        description = 'Sunday is a rest day. Attendance portal is offline.';
      } else if (totalMinutes >= morningStart && totalMinutes < morningEnd) {
        activeWindow = 'Morning';
        const isLateComer = totalMinutes > (8 * 60 + 40); // After 08:40 is Late
        label = 'Morning Scan Portal';
        timeRange = isLateComer ? 'Late Comer Registration (08:41 - 12:00)' : '08:00 - 08:40 (On-Time)';
        description = isLateComer 
          ? 'Scanning is active. Late check-ins register you as Late.'
          : 'Please align your device to scan and check-in present.';
      } else if (!isSaturday && totalMinutes >= afternoonStart && totalMinutes <= afternoonEnd) {
        activeWindow = 'Afternoon';
        label = 'Afternoon Scan Portal';
        timeRange = '12:00 - 14:30';
        description = 'Please align your device to scan afternoon check-in.';
      } else if (isSaturday && totalMinutes >= afternoonStart && totalMinutes <= afternoonEnd) {
        activeWindow = 'Closed';
        label = 'Operational Closed (Saturday Afternoon)';
        timeRange = 'No Saturday Afternoon Portal';
        description = 'Saturdays terminate after the morning sessions.';
      }
    }

    return { activeWindow, label, timeRange, description, isSaturday, isSunday };
  };

  const { activeWindow, label, timeRange, description, isSaturday } = getActiveWindowDetails();

  // Generate QR string to encode as a URL link for mobile scanning to prevent "choose chrome" and search failures
  const todayStr = getTodayLocalDateString(currentTime);
  
  let resolvedOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://digaf.com';
  // If the terminal dashboard is loaded under the private developer workspace domain (ais-dev-xxxx),
  // automatically rewrite the QR string URL to target the public shared app domain (ais-pre-xxxx)
  // so other employees can scan & check-in successfully on their phone browsers.
  if (resolvedOrigin.includes('ais-dev-')) {
    resolvedOrigin = resolvedOrigin.replace('ais-dev-', 'ais-pre-');
  } else if (resolvedOrigin.includes('-dev-')) {
    resolvedOrigin = resolvedOrigin.replace('-dev-', '-pre-');
  }

  const qrString = `${resolvedOrigin}/?qrScan=true&window=${activeWindow}&date=${todayStr}&t=${currentTime.getTime()}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="attendance_display_screen">
      {/* Top Banner Branding Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-5 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25 rounded-xl">
            <Tv className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight uppercase flex items-center gap-2">
              DIGAF Renewal Tracker
              <span className="px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] text-[9px] font-black tracking-widest uppercase rounded">
                ATTENDANCE GATEWAY
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
              Permanent QR Terminal for Verified Office Check-In & Diagnostics
            </p>
          </div>
        </div>

        {/* Live GPS Coordinates of configured Office */}
        {settings && (
          <div className="hidden md:flex items-center gap-2 bg-slate-800/40 border border-slate-700/50 p-2 px-3 rounded-xl">
            <MapPin className="w-4 h-4 text-emerald-400 animate-bounce" />
            <div className="text-left leading-tight">
              <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 block">Office Coordinate</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold block mt-0.5">
                {settings.latitude.toFixed(6)}, {settings.longitude.toFixed(6)} ({settings.radius}m)
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Core Viewport - Split Style */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column (8 cols): QR Core display */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {formatDate(currentTime)}
              </span>
              <span className="text-2xl sm:text-3.5xl font-mono font-black text-white tracking-widest block mt-1.5 flex items-center gap-2 justify-center sm:justify-start">
                <Clock className="w-6 h-6 text-[#8B5CF6]" />
                {simulateMode ? `${formatTime(currentTime)} (Simulated)` : formatTime(currentTime)}
              </span>
            </div>

            <div className={`px-4 py-1.5 rounded-2xl flex items-center gap-2 border text-xs font-black uppercase tracking-wider ${
              activeWindow !== 'Closed'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${activeWindow !== 'Closed' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {activeWindow !== 'Closed' ? 'Scanning Active' : 'Scanning Offline'}
            </div>
          </div>

          {/* Core QR code container */}
          <div className="my-6 py-6 sm:py-10 flex flex-col items-center justify-center">
            {activeWindow !== 'Closed' ? (
              <div className="space-y-6 text-center">
                
                {/* QR box frame with beautiful custom shadows */}
                <div className="bg-white p-6 rounded-3xl shadow-2xl inline-block border-4 border-[#8B5CF6]/40 relative">
                  <QRCodeSVG 
                    value={qrString} 
                    size={240} 
                    level="H" 
                    includeMargin={true}
                    fgColor="#0F172A" // Deep slate
                  />
                  {/* Decorative corners */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-violet-500 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-violet-500 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-violet-500 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-violet-500 rounded-br" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase font-sans">
                    {label}
                  </h2>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-full text-xs font-black font-mono text-[#C4B5FD]">
                    <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    TIME WINDOW: {timeRange}
                  </div>
                  <p className="text-slate-400 text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-5 py-8 max-w-md">
                <div className="inline-flex p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    NO CURRENT ATTENDANCE SCAN PORTAL OPEN
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    Attendance portals automatically initialize daily during standard intervals:
                  </p>
                  <div className="mt-3 divide-y divide-slate-800/80 bg-slate-950 p-3 rounded-xl border border-slate-800 text-left space-y-1 text-[11px] font-mono select-none">
                    <div className="flex justify-between py-1 text-slate-400">
                      <span>Morning (Mon-Sat):</span>
                      <strong className="text-[#8B5CF6]">08:00 - 08:40 (Registration open all morning)</strong>
                    </div>
                    <div className="flex justify-between py-1 pt-1.5 text-slate-400">
                      <span>Afternoon (Mon-Fri):</span>
                      <strong className="text-[#8B5CF6]">12:00 - 14:30</strong>
                    </div>
                    <div className="flex justify-between py-1 pt-1.5 text-slate-400">
                      <span>Afternoon (Saturday):</span>
                      <strong className="text-rose-400">CLOSED</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer instructions */}
          <div className="border-t border-slate-800/80 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Scanning utilizes high-precision GPS geofencing & device locks</span>
            </div>
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 px-2.5 rounded-lg text-[10px] font-bold font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping mr-1" />
              PORTAL LIVE & REGENERATING
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Real-time updates & Dev override panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Real-Time Scans Loop */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#8B5CF6]" />
                  Today's Check-ins
                </h3>
                <span className="px-1.5 py-0.2 bg-[#8B5CF6]/10 text-[#C4B5FD] text-[8.5px] font-black rounded uppercase">
                  {recentRecords.length} SCANNED
                </span>
              </div>

              {recentRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-[10.5px] font-bold space-y-1.5">
                  <Clock className="w-6 h-6 text-slate-700 mx-auto animate-pulse" />
                  <p>No scans recorded yet today.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto no-scrollbar">
                  {recentRecords.map((rec) => (
                    <div key={rec.id} className="p-2.5 bg-slate-950/80 border border-slate-800/60 rounded-xl flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-white block truncate">{rec.employeeName}</span>
                        <div className="flex items-center gap-1.5 text-[9px] text-[#A78BFA] font-bold block h-3 leading-none mt-1">
                          <span>{rec.employeeRole}</span>
                          <span className="text-slate-600">•</span>
                          <span>{rec.attendanceType}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-emerald-400 font-mono font-bold block leading-none">{rec.time}</span>
                        <span className="inline-block mt-1 text-[8px] px-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded font-black uppercase">
                          {rec.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-start gap-1.5 mt-4 text-[9px] text-slate-400 select-none">
              <Info className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <p className="leading-tight">
                Self-updating panel feeds directly from cloud streams as employees clock in.
              </p>
            </div>
          </div>

          {/* Special Admin/Developer Calibration Override (Crucial for Review outside hours) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-black text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-violet-400" />
                Time Calibration Override
              </h4>
              <button 
                onClick={() => setSimulateMode(!simulateMode)}
                className={`px-2 py-0.5 rounded text-[8.5px] font-black font-mono transition-all cursor-pointer uppercase ${
                  simulateMode 
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {simulateMode ? 'BYPASS LIVE' : 'SIMULATE'}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-sans mb-1">
              Test and record mock check-ins using different time window profiles directly.
            </p>

            {simulateMode && (
              <div className="space-y-3 animate-fade-in text-[10px]">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black tracking-wider text-slate-500">Simulate Window Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setSimulatedWindow('Morning')}
                      className={`py-1.5 font-bold rounded-lg cursor-pointer transition-all border ${
                        simulatedWindow === 'Morning'
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-450'
                      }`}
                    >
                      Morning (08:00-08:40)
                    </button>
                    <button
                      onClick={() => setSimulatedWindow('Afternoon')}
                      className={`py-1.5 font-bold rounded-lg cursor-pointer transition-all border ${
                        simulatedWindow === 'Afternoon'
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-450'
                      }`}
                    >
                      Afternoon (12:00-14:30)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black tracking-wider text-slate-500">Day Rule Profile</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setSimulatedDay('Weekday')}
                      className={`py-1.5 font-bold rounded-lg cursor-pointer transition-all border ${
                        simulatedDay === 'Weekday'
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-450'
                      }`}
                    >
                      Weekday (Mon-Fri)
                    </button>
                    <button
                      onClick={() => setSimulatedDay('Saturday')}
                      className={`py-1.5 font-bold rounded-lg cursor-pointer transition-all border ${
                        simulatedDay === 'Saturday'
                          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-450'
                      }`}
                    >
                      Saturday (No PM Scan)
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px] rounded-lg leading-snug flex gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Simulated seeds are recognized by client devices scanning in simulation mode.
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
