import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Search, MapPin, Sparkles, ShieldCheck, Download, Calendar, RefreshCw, X } from 'lucide-react';
import { AttendanceRecord, User, AttendanceStatus } from '../types';
import { dbService } from '../services/db';
import { soundService } from '../services/sound';

interface AttendanceExceptionsProps {
  currentUser: User;
  currentWorkspace: 'first_round' | 'second_round';
}

export default function AttendanceExceptionsView({ currentUser, currentWorkspace }: AttendanceExceptionsProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [systemExceptions, setSystemExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState<'swipes' | 'system'>('swipes');
  const [selectedExceptionRecord, setSelectedExceptionRecord] = useState<AttendanceRecord | null>(null);
  
  // Custom Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Subscribe to raw attendance exceptions (where geofence isInside is false, status is Late / Device pending)
  useEffect(() => {
    setLoading(true);
    const unsub = dbService.subscribeAttendanceRecords((allRecords) => {
      const exceptionsOnly = allRecords.filter(r => {
        const isOutsideGeofence = r.gpsCoordinates?.isInside === false;
        const isLateStatus = r.status.toLowerCase().includes('late');
        const isPendingDevice = r.status === 'New Device Pending Approval';
        return isOutsideGeofence || isLateStatus || isPendingDevice;
      });
      setRecords(exceptionsOnly);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to raw exceptions logs (ACCOUNT SHARING, clock spoofing, etc.)
  useEffect(() => {
    const unsub = dbService.subscribeExceptions((exceptions) => {
      setSystemExceptions(exceptions);
    });
    return () => unsub();
  }, []);

  // Filter based on active query search and the current workspace of the parent toggle
  const filteredExceptions = useMemo(() => {
    return records.filter(r => {
      const textMatch = 
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phoneNumber.includes(searchQuery) ||
        (r.employeeRole || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.status || '').toLowerCase().includes(searchQuery.toLowerCase());
      return textMatch;
    });
  }, [records, searchQuery]);

  const filteredSystemExceptions = useMemo(() => {
    return systemExceptions.filter(e => {
      const textMatch = 
        e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.employeePhone.includes(searchQuery) ||
        (e.employeeRole || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.exceptionType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.actionTaken || '').toLowerCase().includes(searchQuery.toLowerCase());
      return textMatch;
    });
  }, [systemExceptions, searchQuery]);

  // Handle live supervisor override / approval
  const handleApproveException = async (record: AttendanceRecord, targetStatus: AttendanceStatus) => {
    try {
      const updated: AttendanceRecord = {
        ...record,
        status: targetStatus,
        gpsCoordinates: {
          ...record.gpsCoordinates,
          isInside: true, // Manual administrative override / calibration approved
          distanceText: '0m (Approved Override)'
        }
      };
      
      await dbService.saveAttendanceRecord(updated);
      soundService.playSuccessChime();
      showToast(`Geofence exception for ${record.employeeName} has been approved by ${currentUser.fullName}.`);
      setSelectedExceptionRecord(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to update exception status.', 'error');
    }
  };

  // Export exception reports to CSV
  const handleExportCSV = () => {
    if (filteredExceptions.length === 0) {
      showToast('No exceptions found to export.', 'warning');
      return;
    }

    const headers = ['Date', 'Time', 'Employee Name', 'Phone Number', 'Role', 'Status', 'Distance Out', 'Latitude', 'Longitude', 'Device ID'];
    const rows = filteredExceptions.map(r => [
      r.date,
      r.time,
      r.employeeName,
      r.phoneNumber,
      r.employeeRole || 'N/A',
      r.status,
      r.gpsCoordinates?.distanceText || 'N/A',
      r.gpsCoordinates?.latitude || 'N/A',
      r.gpsCoordinates?.longitude || 'N/A',
      (r.deviceInformation || '').split('|||')[0] || 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_exceptions_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Successfully exported exceptions audit logs!');
  };

  return (
    <div className="space-y-6" id="attendance_exceptions_view">
      {/* Toast Notification HUD banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce flex items-center gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 text-xs font-semibold">
          {toast.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
          {toast.type === 'error' && <div className="w-2 h-2 rounded-full bg-rose-400" />}
          {toast.type === 'warning' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-50 text-gray-400 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. HEADER CONTROL BOX */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[#0B1330] font-sans flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
            Attendance Exceptions Center
          </h2>
          <p className="text-2xs text-slate-400 mt-0.5">Automated deep-inspection of geofence breaches, lateness, and untrusted device anomalies.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all border border-slate-150-100 shadow-3xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Exceptions (.CSV)
          </button>
        </div>
      </div>

      {/* 2. LIVE EXCEPTION COUNTERS Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="leading-tight">
            <span className="text-[20px] font-black text-rose-700 block">
              {filteredExceptions.filter(r => r.gpsCoordinates?.isInside === false).length}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mt-0.5">Geofence Breaches</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-250 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <div className="leading-tight">
            <span className="text-[20px] font-black text-amber-700 block">
              {filteredExceptions.filter(r => r.status.toLowerCase().includes('late')).length}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mt-0.5">Lateness Logs</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-3xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="leading-tight">
            <span className="text-[20px] font-black text-indigo-700 block">
              {filteredExceptions.filter(r => r.status === 'New Device Pending Approval').length}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mt-0.5">Device Approvals</span>
          </div>
        </div>
      </div>

      {/* 3. SEARCH BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-3xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search exceptions list by operator name, phone identifier, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-150 rounded-xl text-xs font-semibold focus:outline-hidden"
          />
        </div>
      </div>

      {/* 2.5 DUAL TOGGLE NAVIGATOR */}
      <div className="flex border-b border-slate-100 gap-6 text-xs font-bold px-1 mt-2">
        <button
          onClick={() => setSubTab('swipes')}
          className={`pb-2.5 px-1 border-b-2 transition-all cursor-pointer ${
            subTab === 'swipes' ? 'border-rose-600 text-rose-700 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Geofence & Late Swipes ({filteredExceptions.length})
        </button>
        <button
          onClick={() => setSubTab('system')}
          className={`pb-2.5 px-1 border-b-2 transition-all cursor-pointer ${
            subTab === 'system' ? 'border-rose-600 text-rose-700 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          System & Fraud Alerts ({filteredSystemExceptions.length})
        </button>
      </div>

      {/* 4. MAIN EXCEPTIONS LOGS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-3xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 min-h-[300px]">
            <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
            Analyzing telemetry exceptions log index...
          </div>
        ) : subTab === 'swipes' ? (
          filteredExceptions.length === 0 ? (
            <div className="p-20 text-center text-slate-450 border border-dashed border-slate-150 rounded-3xl m-4">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Perfect Compliance Score</h4>
              <p className="text-[10px] text-slate-400 mt-1">No active geofence exceptions or device mismatches flagged in the system logs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] leading-relaxed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-extrabold uppercase tracking-widest text-[8.5px]">
                    <th className="p-4">Operator</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Exception Diagnostic</th>
                    <th className="p-4">Geofence Distance</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExceptions.map(r => {
                    const isOutside = r.gpsCoordinates?.isInside === false;
                    return (
                      <tr key={r.id} className="hover:bg-rose-50/25 transition-colors">
                        <td className="p-4">
                          <strong className="text-slate-850 block font-black">{r.employeeName}</strong>
                          <span className="text-[8.5px] uppercase tracking-wide text-slate-400 font-bold block mt-0.5">{r.employeeRole || 'Officer'}</span>
                          <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5">{r.phoneNumber}</span>
                        </td>

                        <td className="p-4">
                          <span className="font-semibold text-slate-800 block">{r.date}</span>
                          <span className="font-mono text-slate-400 block mt-0.5 text-[9.5px] font-bold">{r.time}</span>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {isOutside && (
                              <span className="px-1.5 py-0.2 rounded font-black uppercase text-[8px] bg-rose-50 text-rose-800 border border-rose-150">
                                Geofence Breach
                              </span>
                            )}
                            {!isOutside && r.status.toLowerCase().includes('late') && (
                              <span className="px-1.5 py-0.2 rounded font-black uppercase text-[8px] bg-amber-50 text-amber-800 border border-amber-150">
                                Lateness Alert
                              </span>
                            )}
                            {r.status === 'New Device Pending Approval' && (
                              <span className="px-1.5 py-0.2 rounded font-black uppercase text-[8px] bg-indigo-50 text-indigo-800 border border-indigo-150">
                                Unauthorized PC
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          {isOutside ? (
                            <span className="font-mono font-black text-rose-600 block">
                              {r.gpsCoordinates?.distanceText || 'N/A'} Outside
                            </span>
                          ) : (
                            <span className="font-mono text-emerald-600 font-bold block">
                              Compliant ({r.gpsCoordinates?.distanceText || '0m'})
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right space-x-1 whitespace-nowrap align-middle">
                          <button
                            onClick={() => setSelectedExceptionRecord(r)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-extrabold rounded-lg uppercase transition-all shadow-3xs cursor-pointer border border-slate-150"
                          >
                            Telemetry Card
                          </button>
                          <button
                            onClick={() => handleApproveException(r, 'Present')}
                            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-3xs font-extrabold rounded-lg uppercase tracking-tight transition-all shadow-3xs cursor-pointer"
                          >
                            Approve Override
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredSystemExceptions.length === 0 ? (
            <div className="p-20 text-center text-slate-450 border border-dashed border-slate-150 rounded-3xl m-4">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Perfect Security Logs</h4>
              <p className="text-[10px] text-slate-400 mt-1">No account-sharing, clock manipulation or hardware security threats generated inside deep registry.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] leading-relaxed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-extrabold uppercase tracking-widest text-[8.5px]">
                    <th className="p-4">Employee Details</th>
                    <th className="p-4">Date & Stamp</th>
                    <th className="p-4">System Exception Type</th>
                    <th className="p-4">Hardware Signature / Location</th>
                    <th className="p-4">Action Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSystemExceptions.map(e => {
                    const isSharingSuspected = e.exceptionType === 'ACCOUNT SHARING SUSPECTED';
                    return (
                      <tr key={e.id} className={`hover:bg-slate-50/50 transition-colors ${isSharingSuspected ? 'bg-rose-500/5' : ''}`}>
                        <td className="p-4">
                          <strong className="text-slate-850 block font-black">{e.employeeName}</strong>
                          <span className="text-[8.5px] uppercase tracking-wide text-slate-400 font-bold block mt-0.5">{e.employeeRole || 'Officer'}</span>
                          <span className="text-[9.5px] font-mono text-slate-400 block mt-0.5">{e.employeePhone}</span>
                        </td>

                        <td className="p-4 font-mono font-bold text-slate-700">
                          <div>{e.date}</div>
                          <div className="text-[9px] text-slate-400 font-normal mt-0.5">{new Date(e.timestamp).toLocaleTimeString()}</div>
                        </td>

                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border ${
                            isSharingSuspected 
                              ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {e.exceptionType}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-[10px] truncate max-w-xs" title={e.device}>
                            {e.device}
                          </div>
                          <div className="text-slate-400 text-[9px] font-mono mt-0.5 truncate max-w-xs" title={e.location}>
                            {e.location}
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="text-slate-650 font-medium text-[10px] text-slate-600 block">
                            {e.actionTaken}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* 5. DYNAMIC DIALOG COMPONENT */}
      {selectedExceptionRecord && (() => {
        const parts = (selectedExceptionRecord.deviceInformation || '').split('|||');
        const signature = parts[0] || 'Unknown Fingerprint';
        const ua = parts[1] || (typeof window !== 'undefined' ? window.navigator.userAgent : '');
        
        let os = 'Unknown OS';
        if (ua.includes('Windows')) os = 'Windows PC';
        else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
        else if (ua.includes('Android')) os = 'Android Phone';
        else if (ua.includes('Linux')) os = 'Linux OS';

        let browser = 'Unknown Browser';
        if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
        else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
        else if (ua.includes('Edg')) browser = 'Microsoft Edge';
        
        const lat = selectedExceptionRecord.gpsCoordinates?.latitude;
        const lon = selectedExceptionRecord.gpsCoordinates?.longitude;
        const mapsUrl = lat && lon ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : null;

        return (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 font-sans">
                  <ShieldCheck className="w-5 h-5 text-[#8B5CF6] animate-pulse" />
                  Exception Telemetry Card
                </h3>
                <button
                  onClick={() => setSelectedExceptionRecord(null)}
                  className="text-slate-400 hover:text-slate-600 font-extrabold cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center font-black text-rose-700 font-sans">
                    {selectedExceptionRecord.employeeName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <strong className="text-xs font-black text-slate-900 block">{selectedExceptionRecord.employeeName}</strong>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">{selectedExceptionRecord.employeeRole}</span>
                    <span className="text-[9.5px] text-slate-400 font-mono block mt-0.5">{selectedExceptionRecord.phoneNumber}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Core Diagnostic Telemetry</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-705 bg-slate-50/50 p-2.5 rounded-xl border border-slate-101">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Clock In Type</span>
                      <span className="text-slate-900 font-bold">{selectedExceptionRecord.attendanceType}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Geofence Compliance</span>
                      <span className={`inline-block text-[8px] px-1.5 py-0.2 rounded font-black uppercase ${
                        selectedExceptionRecord.gpsCoordinates?.isInside !== false
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                          : 'bg-rose-50 text-rose-800 border border-rose-150'
                      }`}>
                        {selectedExceptionRecord.gpsCoordinates?.isInside !== false ? 'COMPLIANT' : 'OUTSIDE'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Lobby GPS coordinates</span>
                      <span className="font-mono text-slate-900 block font-bold leading-none mt-0.5">
                        {lat ? `${lat.toFixed(5)}, ${lon?.toFixed(5)}` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Meters Out of Bounds</span>
                      <span className="font-mono font-black text-rose-700 block text-xs">
                        {selectedExceptionRecord.gpsCoordinates?.distanceText || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Captured Timestamp</span>
                      <span className="font-mono text-indigo-900 block font-extrabold leading-none mt-0.5">
                        {selectedExceptionRecord.date} at {selectedExceptionRecord.time} (EAT)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Lockbox Hardware signature</span>
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-[11px] font-medium text-slate-700 space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Operating System</span>
                        <span className="text-slate-900 font-black">{os}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Browser Client</span>
                        <span className="text-slate-900 font-black">{browser}</span>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-0.5">Device Fingerprint Hash</span>
                      <span className="font-mono text-indigo-700 font-black px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded-md block text-[10px] mt-0.5 select-all">
                        {signature}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => setSelectedExceptionRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close Card
                </button>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open Google Maps ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
