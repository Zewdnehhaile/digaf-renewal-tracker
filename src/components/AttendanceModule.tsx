import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, AttendanceSettings, LeaveRequest, AttendanceStatus, ActivityLog, OfficerAIPermission, AttendanceCorrectionRequest, Customer, WorkAssignment } from '../types';
import { dbService } from '../services/db';
import { soundService } from '../services/sound';
import AttendanceExceptionsView from './AttendanceExceptionsView';
import { verifyClockSynchronization, logSecurityAnomaly } from '../utils/security';
import { 
  Clock, 
  MapPin, 
  Calendar, 
  FileText, 
  Users, 
  Settings, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Send, 
  Sliders, 
  Smartphone, 
  ShieldAlert, 
  RefreshCw,
  TrendingUp,
  MapPinOff,
  UserCheck,
  Plus,
  Trash2,
  Monitor,
  Sun,
  Moon,
  ShieldCheck,
  Camera,
  Unlock,
  KeyRound
} from 'lucide-react';

// Haversine distance helper calculating space delta in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

interface ParsedUA {
  deviceType: string;
  browserName: string;
  osName: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  ip: string;
  location: string;
}

function parseUserAgent(ua: string): { deviceType: string; browserName: string; osName: string } {
  let deviceType = 'Desktop';
  if (/mobi|android|iphone|ipad|touch/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  let browserName = 'Unknown Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opera/i.test(ua)) browserName = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browserName = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox';
  else if (/edge|edg/i.test(ua)) browserName = 'Edge';
  else if (/opr|opera/i.test(ua)) browserName = 'Opera';

  let osName = 'Unknown OS';
  if (/windows/i.test(ua)) osName = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) osName = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) osName = 'Linux';
  else if (/android/i.test(ua)) osName = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS';

  return { deviceType, browserName, osName };
}

async function fetchPublicIPAndLocation(): Promise<{ ip: string; location: string }> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      return {
        ip: data.ip || '197.156.124.8',
        location: data.city && data.country_name ? `${data.city}, ${data.country_name}` : 'Addis Ababa, Ethiopia'
      };
    }
  } catch (e) {
    // fallback
  }
  return { ip: '197.156.124.8', location: 'Addis Ababa, Ethiopia' };
}

