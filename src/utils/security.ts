/**
 * Custom Security Audit & Defense Library
 * Digaf Renewal Tracker & Attendance System
 */

import { dbService } from '../services/db';

// 1. Browser Native SHA-256 Hashing Engine (Address Audit Task #12: Password Storage)
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn("Crypto API fallback to basic encoding due to sandbox restrictions", err);
    // Dynamic ultra-simple obfuscator fallback if subtle crypto is limited in security sandbox
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return 'obfs-' + Math.abs(hash).toString(16).padStart(16, 'f');
  }
}

// 2. Client-Wide Interface Rate Limiter (Address Audit Task #4: Rate Limiting)
export function checkRateLimit(
  action: string,
  maxAttempts: number,
  windowSecs: number
): { allowed: boolean; remainingSecs: number } {
  if (typeof window === 'undefined') return { allowed: true, remainingSecs: 0 };
  
  const KEY = `digaf_sec_rate_${action}`;
  const now = Math.floor(Date.now() / 1000);
  const rawData = localStorage.getItem(KEY);
  let attempts: number[] = [];
  
  if (rawData) {
    try {
      attempts = JSON.parse(rawData);
    } catch {
      attempts = [];
    }
  }
  
  // Keep only attempts in our check interval
  const cutoff = now - windowSecs;
  attempts = attempts.filter(t => t > cutoff);
  
  if (attempts.length >= maxAttempts) {
    const earliest = attempts[0];
    const diffSecs = (earliest + windowSecs) - now;
    return { 
      allowed: false, 
      remainingSecs: diffSecs > 0 ? diffSecs : windowSecs 
    };
  }
  
  attempts.push(now);
  localStorage.setItem(KEY, JSON.stringify(attempts));
  return { allowed: true, remainingSecs: 0 };
}

// 3. NTP-based Network Clock-Drift Verification (Address Audit Task #7: Clock Spoofing Defenses)
export async function verifyClockSynchronization(): Promise<{ 
  synchronized: boolean; 
  driftSeconds: number;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 2800);
    
    // Addis Ababa EAT reference check
    const res = await fetch('https://worldtimeapi.org/api/timezone/Africa/Addis_Ababa', { 
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(abortTimeout);
    
    if (!res.ok) {
       return { 
         synchronized: true, 
         driftSeconds: 0, 
         message: "NTP server unreachable, using terminal local clock sync fallback." 
       };
    }
    
    const data = await res.json();
    const realUTCSeconds = new Date(data.utc_datetime).getTime() / 1000;
    const localUTCSeconds = Date.now() / 1000;
    const drift = Math.abs(localUTCSeconds - realUTCSeconds);
    
    if (drift > 180) { // More than 3 minutes drift is classified as explicit tampering
      return {
        synchronized: false,
        driftSeconds: drift,
        message: `Device clock mismatch detected! Drift is ${drift.toFixed(1)} seconds. Clock altering is barred.`
      };
    }
    
    return {
      synchronized: true,
      driftSeconds: drift,
      message: "Clock verified and within acceptable boundary tolerances."
    };
  } catch (err) {
    // Graceful check in case the host environment restricts network requests or is entirely offline
    return {
      synchronized: true,
      driftSeconds: 0,
      message: "Network state offline. Clock drift diagnostics suspended."
    };
  }
}

// 4. Trace and Log Security Violation Alerts (Address Audit Task #16: Security Audit Logging)
export async function logSecurityAnomaly(
  userId: string,
  eventSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  actionType: string,
  incidentDetails: string
): Promise<void> {
  const meta = {
    severity: eventSeverity,
    agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'system_agent',
    referrer: typeof window !== 'undefined' ? window.location.href : 'system',
    timestamp: new Date().toISOString()
  };
  
  const cleanDetails = `[SEVERITY: ${eventSeverity}] SEC-INCIDENT: ${actionType} - ${incidentDetails} | Metadata: ${JSON.stringify(meta)}`;
  
  try {
    await dbService.logActivity(
      userId || 'GUEST',
      'No Response',
      'Rejected',
      cleanDetails
    );
  } catch (err) {
    console.error("Local logger crash reporting alarm", err);
  }
}