function getParsedDeviceInfo(emp: any): ParsedUA {
  try {
    if (emp && emp.deviceInfo) {
      const parsed = JSON.parse(emp.deviceInfo);
      return {
        deviceType: parsed.deviceType || 'Desktop',
        browserName: parsed.browser || 'Chrome',
        osName: parsed.os || 'Windows/macOS',
        name: parsed.name || `${parsed.os || 'Windows'} - ${parsed.browser || 'Chrome'}`,
        firstSeen: parsed.firstSeen || emp.deviceRegistrationDate || 'N/A',
        lastSeen: parsed.lastSeen || emp.deviceRegistrationDate || 'N/A',
        ip: parsed.ip || '197.156.124.8',
        location: parsed.location || 'Addis Ababa, Ethiopia'
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    deviceType: 'Desktop',
    browserName: 'Chrome',
    osName: 'Windows/macOS',
    name: 'Browser Window Client',
    firstSeen: (emp && emp.deviceRegistrationDate) || 'N/A',
    lastSeen: (emp && emp.deviceRegistrationDate) || 'N/A',
    ip: '197.156.124.8',
    location: 'Addis Ababa, Ethiopia'
  };
}

const isExcludedUser = (fullName: string, phoneNumber: string) => {
  const lowerName = fullName.toLowerCase();
  const phoneClean = phoneNumber.replace(/^0+/, '');
  const excludedPhones = new Set([
    '0927209931', '0954846480', '0955245591', '0985326831',
    '918004358', '0918004358', '931443655', '0931443655',
    '948811166', '0948811166', '969875646', '0969875646',
    '927209931', '954846480', '955245591', '985326831',
    '918004358', '931443655', '948811166', '969875646'
  ]);
  const excludedNames = [
    'kidusyared', 'liku', 'raji', 'natnael', 'sintayehu', 
    'yohannes', 'mengistu', 'sime', 'suraf', 'amanuel', 'yeshineh', 'sami'
  ];
  
  if (excludedPhones.has(phoneNumber)) return true;
  if (excludedPhones.has(phoneClean)) return true;
  if (excludedNames.some(name => lowerName.includes(name))) return true;
  return false;
};

export interface EATInfo {
  dateStr: string; // "YYYY-MM-DD" in Africa/Nairobi
  timeStr: string; // "HH:MM:SS" absolute EAT format
  hours: number;
  minutes: number;
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  second?: number;
}

export function getEATInfo(d: Date = new Date()): EATInfo {
  // Kenya/East Africa Time is ALWAYS absolute UTC + 3 hours, all year round (no DST)
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatTime = new Date(d.getTime() + eatOffsetMs);

  const year = eatTime.getUTCFullYear();
  const month = String(eatTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eatTime.getUTCDate()).padStart(2, '0');

  const hours = eatTime.getUTCHours();
  const minutes = eatTime.getUTCMinutes();
  const second = eatTime.getUTCSeconds();

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  const dayOfWeek = eatTime.getUTCDay(); // 0 (Sunday) to 6 (Saturday)

  return {
    dateStr,
    timeStr,
    hours,
    minutes,
    dayOfWeek,
    second
  };
}

function getEATDate(d: Date = new Date()): Date {
  const info = getEATInfo(d);
  const fakeDate = new Date();
  fakeDate.setFullYear(parseInt(info.dateStr.split('-')[0], 10));
  fakeDate.setMonth(parseInt(info.dateStr.split('-')[1], 10) - 1);
  fakeDate.setDate(parseInt(info.dateStr.split('-')[2], 10));
  fakeDate.setHours(info.hours);
  fakeDate.setMinutes(info.minutes);
  fakeDate.setSeconds(info.second ?? 0);
  fakeDate.setMilliseconds(0);
  return fakeDate;
}

function getLocalTodayStr(): string {
  return getEATInfo().dateStr;
}

function getDeviceSignature(): string {
  if (typeof window === 'undefined') return 'DEV-SIG-SERVER';
  const width = window.screen?.width || 0;
  const height = window.screen?.height || 0;
  const ua = window.navigator?.userAgent || 'unknown-ua';
  const language = window.navigator?.language || 'en';
  const rawString = `${ua}|${width}x${height}|${language}`;
  let hash = 0;
  for (let i = 0; i < rawString.length; i++) {
    const char = rawString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `DEV-SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
}

interface AttendanceModuleProps {
  currentUser: User;
}

export default function AttendanceModule({ currentUser }: AttendanceModuleProps) {
  // Check access level
  const isZewdneh = currentUser.isSuperAdmin === true || currentUser.role === 'super_admin';
  const isAman = currentUser.role === 'admin';
  const isAdminOrSuper = isZewdneh || isAman;

  const tabs = [
    { id: 'checkin', label: 'Check-In', roles: ['all'] },
    { id: 'my_record', label: 'My Attendance', roles: ['all'] },
    { id: 'leave_requests', label: 'Leave Requests', roles: ['all'] },
    { id: 'corrections', label: 'Corrections', roles: ['all'] },
    { id: 'profile', label: 'My Profile', roles: ['all'] },
    { id: 'dashboard', label: 'Dashboard', roles: ['admin'] },
    { id: 'exceptions', label: 'Exception Center', roles: ['admin'] },
    { id: 'settings', label: 'Office Controls', roles: ['admin'] }
  ];

  // Tab routing
  const filteredTabs = tabs.filter(t => t.roles.includes('all') || (t.roles.includes('admin') && isAdminOrSuper));
  const [activeTab, setActiveTab] = useState<string>('checkin');

  // Profile password edit states
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Database streams
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<AttendanceCorrectionRequest[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [officerPermissions, setOfficerPermissions] = useState<OfficerAIPermission[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workAssignments, setWorkAssignments] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // My Corrections form
  const [correctionDate, setCorrectionDate] = useState<string>(getLocalTodayStr());
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionSuccess, setCorrectionSuccess] = useState<string>('');
  const [correctionError, setCorrectionError] = useState<string>('');

  // My Leave Request form
  const [leaveType, setLeaveType] = useState<'Permission' | 'Emergency Leave' | 'Field Work'>('Permission');
  const [leaveDate, setLeaveDate] = useState<string>(getLocalTodayStr());
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [fieldDestination, setFieldDestination] = useState<string>('');
  const [fieldReturnTime, setFieldReturnTime] = useState<string>('');
  const [leaveActionSuccess, setLeaveActionSuccess] = useState<string>('');
  const [leaveActionError, setLeaveActionError] = useState<string>('');

  // Scanning / Checking-in State
  const [scanning, setScanning] = useState<boolean>(false);
  const isCurrentlyScanningRef = useRef<boolean>(false);
  const [cameraScanActive, setCameraScanActive] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [scanResultText, setScanResultText] = useState<{
    status: 'success' | 'warning' | 'error' | 'already_present',
    message: string,
    userLat?: number,
    userLon?: number,
    targetLat?: number,
    targetLon?: number,
    distanceMeters?: number,
    targetRadius?: number
  } | null>(null);

  // QR Scan Overlay states
  const [isScannedCheckIn, setIsScannedCheckIn] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(30);
  
  // Geolocation bypass for preview/testing environment (highly friendly for cloud preview testing)
  const [useMockLocation, setUseMockLocation] = useState<boolean>(isAdminOrSuper);
  const [mockGPSDistance, setMockGPSDistance] = useState<'inside' | 'outside'>('inside');
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');

  // General feedback status banner
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [liveTime, setLiveTime] = useState<Date>(new Date());
  const [eatLive, setEatLive] = useState<EATInfo>(getEATInfo());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
      setEatLive(getEATInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizedTodayStr = getLocalTodayStr();
  const hasMorningCheckIn = records.some(
    r => r.phoneNumber === currentUser.phoneNumber && r.date === normalizedTodayStr && r.attendanceType === 'Morning'
  );
  const hasAfternoonCheckIn = records.some(
    r => r.phoneNumber === currentUser.phoneNumber && r.date === normalizedTodayStr && r.attendanceType === 'Afternoon'
  );

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 5000);
  };

  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Credentials override recovery states
  const [recoveryUserPhone, setRecoveryUserPhone] = useState<string>('');
  const [recoverySearchText, setRecoverySearchText] = useState<string>('');
  const [showRecoveryDropdown, setShowRecoveryDropdown] = useState<boolean>(false);
  const [recoveryPassword, setRecoveryPassword] = useState<string>('');
  const [recoveryForceChange, setRecoveryForceChange] = useState<boolean>(true);
  const [recoveryClearDevice, setRecoveryClearDevice] = useState<boolean>(false);
  const [recoveryClearFace, setRecoveryClearFace] = useState<boolean>(false);
  const [recoveryReason, setRecoveryReason] = useState<string>('');
  const [recoveryLoading, setRecoveryLoading] = useState<boolean>(false);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [selectedRecordForTelemetry, setSelectedRecordForTelemetry] = useState<AttendanceRecord | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Selfie Verification states
  const [showSelfieModal, setShowSelfieModal] = useState<boolean>(false);
  const [selfieSessionType, setSelfieSessionType] = useState<'Morning' | 'Afternoon' | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [selfieLoading, setSelfieLoading] = useState<boolean>(false);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (showSelfieModal) {
      setSelfieError(null);
      setCapturedImageBase64(null);
      
      const timer = setTimeout(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: 400, 
              height: 300, 
              facingMode: 'user' 
            } 
          })
          .then(stream => {
            if (selfieVideoRef.current) {
              selfieVideoRef.current.srcObject = stream;
              selfieVideoRef.current.play().catch(err => {
                console.error("Video play failed:", err);
              });
            }
          })
          .catch(err => {
            console.error("Camera access failed:", err);
            const errMsg = "Camera permission is required for attendance verification.";
            setSelfieError(errMsg);
            
            dbService.logException({
              date: getLocalTodayStr(),
              employeeName: currentUser.fullName,
              employeePhone: currentUser.phoneNumber,
              employeeRole: currentUser.customRole || currentUser.role,
              device: getDeviceSignature(),
              location: "Webcam Access Attempt",
              exceptionType: 'Camera Permission Denied',
              actionTaken: 'Blocked: Attendance selfie permission denied',
              timestamp: new Date().toISOString()
            });
          });
        } else {
          setSelfieError("Your device browser does not support media capture APIs.");
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (selfieVideoRef.current && selfieVideoRef.current.srcObject) {
          const stream = selfieVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [showSelfieModal]);

  // Biometric Facial Registration States
  const [showFaceRegModal, setShowFaceRegModal] = useState<boolean>(false);
  const [faceRegError, setFaceRegError] = useState<string | null>(null);
  const [faceRegSuccess, setFaceRegSuccess] = useState<string | null>(null);
  const [faceRegLoading, setFaceRegLoading] = useState<boolean>(false);
  const [capturedRegBase64, setCapturedRegBase64] = useState<string | null>(null);
  const faceRegVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (showFaceRegModal) {
      setFaceRegError(null);
      setFaceRegSuccess(null);
      setCapturedRegBase64(null);
      
      const timer = setTimeout(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 }
            } 
          })
          .then(stream => {
            if (faceRegVideoRef.current) {
              faceRegVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => {
            console.error("Camera access failed:", err);
            setFaceRegError("Could not connect to workstation camera. Please verify device permissions.");
          });
        } else {
          setFaceRegError("Media capture API is not supported on this workstation browser.");
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (faceRegVideoRef.current && faceRegVideoRef.current.srcObject) {
          const stream = faceRegVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [showFaceRegModal]);

  // Manual record generation states
  const [showAddManualForm, setShowAddManualForm] = useState<boolean>(false);
  const [manualEmployeePhone, setManualEmployeePhone] = useState<string>('');
  const [manualSearchText, setManualSearchText] = useState<string>('');
  const [showManualDropdown, setShowManualDropdown] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(getLocalTodayStr());
  const [manualWindow, setManualWindow] = useState<'Morning' | 'Afternoon'>('Morning');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Present');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  const handleManualRecordSubmit = async () => {
    if (!manualEmployeePhone) {
      showFeedback('Please select an employee.', 'error');
      return;
    }
    const targetEmp = users.find(u => u.phoneNumber === manualEmployeePhone);
    if (!targetEmp) {
      showFeedback('Employee details not found.', 'error');
      return;
    }

    const checkInId = `att-${manualDate}-${manualWindow}-${manualEmployeePhone}`;
    const newAttRecord: AttendanceRecord = {
      id: checkInId,
      employeeName: targetEmp.fullName,
      employeeRole: targetEmp.customRole || targetEmp.role,
      phoneNumber: targetEmp.phoneNumber,
      date: manualDate,
      time: manualWindow === 'Morning' ? '08:05:00' : '12:30:00',
      attendanceType: manualWindow,
      gpsCoordinates: {
        latitude: settings?.latitude ?? 9.0115,
        longitude: settings?.longitude ?? 38.7830,
        isInside: true,
        distanceText: '0m'
      },
      deviceInformation: `Manual Override Entry by Calibrator: ${currentUser.fullName}`,
      status: manualStatus
    };

    try {
      await dbService.saveAttendanceRecord(newAttRecord);
      soundService.playSuccessChime();
      showFeedback(`Manual attendance record successfully saved as "${manualStatus}".`);
      setManualEmployeePhone('');
      setManualSearchText('');
      setShowAddManualForm(false);
    } catch (err) {
      showFeedback('Error creating manual record. Check Firestore permissions or rules.', 'error');
    }
  };

  // Load and Streams
  useEffect(() => {
    const unsubRecords = dbService.subscribeAttendanceRecords((data) => {
      setRecords(data);
    });

    const unsubRequests = dbService.subscribeLeaveRequests((data) => {
      setLeaveRequests(data);
    });

    const unsubCorrections = dbService.subscribeCorrectionRequests((data) => {
      setCorrectionRequests(data);
    });

    const unsubSettings = dbService.subscribeAttendanceSettings((data) => {
      setSettings(data);
      if (data) {
        setNewRadius(data.radius || 10);
        setManualLat(data.latitude ? String(data.latitude) : '9.0115');
        setManualLon(data.longitude ? String(data.longitude) : '38.7830');
      }
    });

    const unsubUsers = dbService.subscribeUsers((data) => {
      setUsers(data);
      setLoading(false);
    });

    const unsubPerms = dbService.subscribeOfficerPermissions((data) => {
      setOfficerPermissions(data);
    });

    const unsubLogs = dbService.subscribeLogs((data) => {
      setActivityLogs(data);
    });

    const unsubCustomers = dbService.subscribeCustomers((data) => {
      setCustomers(data);
    });

    const unsubAssignments = dbService.subscribeWorkAssignments((data) => {
      setWorkAssignments(data);
    });

    return () => {
      unsubRecords();
      unsubRequests();
      unsubCorrections();
      unsubSettings();
      unsubUsers();
      unsubPerms();
      unsubLogs();
      unsubCustomers();
      unsubAssignments();
    };
  }, []);

  const handleDismissOverlay = () => {
    setIsScannedCheckIn(false);
    try {
      const cleanUrl = '/';
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {
      console.error("Could not remove QR scan query parameters and redirect to root:", e);
    }
  };

  // Automated QR scanner check-in processor
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const isQrScan = params.get('qrScan') === 'true';

    if (isQrScan && !loading) {
      setIsScannedCheckIn(true);
      setCountdownSeconds(30);
      const qrWindowName = params.get('window') as 'Morning' | 'Afternoon' | undefined;
      
      const timer = setTimeout(() => {
        // Trigger check in with parameters from QR code (Do NOT redirect to root immediately so they can read the status!)
        handleCheckIn(qrWindowName);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Sync offline queued up records automatically
  const syncOfflineAttendanceRecords = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    
    const rawQueue = localStorage.getItem('digaf_offline_attendance_queue');
    if (!rawQueue) return;
    
    try {
      const queue: AttendanceRecord[] = JSON.parse(rawQueue);
      if (queue.length === 0) return;
      
      console.log(`Connection restored! Attempting to sync ${queue.length} offline attendance records.`);
      
      const successfulIds: string[] = [];
      
      // Obtain actual independent Addis server datetime
      let serverTimeAtSync = new Date().toISOString();
      try {
        const timeRes = await fetch('https://worldtimeapi.org/api/timezone/Africa/Addis_Ababa', { cache: 'no-store' });
        if (timeRes.ok) {
          const tData = await timeRes.json();
          if (tData && tData.utc_datetime) {
            serverTimeAtSync = new Date(tData.utc_datetime).toISOString();
          }
        }
      } catch (e) {
        console.warn("Could not fetch absolute Addis time, utilizing fallbacks", e);
      }

      for (const record of queue) {
        const clientSyncTime = new Date().toISOString();
        const recordLocalTime = record.localDeviceTime || record.time || clientSyncTime;
        
        // Calculate drifts
        const clientSyncMs = new Date(clientSyncTime).getTime();
        const serverSyncMs = new Date(serverTimeAtSync).getTime();
        const driftSeconds = Math.abs(clientSyncMs - serverSyncMs) / 1000;
        
        let finalStatus: AttendanceStatus = record.offlineCalculatedStatus as AttendanceStatus;
        if (!finalStatus || finalStatus === 'OFFLINE PENDING SYNC' || finalStatus === 'Present') {
          // Double-guard: derive exact status from original offline capture time using EAT parameters
          finalStatus = resolveApprovedStatus(record.attendanceType as 'Morning' | 'Afternoon', record.time);
        }
        let finalReviewFlag = record.managerReviewRequired || false;
        
        let uploadedSelfieUrl = record.selfieImageUrl;
        if (record.selfieImageUrl && record.selfieImageUrl.startsWith('data:image')) {
          try {
            uploadedSelfieUrl = await dbService.uploadSelfieImage(record.phoneNumber, record.selfieImageUrl, 'selfies');
          } catch (uploadErr) {
            console.error("Could not upload offline selfie image to Storage:", uploadErr);
          }
        }

        if (driftSeconds > 120) {
          finalStatus = 'OFFLINE TIME ANOMALY';
          finalReviewFlag = true;
          
          await dbService.logException({
            date: record.date,
            employeeName: record.employeeName,
            employeePhone: record.phoneNumber,
            employeeRole: record.employeeRole || 'Employee',
            device: record.deviceInformation || 'Offline Fingerprint signature',
            location: `Sync drift: ${driftSeconds.toFixed(1)}s`,
            exceptionType: 'OFFLINE TIME ANOMALY',
            actionTaken: 'Flagged: OFFLINE TIME ANOMALY - MANAGER REVIEW REQUIRED',
            timestamp: new Date().toISOString()
          });
        } else {
          // Log standard sync exception
          await dbService.logException({
            date: record.date,
            employeeName: record.employeeName,
            employeePhone: record.phoneNumber,
            employeeRole: record.employeeRole || 'Employee',
            device: record.deviceInformation || 'Offline Fingerprint signature',
            location: record.gpsCoordinates ? `Lat: ${record.gpsCoordinates.latitude}, Lon: ${record.gpsCoordinates.longitude}` : 'Unknown coordinates',
            exceptionType: 'Offline Attendance Sync',
            actionTaken: 'Synced to server successfully',
            timestamp: new Date().toISOString()
          });
        }

        const syncedRecord: AttendanceRecord = {
          ...record,
          status: finalStatus,
          selfieImageUrl: uploadedSelfieUrl,
          managerReviewRequired: finalReviewFlag,
          syncSource: 'SYNCED FROM OFFLINE',
          syncArrivalTime: clientSyncTime,
          serverTimeAtSync: serverTimeAtSync
        };
        
        await dbService.saveAttendanceRecord(syncedRecord);
        
        await dbService.logActivity(
          record.phoneNumber,
          'Renewal Processing',
          'Renewal Processing',
          `Successfully synchronized offline attendance record. Status: ${syncedRecord.status}. SYNCED FROM OFFLINE`
        );
        
        successfulIds.push(record.id);
      }
      
      const remainingQueue = queue.filter(r => !successfulIds.includes(r.id));
      if (remainingQueue.length === 0) {
        localStorage.removeItem('digaf_offline_attendance_queue');
        showFeedback("Connection restored! All offline attendance records synced successfully.");
      } else {
        localStorage.setItem('digaf_offline_attendance_queue', JSON.stringify(remainingQueue));
      }
    } catch (e) {
      console.warn("Could not sync queued offline records at this moment. Retrying later...", e);
    }
  };

  // Synchronizer online trigger & listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => {
        syncOfflineAttendanceRecords();
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Run fallback periodic synchronizer every 30 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineAttendanceRecords();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Handle countdown redirection for QR Swipers
  useEffect(() => {
    if (isScannedCheckIn && scanResultText && countdownSeconds > 0) {
      const interval = setInterval(() => {
        setCountdownSeconds(prev => {
          if (prev <= 1) {
            handleDismissOverlay();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isScannedCheckIn, scanResultText, countdownSeconds]);

  // Format Helper
  const formatTimeStr = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
  };

  const getSystemDateStr = () => {
    return getLocalTodayStr();
  };

  // EXECUTE CHECK IN
  const handleCheckIn = async (
    scanWindowOverride?: 'Morning' | 'Afternoon',
    bypassSelfie = false,
    verifiedSelfieUrl?: string,
    verifiedSelfieResult?: string
  ) => {
    // Determine target session type early
    const currentHours = getEATInfo().hours;
    const scanTypeRaw = scanWindowOverride || (currentHours < 12 ? 'Morning' : 'Afternoon');

    // Early session state check to prevent taking a selfie when attendance is not available
    if (!bypassSelfie && !isAdminOrSuper) {
      const eatCheck = getEATInfo();
      const checkHours = eatCheck.hours;
      const checkDayOfWeek = eatCheck.dayOfWeek;
      const checkIsSaturday = checkDayOfWeek === 6;
      const checkIsSunday = checkDayOfWeek === 0;

      if (checkHours < 8) {
        setScanResultText({
          status: 'error',
          message: "Attendance has not opened yet. Morning attendance starts at 08:00."
        });
        soundService.playErrorChime();
        return;
      }

      if (checkIsSunday) {
        setScanResultText({
          status: 'error',
          message: "Session not available at this time."
        });
        soundService.playErrorChime();
        return;
      }

      if (scanTypeRaw === 'Morning') {
        const isMorningValid = checkHours >= 8 && checkHours < 12;
        if (!isMorningValid) {
          setScanResultText({
            status: 'error',
            message: "Session not available at this time."
          });
          soundService.playErrorChime();
          return;
        }
      }

      if (scanTypeRaw === 'Afternoon') {
        const isAfternoonValid = checkHours >= 12 && checkHours < 24;
        if (!isAfternoonValid || checkIsSaturday) {
          setScanResultText({
            status: 'error',
            message: "Session not available at this time."
          });
          soundService.playErrorChime();
          return;
        }
      }
    }

    const isZewdnehText = currentUser && (currentUser.isSuperAdmin === true || currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.fullName?.toLowerCase().includes('zewd') || currentUser.phoneNumber?.toLowerCase().includes('zewd'));
    const isAmanText = currentUser && currentUser.role === 'admin';
    const isAdminOrSuperText = !!(isZewdnehText || isAmanText);

    const userRoleValue = (currentUser?.customRole || currentUser?.role || '').trim().toLowerCase();
    const mandatoryRolesList = [
      'digital operational officer',
      'digital loan officer',
      'credit controller',
      'contact center'
    ];
    const needsSelfieCheck = mandatoryRolesList.includes(userRoleValue) || (!isAdminOrSuperText && currentUser?.role !== 'admin');

    if (needsSelfieCheck && !verifiedSelfieUrl && !bypassSelfie) {
      setSelfieSessionType(scanTypeRaw);
      setShowSelfieModal(true);
      setSelfieError(null);
      setCapturedImageBase64(null);
      return;
    }

    if (isCurrentlyScanningRef.current) return;
    isCurrentlyScanningRef.current = true;
    try {
      setScanning(true);
      setScanResultText(null);
      setGpsLoading(true);

      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      // Retrieve and verify current absolute EAT time
      const eatInfo = getEATInfo();
      const hours = eatInfo.hours;
      const minutes = eatInfo.minutes;
      const totalMinutes = hours * 60 + minutes;
      const dayOfWeek = eatInfo.dayOfWeek;
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      // 1. BLOCK EARLY ATTENDANCE (Before 08:00)
      if (hours < 8) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'error',
          message: "Attendance has not opened yet. Morning attendance starts at 08:00."
        });
        soundService.playErrorChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      // 2. SESSION HOURS SANITY (Wrong Session Block)
      let scanType: 'Morning' | 'Afternoon' = 'Morning';
      if (scanWindowOverride) {
        scanType = scanWindowOverride;
      } else {
        if (hours < 12) {
          scanType = 'Morning';
        } else {
          scanType = 'Afternoon';
        }
      }

      // Session bounds verification
      if (isSunday) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'error',
          message: "Session not available at this time."
        });
        soundService.playErrorChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      if (scanType === 'Morning') {
        const isMorningValid = hours >= 8 && hours < 12;
        if (!isMorningValid) {
          setScanning(false);
          setGpsLoading(false);
          setScanResultText({
            status: 'error',
            message: "Session not available at this time."
          });
          soundService.playErrorChime();
          isCurrentlyScanningRef.current = false;
          return;
        }
      }

      if (scanType === 'Afternoon') {
        const isAfternoonValid = hours >= 12 && hours < 24;
        if (!isAfternoonValid || isSaturday) { // Saturdays afternoon is closed
          setScanning(false);
          setGpsLoading(false);
          setScanResultText({
            status: 'error',
            message: "Session not available at this time."
          });
          soundService.playErrorChime();
          isCurrentlyScanningRef.current = false;
          return;
        }
      }

      // Get coordinates
      let latitude = 0;
      let longitude = 0;
      let accuracy = 0;

      let testDistanceMeters = 0;
      let isInside = true;

      // Haversine parameters
      const targetLat = settings?.latitude ?? 9.0115;
      const targetLon = settings?.longitude ?? 38.7830;
      const targetRadius = settings?.radius ?? 10;

      if (useMockLocation) {
        // Simulate GPS Location
        setGpsLoading(false);
        if (mockGPSDistance === 'inside') {
          latitude = targetLat;
          longitude = targetLon;
          testDistanceMeters = 1.2; // deep inside
          isInside = true;
          accuracy = 3.5;
        } else {
          latitude = targetLat + 0.0003; // ~33 meters away
          longitude = targetLon + 0.0003;
          testDistanceMeters = 45;
          isInside = false;
          accuracy = 5.0;
        }
      } else {
        // Standard HTML5 Geolocation API
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 0
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy;
          setGpsLoading(false);

          // 3. GPS ACCURACY LIMIT (accuracy > 150m gets rejected)
          if (accuracy > 150) {
            setScanning(false);
            setScanResultText({
              status: 'error',
              message: 'GPS accuracy too low (exceeds 150m). Please move closer to a window or retry.'
            });
            soundService.playErrorChime();

            // Log accuracy failure
            await dbService.logException({
              date: getLocalTodayStr(),
              employeeName: currentUser.fullName,
              employeePhone: currentUser.phoneNumber,
              employeeRole: currentUser.customRole || currentUser.role,
              device: getDeviceSignature(),
              location: `Device Reports Accuracy: ${accuracy.toFixed(1)}m`,
              exceptionType: 'GPS Accuracy Failure',
              actionTaken: 'Blocked: Accuracy exceeds 150 meters',
              timestamp: new Date().toISOString()
            });

            isCurrentlyScanningRef.current = false;
            return;
          }

          // Compute distance
          testDistanceMeters = getHaversineDistance(latitude, longitude, targetLat, targetLon);
          isInside = testDistanceMeters <= targetRadius;
        } catch (err: any) {
          setGpsLoading(false);
          setScanning(false);
          setScanResultText({
            status: 'error',
            message: isAdminOrSuper
              ? 'GPS location error. Please grant location permissions in your browser or select Geolocation Bypass for easy sandboxed evaluation.'
              : 'GPS location error. Please ensure location services are enabled on your computer or browser, grant location access to this site, and try again.'
          });
          soundService.playSuccessChime(); // micro alert
          isCurrentlyScanningRef.current = false;
          return;
        }
      }

      // 4. DEVICE APPROVAL CHECK (Blocked if not approved)
      const currentSig = getDeviceSignature();
      let isDeviceValidAndApproved = false;

      if (!isCurrentlyOnline) {
        // Retrieve offline approval cache from localStorage
        const localApproval = localStorage.getItem(`digaf_device_approved_${currentUser.phoneNumber}`);
        if (localApproval === 'false') {
          setScanning(false);
          setGpsLoading(false);
          setScanResultText({
            status: 'error',
            message: "ACCOUNT SHARING BLOCKED: Unapproved workspace device fingerprint signature."
          });
          soundService.playErrorChime();
          isCurrentlyScanningRef.current = false;
          return;
        }
        isDeviceValidAndApproved = true; // allow attempt for sync validation
      } else {
        try {
          const freshUserAndDevice = await dbService.getUser(currentUser.phoneNumber);
          if (freshUserAndDevice) {
            const approvedSigs = freshUserAndDevice.deviceSignature
              ? freshUserAndDevice.deviceSignature.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];

            if (approvedSigs.length === 0) {
              // Record device and save pending state
              const regDate = getLocalTodayStr();
              const { ip, location } = await fetchPublicIPAndLocation();
              const parsed = parseUserAgent(window.navigator.userAgent);
              const infoObj = {
                deviceType: parsed.deviceType,
                browser: parsed.browserName,
                os: parsed.osName,
                name: `${parsed.osName} - ${parsed.browserName}`,
                firstSeen: regDate,
                lastSeen: regDate,
                ip,
                location
              };

              await dbService.updateUser(currentUser.phoneNumber, {
                deviceSignature: currentSig,
                deviceRegistrationDate: regDate,
                deviceApproved: false,
                deviceInfo: JSON.stringify(infoObj)
              });

              localStorage.setItem(`digaf_device_approved_${currentUser.phoneNumber}`, 'false');
              isDeviceValidAndApproved = false;

              // Log New Device exception as ACCOUNT SHARING BLOCKED
              await dbService.logException({
                date: regDate,
                employeeName: currentUser.fullName,
                employeePhone: currentUser.phoneNumber,
                employeeRole: currentUser.customRole || currentUser.role,
                device: `${parsed.deviceType} - ${parsed.osName} (${parsed.browserName}) - Sig: ${currentSig}`,
                location: `Lat: ${latitude}, Lon: ${longitude}`,
                exceptionType: 'ACCOUNT SHARING BLOCKED' as any,
                actionTaken: 'Blocked: New/Unapproved device binding attempt',
                timestamp: new Date().toISOString()
              });

            } else if (!approvedSigs.includes(currentSig)) {
              // Add/overwrite signature and block
              const regDate = getLocalTodayStr();
              const { ip, location } = await fetchPublicIPAndLocation();
              const parsed = parseUserAgent(window.navigator.userAgent);
              const infoObj = {
                deviceType: parsed.deviceType,
                browser: parsed.browserName,
                os: parsed.osName,
                name: `${parsed.osName} - ${parsed.browserName}`,
                firstSeen: regDate,
                lastSeen: regDate,
                ip,
                location
              };

              await dbService.updateUser(currentUser.phoneNumber, {
                deviceSignature: currentSig,
                deviceApproved: false,
                deviceInfo: JSON.stringify(infoObj)
              });

              localStorage.setItem(`digaf_device_approved_${currentUser.phoneNumber}`, 'false');
              isDeviceValidAndApproved = false;

              // Log Exception as ACCOUNT SHARING BLOCKED
              await dbService.logException({
                date: regDate,
                employeeName: currentUser.fullName,
                employeePhone: currentUser.phoneNumber,
                employeeRole: currentUser.customRole || currentUser.role,
                device: `${parsed.deviceType} - ${parsed.osName} (${parsed.browserName}) - Sig: ${currentSig}`,
                location: `Lat: ${latitude}, Lon: ${longitude}`,
                exceptionType: 'ACCOUNT SHARING BLOCKED' as any,
                actionTaken: 'Blocked: Mismatched/Unrecognized hardware signature',
                timestamp: new Date().toISOString()
              });

            } else if (freshUserAndDevice.deviceApproved === false) {
              localStorage.setItem(`digaf_device_approved_${currentUser.phoneNumber}`, 'false');
              isDeviceValidAndApproved = false;
              
              // Log Exception as ACCOUNT SHARING BLOCKED
              await dbService.logException({
                date: getLocalTodayStr(),
                employeeName: currentUser.fullName,
                employeePhone: currentUser.phoneNumber,
                employeeRole: currentUser.customRole || currentUser.role,
                device: `Signature: ${currentSig}`,
                location: `Lat: ${latitude}, Lon: ${longitude}`,
                exceptionType: 'ACCOUNT SHARING BLOCKED' as any,
                actionTaken: 'Blocked: Device signature pending admin activation',
                timestamp: new Date().toISOString()
              });
            } else {
              localStorage.setItem(`digaf_device_approved_${currentUser.phoneNumber}`, 'true');
              isDeviceValidAndApproved = true;
            }
          }
        } catch (dbErr) {
          console.warn("Could not query device signatures. Offline fallbacks enabled.", dbErr);
          isDeviceValidAndApproved = true; // allow transaction fallback
        }
      }

      if (!isDeviceValidAndApproved) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'error',
          message: "ACCOUNT SHARING BLOCKED: Unapproved workspace device fingerprint signature."
        });
        soundService.playErrorChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      // New Clock verification check to identify client computer-level date/time manipulation (Clock Spoofing)
      if (isCurrentlyOnline) {
        const clockVerify = await verifyClockSynchronization();
        if (!clockVerify.synchronized) {
          setScanning(false);
          setScanResultText({
            status: 'error',
            message: `SYSTEM INTEGRITY VIOLATION: Clock tampering detected! Your device clock drift helper is ${clockVerify.driftSeconds.toFixed(1)}s compared to central time. Check-ins barred until sync'd.`
          });
          
          await dbService.logException({
            date: getLocalTodayStr(),
            employeeName: currentUser.fullName,
            employeePhone: currentUser.phoneNumber,
            employeeRole: currentUser.customRole || currentUser.role,
            device: currentSig,
            location: `Device Drift: ${clockVerify.driftSeconds.toFixed(1)} seconds`,
            exceptionType: 'Clock Synchronization Failure',
            actionTaken: 'Blocked: Clock manipulation detected',
            timestamp: new Date().toISOString()
          });

          await logSecurityAnomaly(
            currentUser.phoneNumber,
            'HIGH',
            'TIME_MANIPULATION_ATTEMPT',
            `Device time skew blocked. Recorded clock difference is ${clockVerify.driftSeconds.toFixed(1)} seconds.`
          );
          isCurrentlyScanningRef.current = false;
          return;
        }
      }

      // 5. DUPLICATE ATTENDANCE PREVENTION
      const normalizedTodayStr = getLocalTodayStr();
      const offlineQueueRaw = typeof window !== 'undefined' ? localStorage.getItem('digaf_offline_attendance_queue') : null;
      let offlinePendingThisSession = false;
      if (offlineQueueRaw) {
        try {
          const q: AttendanceRecord[] = JSON.parse(offlineQueueRaw);
          offlinePendingThisSession = q.some(r => r.phoneNumber === currentUser.phoneNumber && r.date === normalizedTodayStr && r.attendanceType === scanType);
        } catch {}
      }

      if (offlinePendingThisSession) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'error',
          message: "Attendance already pending synchronization."
        });
        soundService.playErrorChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      const hasAlreadyScannedThisSession = (scanType === 'Morning' && hasMorningCheckIn) || (scanType === 'Afternoon' && hasAfternoonCheckIn);
      if (hasAlreadyScannedThisSession) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'already_present',
          message: "Attendance Already Recorded."
        });
        soundService.playSuccessChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      let allRecords: AttendanceRecord[] = [];
      if (isCurrentlyOnline) {
        try {
          allRecords = await dbService.getAttendanceRecords();
          const isAlreadyPresentInDb = allRecords.some(r => r.phoneNumber === currentUser.phoneNumber && r.date === normalizedTodayStr && r.attendanceType === scanType);
          if (isAlreadyPresentInDb) {
            setScanning(false);
            setGpsLoading(false);
            setScanResultText({
              status: 'already_present',
              message: "Attendance Already Recorded."
            });
            soundService.playSuccessChime();

            await dbService.logException({
              date: normalizedTodayStr,
              employeeName: currentUser.fullName,
              employeePhone: currentUser.phoneNumber,
              employeeRole: currentUser.customRole || currentUser.role,
              device: currentSig,
              location: `Firewall double check on ${scanType}`,
              exceptionType: 'Duplicate Attendance Attempt',
              actionTaken: 'Blocked: Duplicate clock-in rejected',
              timestamp: new Date().toISOString()
            });

            isCurrentlyScanningRef.current = false;
            return;
          }
        } catch (e) {
          console.warn("Direct DB duplication sweep skipped.");
        }
      }

      // 6. GEOFENCE ENFORCEMENT AUDIT (Strict Geofence Reject)
      const accuracyTolerance = Math.min(accuracy || 0, 150);
      isInside = testDistanceMeters <= (targetRadius + accuracyTolerance);

      if (!isInside && !isAdminOrSuper) {
        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'error',
          message: "Attendance Rejected - Outside Office Geofence.",
          userLat: latitude,
          userLon: longitude,
          targetLat,
          targetLon,
          distanceMeters: testDistanceMeters,
          targetRadius
        });
        soundService.playErrorChime();

        // Log critical outside geofence trace
        await dbService.logException({
          date: normalizedTodayStr,
          employeeName: currentUser.fullName,
          employeePhone: currentUser.phoneNumber,
          employeeRole: currentUser.customRole || currentUser.role,
          device: currentSig,
          location: `Outside geofence: ${testDistanceMeters.toFixed(1)}m, Coordinates: (${latitude}, ${longitude})`,
          exceptionType: 'Outside Office Attempt',
          actionTaken: 'Blocked: Geofence Rejection',
          timestamp: new Date().toISOString()
        });

        isCurrentlyScanningRef.current = false;
        return;
      }

      // 7. ACCOUNT SHARING SUSPECTED TRIGGER
      if (allRecords.length > 0) {
        const myDailyRecords = allRecords.filter(r => r.phoneNumber === currentUser.phoneNumber && r.date === normalizedTodayStr);
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const sharingDetected = myDailyRecords.some(r => {
          const rDate = new Date(`${r.date}T${r.time}`);
          const isRecent = Math.abs(nowMs - rDate.getTime()) < twoHoursMs;
          const isDiffDevice = r.deviceInformation !== currentSig;
          return isRecent && isDiffDevice;
        });

        if (sharingDetected) {
          await dbService.logException({
            date: normalizedTodayStr,
            employeeName: currentUser.fullName,
            employeePhone: currentUser.phoneNumber,
            employeeRole: currentUser.customRole || currentUser.role,
            device: `Mismatched hardware ID logs. Cur: ${currentSig}`,
            location: `Multi-terminal checkin inside two hours window`,
            exceptionType: 'ACCOUNT SHARING SUSPECTED',
            actionTaken: 'Flagged: ACCOUNT SHARING SUSPECTED - Sent to Exception logs',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 8. RESOLVE LATE / VERY LATE AUDIT WINDOWS
      let calculatedStatus: AttendanceStatus = 'Present';
      let displayMessage = '';
      let isWarningAlert = false;
      let managerReviewRequired = false;

      if (scanType === 'Morning') {
        if (totalMinutes <= 8 * 60 + 40) {
          // 08:00 - 08:40
          calculatedStatus = 'Present';
          displayMessage = `Successfully verified check-in! Swiped as "Present" at ${eatInfo.timeStr}.`;
        } else if (totalMinutes <= 10 * 60) {
          // 08:41 - 10:05
          calculatedStatus = 'Late';
          displayMessage = `Marked "Late". Clock-ins after 08:40 up to 10:00 register as Late.`;
          isWarningAlert = true;

          await dbService.logException({
            date: normalizedTodayStr,
            employeeName: currentUser.fullName,
            employeePhone: currentUser.phoneNumber,
            employeeRole: currentUser.customRole || currentUser.role,
            device: currentSig,
            location: `Lat: ${latitude}, Lon: ${longitude}`,
            exceptionType: 'Late Attendance',
            actionTaken: 'Logged: Present (Late)',
            timestamp: new Date().toISOString()
          });
        } else if (totalMinutes <= 12 * 60) {
          // 10:01 - 12:00 -> VERY LATE (Flagged for Review)
          calculatedStatus = 'VERY LATE';
          managerReviewRequired = true;
          displayMessage = `Marked "VERY LATE". Supervisor evaluation protocol assigned.`;
          isWarningAlert = true;

          await dbService.logException({
            date: normalizedTodayStr,
            employeeName: currentUser.fullName,
            employeePhone: currentUser.phoneNumber,
            employeeRole: currentUser.customRole || currentUser.role,
            device: currentSig,
            location: `Lat: ${latitude}, Lon: ${longitude}`,
            exceptionType: 'Very Late Attendance',
            actionTaken: 'Flagged: MANAGER REVIEW REQUIRED',
            timestamp: new Date().toISOString()
          });
        } else {
          calculatedStatus = 'Admin Approval Required';
          displayMessage = `Morning attendance window has closed. Admin approval required.`;
          isWarningAlert = true;
        }
      } else {
        // Afternoon Windows (Aligned with Audited Production Guidelines)
        if (totalMinutes <= 14 * 60 + 30) {
          calculatedStatus = 'Afternoon Present';
          displayMessage = `Successfully verified Afternoon check-in! Swiped as "Afternoon Present" at ${eatInfo.timeStr}.`;
        } else if (totalMinutes <= 15 * 60 + 59) {
          calculatedStatus = 'Afternoon Late';
          displayMessage = `Marked "Afternoon Late". Check-ins from 14:31 up to 15:59 register as Afternoon Late.`;
          isWarningAlert = true;
        } else {
          calculatedStatus = 'Afternoon Admin Approval Required';
          displayMessage = `Afternoon attendance window has closed (16:00+). Swiped as "Afternoon Admin Approval Required".`;
          isWarningAlert = true;
        }
      }

      // Check leave requests
      const matchingLeave = leaveRequests.find(
        l => l.phoneNumber === currentUser.phoneNumber && l.date === normalizedTodayStr && l.status === 'Approved'
      );

      if (matchingLeave) {
        calculatedStatus = matchingLeave.type as AttendanceStatus;
        displayMessage = `Leave overrides apply: clock-in swiped as "${calculatedStatus.toUpperCase()}" based on authorized request.`;
        isWarningAlert = false;
      }

      const geofenceDiagnostic = ` [Geofence: Detected ${testDistanceMeters.toFixed(1)}m from office center (configured radius: ${targetRadius}m) - status: ${isInside ? 'COMPLIANT' : 'EXCEPTION OUTSIDE'}]`;
      displayMessage += geofenceDiagnostic;

      // WiFi / connection verification logic
      let networkName = 'WiFi Detection Restricted (Browser Permissions)';
      let networkVerificationStatus = 'Not Verified (Browser Restricts Network SSID Info)';
      try {
        const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (conn) {
          if (conn.type === 'wifi') {
            networkName = 'Office Local WiFi';
            networkVerificationStatus = 'WiFi Verified';
          } else if (conn.effectiveType) {
            networkName = `Cellular / LAN (${conn.effectiveType})`;
            networkVerificationStatus = 'Verified Network';
          }
        }
      } catch (e) {
        console.warn("Could not read connection metadata", e);
      }

      const recordId = `att-${normalizedTodayStr}-${scanType}-${currentUser.phoneNumber}`;
      const newRecord: AttendanceRecord = {
        id: recordId,
        employeeName: currentUser.fullName,
        employeeRole: currentUser.customRole || currentUser.role,
        phoneNumber: currentUser.phoneNumber,
        date: normalizedTodayStr,
        time: eatInfo.timeStr,
        attendanceType: scanType,
        gpsCoordinates: {
          latitude,
          longitude,
          accuracy,
          distanceText: `${testDistanceMeters.toFixed(1)}m`,
          isInside
        },
        deviceInformation: currentSig,
        status: calculatedStatus,
        managerReviewRequired,
        localDeviceTime: new Date().toISOString(),
        networkName,
        networkVerificationStatus,
        selfieImageUrl: verifiedSelfieUrl,
        verificationResult: verifiedSelfieResult
      };

      if (!isCurrentlyOnline) {
        // Queue Offline
        newRecord.status = 'OFFLINE PENDING SYNC';
        newRecord.offlineCalculatedStatus = calculatedStatus;
        const existingQueueRaw = localStorage.getItem('digaf_offline_attendance_queue');
        let queue: AttendanceRecord[] = [];
        if (existingQueueRaw) {
          try {
            queue = JSON.parse(existingQueueRaw);
          } catch (err) {
            queue = [];
          }
        }
        if (!queue.some(r => r.id === newRecord.id)) {
          queue.push(newRecord);
          // Standardize offline queue limits
          if (queue.length > 50) {
            queue.shift(); // Evicts oldest duplicate queues
          }
          localStorage.setItem('digaf_offline_attendance_queue', JSON.stringify(queue));
        }

        setScanning(false);
        setGpsLoading(false);
        setScanResultText({
          status: 'warning',
          message: 'OFFLINE MODE: Internet is currently unavailable. Your attendance was successfully captured locally with status "OFFLINE PENDING SYNC". It will be automatically uploaded soon.',
          record: newRecord
        });
        soundService.playSuccessChime();
        isCurrentlyScanningRef.current = false;
        return;
      }

      // Online Save
      await dbService.saveAttendanceRecord(newRecord);
      setScanning(false);

      if (isWarningAlert) {
        setScanResultText({
          status: 'warning',
          message: displayMessage,
          userLat: latitude,
          userLon: longitude,
          targetLat,
          targetLon,
          distanceMeters: testDistanceMeters,
          targetRadius,
          record: newRecord
        });
        soundService.playLateWarningChime();
      } else {
        setScanResultText({
          status: 'success',
          message: displayMessage,
          userLat: latitude,
          userLon: longitude,
          targetLat,
          targetLon,
          distanceMeters: testDistanceMeters,
          targetRadius,
          record: newRecord
        });
        soundService.playSuccessChime();
      }

    } catch (outerError) {
      console.error("Uncaught clock-in error", outerError);
      setScanning(false);
      setGpsLoading(false);
    } finally {
      isCurrentlyScanningRef.current = false;
    }
  };

  const resolveApprovedStatus = (type: 'Morning' | 'Afternoon', timeStr: string): AttendanceStatus => {
    if (!timeStr) return 'Present';
    const parts = timeStr.split(':');
    if (parts.length < 2) return 'Present';
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const totalMinutes = hours * 60 + minutes;

    if (type === 'Morning') {
      if (totalMinutes <= 8 * 60 + 40) return 'Present';
      if (totalMinutes <= 10 * 60) return 'Late';
      if (totalMinutes <= 12 * 60) return 'VERY LATE';
      return 'Admin Approval Required';
    } else {
      if (totalMinutes <= 14 * 60 + 30) return 'Afternoon Present';
      if (totalMinutes <= 15 * 60 + 59) return 'Afternoon Late';
      return 'Afternoon Admin Approval Required';
    }
  };

  // DEVICE BIOMETRIC/SIGNATURE OVERRIDES
  const handleDeviceApprove = async (phoneNumber: string) => {
    try {
      const userRecords = records.filter(r => r.phoneNumber === phoneNumber);
      // Look first for a record with status === 'New Device Pending Approval' containing device signature
      let latestRecord = userRecords.find(r => r.status === 'New Device Pending Approval' && !!r.deviceInformation);
      if (!latestRecord) {
        // Fallback: sort user records descending by date and time to find the true latest scan
        const sortedRecords = [...userRecords].sort((a, b) => {
          const dateComp = b.date.localeCompare(a.date);
          if (dateComp !== 0) return dateComp;
          return (b.time || '').localeCompare(a.time || '');
        });
        latestRecord = sortedRecords.find(r => !!r.deviceInformation);
      }
      
      const userDoc = await dbService.getUser(phoneNumber);
      const existingSigs = userDoc?.deviceSignature
        ? userDoc.deviceSignature.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const reason = window.prompt("Enter Device Approval Justification Reason:", "Authorized Office PC / Workstation Signature matches employee ledger") || "Authorized Office PC";
      const updates: any = { 
        deviceApproved: true,
        deviceApprovedBy: currentUser.fullName,
        deviceApprovedDate: new Date().toISOString(),
        deviceApprovalReason: reason,
        approvedBy: currentUser.fullName,
        approvedDate: new Date().toISOString(),
        approvalReason: reason
      };

      if (latestRecord && latestRecord.deviceInformation) {
        const newSig = latestRecord.deviceInformation;
        if (!existingSigs.includes(newSig)) {
          existingSigs.push(newSig);
        }
        updates.deviceSignature = existingSigs.join(',');
      }
      
      await dbService.updateUser(phoneNumber, updates);
      
      // Audit compliance requirement: approving a device ONLY approves the device profile and never alters existing attendance records
      showFeedback("Successfully approved employee's current device signature in Firestore!");
      soundService.playSuccessChime();
    } catch (err) {
      showFeedback("Could not update device approval status in cloud database.", "error");
    }
  };

  // ADMINISTRATIVE SECURITY CREDENTIALS OVERRIDE & ACCOUNT RECOVERY ACTION HANDLER
  const handleExecuteSecurityRecovery = async () => {
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (!recoveryUserPhone) {
      setRecoveryError("Please select an employee account for security recovery resets.");
      return;
    }
    if (!recoveryPassword || recoveryPassword.trim().length < 4) {
      setRecoveryError("New override password or passcode must be at least 4 digits/characters.");
      return;
    }
    if (!recoveryReason || recoveryReason.trim().length < 5) {
      setRecoveryError("A valid administrative justification/audit reason is required.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const selectedEmp = users.find(u => u.phoneNumber === recoveryUserPhone);
      if (!selectedEmp) {
        throw new Error("Target employee profile was not found in the workstation registry.");
      }

      // Check role based restrictions:
      const targetIsZewdneh = selectedEmp.phoneNumber === '0988286610' || selectedEmp.fullName.toLowerCase().includes('zewdneh') || selectedEmp.role === 'super_admin';
      if (currentUser.role === 'admin' && targetIsZewdneh) {
        throw new Error("SECURITY VIOLATION: Sub-administrator credentials cannot alter Super-Administrator credentials.");
      }

      const updates: any = {
        password: recoveryPassword.trim()
      };

      if (recoveryForceChange) {
        updates.forcePasswordChange = true;
        updates.tempPassword = recoveryPassword.trim();
      } else {
        updates.forcePasswordChange = false;
        updates.tempPassword = '';
      }

      if (recoveryClearDevice) {
        updates.deviceSignature = '';
        updates.deviceApproved = false;
        updates.deviceInfo = '';
      }

      if (recoveryClearFace) {
        updates.registeredSelfieUrl = '';
      }

      // Execute Firestore write
      await dbService.updateUser(recoveryUserPhone, updates);

      // Save admin compliance log in exceptions collections
      await dbService.logException({
        date: getLocalTodayStr(),
        employeeName: selectedEmp.fullName,
        employeePhone: selectedEmp.phoneNumber,
        employeeRole: selectedEmp.customRole || selectedEmp.role,
        device: `Admin-Executed Recovery Key Override`,
        location: `Bypasses: Device=${recoveryClearDevice}, Face=${recoveryClearFace}, ForceReset=${recoveryForceChange}`,
        exceptionType: 'ADMIN SECURITY RECOVERY' as any,
        actionTaken: `Executed by Admin: ${currentUser.fullName} (${currentUser.role}). Reason: ${recoveryReason}`,
        timestamp: new Date().toISOString()
      });

      // Write standard security audit log
      await logSecurityAnomaly(
        currentUser.phoneNumber,
        'MEDIUM',
        'ADMIN_SECURITY_RECOVERY_OVERRIDE',
        `Admin '${currentUser.fullName}' forced credential overrides for Employee '${selectedEmp.fullName}'. ClearedDevice: ${recoveryClearDevice}, ClearedFace: ${recoveryClearFace}. Reason: ${recoveryReason}`
      );

      // Clear states
      setRecoveryPassword('');
      setRecoveryReason('');
      setRecoveryUserPhone('');
      setRecoverySearchText('');
      setRecoverySuccess(`Account recovery credentials updated! Override and security modifications successfully saved in the active audit trail logs for '${selectedEmp.fullName}'.`);
      soundService.playSuccessChime();
    } catch (err: any) {
      console.error(err);
      setRecoveryError(err.message || "Failed to update employee's credentials.");
      soundService.playErrorChime();
    } finally {
      setRecoveryLoading(false);
    }
  };

  // ATTENDANCE MANUAL CORRECTION CENTER ACTION HANDLERS
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionError('');
    setCorrectionSuccess('');
    
    if (!correctionReason.trim()) {
      setCorrectionError('Please enter a valid justification or reason for this manual correction.');
      return;
    }

    const regId = `corr-${Date.now()}-${currentUser.phoneNumber}`;
    const newCorr: AttendanceCorrectionRequest = {
      id: regId,
      employeeName: currentUser.fullName,
      employeePhone: currentUser.phoneNumber,
      date: correctionDate,
      reason: correctionReason.trim(),
      requestedBy: currentUser.fullName,
      requestedAt: new Date().toISOString(),
      status: 'Pending'
    };

    try {
      await dbService.createCorrectionRequest(newCorr);
      
      // Log on admin logs
      await dbService.logActivity(
        currentUser.phoneNumber,
        'Renewal Processing',
        'Renewal Processing',
        `Employee submitted attendance correction request for date ${correctionDate}`
      );

      setCorrectionSuccess('Your manual correction request was successfully submitted for Administrator security audit!');
      setCorrectionReason('');
      soundService.playSuccessChime();
    } catch (err) {
      setCorrectionError('Could not process correction submission in Cloud Database.');
    }
  };

  const handleCorrectionReview = async (requestId: string, status: 'Approved' | 'Rejected', notes?: string) => {
    try {
      const selectedReq = correctionRequests.find(r => r.id === requestId);
      if (!selectedReq) return;

      const adminNotes = notes || (status === 'Approved' ? "Audit completed & corrected successfully" : "Rejected: Insufficient alignment with geotags");
      await dbService.updateCorrectionRequest(requestId, status, currentUser.fullName, adminNotes);

      // Log activity
      await dbService.logActivity(
        currentUser.fullName,
        'Renewal Processing',
        'Renewal Processing',
        `Admin processed manual correction request for ${selectedReq.employeeName} (${selectedReq.date}) as ${status.toUpperCase()}: ${adminNotes}`
      );

      // If approved, let's also update or create the attendance record for that date
      if (status === 'Approved') {
        const recordId = `att-${selectedReq.date}-Morning-${selectedReq.employeePhone}`; // default correction to Morning session
        const correctedRecord: AttendanceRecord = {
          id: recordId,
          employeeName: selectedReq.employeeName,
          employeeRole: 'Digital Operational Officer', // defaults
          phoneNumber: selectedReq.employeePhone,
          date: selectedReq.date,
          time: '08:30:00', // standard compliant check-in
          attendanceType: 'Morning',
          gpsCoordinates: {
            latitude: settings?.latitude ?? 9.0115,
            longitude: settings?.longitude ?? 38.7830,
            isInside: true,
            distanceText: '0m (Approved Manual Correction)'
          },
          deviceInformation: 'ADMIN_MANUALLY_CORRECTED',
          status: 'Present',
          syncSource: 'MANUAL CORRECTION BY ADMIN',
          localDeviceTime: new Date().toISOString()
        };
        await dbService.saveAttendanceRecord(correctedRecord);
        
        // Log extra exception so it shows in the exceptions center
        await dbService.logException({
          date: selectedReq.date,
          employeeName: selectedReq.employeeName,
          employeePhone: selectedReq.employeePhone,
          employeeRole: 'Employee',
          device: 'Manual Correction',
          location: 'Approved override',
          exceptionType: 'Manual Attendance Correction',
          actionTaken: `Corrected status: Present. Approved by ${currentUser.fullName}`,
          timestamp: new Date().toISOString()
        });
      }

      showFeedback(`Successfully ${status.toLowerCase()}ed attendance correction request!`);
      soundService.playSuccessChime();
    } catch (err) {
      showFeedback(`Failed to update correction request: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleDeviceReset = async (phoneNumber: string) => {
    try {
      await dbService.updateUser(phoneNumber, {
        deviceSignature: '',
        deviceApproved: false,
        deviceRegistrationDate: ''
      });
      showFeedback("Device hardware fingerprint cleared! Employee can connect a new computer on their next clock-in.");
      soundService.playSuccessChime();
    } catch (err) {
      showFeedback("Could not purge browser device signatures.", "error");
    }
  };

  const handleProfilePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    if (!profileCurrentPassword || !profileNewPassword || !profileConfirmPassword) {
      setProfileError('Please fill in all security credential inputs.');
      return;
    }

    if (profileNewPassword !== profileConfirmPassword) {
      setProfileError('Confirmation password does not match.');
      return;
    }

    if (profileNewPassword.length < 4) {
      setProfileError('New password must be at least 4 characters long.');
      return;
    }

    try {
      const userObj = await dbService.getUser(currentUser.phoneNumber);
      if (!userObj) {
        setProfileError('Profile record not verified in Firestore database.');
        return;
      }

      if (userObj.passwordHash !== profileCurrentPassword) {
        setProfileError('Current password entered is incorrect.');
        return;
      }

      await dbService.updateUser(currentUser.phoneNumber, {
        passwordHash: profileNewPassword
      });

      setProfileSuccess('Your profile login password has been successfully updated in Firestore!');
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
      soundService.playSuccessChime();
    } catch (err: any) {
      setProfileError(`Could not modify security keys. ${err.message || ''}`);
    }
  };

  // LEAVE SUBMITS
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      setLeaveActionError('Please state the detailed business or personal reason for this leave request.');
      return;
    }

    setLeaveActionSuccess('');
    setLeaveActionError('');

    const reqId = 'leave-' + Math.random().toString(36).substring(2, 11);
    const newLeave: LeaveRequest = {
      id: reqId,
      employeeName: currentUser.fullName,
      phoneNumber: currentUser.phoneNumber,
      employeeRole: currentUser.customRole || currentUser.role,
      type: leaveType,
      date: leaveDate,
      reason: leaveReason.substring(0, 500),
      notes: '',
      status: 'Pending',
      timestamp: new Date().toISOString()
    };

    if (leaveType === 'Field Work') {
      newLeave.destination = fieldDestination || 'Assigned Site Location';
      newLeave.expectedReturnTime = fieldReturnTime || 'By end of shift';
    }

    try {
      await dbService.createLeaveRequest(newLeave);
      setLeaveActionSuccess(`Your ${leaveType} leave application has been submitted to Aman / Zewdneh.`);
      setLeaveReason('');
      setFieldDestination('');
      setFieldReturnTime('');
      soundService.playSuccessChime();
    } catch (err) {
      setLeaveActionError('Failed to commit leave request to database.');
    }
  };

  // LEAVE REVIEWS (Admin approvals)
  const handleLeaveReview = async (reqId: string, status: 'Approved' | 'Rejected') => {
    try {
      await dbService.updateLeaveRequest(reqId, status, currentUser.fullName);
      soundService.playSuccessChime();

      // If approved, let's auto-generate corresponding attendance record for that date
      const matchingReq = leaveRequests.find(r => r.id === reqId);
      if (matchingReq && status === 'Approved') {
        const checkInId = `att-${matchingReq.date}-Morning-${matchingReq.phoneNumber}`;
        const newAttRecord: AttendanceRecord = {
          id: checkInId,
          employeeName: matchingReq.employeeName,
          employeeRole: matchingReq.employeeRole,
          phoneNumber: matchingReq.phoneNumber,
          date: matchingReq.date,
          time: '08:00:00',
          attendanceType: 'Morning',
          gpsCoordinates: {
            latitude: settings?.latitude ?? 9.0115,
            longitude: settings?.longitude ?? 38.7830,
            isInside: true
          },
          deviceInformation: 'System Approved Leave Integration',
          status: matchingReq.type as AttendanceStatus
        };
        await dbService.saveAttendanceRecord(newAttRecord);
      }
    } catch (err) {
      alert('Review action error.');
    }
  };



  // OFFICE GPS CALIBRATOR
  const [newRadius, setNewRadius] = useState<number>(10);
  const handleSaveOfficeGPS = async () => {
    setGpsLoading(true);
    try {
      // Ask system geolocation representing current stance, or support easy custom layout setting
      navigator.geolocation.getCurrentPosition(async (position) => {
        const updateObj: AttendanceSettings = {
          id: 'office_config',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radius: newRadius,
          updatedBy: currentUser.fullName,
          updatedAt: new Date().toISOString()
        };
        await dbService.saveAttendanceSettings(updateObj);
        setGpsLoading(false);
        soundService.playSuccessChime();
        alert(`Office Geofence successfully aligned to current location: lat ${updateObj.latitude.toFixed(6)}, lon ${updateObj.longitude.toFixed(6)}.`);
      }, () => {
        setGpsLoading(false);
        alert('Could not configure current GPS precisely. Using mock default coordinates (Addis Ababa).');
      }, {
        enableHighAccuracy: true
      });
    } catch (err) {
      setGpsLoading(false);
      alert('GPS access denied.');
    }
  };

  const handleSaveManualSettings = async () => {
    const latNum = parseFloat(manualLat);
    const lonNum = parseFloat(manualLon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      alert('Please enter valid decimal numbers for Latitude and Longitude.');
      return;
    }

    setGpsLoading(true);
    try {
      const updateObj: AttendanceSettings = {
        id: 'office_config',
        latitude: latNum,
        longitude: lonNum,
        radius: newRadius,
        updatedBy: currentUser.fullName,
        updatedAt: new Date().toISOString()
      };
      await dbService.saveAttendanceSettings(updateObj);
      setGpsLoading(false);
      soundService.playSuccessChime();
      alert(`Office GPS Settings manually configured successfully!\nLatitude: ${latNum.toFixed(6)}\nLongitude: ${lonNum.toFixed(6)}\nRadius: ${newRadius} meters.`);
    } catch (err: any) {
      setGpsLoading(false);
      alert(`Could not save manual coordinates in Firestore: ${err.message || err}`);
    }
  };

  const handleToggleChatbot = async (staffPhone: string, staffName: string) => {
    const existingPerm = officerPermissions.find(p => p.phoneNumber === staffPhone);
    const updatedPerm: OfficerAIPermission = existingPerm 
      ? { ...existingPerm }
      : {
          phoneNumber: staffPhone,
          fullName: staffName,
          customerBriefAllowed: false,
          imageGenerationAllowed: false,
          assistantPanelAllowed: true, // Default to true since chatbot is open by default
          aiReportsAllowed: false,
        };

    const nextVal = !updatedPerm.assistantPanelAllowed;
    updatedPerm.assistantPanelAllowed = nextVal;

    try {
      await dbService.updateOfficerPermission(updatedPerm);
      dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'CHATBOT_TOGGLE',
        `Altered Chatbot access for ${staffName} to: ${nextVal}`
      );
      showFeedback(`Toggled chatbot for ${staffName} to ${nextVal ? 'ENABLED' : 'DISABLED'}`);
      soundService.playSuccessChime();
    } catch (err) {
      showFeedback('Failed to save staff chatbot permission state.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      showFeedback("No reports to export.", "error");
      return;
    }
    
    const getExportRole = (role: string) => {
      const cleaned = (role || '').trim().toLowerCase();
      if (cleaned === 'system_admin' || cleaned === 'super_admin' || cleaned === 'admin' || cleaned === 'system owner') {
        return 'Digital Loan Officer';
      }
      return role || 'Digital Loan Officer';
    };
    
    const headers = [
      "Employee Name", 
      "Role", 
      "Phone Number", 
      "Date", 
      "Swipe Time", 
      "Session", 
      "Status", 
      "GPS Distance", 
      "Device Name", 
      "Selfie Verification Result", 
      "Number of Posts", 
      "Completed Tasks", 
      "Remaining Tasks", 
      "First Round Workload", 
      "Second Round Workload"
    ];
    
    const rows = records.map(r => {
      // Metric calculations per staff member
      const postsCount = customers.filter(c => c.addedBy === r.phoneNumber || c.addedBy === r.employeeName).length;
      const completedTasksCount = workAssignments.filter(w => w.assignedTo === r.phoneNumber && (w.status === 'Completed' || w.status === 'COMPLETED')).length;
      const remainingTasksCount = workAssignments.filter(w => w.assignedTo === r.phoneNumber && !(w.status === 'Completed' || w.status === 'COMPLETED')).length;
      const firstRoundCount = customers.filter(c => (c.addedBy === r.phoneNumber || c.addedBy === r.employeeName) && c.workspace === 'first_round').length;
      const secondRoundCount = customers.filter(c => (c.addedBy === r.phoneNumber || c.addedBy === r.employeeName) && c.workspace === 'second_round').length;
      
      const selfieResult = r.verificationResult 
        ? "PASSED (Confidence matching high)" 
        : (r.selfieImageUrl ? "PASSED (Face Profile Synced)" : "N/A (Bypassed Or Legacy)");

      return [
        `"${r.employeeName.replace(/"/g, '""')}"`,
        `"${getExportRole(r.employeeRole || '').replace(/"/g, '""')}"`,
        `"${r.phoneNumber}"`,
        `"${r.date}"`,
        `"${r.time}"`,
        `"${r.attendanceType}"`,
        `"${r.status}"`,
        `"${r.gpsCoordinates?.distanceText || 'N/A'}"`,
        `"${(r.deviceInformation || '').replace(/"/g, '""')}"`,
        `"${selfieResult}"`,
        `"${postsCount}"`,
        `"${completedTasksCount}"`,
        `"${remainingTasksCount}"`,
        `"${firstRoundCount}"`,
        `"${secondRoundCount}"`
      ];
    });
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${getSystemDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback("Master attendance report exported as CSV successfully!");
  };

  const handleExportExcel = () => {
    if (records.length === 0) {
      showFeedback("No reports to export.", "error");
      return;
    }
    
    const getExportRole = (role: string) => {
      const cleaned = (role || '').trim().toLowerCase();
      if (cleaned === 'system_admin' || cleaned === 'super_admin' || cleaned === 'admin' || cleaned === 'system owner') {
        return 'Digital Loan Officer';
      }
      return role || 'Digital Loan Officer';
    };
    
    const excelHeader = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/html; charset=UTF-8">
        <!--[if gte o35 mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Attendance Logs</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          th { background-color: #4F46E5; color: white; font-weight: bold; }
          td, th { border: 1px solid #D1D5DB; padding: 6px; font-family: sans-serif; font-size: 11px; }
        </style>
      </head>
      <body>
    `;
    
    let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Role</th>
            <th>Phone Number</th>
            <th>Date</th>
            <th>Swipe Time</th>
            <th>Session</th>
            <th>Status</th>
            <th>GPS Distance</th>
            <th>Device Name</th>
            <th>Selfie Verification Result</th>
            <th>Number of Posts</th>
            <th>Completed Tasks</th>
            <th>Remaining Tasks</th>
            <th>First Round Workload</th>
            <th>Second Round Workload</th>
          </tr>
        </thead>
        <tbody>
    `;
      
    records.forEach(r => {
      const postsCount = customers.filter(c => c.addedBy === r.phoneNumber || c.addedBy === r.employeeName).length;
      const completedTasksCount = workAssignments.filter(w => w.assignedTo === r.phoneNumber && (w.status === 'Completed' || w.status === 'COMPLETED')).length;
      const remainingTasksCount = workAssignments.filter(w => w.assignedTo === r.phoneNumber && !(w.status === 'Completed' || w.status === 'COMPLETED')).length;
      const firstRoundCount = customers.filter(c => (c.addedBy === r.phoneNumber || c.addedBy === r.employeeName) && c.workspace === 'first_round').length;
      const secondRoundCount = customers.filter(c => (c.addedBy === r.phoneNumber || c.addedBy === r.employeeName) && c.workspace === 'second_round').length;
      
      const selfieResult = r.verificationResult 
        ? "PASSED (Confidence matching high)" 
        : (r.selfieImageUrl ? "PASSED (Face Profile Synced)" : "N/A (Bypassed Or Legacy)");

      tableHtml += `
        <tr>
          <td>${r.employeeName}</td>
          <td>${getExportRole(r.employeeRole || '')}</td>
          <td style="mso-number-format:'\\@'">${r.phoneNumber}</td>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td>${r.attendanceType}</td>
          <td>${r.status}</td>
          <td>${r.gpsCoordinates?.distanceText || 'N/A'}</td>
          <td style="mso-number-format:'\\@'">${r.deviceInformation || ''}</td>
          <td>${selfieResult}</td>
          <td>${postsCount}</td>
          <td>${completedTasksCount}</td>
          <td>${remainingTasksCount}</td>
          <td>${firstRoundCount}</td>
          <td>${secondRoundCount}</td>
        </tr>
      `;
    });
    
    tableHtml += `
        </tbody>
      </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([excelHeader + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${getSystemDateStr()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback("Master attendance report exported as Excel (.xls) successfully!");
  };

  // STATS & AGGREGATE SUMMARY CALCULATIONS (Dashboard View)
  const getAggregatedStats = () => {
    // 1. Employee Count excluding Zewdneh & dynamic list of excluded users
    const activeStaff = users.filter(u => u.status === 'active' && !isExcludedUser(u.fullName, u.phoneNumber) && !(u.fullName.toLowerCase().includes('zewd') || u.phoneNumber.toLowerCase().includes('zewd')));
    const activeStaffCount = activeStaff.length;

    // 2. Today's records
    const todayStr = getSystemDateStr();
    const todayRecords = records.filter(r => r.date === todayStr);

    const presentsToday = todayRecords.filter(r => r.status === 'Present' || r.status === 'Afternoon Present');
    const latesToday = todayRecords.filter(r => 
      r.status === 'Late' || 
      r.status === 'Afternoon Late' || 
      r.status === 'Very Late' || 
      r.status === 'VERY LATE' || 
      r.status === 'Admin Approval Required' || 
      r.status === 'Afternoon Admin Approval Required' || 
      r.status === 'New Device Pending Approval'
    );
    
    // Who is absent
    const scannedPhoneNumbers = new Set(todayRecords.map(r => r.phoneNumber));
    const absentsToday = activeStaff.filter(s => !scannedPhoneNumbers.has(s.phoneNumber));

    // Attendance Ranking calculation
    const rankingMap: Record<string, { presentCount: number, lateCount: number, absentCount: number, name: string }> = {};
    activeStaff.forEach(u => {
      rankingMap[u.phoneNumber] = { presentCount: 0, lateCount: 0, absentCount: 0, name: u.fullName };
    });

    // Historic records
    records.forEach(r => {
      if (rankingMap[r.phoneNumber]) {
        if (r.status === 'Present' || r.status === 'Afternoon Present') {
          rankingMap[r.phoneNumber].presentCount++;
        } else if (
          r.status === 'Late' || 
          r.status === 'Afternoon Late' || 
          r.status === 'Very Late' || 
          r.status === 'VERY LATE' || 
          r.status === 'Admin Approval Required' || 
          r.status === 'Afternoon Admin Approval Required'
        ) {
          rankingMap[r.phoneNumber].lateCount++;
        } else if (r.status === 'Absent') {
          rankingMap[r.phoneNumber].absentCount++;
        }
      }
    });

    const ranks = Object.values(rankingMap).sort((a, b) => b.presentCount - a.presentCount);

    return { activeStaffCount, presentsCount: presentsToday.length, latesCount: latesToday.length, absentsCount: absentsToday.length, absentsList: absentsToday, ranks };
  };

  const { activeStaffCount, presentsCount, latesCount, absentsCount, absentsList, ranks } = getAggregatedStats();

  if (isScannedCheckIn) {
    const formattedMinutes = Math.floor(countdownSeconds / 60);
    const formattedSecs = String(countdownSeconds % 60).padStart(2, '0');
    
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 bg-slate-50 animate-fade-in" id="qr_scan_direct_overlay">
        <div className="bg-white rounded-3xl border border-slate-150 p-8 shadow-md max-w-md w-full text-center space-y-6">
          
          {/* 1. Header with branding/title */}
          <div className="space-y-1.5 pb-2">
            <span className="text-[9px] px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 font-extrabold uppercase rounded-full text-indigo-700 tracking-wider">
              Secure QR Swipe Portal
            </span>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight font-sans">
              Workstation Attendance
            </h2>
          </div>

          {/* 2. Loading State vs Result state */}
          {!scanResultText ? (
            <div className="py-12 space-y-4 animate-pulse">
              <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin mx-auto" />
              <div className="space-y-1 text-center">
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">AQUIRING GPS LOCK...</p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                  Drawing satellite geofence coordinates to securely verify your check-in proximity. Please stand still.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {scanResultText.record ? (
                /* Beautiful High-Contrast Large Confirmation Card */
                <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 text-left space-y-4 shadow-xl">
                  <div className="text-center border-b border-slate-800 pb-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 animate-bounce" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                      Attendance Recorded Successfully
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-1 text-xs font-sans">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Employee Name</span>
                      <span className="font-bold text-white text-xs block truncate">{scanResultText.record.employeeName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Role</span>
                      <span className="font-bold text-white text-xs block truncate">{scanResultText.record.employeeRole}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Date</span>
                      <span className="font-mono text-white text-xs block">{scanResultText.record.date}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Time</span>
                      <span className="font-mono text-white text-xs block">{scanResultText.record.time}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Attendance Type</span>
                      <span className="font-bold text-white text-xs block">{scanResultText.record.attendanceType} Session</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">GPS Distance</span>
                      <span className="font-bold text-white text-xs block">{scanResultText.record.gpsCoordinates?.distanceText || '0.0m'}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-800 pt-3">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Device Name</span>
                      <span className="font-mono text-slate-300 text-[10px] break-all block">
                        {scanResultText.record.deviceInformation}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`mt-3 p-3.5 rounded-2xl text-center border font-sans ${
                    scanResultText.record.status === 'Present' || scanResultText.record.status === 'Afternoon Present'
                      ? 'bg-emerald-950/80 border-emerald-500/20 text-emerald-300'
                      : scanResultText.record.status === 'Late' || scanResultText.record.status === 'Afternoon Late'
                        ? 'bg-amber-950/80 border-amber-500/20 text-amber-300'
                        : 'bg-rose-950/80 border-rose-500/20 text-rose-300'
                  }`}>
                    <span className="text-[10px] uppercase tracking-widest font-black block">Recorded Status</span>
                    <span className="text-base font-black tracking-tight block mt-0.5 uppercase">
                      {scanResultText.record.status.toUpperCase()}
                    </span>
                    {scanResultText.record.managerReviewRequired && (
                      <span className="text-[9px] font-extrabold text-rose-450 text-rose-400 uppercase tracking-wide block mt-1 animate-pulse">
                        ⚠️ Manager Review Required
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Visual checkmark or alert emblem */}
                  <div className="flex justify-center">
                    {scanResultText.status === 'success' ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-full animate-bounce">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      </div>
                    ) : scanResultText.status === 'already_present' ? (
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-full animate-bounce">
                        <CheckCircle2 className="w-10 h-10 text-indigo-500" />
                      </div>
                    ) : scanResultText.status === 'warning' ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-full animate-pulse">
                        <AlertCircle className="w-10 h-10 text-amber-500" />
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-full">
                        <XCircle className="w-10 h-10 text-rose-500" />
                      </div>
                    )}
                  </div>

                  {/* Status Details */}
                  <div className="space-y-2 bg-slate-50/50 border border-slate-150 p-4 rounded-2xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Swipe Status Details</span>
                    <span className={`text-base font-black uppercase tracking-tight block ${
                      scanResultText.status === 'success'
                        ? 'text-emerald-600'
                        : scanResultText.status === 'already_present'
                          ? 'text-indigo-600'
                          : scanResultText.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                    }`}>
                      {scanResultText.status === 'success' ? 'PRESENT' : scanResultText.status === 'already_present' ? 'ALREADY PRESENT' : scanResultText.status === 'warning' ? 'LATE COMER' : 'SWIPE REFUSED'}
                    </span>
                    
                    <p className="text-[10.5px] text-slate-600 font-medium leading-relaxed font-sans px-2">
                      {scanResultText.message}
                    </p>

                    {scanResultText.userLat !== undefined && scanResultText.targetLat !== undefined && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-200/60 text-[9.5px] space-y-1.5 font-mono text-slate-600">
                        <div className="flex items-center gap-1 text-[#8B5CF6] font-black uppercase text-[8px] tracking-wider mb-1">
                          <MapPin className="w-3 h-3 text-[#8B5CF6]" />
                          📡 High-Precision Geofence Diagnosis
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[9px] text-left">
                          <div className="bg-slate-100 p-2 rounded-xl border border-slate-150">
                            <span className="text-slate-400 block uppercase text-[7.5px] font-black leading-tight mb-0.5">Detected GPS</span>
                            <span className="font-extrabold text-slate-700 block">Lat: {Number(scanResultText.userLat).toFixed(6)}</span>
                            <span className="font-extrabold text-slate-700 block">Lon: {Number(scanResultText.userLon).toFixed(6)}</span>
                          </div>
                          <div className="bg-slate-100 p-2 rounded-xl border border-slate-150">
                            <span className="text-slate-400 block uppercase text-[7.5px] font-black leading-tight mb-0.5">Office Target</span>
                            <span className="font-extrabold text-slate-700 block">Lat: {Number(scanResultText.targetLat).toFixed(6)}</span>
                            <span className="font-extrabold text-slate-700 block">Lon: {Number(scanResultText.targetLon).toFixed(6)}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center text-[9px] leading-tight font-sans">
                          <div>Distance: <strong className={scanResultText.distanceMeters! <= (scanResultText.targetRadius! + 15) ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>{Number(scanResultText.distanceMeters).toFixed(1)} meters</strong></div>
                          <div>Fence Limit: <strong className="text-slate-700 font-extrabold">{scanResultText.targetRadius} meters</strong></div>
                        </div>
                      </div>
                    )}
                    
                    <div className="border-t border-slate-200/60 pt-2.5 mt-2 flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
                      <div>Employee: <strong className="text-slate-700 font-sans">{currentUser.fullName}</strong></div>
                      <div>Phone ID: <strong className="text-slate-700">{currentUser.phoneNumber}</strong></div>
                      <div>Device Lock ID: <strong className="text-slate-700">Verified System Node</strong></div>
                    </div>
                  </div>
                </>
              )}

              {/* Countdown Message */}
              <div className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-1">
                <p className="text-[9.5px] font-bold text-indigo-800 flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  Redirecting to History Desk in {formattedMinutes}:{formattedSecs}
                </p>
                <p className="text-[8px] text-indigo-600">
                  You are being securely redirected to your permanent attendance logs records.
                </p>
              </div>

              {/* Interactive buttons */}
              <button
                onClick={handleDismissOverlay}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-[10.5px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Go to Attendance Desk Now ➔
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto px-1 py-2 animate-fade-in" id="attendance_management_block">
      
      {feedbackMessage && (
        <div className={`p-3.5 rounded-2xl border text-[10px] uppercase tracking-wider font-extrabold flex items-center justify-between animate-fade-in ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="font-extrabold text-[12.5px] opacity-65 hover:opacity-100 px-2 select-none cursor-pointer">✕</button>
        </div>
      )}

      {/* Dynamic Header Block with Sub-Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-3xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1.5 font-sans">
              <QrCode className="w-4 h-4 text-[#8B5CF6]" />
              Employee Attendance Desk
            </h2>
            <p className="text-[10.5px] text-slate-500 font-medium">
              Configure office boundaries, verify credentials via geofenced coordinates, and manage leaves.
            </p>
          </div>

          {/* Quick User Identity Card */}
          <div className="p-1 px-3 bg-violet-50/50 border border-violet-100 rounded-xl leading-tight text-center md:text-right select-none">
            <span className="text-slate-450 block text-[8px] uppercase tracking-wider font-extrabold">Active Operator</span>
            <span className="font-extrabold text-slate-800 text-[10.5px] font-mono whitespace-nowrap block mt-0.5">
              {currentUser.fullName} ({currentUser.businessRole || currentUser.customRole || (isZewdneh ? 'System Owner' : currentUser.role.toUpperCase())})
            </span>
          </div>
        </div>

        {/* Modular Sidebar or top tab sub bar */}
        <div className="flex gap-1.5 pt-3 overflow-x-auto select-none no-scrollbar">
          {filteredTabs.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setScanResultText(null);
                setLeaveActionSuccess('');
                setLeaveActionError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* RENDER ACTIVE TAB COMPONENT CONTENT */}
      <div className="w-full">
        
        {/* NEW DEVICE ALERT PROMINENT BANNER FOR ADMINISTRATORS */}
        {isAdminOrSuper && (() => {
          const pendingDeviceUsers = users.filter(u => u.deviceSignature && u.deviceApproved === false);
          if (pendingDeviceUsers.length === 0) return null;
          return (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-left leading-tight">
                  <strong className="text-xs font-black text-amber-900 block uppercase tracking-wide">⚠️ NEW DEVICE ALERT REGISTERED</strong>
                  <span className="text-[10.5px] text-amber-700 block font-medium mt-0.5">
                    The following staff members logged in from unapproved/new device footprint signatures: <span className="font-extrabold text-[#78350F]">{pendingDeviceUsers.map(u => u.fullName).join(', ')}</span>. Their attendance logs will stay locked as 'New Device Pending Approval' until you white-list them.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('exceptions')}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black uppercase rounded-xl transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto"
              >
                Go Approve Now
              </button>
            </div>
          );
        })()}
        
        {/* TAB 1: CHECK IN SCANNING CONTROL PANEL */}
        {activeTab === 'checkin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left Box showing scan simulation screen & camera launcher */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-150 p-6 shadow-3xs space-y-6">
              
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  Clock-In Scan Simulation Node
                </h3>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[9px] font-black rounded uppercase">
                  READY
                </span>
              </div>

              {/* GPS Settings configuration for evaluation bypass */}
              {isAdminOrSuper ? (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 space-y-3" id="sandbox_bypass_control_element">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-extrabold text-slate-800 block">Geolocation Sandbox Mode</span>
                      <span className="text-[9px] text-slate-500 block">Required for clean simulator verification inside cloud containers</span>
                    </div>
                    <button
                      onClick={() => setUseMockLocation(!useMockLocation)}
                      className={`px-2 py-1 rounded text-[9.5px] font-bold font-mono uppercase cursor-pointer ${
                        useMockLocation ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-205 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {useMockLocation ? 'BYPASS ACTIVE' : 'REAL DEVICE'}
                    </button>
                  </div>

                  {useMockLocation && (
                    <div className="p-2 bg-white rounded-xl border border-slate-150 flex items-center justify-between gap-3 animate-fade-in text-[10px]" id="sandbox_stance_distance_switch">
                      <span className="text-slate-500 font-medium">Position stance to reference:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setMockGPSDistance('inside')}
                          className={`px-2 py-1 rounded-md cursor-pointer transition-all ${
                            mockGPSDistance === 'inside' ? 'bg-emerald-500 text-white font-bold' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          Inside (1.2 meters)
                        </button>
                        <button
                          onClick={() => setMockGPSDistance('outside')}
                          className={`px-2 py-1 rounded-md cursor-pointer transition-all ${
                            mockGPSDistance === 'outside' ? 'bg-rose-500 text-white font-bold' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          Outside (45 meters)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3 text-left" id="employee_gps_locked_banner">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-indigo-950 block uppercase tracking-wide">🔒 Office GPS Geofence Locked</span>
                    <span className="text-[9px] text-indigo-700/80 block leading-tight font-sans font-medium">
                      Attendance requires physical presence in the workspace. Your device coordinates are fully validated against the calibrated desk radius.
                    </span>
                  </div>
                </div>
              )}

              {/* Main Simulated Trigger Box */}
              <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-center text-white relative overflow-hidden flex flex-col justify-center items-center gap-5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <span className="text-[9px] px-3 py-1 bg-violet-500/15 border border-violet-500/30 font-extrabold uppercase rounded-full text-slate-350 tracking-wider flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-450 bg-violet-400" />
                  Primary Dispatch Terminal Console
                </span>

                {/* Live digital desktop clock */}
                <div className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-mono font-black text-slate-100 tracking-widest pl-1">
                    {eatLive.timeStr}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest font-sans">
                    {new Intl.DateTimeFormat('en-US', {
                      timeZone: 'Africa/Nairobi',
                      weekday: 'long',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }).format(new Date())}
                  </div>
                </div>

                {/* Device Profile Trust Level */}
                <div className="w-full max-w-md p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Device Signature Audit</span>
                    <span className="font-mono text-[9px] text-[#C4B5FD] font-semibold">{getDeviceSignature()}</span>
                  </div>
                  
                  {(() => {
                    const dbUser = users.find(u => u.phoneNumber === currentUser.phoneNumber) || currentUser;
                    if (!dbUser.deviceSignature) {
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold leading-normal">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          First Attendance Pending (Your device profile will bind on click).
                        </div>
                      );
                    } else if (dbUser.deviceSignature === getDeviceSignature()) {
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold leading-normal">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Authenticated: Underwriting Secure primary signature bound.
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold leading-normal">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                          Fingerprint mismatch: logged as "New Device Pending Approval".
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Primary Tactile Session Check-In Buttons */}
                <div className="w-full max-w-md space-y-2 mt-2">
                  {eatLive.hours < 8 && (
                    <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-[10.5px] text-rose-300 font-bold leading-normal">
                      Attendance has not opened yet. Morning attendance starts at 08:00.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCheckIn('Morning')}
                      disabled={scanning || gpsLoading || eatLive.dayOfWeek === 0 || hasMorningCheckIn || eatLive.hours < 8}
                      className="py-3 px-4 bg-gradient-to-r from-[#8B5CF6] to-violet-600 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                    >
                      {gpsLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      {hasMorningCheckIn ? "✅ Morning Clocked In" : "🌞 Morning check-in"}
                    </button>

                    <button
                      onClick={() => handleCheckIn('Afternoon')}
                      disabled={scanning || gpsLoading || eatLive.dayOfWeek === 0 || eatLive.dayOfWeek === 6 || hasAfternoonCheckIn || eatLive.hours < 8}
                      className={`py-3 px-4 ${
                        eatLive.dayOfWeek === 6 
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50' 
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                      } disabled:opacity-50 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs`}
                      title={eatLive.dayOfWeek === 6 ? "Saturday does not support Afternoon checkout scans" : "Afternoon Checkout Check-in"}
                    >
                      {gpsLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-slate-200" />
                      )}
                      {hasAfternoonCheckIn ? "✅ Afternoon Clocked In" : "🌇 Afternoon Session"}
                    </button>
                  </div>

                  {eatLive.dayOfWeek === 0 && (
                    <div className="text-[10px] text-rose-400 font-extrabold uppercase">
                      Sunday Off-Duty Administrative Block Active
                    </div>
                  )}
                  {eatLive.dayOfWeek === 6 && (
                    <div className="text-[10px] text-amber-400 font-extrabold uppercase">
                      Saturdays Morning Session Only (Afternoon Closed)
                    </div>
                  )}

                  {/* Development sandbox overrides */}
                  {isAdminOrSuper && (
                    <div className="flex gap-1 bg-white/5 border border-white/10 p-1.5 rounded-xl justify-center mt-3">
                      <span className="text-[9px] text-slate-400 font-mono font-bold uppercase self-center mr-1">Admin Sand:</span>
                      <button
                        onClick={() => handleCheckIn('Morning')}
                        title="Force Clock-in in Morning window"
                        className="p-1.5 px-2.5 bg-violet-950 hover:bg-violet-900 rounded-lg text-[9px] font-mono font-bold text-[#C4B5FD]"
                      >
                        Force AM Check-in
                      </button>
                      <button
                        onClick={() => handleCheckIn('Afternoon')}
                        title="Force Clock-in in Afternoon window"
                        className="p-1.5 px-2.5 bg-emerald-950 hover:bg-emerald-900 rounded-lg text-[9px] font-mono font-bold text-emerald-400"
                      >
                        Force PM Check-in
                      </button>
                    </div>
                  )}
                </div>

                {/* Scan Outcomes Indicator */}
                {scanResultText && (
                  <div className="max-w-md w-full space-y-2">
                    {scanResultText.record ? (
                      /* Beautiful High-Contrast Full Featured Large Confirmation Card */
                      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 text-left space-y-4 shadow-xl">
                        <div className="text-center border-b border-slate-800 pb-4">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 animate-bounce" />
                          <h4 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                            Attendance Recorded Successfully
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-1 text-xs font-sans">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Employee Name</span>
                            <span className="font-bold text-white text-xs block truncate">{scanResultText.record.employeeName}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Role</span>
                            <span className="font-bold text-white text-xs block truncate">{scanResultText.record.employeeRole}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Date</span>
                            <span className="font-mono text-white text-xs block">{scanResultText.record.date}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Time</span>
                            <span className="font-mono text-white text-xs block">{scanResultText.record.time}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Attendance Type</span>
                            <span className="font-bold text-white text-xs block">{scanResultText.record.attendanceType} Session</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">GPS Distance</span>
                            <span className="font-bold text-white text-xs block">{scanResultText.record.gpsCoordinates?.distanceText || '0.0m'}</span>
                          </div>
                          <div className="col-span-2 border-t border-slate-800 pt-3">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Device Name</span>
                            <span className="font-mono text-slate-300 text-[10px] break-all block">
                              {scanResultText.record.deviceInformation}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`mt-3 p-3.5 rounded-2xl text-center border font-sans ${
                          scanResultText.record.status === 'Present' || scanResultText.record.status === 'Afternoon Present'
                            ? 'bg-emerald-950/80 border-emerald-500/20 text-emerald-300'
                            : scanResultText.record.status === 'Late' || scanResultText.record.status === 'Afternoon Late'
                              ? 'bg-amber-950/80 border-amber-500/20 text-amber-300'
                              : 'bg-rose-950/80 border-rose-500/20 text-rose-300'
                        }`}>
                          <span className="text-[10px] uppercase tracking-widest font-black block">Recorded Status</span>
                          <span className="text-base font-black tracking-tight block mt-0.5 uppercase">
                            {scanResultText.record.status.toUpperCase()}
                          </span>
                          {scanResultText.record.managerReviewRequired && (
                            <span className="text-[9px] font-extrabold text-rose-450 text-rose-400 uppercase tracking-wide block mt-1 animate-pulse">
                              ⚠️ Manager Review Required
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`mt-2 p-3.5 rounded-2xl border text-[10.5px] leading-relaxed w-full animate-fade-in flex gap-2.5 text-left ${
                          scanResultText.status === 'success'
                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400'
                            : scanResultText.status === 'already_present'
                              ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400'
                              : scanResultText.status === 'warning'
                                ? 'bg-amber-950/40 border-amber-500/20 text-[#F59E0B]'
                                : 'bg-rose-950/40 border-rose-500/20 text-rose-400'
                        }`}>
                          {scanResultText.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : scanResultText.status === 'already_present' ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          ) : scanResultText.status === 'warning' ? (
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="font-extrabold leading-normal">{scanResultText.message}</span>
                        </div>

                        {scanResultText.userLat !== undefined && scanResultText.targetLat !== undefined && (
                          <div className="p-3.5 bg-slate-800/80 border border-slate-705/50 rounded-2xl text-[10px] space-y-2 font-mono w-full animate-fade-in text-slate-300">
                            <div className="flex items-center gap-1.5 text-violet-400 font-extrabold uppercase text-[8.5px] tracking-wider">
                              <MapPin className="w-3.5 h-3.5 text-violet-400" />
                              📡 High-Precision Geofence Diagnosis
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-[9.5px]">
                              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                                <span className="text-slate-400 block uppercase text-[7.5px] font-black leading-tight mb-1">Detected Coordinates</span>
                                <span className="font-extrabold text-white block">Lat: {Number(scanResultText.userLat).toFixed(6)}</span>
                                <span className="font-extrabold text-white block">Lon: {Number(scanResultText.userLon).toFixed(6)}</span>
                              </div>
                              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                                <span className="text-slate-400 block uppercase text-[7.5px] font-black leading-tight mb-1">Office Center Target</span>
                                <span className="font-extrabold text-white block">Lat: {Number(scanResultText.targetLat).toFixed(6)}</span>
                                <span className="font-extrabold text-white block">Lon: {Number(scanResultText.targetLon).toFixed(6)}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center text-[9.5px] leading-tight">
                              <div>Distance: <strong className={scanResultText.distanceMeters! <= (scanResultText.targetRadius! + 15) ? "text-emerald-400 font-extrabold" : "text-rose-400 font-extrabold"}>{Number(scanResultText.distanceMeters).toFixed(1)} meters</strong></div>
                              <div>Fence Limit: <strong className="text-slate-200 font-extrabold">{scanResultText.targetRadius} meters</strong></div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Right block showing scanning conditions and constraints checklist */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                Scanning Compliance Rules
              </h3>

              <div className="space-y-4 text-[10px] leading-relaxed text-slate-550 text-slate-500">
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[#8B5CF6] font-bold text-[8.5px]">1</div>
                  <p>Check-in scanner checks that you are inside the designated <strong>10 meters geofence radius</strong> from the office center point coordinate.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[#8B5CF6] font-bold text-[8.5px]">2</div>
                  <p><strong>Standard Morning window</strong>: 08:00 to 08:40 marks you <strong>"Present"</strong>. After 08:40, clock-ins register as <strong>"Late"</strong> (Late Comer with distinct alarm warning).</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[#8B5CF6] font-bold text-[8.5px]">3</div>
                  <p><strong>Standard Afternoon window</strong>: 12:00 to 14:30 marks you <strong>"Afternoon Present"</strong>. After 14:30, registers as <strong>"Afternoon Late"</strong>.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-[#8B5CF6]/15 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[#8B5CF6] font-bold text-[8.5px]">4</div>
                  <p><strong>Absolute limits</strong>: Morning scans close at 12:00. Lack of check-in triggers automated marks as <strong>"Absent"</strong>.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY PERSONAL ATTENDANCE LOGS */}
        {activeTab === 'my_record' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left box containing history of scan log cards */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                My Check-In History
              </h3>

              {records.filter(r => r.phoneNumber === currentUser.phoneNumber).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-[10.5px] space-y-2">
                  <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
                  <p>You have no attendance records logged in the database yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-450 border-b border-slate-155 text-[8.5px] uppercase tracking-wider font-extrabold font-mono header-font">
                        <th className="p-2">Date</th>
                        <th className="p-2">Check-in Type</th>
                        <th className="p-2">Swipe Time</th>
                        <th className="p-2">GPS Coordinates</th>
                        <th className="p-2">Fencing</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records
                        .filter(r => r.phoneNumber === currentUser.phoneNumber)
                        .map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-2 text-slate-800 font-extrabold">{r.date}</td>
                            <td className="p-2 text-slate-600 uppercase font-bold">{r.attendanceType}</td>
                            <td className="p-2 text-slate-500 font-mono font-bold">{r.time}</td>
                            <td className="p-2 text-slate-450 font-mono">{r.gpsCoordinates?.latitude?.toFixed(5) || 'N/A'}, {r.gpsCoordinates?.longitude?.toFixed(5) || 'N/A'}</td>
                            <td className="p-2 text-slate-500 font-mono font-bold">{r.gpsCoordinates?.distanceText || '0m'}</td>
                            <td className="p-2">
                              <span className={`inline-block text-[8px] px-1.5 py-0.2 rounded font-black uppercase ${
                                r.status === 'Present' || r.status === 'Afternoon Present'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-150'
                                  : r.status === 'Late' || r.status === 'Afternoon Late'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-150'
                                    : 'bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right box showing streaks and count metric cubes */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-[#8B5CF6] uppercase tracking-wider border-b border-slate-100 pb-2">
                My Attendance Summary
              </h3>

              {(() => {
                const myRecs = records.filter(r => r.phoneNumber === currentUser.phoneNumber);
                const presents = myRecs.filter(r => r.status === 'Present' || r.status === 'Afternoon Present').length;
                const lates = myRecs.filter(r => r.status === 'Late' || r.status === 'Afternoon Late').length;
                const permissions = myRecs.filter(r => r.status === 'Permission' || r.status === 'Emergency Leave' || r.status === 'Field Work').length;

                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl leading-none">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Puj Punctuality</span>
                      <strong className="text-xl font-mono text-slate-800 font-bold">{presents} / {myRecs.length}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl leading-none">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lates Scanned</span>
                      <strong className="text-xl font-mono text-amber-650 font-bold text-amber-600">{lates}</strong>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl leading-none">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Approved Leaves</span>
                      <strong className="text-xl font-mono text-indigo-600 font-bold">{permissions}</strong>
                    </div>
                    <div className="p-3 bg-violet-50/50 border border-violet-100 rounded-2xl leading-none">
                      <span className="text-[8px] font-black text-[#8B5CF6] uppercase tracking-widest block mb-1">Total Logs</span>
                      <strong className="text-xl font-mono text-[#8B5CF6] font-bold">{myRecs.length}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 3: LEAVE APPLICATIONS AND APPROVAL DESK */}
        {activeTab === 'leave_requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Form Column (5 cols): Apply block */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Apply for Leave / Permission
              </h3>

              {leaveActionSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-[10px] font-bold">
                  {leaveActionSuccess}
                </div>
              )}

              {leaveActionError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 text-[10px] font-bold">
                  [Error] {leaveActionError}
                </div>
              )}

              <form onSubmit={handleLeaveSubmit} className="space-y-4 text-[10px]">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Leave Request Type</label>
                  <select
                    value={leaveType}
                    onChange={(e: any) => setLeaveType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="Permission">Permission</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Field Work">Field Work</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Leave Date</label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>

                {leaveType === 'Field Work' && (
                  <div className="space-y-3.5 animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Work Assignment Destination</label>
                      <input
                        type="text"
                        placeholder="e.g. Merkato Branch, Bole Subcity site..."
                        value={fieldDestination}
                        onChange={(e) => setFieldDestination(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Expected Return Time (Same Day)</label>
                      <input
                        type="text"
                        placeholder="e.g. 15:30, or End of Shift"
                        value={fieldReturnTime}
                        onChange={(e) => setFieldReturnTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Reason / Remarks / Contact Notes</label>
                  <textarea
                    required
                    placeholder="Provide specific notes detailing the core purpose or emergency details..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 h-20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10.5px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  SUBMIT LEAVE REQUEST
                </button>
              </form>
            </div>

            {/* Approvals Loop Column (7 cols): Only visible or reviewable by Admin / Super Admin */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                {isAdminOrSuper ? 'Staff Leave Registries & Approvals' : 'My Leaves Submission Status'}
              </h3>

              {(() => {
                const list = isAdminOrSuper 
                  ? leaveRequests 
                  : leaveRequests.filter(r => r.phoneNumber === currentUser.phoneNumber);

                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-[10.5px] space-y-2 font-bold">
                      <FileText className="w-6 h-6 text-slate-300 mx-auto" />
                      <p>No active leave requests found on the registry records.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 no-scrollbar-container">
                    {list.map((req) => (
                      <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-[10px] space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-extrabold text-slate-800 block">{req.employeeName}</span>
                            <span className="text-[9px] text-[#8B5CF6] font-bold uppercase block h-3 leading-none mt-1">
                              {req.employeeRole} • Phone: {req.phoneNumber}
                            </span>
                          </div>
                          
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                            req.status === 'Pending' 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : req.status === 'Approved' 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-150 text-[10px] text-slate-600 block mt-1.5 leading-relaxed">
                          <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5 font-bold">
                            <span className="text-slate-500 font-mono text-[9px]">TYPE: {req.type.toUpperCase()}</span>
                            <span className="text-slate-800">LEAVE DATE: {req.date}</span>
                          </div>
                          <p className="text-slate-700 italic font-medium">"{req.reason}"</p>

                          {req.type === 'Field Work' && (
                            <div className="mt-2 pt-1.5 border-t border-slate-100 flex justify-between text-slate-500 text-[9px] font-mono select-none leading-none">
                              <span>DEST: <strong className="text-slate-700">{req.destination}</strong></span>
                              <span>RETURN: <strong className="text-slate-700">{req.expectedReturnTime}</strong></span>
                            </div>
                          )}
                        </div>

                        {req.status === 'Pending' && isAdminOrSuper && (
                          <div className="flex gap-2 justify-end pt-1.5 border-t border-dotted border-slate-200">
                            {/* Protection: Aman cannot review Super Admin leaves */}
                            {!(req.phoneNumber.toLowerCase().includes('zewd') && !isZewdneh) ? (
                              <>
                                <button
                                  onClick={() => handleLeaveReview(req.id, 'Approved')}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold rounded-lg cursor-pointer"
                                >
                                  REDEEM APPROVE
                                </button>
                                <button
                                  onClick={() => handleLeaveReview(req.id, 'Rejected')}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-extrabold rounded-lg cursor-pointer"
                                >
                                  REJECT
                                </button>
                              </>
                            ) : (
                              <span className="text-[9px] text-slate-400">Security: Super Admin Restricted</span>
                            )}
                          </div>
                        )}
                        
                        {req.status !== 'Pending' && req.reviewedBy && (
                          <div className="text-right text-[8.5px] font-mono text-slate-400 uppercase tracking-tight block">
                            Reviewed by: <strong className="text-slate-600">{req.reviewedBy}</strong>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB: ATTENDANCE CORRECTIONS CENTER */}
        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Form Column (5 cols): Apply block */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4 text-[10px]">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Submit Attendance Correction
              </h3>

              {correctionSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-[10px] font-bold">
                  {correctionSuccess}
                </div>
              )}

              {correctionError && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 text-[10px] font-bold">
                  [Error] {correctionError}
                </div>
              )}

              <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Target Date to Correct</label>
                  <input
                    type="date"
                    required
                    value={correctionDate}
                    onChange={(e) => setCorrectionDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Manual Correction Justification / Details</label>
                  <textarea
                    required
                    rows={4}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Provide full description of why your swipe was missed, clock spoof detected, or device approval failed. Include details such as work trips, device swaps, etc."
                    className="w-full p-2.5 rounded-xl border border-slate-200 placeholder-slate-400 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                >
                  <Send className="w-3.5 h-3.5" />
                  SUBMIT CORRECTION REQUEST
                </button>
              </form>
            </div>

            {/* List Column (7 cols): Corrections log / Admin control */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4 text-[10px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  {isAdminOrSuper ? 'Operator Adjustment Requests' : 'My Security Audits & Corrections'}
                </h3>
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 text-[8px] font-black rounded-md font-mono">
                  {isAdminOrSuper 
                    ? correctionRequests.length 
                    : correctionRequests.filter(r => r.employeePhone === currentUser.phoneNumber).length
                  } TOTAL
                </span>
              </div>

              {(() => {
                const list = isAdminOrSuper
                  ? correctionRequests
                  : correctionRequests.filter(r => r.employeePhone === currentUser.phoneNumber);

                if (list.length === 0) {
                  return (
                    <div className="p-12 text-center text-slate-400 text-[10.5px] border border-dashed border-slate-200 rounded-2xl">
                      No correction logs registered in this system ledger.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                    {list.map((req) => (
                      <div 
                        key={req.id} 
                        className={`p-3.5 border rounded-2xl space-y-2 relative transition-all ${
                          req.status === 'Approved'
                            ? 'bg-emerald-50/20 border-emerald-150'
                            : req.status === 'Rejected'
                              ? 'bg-rose-50/20 border-rose-150'
                              : 'bg-amber-50/20 border-amber-150'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div>
                            <strong className="text-[11px] font-extrabold text-slate-800">{req.employeeName}</strong>
                            <span className="text-[8.5px] text-slate-500 block font-mono">Date to Adjust: <strong className="text-slate-800">{req.date}</strong></span>
                            <span className="text-[8.5px] text-slate-400 block font-mono mt-0.5">Submitted: {new Date(req.requestedAt).toLocaleString()}</span>
                          </div>

                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            req.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-250'
                              : req.status === 'Rejected'
                                ? 'bg-rose-50 text-rose-800 border-rose-250'
                                : 'bg-amber-50 text-amber-800 border-amber-250'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="bg-white/60 p-2.5 rounded-lg border border-slate-100/80 font-medium text-slate-700">
                          <div className="text-[7.5px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Justification rationale</div>
                          {req.reason}
                        </div>

                        {req.adminNotes && (
                          <div className="bg-slate-50/85 p-2 rounded-lg border border-slate-200/50 text-slate-600 font-medium">
                            <span className="text-[7px] text-[#8B5CF6] uppercase font-black tracking-wider block">Admin Auditor Notes</span>
                            {req.adminNotes}
                          </div>
                        )}

                        {req.status === 'Pending' && isAdminOrSuper && (
                          <div className="pt-2 border-t border-slate-100/30 flex gap-2 justify-end items-center">
                            <button
                              onClick={() => {
                                const notes = window.prompt("Enter approval audit notes:", "Verified with manager audit ledger") || "Verified with manager audit ledger";
                                handleCorrectionReview(req.id, 'Approved', notes);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg cursor-pointer text-[9px] shadow-2xs"
                            >
                              APPROVE
                            </button>
                            <button
                              onClick={() => {
                                const notes = window.prompt("Enter rejection audit notes:", "Insufficient geotag validation details") || "Insufficient geotag validation details";
                                handleCorrectionReview(req.id, 'Rejected', notes);
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg cursor-pointer text-[9px] shadow-2xs"
                            >
                              REJECT
                            </button>
                          </div>
                        )}

                        {req.status !== 'Pending' && req.approvedBy && (
                          <div className="text-right text-[8.5px] font-mono text-slate-400 uppercase tracking-tight block">
                            Audited by: <strong className="text-slate-600">{req.approvedBy}</strong> {req.approvedAt ? `on ${new Date(req.approvedAt).toLocaleDateString()}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB: MY INDIVIDUAL PROFILE SETTINGS */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in text-[10px]">
            {/* Left box showing user metadata card */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-150 p-6 shadow-3xs space-y-5 text-left">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 bg-[#8B5CF6]/10 text-[#8B5CF6] font-black rounded-full flex items-center justify-center text-lg uppercase select-none shadow-3xs shrink-0">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="text-[12px] font-black text-slate-850 block leading-tight">{currentUser.fullName}</h4>
                  <span className="text-[9px] text-[#8B5CF6] font-bold block mt-0.5 uppercase tracking-wide leading-none">{currentUser.customRole || currentUser.role}</span>
                </div>
              </div>

              <div className="space-y-3.5">
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Security Account Credentials</span>
                
                <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl space-y-2.5 font-sans text-slate-600">
                  <div>
                    <span className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider block leading-none mb-0.5">Contact Method (Username):</span>
                    <strong className="text-slate-800 text-[10.5px] font-mono leading-none">{currentUser.phoneNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider block leading-none mb-0.5">Assigned Shift Authority:</span>
                    <strong className="text-slate-800 text-[10.5px] leading-none">{currentUser.customRole || currentUser.role === 'admin' ? 'Administrative Supervisor' : 'Standard Workstation Operator'}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider block leading-none mb-0.5">Registered Device Fingerprint:</span>
                    <strong className="text-slate-800 text-[9.5px] font-mono leading-normal pr-1 block bg-white border border-slate-150 p-1 px-1 rounded truncate mt-0.5">
                      {(() => {
                        const dbUser = users.find(u => u.phoneNumber === currentUser.phoneNumber) || currentUser;
                        return dbUser.deviceSignature || 'No primary device bound yet';
                      })()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Biometric Face Profile Widget */}
              <div className="border-t border-slate-100 pt-5 space-y-3.5 mt-5">
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Biometric Reference Face</span>
                
                {(() => {
                  const dbUser = users.find(u => u.phoneNumber === currentUser.phoneNumber) || currentUser;
                  return (
                    <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl text-slate-600 flex flex-col items-center gap-3">
                      {dbUser.registeredSelfieUrl ? (
                        <div className="relative group w-24 h-24 rounded-2xl overflow-hidden border-2 border-violet-500/40 cursor-pointer shadow-3xs hover:scale-105 transition-all">
                          <img
                            src={dbUser.registeredSelfieUrl}
                            alt="Registered Reference Face"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8.5px] text-white font-extrabold uppercase">Update</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1.5 text-center p-2 text-slate-450">
                          <Camera className="w-5 h-5 text-slate-400" />
                          <span className="text-[8px] font-bold leading-tight uppercase">Unregistered Biometric Identity</span>
                        </div>
                      )}

                      <div className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          dbUser.registeredSelfieUrl ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-250'
                        }`}>
                          {dbUser.registeredSelfieUrl ? '✅ Face Profile Bound' : '⚠️ Biometrics Required'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFaceRegError(null);
                          setFaceRegSuccess(null);
                          setCapturedRegBase64(null);
                          setShowFaceRegModal(true);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[8.5px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-3xs"
                      >
                        {dbUser.registeredSelfieUrl ? 'Update Biometric Image' : 'Register Reference Face'}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right box containing security update form */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-6 shadow-3xs space-y-4 text-left">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                🔒 Security & Password Update
              </h3>

              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 font-bold leading-normal">
                  {profileSuccess}
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 font-bold leading-normal">
                  [Error] {profileError}
                </div>
              )}

              <form onSubmit={handleProfilePasswordChange} className="space-y-4 font-sans font-semibold text-slate-705 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block">Current Password</label>
                  <input
                    type="password"
                    value={profileCurrentPassword}
                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                    placeholder="Enter today's active verification key"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white placeholder-slate-350"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block">New Password</label>
                  <input
                    type="password"
                    value={profileNewPassword}
                    onChange={(e) => setProfileNewPassword(e.target.value)}
                    placeholder="Create a personalized secure passcode"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white placeholder-slate-350"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block">Confirm New Password</label>
                  <input
                    type="password"
                    value={profileConfirmPassword}
                    onChange={(e) => setProfileConfirmPassword(e.target.value)}
                    placeholder="Retype password to confirm parity"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white placeholder-slate-350"
                  />
                </div>

                <div className="pt-2 z-10 relative">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-3xs"
                  >
                    CHANGE PASSWORD KEY
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: OVERALL STATS & ANALYTICS DASHBOARD (Admin Only) */}
        {activeTab === 'dashboard' && isAdminOrSuper && (
          <div className="space-y-6 animate-fade-in text-[10px]">
            
            {/* Quick Metrics Grids */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-white border border-slate-150 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="p-3 bg-indigo-50 text-[#8B5CF6] rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Active Registry</span>
                  <strong className="text-lg font-mono text-slate-800 font-bold block mt-1 leading-none">{activeStaffCount} Staff</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-150 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Clocked Present</span>
                  <strong className="text-lg font-mono text-slate-800 font-bold block mt-1 leading-none">{presentsCount} Checked</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-150 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="p-3 bg-amber-50 text-amber-650 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Late Scandals</span>
                  <strong className="text-lg font-mono text-slate-800 font-bold block mt-1 leading-none">{latesCount} Records</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-150 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Absent (No Scan)</span>
                  <strong className="text-lg font-mono text-slate-800 font-bold block mt-1 leading-none">{absentsCount} Employees</strong>
                </div>
              </div>
            </div>

            {/* List Absentees lists & general historical ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Absentees Alert Block */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-3 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                    Pending Absentees Alerts Today
                  </h3>
                  
                  {absentsList.length === 0 ? (
                    <div className="py-6 text-center text-[10px] text-slate-450 italic font-bold">
                      100% compliance recorded. No missing staff registries.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 mt-2">
                      {absentsList.map(emp => (
                        <div key={emp.phoneNumber} className="py-2.5 flex items-center justify-between">
                          <div>
                            <strong className="text-[10px] text-slate-800 font-extrabold">{emp.fullName}</strong>
                            <span className="text-[8.5px] text-slate-450 block font-mono">ID: {emp.phoneNumber}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 rounded text-[8.5px] font-black text-rose-800">
                            ABSENT (PENDING)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-rose-100/10 border border-rose-500/15 rounded-xl text-[9px] text-rose-700 leading-normal mt-4">
                  * Absence alerts automatically populate for any staff workstation registry missing scan recordings by midday checkout intervals (12:00 PM).
                </div>
              </div>

              {/* Employee Punctuality Rankings */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-3">
                <h3 className="text-xs font-black text-[#8B5CF6] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Operator Punctuality Leaderboard
                </h3>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[220px] pr-1">
                  {ranks.map((entry, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-1.5 bg-slate-100 font-black text-[9px] text-slate-800 rounded font-mono">#{idx+1}</span>
                        <strong className="text-slate-800 font-extrabold">{entry.name}</strong>
                      </div>
                      <div className="flex gap-2 text-[9.5px] font-mono text-slate-500 font-bold select-none leading-none">
                        <span>P: <strong className="text-emerald-600">{entry.presentCount}</strong></span>
                        <span>L: <strong className="text-amber-600">{entry.lateCount}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Device Security & Activity Logger (Dual Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Device Authorized Fingerprints Panel */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    📱 Device Signature Audit & Security Registries
                  </h3>
                  <p className="text-[9px] text-slate-450 leading-tight block mt-0.5 font-medium leading-none">
                    Review locked hardware nodes, approve unrecognized browser profiles, or reset bindings to allow office PC replacements.
                  </p>
                </div>

                <div className="mb-3">
                  <input
                    type="text"
                    id="staff_search_input"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Search employee by Name, Phone number, or Employee ID..."
                    className="w-full p-2.5 text-[10px] border border-slate-200 focus:border-indigo-400 bg-white rounded-xl outline-none font-bold"
                  />
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[300px] pr-1">
                  {users
                    .filter(u => {
                      if (isExcludedUser(u.fullName, u.phoneNumber) || u.fullName.toLowerCase().includes('zewd') || u.phoneNumber.toLowerCase().includes('zewd')) {
                        return false;
                      }
                      if (!staffSearchQuery.trim()) return true;
                      const q = staffSearchQuery.toLowerCase().trim();
                      const matchName = u.fullName.toLowerCase().includes(q);
                      const matchPhone = u.phoneNumber.toLowerCase().includes(q);
                      const matchId = u.originalId?.toLowerCase().includes(q) || u.normalizedId?.toLowerCase().includes(q) || (u.phoneNumber === q);
                      return matchName || matchPhone || matchId;
                    })
                    .map((emp) => {
                      const hasBinding = !!emp.deviceSignature;
                      const isApproved = emp.deviceApproved === true;
                      
                      return (
                        <div key={emp.phoneNumber} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[10px]">
                          <div className="text-left space-y-1">
                            <div>
                              <strong className="text-slate-850 font-extrabold text-[10.5px] block leading-none">{emp.fullName}</strong>
                              <span className="text-[8.5px] text-[#8B5CF6] font-bold block mt-1 uppercase tracking-wide leading-none">{emp.customRole || emp.role} • {emp.phoneNumber}</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 w-full">
                              {hasBinding ? (
                                <div className="space-y-1.5 w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8.5px] text-slate-600">
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">Device Type</span>
                                      <span className="font-extrabold text-slate-800">{getParsedDeviceInfo(emp).deviceType}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">Platform Client</span>
                                      <span className="font-extrabold text-slate-800 leading-none block mt-0.5">{getParsedDeviceInfo(emp).osName} ({getParsedDeviceInfo(emp).browserName})</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">IP Address</span>
                                      <span className="font-extrabold text-[#8B5CF6]">{getParsedDeviceInfo(emp).ip}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">Location</span>
                                      <span className="font-extrabold text-slate-800 leading-none block mt-0.5">{getParsedDeviceInfo(emp).location}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">First Seen</span>
                                      <span className="font-mono text-slate-500 font-bold">{getParsedDeviceInfo(emp).firstSeen}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">Last Seen Direct</span>
                                      <span className="font-mono text-slate-500 font-bold">{getParsedDeviceInfo(emp).lastSeen}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-slate-400 font-bold block uppercase text-[6.5px]">Security Fingerprint Hash</span>
                                      <span className="font-mono text-indigo-700 font-extrabold block text-[8px] break-all">{emp.deviceSignature}</span>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-slate-200/50 flex flex-col gap-1.5 align-middle">
                                    <div className="flex gap-2 items-center">
                                      {isApproved ? (
                                        <span className="text-[7.5px] bg-emerald-50 text-emerald-800 border border-emerald-150 rounded px-1.5 py-0.5 font-black uppercase leading-none">
                                          🛡️ Approved Trusted Device
                                        </span>
                                      ) : (
                                        <span className="text-[7.5px] bg-amber-50 text-amber-800 border border-amber-150 rounded px-1.5 py-0.5 font-black uppercase animate-pulse leading-none">
                                          ⚠️ Unapproved Pending Approval
                                        </span>
                                      )}
                                    </div>
                                    {isApproved && emp.deviceApprovedBy && (
                                      <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg font-medium text-[8px] text-slate-500 space-y-0.5 mt-1">
                                        <div className="text-[7px] text-[#8B5CF6] font-black uppercase tracking-wider">Verification Audit Trail</div>
                                        <div>Approved By: <strong className="text-slate-800">{emp.deviceApprovedBy}</strong></div>
                                        <div>Date: <strong className="text-slate-850 font-mono">{new Date(emp.deviceApprovedDate || '').toLocaleString()}</strong></div>
                                        <div>Reason: <span className="italic text-slate-700 font-semibold font-sans">"{emp.deviceApprovalReason || 'Admin Approved'}"</span></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[8.5px] text-slate-400 italic">
                                  📋 First attendance pending. Device signature will auto-generate first.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                            {hasBinding && !isApproved && (
                              <button
                                onClick={() => handleDeviceApprove(emp.phoneNumber)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9px] font-black uppercase tracking-wide rounded-lg cursor-pointer transform active:scale-95 transition-all text-[8.5px]"
                              >
                                Trust Device
                              </button>
                            )}
                            {hasBinding && (
                              <button
                                onClick={() => handleDeviceReset(emp.phoneNumber)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-800 text-[9px] font-black uppercase tracking-wide rounded-lg cursor-pointer transform active:scale-95 transition-all text-[8.5px]"
                                title="Reset bindings to allow registration from a different PC/browser"
                              >
                                Reset Binding
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Security Activity incidents & Logs Logger Panel */}
              <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <ShieldAlert className="w-4 h-4 text-indigo-500" />
                    🚨 Live Compliance Activity & Security Incident Audits
                  </h3>
                  <p className="text-[9px] text-slate-455 leading-tight block mt-0.5 font-medium leading-none">
                    Real-time network events, device signature validation outputs, coordinates, and credential alarms.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 overflow-y-auto max-h-[300px] pr-1 space-y-2 text-[9.5px]">
                  {activityLogs
                    .filter(log => log.details?.includes('Successfully clocked') || log.details?.includes('SECURITY') || log.action?.includes('fingerprint') || log.action?.includes('security'))
                    .slice(0, 35)
                    .map((log) => {
                      const isSecWarning = log.details?.includes('[SECURITY WARNING]');
                      return (
                        <div key={log.id} className={`py-2 p-2.5 rounded-xl border leading-relaxed text-left transition-all ${
                          isSecWarning 
                            ? 'bg-rose-50/70 border-rose-100/80 text-rose-950/90' 
                            : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}>
                          <div className="flex justify-between items-center mb-1 font-bold">
                            <span className={`px-1.5 py-0.2 rounded text-[7.5px] uppercase font-black tracking-wider ${
                              isSecWarning 
                                ? 'bg-rose-600 text-white' 
                                : 'bg-[#8B5CF6] text-white'
                            }`}>
                              {isSecWarning ? 'Security Alert' : 'Check-In Action'}
                            </span>
                            <span className="font-mono text-[8.5px] text-slate-400 font-semibold">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''} - {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : ''}</span>
                          </div>
                          
                          <p className={`font-medium ${isSecWarning ? 'font-bold' : ''}`}>
                            {log.details || log.action}
                          </p>
                          <div className="text-[8.5px] text-slate-400 font-bold block mt-1">
                            Operator: <span className="text-slate-650">{log.operatorName}</span>
                          </div>
                        </div>
                      );
                    })}

                  {activityLogs.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic">
                      Zero suspicious alerts logging recorded in database.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GPS Exception Registry Reports replaced with Master Attendance Records & Override Controls */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Calendar className="w-4 h-4 text-[#8B5CF6]" />
                    Master Attendance Records & Status Override Controls
                  </h3>
                  <p className="text-[9px] text-slate-455 text-slate-500 font-medium">
                    Adjust employee statuses, delete faulty logs, or manually add records when barcode/QR code scans did not occur.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-750 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowAddManualForm(!showAddManualForm)}
                    className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showAddManualForm ? 'Hide Form' : 'Manually Add Check-In'}
                  </button>
                </div>
              </div>

              {/* Manual Entry Form */}
              {showAddManualForm && (
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3 animate-fade-in text-[10px]">
                  <span className="text-[9px] font-black uppercase text-[#8B5CF6] tracking-wider block">Manual Clock-In Override</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {/* Employee select with searchable Autocomplete */}
                    <div className="space-y-1 relative" id="manual_employee_picker_parent">
                      <label className="text-[8px] uppercase font-black text-slate-450 tracking-wider">Employee</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={manualSearchText}
                          onChange={(e) => {
                            setManualSearchText(e.target.value);
                            setShowManualDropdown(true);
                            if (!e.target.value) {
                              setManualEmployeePhone('');
                            }
                          }}
                          onFocus={() => setShowManualDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowManualDropdown(false), 200);
                          }}
                          placeholder="Search staff Name or Phone..."
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                        />
                        {manualEmployeePhone && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualEmployeePhone('');
                              setManualSearchText('');
                              setShowManualDropdown(false);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full font-bold cursor-pointer transition-all flex items-center justify-center text-[10px] leading-none"
                            style={{ width: '16px', height: '16px' }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {showManualDropdown && (
                        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-[10px]">
                          {(() => {
                            const filtered = users.filter(u => {
                              if (isExcludedUser(u.fullName, u.phoneNumber) || u.fullName.toLowerCase().includes('zewd') || u.phoneNumber.toLowerCase().includes('zewd')) {
                                return false;
                              }
                              const term = manualSearchText.toLowerCase();
                              return u.fullName.toLowerCase().includes(term) || u.phoneNumber.includes(term);
                            });
                            if (filtered.length === 0) {
                              return <div className="p-2.5 text-slate-400 italic text-left">No matches found</div>;
                            }
                            return filtered.map(u => (
                              <button
                                type="button"
                                key={u.phoneNumber}
                                onClick={() => {
                                  setManualEmployeePhone(u.phoneNumber);
                                  setManualSearchText(u.fullName);
                                  setShowManualDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-all font-bold flex flex-col cursor-pointer border-none bg-transparent"
                              >
                                <span className="text-slate-800 text-[10px]">{u.fullName}</span>
                                <span className="text-[8px] text-[#8B5CF6] font-extrabold mt-0.5">{u.phoneNumber} • {u.customRole || u.role}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-black text-slate-450 tracking-wider">Date</label>
                      <input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono"
                      />
                    </div>

                    {/* Window selection */}
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-black text-slate-450 tracking-wider">Window Type</label>
                      <select
                        value={manualWindow}
                        onChange={(e: any) => setManualWindow(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="Morning">Morning (08:00)</option>
                        <option value="Afternoon">Afternoon (12:00)</option>
                      </select>
                    </div>

                    {/* Status selection */}
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-black text-slate-450 tracking-wider">Status</label>
                      <select
                        value={manualStatus}
                        onChange={(e: any) => setManualStatus(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Afternoon Present">Afternoon Present</option>
                        <option value="Afternoon Late">Afternoon Late</option>
                        <option value="Absent">Absent</option>
                        <option value="Permission">Permission</option>
                        <option value="Emergency Leave">Emergency Leave</option>
                        <option value="Field Work">Field Work</option>
                      </select>
                    </div>

                    {/* Trigger Button */}
                    <div className="flex items-end">
                      <button
                        onClick={handleManualRecordSubmit}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        SUBMIT RECORD
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {records.length === 0 ? (
                <div className="py-6 text-center text-slate-400 font-bold">
                  No attendance check-ins logged in database.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto no-scrollbar rounded-xl border border-slate-100">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-455 border-b border-slate-155 text-[8px] uppercase tracking-wider font-extrabold font-mono header-font">
                        <th className="p-2.5">Employee Name & Role</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Swipe Time & Type</th>
                        <th className="p-2.5">Geofence Compliance</th>
                        <th className="p-2.5">Dynamic Status (Change Status)</th>
                        <th className="p-2.5 text-right">Delete Log</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              {r.selfieImageUrl ? (
                                <div 
                                  onClick={() => setSelectedRecordForTelemetry(r)}
                                  title="Click to view verified selfie"
                                  className="w-7 h-7 rounded-md overflow-hidden border border-violet-200 cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xs flex-shrink-0"
                                >
                                  <img 
                                    src={r.selfieImageUrl} 
                                    alt="Selfie" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              ) : (
                                <div 
                                  className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[7.5px] text-slate-400 font-extrabold flex-shrink-0 border border-slate-205 leading-none"
                                  title="No selfie captured (e.g. Admin/Superadmin bypass or legacy)"
                                >
                                  N/A
                                </div>
                              )}
                              <div>
                                <strong className="font-extrabold text-slate-800 block leading-tight">{r.employeeName}</strong>
                                <span className="text-[8.5px] text-[#8B5CF6] font-bold block mt-0.5 uppercase tracking-wide leading-none">{r.employeeRole}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-600 font-mono font-medium">{r.date}</td>
                          <td className="p-2.5">
                            <span className="font-mono text-slate-500 font-bold">{r.time}</span>
                            <span className="text-slate-400 font-bold block text-[8px] mt-0.5 uppercase tracking-wider">{r.attendanceType}</span>
                          </td>
                          <td className="p-2.5">
                            <span 
                              onClick={() => setSelectedRecordForTelemetry(r)}
                              title="Click to view full security location & hardware biometrics telemetry card"
                              className={`inline-block text-[8px] px-1.5 py-0.2 rounded font-black uppercase cursor-pointer hover:scale-105 hover:underline transition-all active:scale-95 ${
                                r.gpsCoordinates?.isInside !== false
                                  ? 'bg-emerald-50/80 text-emerald-800 border border-emerald-150'
                                  : 'bg-rose-50/80 text-rose-800 border border-rose-150'
                              }`}
                            >
                              {r.gpsCoordinates?.isInside !== false ? `COMPLIANT (${r.gpsCoordinates?.distanceText || '0m'})` : `EXCEPTION (${r.gpsCoordinates?.distanceText || 'N/A'} OUTSIDE)`}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <select
                              value={r.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value as AttendanceStatus;
                                try {
                                  // Save updated status in record
                                  await dbService.saveAttendanceRecord({
                                    ...r,
                                    status: newStatus
                                  });

                                  // Check if we are approving a pending device signature
                                  const approvedStatuses: AttendanceStatus[] = [
                                    'Present', 'Late', 'Very Late', 'Afternoon Present', 'Afternoon Late'
                                  ];
                                  if (r.status === 'New Device Pending Approval' && approvedStatuses.includes(newStatus)) {
                                    if (r.deviceInformation) {
                                      const userDoc = await dbService.getUser(r.phoneNumber);
                                      const existingSigs = userDoc?.deviceSignature
                                        ? userDoc.deviceSignature.split(',').map((s: string) => s.trim()).filter(Boolean)
                                        : [];
                                      const newSig = r.deviceInformation;
                                      if (!existingSigs.includes(newSig)) {
                                        existingSigs.push(newSig);
                                      }
                                      await dbService.updateUser(r.phoneNumber, {
                                        deviceSignature: existingSigs.join(','),
                                        deviceApproved: true
                                      });
                                      showFeedback(`Automatically trusted & registered device signature for ${r.employeeName}!`);
                                    }
                                  }

                                  soundService.playSuccessChime();
                                } catch (err) {
                                  showFeedback('Database permission or update error.', 'error');
                                }
                              }}
                              className="p-1 px-2 border border-slate-200 hover:border-slate-350 rounded-lg text-[9px] bg-white font-extrabold text-slate-700 outline-none transition-all cursor-pointer"
                            >
                              <option value="Present">Morning Present</option>
                              <option value="Late">Late</option>
                              <option value="Very Late">Very Late</option>
                              <option value="Admin Approval Required">Admin Approval Required</option>
                              <option value="Afternoon Present">Afternoon Present</option>
                              <option value="Afternoon Late">Afternoon Late</option>
                              <option value="Afternoon Admin Approval Required">Afternoon Admin Approval Required</option>
                              <option value="New Device Pending Approval">New Device Pending Approval</option>
                              <option value="Absent">Absent</option>
                              <option value="Permission">Approved Leave</option>
                              <option value="Emergency Leave">Emergency Leave</option>
                              <option value="Field Work">Field Work</option>
                            </select>
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap">
                            {deletingRecordId === r.id ? (
                              <div className="flex items-center justify-end gap-1 select-none animate-fade-in">
                                <span className="text-[8px] font-black text-rose-600 uppercase bg-rose-50 px-1 rounded">Delete this?</span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await dbService.deleteAttendanceRecord(r.id);
                                      soundService.playSuccessChime();
                                      showFeedback(`Deleted record for ${r.employeeName}`);
                                    } catch (err) {
                                      showFeedback('Error deleting record.', 'error');
                                    } finally {
                                      setDeletingRecordId(null);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded text-[8.5px] uppercase cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingRecordId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-extrabold rounded text-[8.5px] uppercase cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingRecordId(r.id);
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="Delete attendance row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Row 3: Admin Password override & Account Recovery Panel */}
            <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-3xs space-y-4 text-left mt-6">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black text-indigo-750 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <KeyRound className="w-4 h-4 text-indigo-650" />
                  🔑 Administrative Password & Biometric Recovery Engine
                </h3>
                <p className="text-[9px] text-slate-450 leading-tight block mt-0.5 font-medium">
                  Perform secure, logged recovery actions on employee profiles. Sub-admin characters cannot alter Super-Admin profiles.
                </p>
              </div>

              {recoveryError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 font-bold rounded-xl animate-fade-in">
                  ⚠️ {recoveryError}
                </div>
              )}

              {recoverySuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold rounded-xl animate-fade-in">
                  ✨ {recoverySuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                {/* Employee select dropdown with searchable Autocomplete */}
                <div className="space-y-1 relative" id="recovery_employee_picker_parent">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Target Employee Profile</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={recoverySearchText}
                      onChange={(e) => {
                        setRecoverySearchText(e.target.value);
                        setShowRecoveryDropdown(true);
                        if (!e.target.value) {
                          setRecoveryUserPhone('');
                        }
                      }}
                      onFocus={() => setShowRecoveryDropdown(true)}
                      onBlur={() => {
                        setTimeout(() => setShowRecoveryDropdown(false), 200);
                      }}
                      placeholder="Search employee profile to recover..."
                      className="w-full p-2.5 border border-slate-200 focus:border-indigo-400 bg-white rounded-xl outline-none font-bold text-slate-705 font-sans"
                    />
                    {recoveryUserPhone && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryUserPhone('');
                          setRecoverySearchText('');
                          setShowRecoveryDropdown(false);
                          setRecoverySuccess(null);
                          setRecoveryError(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full font-bold cursor-pointer transition-all flex items-center justify-center text-[10px] leading-none"
                        style={{ width: '16px', height: '16px' }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {showRecoveryDropdown && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 text-[10px]">
                      {(() => {
                        const filtered = users.filter(u => {
                          const isZewdneh = u.phoneNumber === '0988286610' || u.fullName.toLowerCase().includes('zewdneh') || u.role === 'super_admin';
                          if (currentUser.role === 'admin' && isZewdneh) {
                            return false;
                          }
                          if (u.phoneNumber === currentUser.phoneNumber) {
                            return false;
                          }
                          const term = recoverySearchText.toLowerCase();
                          const roleStr = (u.customRole || u.role || '').toLowerCase();
                          return u.fullName.toLowerCase().includes(term) || u.phoneNumber.includes(term) || roleStr.includes(term);
                        });
                        if (filtered.length === 0) {
                          return <div className="p-2.5 text-slate-400 italic text-left">No matches found</div>;
                        }
                        return filtered.map(emp => (
                          <button
                            type="button"
                            key={emp.phoneNumber}
                            onClick={() => {
                              setRecoveryUserPhone(emp.phoneNumber);
                              setRecoverySearchText(emp.fullName);
                              setShowRecoveryDropdown(false);
                              setRecoverySuccess(null);
                              setRecoveryError(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-all font-bold flex flex-col cursor-pointer border-none bg-transparent"
                          >
                            <span className="text-slate-800 text-[10px]">{emp.fullName}</span>
                            <span className="text-[8px] text-[#8B5CF6] font-extrabold mt-0.5">{emp.phoneNumber} • {emp.customRole || emp.role}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* Password / key Input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider">New Password / Passcode</label>
                    <button
                      type="button"
                      onClick={() => {
                        const pass = Math.floor(1000 + Math.random() * 9000).toString();
                        setRecoveryPassword(pass);
                      }}
                      className="text-[7.5px] font-black text-indigo-600 hover:underline uppercase cursor-pointer"
                    >
                      Autogen Temp Password
                    </button>
                  </div>
                  <input
                    type="text"
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    placeholder="Enter 4+ digit numeric code or strong password"
                    className="w-full p-2.5 border border-slate-200 focus:border-indigo-400 bg-white rounded-xl outline-none font-bold text-slate-700 placeholder-slate-350"
                  />
                </div>

                {/* Submit Trigger Button */}
                <div>
                  <button
                    disabled={recoveryLoading}
                    onClick={handleExecuteSecurityRecovery}
                    className="w-full py-2.5 bg-gradient-to-r from-slate-800 to-slate-950 hover:from-indigo-700 hover:to-indigo-800 text-white font-black uppercase tracking-wider text-[9px] rounded-xl transform active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {recoveryLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 animate-pulse" />
                    )}
                    EXECUTE SECURITY RECOVERY RESET
                  </button>
                </div>
              </div>

              {/* Checkboxes & Recovery Parameters */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2 items-center text-[9px]">
                <label className="flex items-center gap-2 text-slate-705 font-extrabold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recoveryForceChange}
                    onChange={(e) => setRecoveryForceChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-opacity-40 cursor-pointer"
                  />
                  <span>🔄 Force Password Change on Next Login</span>
                </label>

                <label className="flex items-center gap-2 text-rose-800 font-extrabold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recoveryClearDevice}
                    onChange={(e) => setRecoveryClearDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-opacity-40 cursor-pointer"
                  />
                  <span>📱 Reset Device Security Binding</span>
                </label>

                <label className="flex items-center gap-2 text-rose-800 font-extrabold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recoveryClearFace}
                    onChange={(e) => setRecoveryClearFace(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-opacity-40 cursor-pointer"
                  />
                  <span>👤 Wipe Facial Profile Image Signature</span>
                </label>
              </div>

              {/* Audited Reason Box */}
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Administrative Justification / Reason (Saved in Secure Compliance Ledger)</label>
                <input
                  type="text"
                  value={recoveryReason}
                  onChange={(e) => setRecoveryReason(e.target.value)}
                  placeholder="e.g. Employee changed device due to hardware breakage / Password reset verified in-person"
                  className="w-full p-2.5 border border-slate-200 focus:border-indigo-400 bg-slate-50 rounded-xl outline-none font-medium text-slate-700 placeholder-slate-400"
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB: EXCEPTIONS CENTER */}
        {activeTab === 'exceptions' && isAdminOrSuper && (
          <div className="animate-fade-in">
            <AttendanceExceptionsView 
              currentUser={currentUser} 
              currentWorkspace={currentUser.workspace === 'second_round' ? 'second_round' : 'first_round'} 
            />
          </div>
        )}

        {/* TAB 5: OFFICE CONFIGURATION SETUPS */}
        {activeTab === 'settings' && isAdminOrSuper && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-[10px]">
            {/* Align coordinates manually and settings */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Configure Office GPS Center Point
              </h3>

              <p className="text-[10px] text-slate-500 leading-relaxed mb-2 font-medium">
                Lock system alignment coordinates dynamically using high-precision spatial positioning. Scan requests will validate that operators are within range of these set coordinates.
              </p>

              {gpsLoading && (
                <div className="p-3 bg-violet-50 text-[#8B5CF6] rounded-xl flex items-center gap-2 font-extrabold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Synchronizing high-precision device lock GPS coordinates...
                </div>
              )}

              {settings && (
                <div className="bg-slate-900 rounded-2xl p-4.5 text-white space-y-2.5 font-mono select-none">
                  <div className="flex justify-between border-b border-white/5 pb-2 leading-none">
                    <span className="text-slate-450 text-[9px] uppercase tracking-wider font-extrabold font-sans">Active Setup Lat</span>
                    <strong className="text-[#A78BFA] text-xs font-mono font-bold leading-none">{settings.latitude.toFixed(6)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2.5 leading-none mt-2.5">
                    <span className="text-slate-450 text-[9px] uppercase tracking-wider font-extrabold font-sans">Active Setup Lon</span>
                    <strong className="text-[#A78BFA] text-xs font-mono font-bold leading-none">{settings.longitude.toFixed(6)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2.5 leading-none mt-2.5">
                    <span className="text-slate-450 text-[9px] uppercase tracking-wider font-extrabold font-sans">Allowance Radius Threshold</span>
                    <strong className="text-emerald-400 text-xs font-mono font-bold leading-none">{settings.radius} meters</strong>
                  </div>
                  <div className="flex justify-between pt-1 text-[8.5px] uppercase font-sans text-slate-455 text-slate-450 leading-none">
                    <span>Admin calibrator:</span>
                    <strong>{settings.updatedBy}</strong>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Office Latitude Center</label>
                    <input
                      type="text"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="e.g. 9.0115"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Office Longitude Center</label>
                    <input
                      type="text"
                      value={manualLon}
                      onChange={(e) => setManualLon(e.target.value)}
                      placeholder="e.g. 38.7830"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider">Configure Fence Radius Threshold (meters)</label>
                  <input
                    type="number"
                    value={newRadius}
                    onChange={(e) => setNewRadius(parseInt(e.target.value) || 10)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSaveManualSettings}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    SAVE SPECIFIED COORDINATES
                  </button>
                  <button
                    onClick={handleSaveOfficeGPS}
                    className="flex-1 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4 text-violet-200" />
                    USE MY CURRENT POSITION
                  </button>
                </div>
              </div>
            </div>

            {/* Manage Chatbot Access Panel */}
            <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-[#8B5CF6]" />
                Staff Operations AI Chatting Access Control
              </h3>

              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                Turn the AI Chatting panel on or off for individual staff members. Revoking access directs standard employees to contact management.
              </p>

              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider border-b border-slate-150">
                      <th className="p-3">Staff Employee</th>
                      <th className="p-3 text-center">AI Chatting Privilege</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users
                      .filter(u => u.role !== 'admin' && !(u.fullName?.toLowerCase().includes('zewd') || u.phoneNumber?.toLowerCase().includes('zewd')))
                      .map((u) => {
                        const perm = officerPermissions.find(p => p.phoneNumber === u.phoneNumber);
                        const isChatbotEnabled = perm ? perm.assistantPanelAllowed !== false : true;

                        return (
                          <tr key={u.phoneNumber} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className="font-extrabold text-slate-800 block leading-tight">{u.fullName}</span>
                              <span className="font-mono text-[9px] text-slate-400 block mt-0.5">{u.phoneNumber}</span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggleChatbot(u.phoneNumber, u.fullName)}
                                className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer transition-all ${
                                  isChatbotEnabled
                                    ? 'bg-emerald-50 text-emerald-850 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}
                              >
                                {isChatbotEnabled ? 'ALLOWED' : 'REVOKED'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {users.filter(u => u.role !== 'admin' && !(u.fullName?.toLowerCase().includes('zewd') || u.phoneNumber?.toLowerCase().includes('zewd'))).length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-6 text-center text-slate-400 italic">
                          No staff employees registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      {/* MANDATORY SELFIE VERIFICATION MODAL */}
      {showSelfieModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#8B5CF6] animate-pulse" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                  Selfie Attendance Verification
                </h3>
              </div>
              <button
                onClick={() => {
                  if (selfieVideoRef.current && selfieVideoRef.current.srcObject) {
                    const stream = selfieVideoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                  }
                  setShowSelfieModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-extrabold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-[10.5px] text-slate-500 font-medium">
                To complete your <span className="font-bold text-[#8B5CF6] uppercase">{selfieSessionType}</span> check-in, please look directly at the camera and take a live selfie. Valid face detection is mandatory.
              </p>

              {/* CAMERA WORKSTAGE AREA */}
              <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center">
                {!capturedImageBase64 ? (
                  <video
                    ref={selfieVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <img
                    src={capturedImageBase64}
                    alt="Captured Selfie"
                    className="w-full h-full object-cover"
                  />
                )}

                {selfieLoading && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 text-white p-4 text-center z-10">
                    <div className="w-8 h-8 rounded-full border-4 border-violet-400 border-t-transparent animate-spin"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Biometric Parsing...</span>
                    <span className="text-[9px] text-slate-400">Verifying face uniqueness & luminance standards via Gemini AI</span>
                  </div>
                )}
              </div>

              {/* LIVE DUAL-LAYER ERROR REPORTING */}
              {selfieError && (
                <div className="bg-rose-50 border border-rose-150 p-3 rounded-xl text-rose-800 space-y-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider block">Verification Blocked</span>
                  <p className="text-[10px] font-medium leading-relaxed">{selfieError}</p>
                </div>
              )}

              {/* OPERATIONAL BUTTONS BAR */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                {!capturedImageBase64 ? (
                  <button
                    disabled={selfieLoading}
                    onClick={async () => {
                      if (!selfieVideoRef.current || !selfieVideoRef.current.srcObject) {
                        setSelfieError("Camera stream is not ready. Please approve camera permission and try again.");
                        return;
                      }

                      setSelfieLoading(true);
                      setSelfieError(null);

                      try {
                        const video = selfieVideoRef.current;
                        const canvas = document.createElement('canvas');
                        canvas.width = 320;
                        canvas.height = 240;
                        
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                          throw new Error("Unable to create canvas context");
                        }

                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        ctx.setTransform(1, 0, 0, 1, 0, 0);

                        const base64 = canvas.toDataURL('image/jpeg', 0.65);
                        setCapturedImageBase64(base64);

                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imgData.data;
                        let totalLuminance = 0;
                        let count = 0;
                        for (let i = 0; i < data.length; i += 16) {
                          const r = data[i];
                          const g = data[i+1];
                          const b = data[i+2];
                          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                          totalLuminance += luminance;
                          count++;
                        }
                        const avgLuminance = totalLuminance / count;
                        
                        let sumSquaredDiff = 0;
                        for (let i = 0; i < data.length; i += 16) {
                          const r = data[i];
                          const g = data[i+1];
                          const b = data[i+2];
                          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                          sumSquaredDiff += Math.pow(luminance - avgLuminance, 2);
                        }
                        const stdDev = Math.sqrt(sumSquaredDiff / count);

                        let totalGradient = 0;
                        let gradCount = 0;
                        const w = canvas.width;
                        const h = canvas.height;
                        for (let y = 10; y < h - 10; y += 8) {
                          for (let x = 10; x < w - 10; x += 8) {
                            const idxCurrent = (y * w + x) * 4;
                            const idxRight = (y * w + (x + 1)) * 4;
                            const idxDown = ((y + 1) * w + x) * 4;

                            const lumCurrent = 0.299 * data[idxCurrent] + 0.587 * data[idxCurrent+1] + 0.114 * data[idxCurrent+2];
                            const lumRight = 0.299 * data[idxRight] + 0.587 * data[idxRight+1] + 0.114 * data[idxRight+2];
                            const lumDown = 0.299 * data[idxDown] + 0.587 * data[idxDown+1] + 0.114 * data[idxDown+2];

                            const gradX = Math.abs(lumCurrent - lumRight);
                            const gradY = Math.abs(lumCurrent - lumDown);

                            totalGradient += (gradX + gradY);
                            gradCount += 2;
                          }
                        }
                        const avgGradient = totalGradient / gradCount;

                        // Pre-validation bypassed to avoid blocking users under various light/frame circumstances.
                        // Retrieve referenced face
                        const dbUser = users.find(u => u.phoneNumber === currentUser.phoneNumber) || currentUser;
                        const referenceImage = dbUser.registeredSelfieUrl || null;

                        const res = await fetch("/api/ai/verify-selfie", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ image: base64, referenceImage })
                        });

                        if (!res.ok) {
                          throw new Error("Selfie biometrics server endpoint failed.");
                        }

                        const result = await res.json();
                        if (result.passed === true) {
                          if (selfieVideoRef.current && selfieVideoRef.current.srcObject) {
                            const stream = selfieVideoRef.current.srcObject as MediaStream;
                            stream.getTracks().forEach(track => track.stop());
                          }
                          setShowSelfieModal(false);
                          setSelfieLoading(false);
                          
                          await handleCheckIn(selfieSessionType || undefined, false, base64, JSON.stringify(result));
                        } else {
                          let excType: any = 'Selfie Verification Failed';
                          let showMsg = result.qualityReason || "Selfie verification failed. Please try again.";

                          if (result.faceCount === 0) {
                            excType = 'No Face Detected';
                            showMsg = "No face detected. Please position your face clearly in front of the camera.";
                          } else if (result.faceCount > 1) {
                            excType = 'Multiple Faces Detected';
                            showMsg = "Multiple faces detected. Only one employee may appear in the photo.";
                          } else if (result.qualityStatus === 'FAIL' || result.isBlackOrWhiteImage || result.isBlurry) {
                            excType = 'Poor Image Quality';
                            showMsg = "Image quality too low. Please move to a brighter area and try again.";
                          } else if (result.matchPassed === false) {
                            excType = 'Biometric Mismatch';
                            showMsg = `Face does not match registered employee. (Security Match Confidence: ${(result.matchScore * 100).toFixed(1)}%)`;
                          }

                          setSelfieError(showMsg);
                          setSelfieLoading(false);

                          await dbService.logException({
                            date: getLocalTodayStr(),
                            employeeName: currentUser.fullName,
                            employeePhone: currentUser.phoneNumber,
                            employeeRole: currentUser.customRole || currentUser.role,
                            device: getDeviceSignature(),
                            location: `Faces: ${result.faceCount || 0}, Match: ${result.matchPassed === undefined ? 'N/A' : result.matchPassed}, Score: ${(result.matchScore || 0).toFixed(2)}`,
                            exceptionType: excType,
                            actionTaken: 'Blocked: Face verification rejected',
                            timestamp: new Date().toISOString()
                          });
                        }
                      } catch (err: any) {
                        console.error("Biometric Verification lifecycle fail:", err);
                        setSelfieError("An unexpected server connection error occurred. Please try again.");
                        setSelfieLoading(false);
                      }
                    }}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    CAPTURE & VERIFY PHOTO
                  </button>
                ) : (
                  <button
                    disabled={selfieLoading}
                    onClick={() => {
                      setCapturedImageBase64(null);
                      setSelfieError(null);
                    }}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retake Photo
                  </button>
                )}

                {/* Normal visual selfie bypass removed by Audit request #2. Admins should use Manual Corrections instead */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BIOMETRIC FACIAL PROFILE REGISTRATION MODAL */}
      {showFaceRegModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-left text-[10px]">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                  Biometric Face Registration
                </h3>
              </div>
              <button
                onClick={() => {
                  if (faceRegVideoRef.current && faceRegVideoRef.current.srcObject) {
                    const stream = faceRegVideoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                  }
                  setShowFaceRegModal(false);
                }}
                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md cursor-pointer select-none font-bold"
              >
                Cancel
              </button>
            </div>

            {faceRegError && (
              <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 font-bold leading-normal">
                {faceRegError}
              </div>
            )}

            {faceRegSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 font-bold leading-normal">
                {faceRegSuccess}
              </div>
            )}

            <div className="bg-slate-950 rounded-2xl overflow-hidden aspect-video border border-slate-800 flex items-center justify-center relative bg-radial from-slate-900 to-slate-950 shadow-inner">
              {faceRegLoading && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-10 text-white">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="font-sans font-black uppercase tracking-wider text-[9px] text-indigo-300">Verifying Biometrics...</span>
                </div>
              )}

              {!capturedRegBase64 ? (
                <>
                  <video 
                    ref={faceRegVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]" 
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-indigo-400/40 rounded-2xl pointer-events-none m-4 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-indigo-400/60 rounded-full flex items-center justify-center relative">
                      <span className="text-[8px] bg-slate-950/75 border border-slate-800 text-indigo-200 px-2.5 py-1 rounded-full font-black uppercase tracking-widest leading-none absolute -bottom-3">
                        Align Face Ideally
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <img 
                  src={capturedRegBase64} 
                  alt="Captured face" 
                  className="w-full h-full object-cover" 
                />
              )}
            </div>

            <div className="space-y-2.5">
              {!capturedRegBase64 ? (
                <button
                  disabled={faceRegLoading}
                  onClick={async () => {
                    if (!faceRegVideoRef.current) return;
                    setFaceRegLoading(true);
                    setFaceRegError(null);

                    try {
                      const canvas = document.createElement('canvas');
                      canvas.width = 640;
                      canvas.height = 480;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(faceRegVideoRef.current, 0, 0, canvas.width, canvas.height);
                        const base64 = canvas.toDataURL('image/jpeg');
                        setCapturedRegBase64(base64);

                        // Call backend to verify this registers precisely ONE human face in good quality!
                        const res = await fetch("/api/ai/verify-selfie", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ image: base64 })
                        });

                        if (!res.ok) {
                          throw new Error("Biometric facial detection check failed.");
                        }

                        const result = await res.json();
                        if (result.passed === true) {
                          // Upload to Storage
                          const url = await dbService.uploadSelfieImage(currentUser.phoneNumber, base64, 'registered_faces');
                          
                          // Save in user profile in Firestore
                          await dbService.updateUser(currentUser.phoneNumber, { registeredSelfieUrl: url });
                          
                          setFaceRegSuccess("Biometric reference face registered successfully! Your security credentials have been updated.");
                        } else {
                          setCapturedRegBase64(null);
                          let customError = result.qualityReason || "We could not extract a distinct human face. Please align and try again.";
                          if (result.faceCount === 0) {
                            customError = "No face detected. Please position your face clearly in front of the camera.";
                          } else if (result.faceCount > 1) {
                            customError = "Multiple faces detected. Only one employee may appear in the photo.";
                          }
                          setFaceRegError(customError);
                        }
                      }
                    } catch (err: any) {
                      console.error("Biometric registration capture failed:", err);
                      setCapturedRegBase64(null);
                      setFaceRegError(err.message || "Workstation photo capture failed. Please retry.");
                    } finally {
                      setFaceRegLoading(false);
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  Capture & Analyze Reference Image
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    disabled={faceRegLoading}
                    onClick={() => {
                      setCapturedRegBase64(null);
                      setFaceRegSuccess(null);
                    }}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 text-[9.5px] font-black uppercase rounded-xl cursor-pointer transition-all"
                  >
                    Recapture
                  </button>
                  <button
                    disabled={faceRegLoading}
                    onClick={() => {
                      if (faceRegVideoRef.current && faceRegVideoRef.current.srcObject) {
                        const stream = faceRegVideoRef.current.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                      }
                      setShowFaceRegModal(false);
                    }}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase rounded-xl cursor-pointer transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY TELEMETRY CARD MODAL */}
      {selectedRecordForTelemetry && (() => {
        const parts = (selectedRecordForTelemetry.deviceInformation || '').split('|||');
        const signature = parts[0] || 'Unknown Fingerprint';
        const ua = parts[1] || '';
        
        let os = 'Unknown OS';
        if (ua) {
          if (ua.includes('Windows')) os = 'Windows PC';
          else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
          else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
          else if (ua.includes('Android')) os = 'Android Phone';
          else if (ua.includes('Linux')) os = 'Linux OS';
        } else {
          os = getParsedDeviceInfo({ deviceInfo: selectedRecordForTelemetry.deviceInformation } as any).osName;
        }

        let browser = 'Unknown Browser';
        if (ua) {
          if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
          else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
          else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
          else if (ua.includes('Edg')) browser = 'Microsoft Edge';
        } else {
          browser = getParsedDeviceInfo({ deviceInfo: selectedRecordForTelemetry.deviceInformation } as any).browserName;
        }
        
        const lat = selectedRecordForTelemetry.gpsCoordinates?.latitude;
        const lon = selectedRecordForTelemetry.gpsCoordinates?.longitude;
        const distanceText = selectedRecordForTelemetry.gpsCoordinates?.distanceText || 'N/A';
        const timestampText = `${selectedRecordForTelemetry.date} ${selectedRecordForTelemetry.time}`;
        const mapsUrl = lat && lon ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 font-sans">
                  <ShieldCheck className="w-5 h-5 text-[#8B5CF6] animate-pulse" />
                  Security Telemetry Card
                </h3>
                <button
                  onClick={() => setSelectedRecordForTelemetry(null)}
                  className="text-slate-400 hover:text-slate-600 font-extrabold cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center font-black text-[#8B5CF6] font-sans">
                    {selectedRecordForTelemetry.employeeName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <strong className="text-xs font-black text-slate-900 block">{selectedRecordForTelemetry.employeeName}</strong>
                    <span className="text-[9px] text-[#8B5CF6] font-bold uppercase tracking-wider block mt-0.5">{selectedRecordForTelemetry.employeeRole}</span>
                    <span className="text-[9.5px] text-slate-400 font-mono block mt-0.5">{selectedRecordForTelemetry.phoneNumber}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Geolocational Diagnostic Details</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-700 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Latitude</span>
                      <span className="font-mono text-slate-900 font-bold">{lat ? lat.toFixed(6) : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Longitude</span>
                      <span className="font-mono text-slate-900 font-bold">{lon ? lon.toFixed(6) : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Distance from Office</span>
                      <span className="font-mono text-rose-700 font-black">{distanceText}</span>
                    </div>
                    <div>
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Session Status</span>
                      <span className="text-slate-900 font-extrabold">{selectedRecordForTelemetry.attendanceType} ({selectedRecordForTelemetry.status})</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Swipe Time & Date</span>
                      <span className="font-mono text-indigo-700 font-black">{timestampText}</span>
                    </div>
                  </div>
                </div>

                {/* BIOMETRIC SELFIE PROOF AREA */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3 mt-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Biometric Selfie Proof</span>
                  {selectedRecordForTelemetry.selfieImageUrl ? (
                    <div className="flex gap-3 bg-violet-50/25 p-2.5 rounded-xl border border-violet-100">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-violet-200 bg-slate-100 flex-shrink-0 shadow-sm">
                        <img
                          src={selectedRecordForTelemetry.selfieImageUrl}
                          alt="Selfie verification"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="text-[10px] space-y-0.5 leading-tight flex-1">
                        <span className="text-[8px] uppercase font-bold text-violet-600 block">Biometric Status</span>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                          <span className="text-emerald-800 font-extrabold text-[10px]">VERIFIED (1 FACE)</span>
                        </div>
                        <p className="text-[8.5px] text-slate-550 font-medium italic mt-1 leading-normal">
                          {selectedRecordForTelemetry.verificationResult ? (
                            (() => {
                              try {
                                const parsed = JSON.parse(selectedRecordForTelemetry.verificationResult);
                                return parsed.qualityReason || "Face matches employee identification requirements.";
                              } catch(e) {
                                return "Face matches employee identification requirements.";
                              }
                            })()
                          ) : "Verified successfully during attendance clock-in."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-2.5 text-center rounded-xl border border-dashed border-slate-200">
                      <span className="text-[9.5px] italic text-slate-400 block">Selfie image not registered for this record (e.g. Admin bypass or legacy).</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Hardware Biometrics / Device Fingerprint</span>
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-[10px] font-medium text-slate-700 space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Device Type</span>
                        <span className="text-slate-900 font-bold uppercase text-[9px]">
                          {getParsedDeviceInfo({ deviceInfo: selectedRecordForTelemetry.deviceInformation } as any).deviceType || 'Desktop/Browser'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Operating System</span>
                        <span className="text-slate-900 font-bold">{os} ({browser})</span>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-slate-150">
                      <span className="text-[7.5px] uppercase font-bold text-slate-450 block mb-0.5">Hardened Device Hash</span>
                      <span className="font-mono text-[#8B5CF6] font-black px-2 py-0.5 bg-violet-50 border border-violet-150 rounded-md block text-[9.5px] mt-0.5 select-all break-all leading-relaxed">
                        {signature || selectedRecordForTelemetry.deviceInformation || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => setSelectedRecordForTelemetry(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close Telemetry
                </button>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1 cursor-pointer"
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

    </div>
  );
}
