import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dbService } from '../services/db';
import { Phone, Lock, User as UserIcon, RefreshCw, KeyRound, Check, HelpCircle, AlertCircle, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { soundService } from '../services/sound';
import { useLanguage } from '../services/language';
import { hashPassword, checkRateLimit, verifyClockSynchronization, logSecurityAnomaly } from '../utils/security';
import DigafLogo, { DigafIcon } from './DigafLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: User, rememberMe: boolean) => void;
  initialMessage?: string;
}

export default function LoginScreen({ onLoginSuccess, initialMessage }: LoginScreenProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Form fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot password specific fields
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [managerPin, setManagerPin] = useState('');

  // Forced password change security states
  const [forceResetUser, setForceResetUser] = useState<User | null>(null);
  const [forceResetNewPass, setForceResetNewPass] = useState('');
  const [forceResetConfirmPass, setForceResetConfirmPass] = useState('');
  const [forceResetError, setForceResetError] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Clear states when mode shifts
  useEffect(() => {
    setError('');
    setSuccess('');
    setConfirmPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);

    if (mode === 'login') {
      try {
        const saved = localStorage.getItem('digaf_saved_credentials');
        if (saved) {
          const { phoneNumber: savedPhone, password: savedPassword } = JSON.parse(saved);
          if (savedPhone) setPhoneNumber(savedPhone);
          if (savedPassword) setPassword(savedPassword);
          setRememberMe(true);
        } else {
          setPassword('');
        }
      } catch {
        setPassword('');
      }
    } else {
      setPassword('');
    }
  }, [mode]);

  useEffect(() => {
    if (initialMessage) {
      setError(initialMessage);
    }
  }, [initialMessage]);

  

  const sanitizeLoginPhone = (phone: string): string => {
    const cl = phone.trim().toLowerCase();
    let norm = cl.replace(/[\s-+]/g, '');
    if (norm.startsWith('251')) {
      norm = '0' + norm.substring(3);
    }
    if (norm.length === 9 && !norm.startsWith('0')) {
      norm = '0' + norm;
    }
    return norm;
  };

 const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!phoneNumber.trim() || !password) {
    setError(t('All fields are required.'));
    return;
  }

  const inputPhone = sanitizeLoginPhone(phoneNumber);
  setLoading(true);
  setError('');

  // CHECK LOCAL STORAGE FIRST - INSTANT!
  const savedUser = localStorage.getItem('digaf_remembered_session');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user.phoneNumber === inputPhone && user.password === password) {
        // INSTANT LOGIN - no API call!
        soundService.playSuccessChime();
        setLoading(false);
        onLoginSuccess(user, rememberMe);
        return;
      }
    } catch (e) {}
  }

  // If not in localStorage, make API call (only first time)
  try {
    const user = await dbService.getUser(inputPhone);
    
    if (!user) {
      setError(t('User not found. Please check your phone number.'));
      setLoading(false);
      return;
    }

    if (user.status === 'deactive') {
      setError(t('Your account has been deactivated.'));
      setLoading(false);
      return;
    }

    const isPasswordValid = user.password === password;
    if (!isPasswordValid) {
      setError(t('Incorrect password.'));
      setLoading(false);
      return;
    }

    soundService.playSuccessChime();
    if (rememberMe) {
      localStorage.setItem('digaf_saved_credentials', JSON.stringify({ phoneNumber: inputPhone, password }));
    }

    if (user.forcePasswordChange === true) {
      setForceResetUser(user);
      setLoading(false);
      return;
    }

    setLoading(false);
    onLoginSuccess(user, rememberMe);

  } catch (err: any) {
    setError(t('Authentication failed. Please try again.'));
    console.error('Login error:', err);
    setLoading(false);
  }
};


  const handleForcePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForceResetError('');

    if (!forceResetNewPass || !forceResetConfirmPass) {
      setForceResetError(t('Please fill in all passcode fields.'));
      return;
    }

    if (forceResetNewPass !== forceResetConfirmPass) {
      setForceResetError(t('Passwords do not match.'));
      return;
    }

    if (forceResetNewPass.length < 4) {
      setForceResetError(t('Your new password must be at least 4 characters/digits long.'));
      return;
    }

    setLoading(true);
    try {
      if (!forceResetUser) throw new Error("Invalid session workspace profile.");

      const updates: any = {
        password: forceResetNewPass.trim(),
        forcePasswordChange: false,
        tempPassword: ''
      };

      await dbService.updateUser(forceResetUser.phoneNumber, updates);

      const updatedUser = { ...forceResetUser, forcePasswordChange: false, tempPassword: '' };

      soundService.playSuccessChime();

      try {
        if (rememberMe) {
          localStorage.setItem('digaf_saved_credentials', JSON.stringify({
            phoneNumber: forceResetUser.phoneNumber,
            password: forceResetNewPass.trim()
          }));
        }
      } catch (err) {
        console.error(err);
      }

      setForceResetUser(null);
      onLoginSuccess(updatedUser, rememberMe);
    } catch (err: any) {
      console.error(err);
      setForceResetError(err.message || t('Could not finalize your passcode update.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneTrimmed = sanitizeLoginPhone(forgotPhone);

    if (!phoneTrimmed || !newPassword || !confirmNewPassword) {
      setError(t('All fields are required.'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('Passwords do not match.'));
      return;
    }

    setError(t('Self-service bypass PINs have been permanently removed for security hardening. Please contact Administrator Aman or Super Admin Zewdneh in the office to securely reset your credentials.'));
    await logSecurityAnomaly(phoneTrimmed, 'MEDIUM', 'PIN_REMOVAL_BYPASS_ATTEMPT', `User attempted self-service password reset. Instructed to contact Admins.`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans relative overflow-hidden transition-colors duration-300" id="login_screen_view">
      {/* Decorative clean circles matching mockup style */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-80 h-80 bg-[#C4B5FD]/10 rounded-full mix-blend-multiply filter blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 relative z-10 overflow-hidden animate-fade-in p-2 sm:p-4 lg:p-6 min-h-[600px] flex items-center transition-colors duration-300">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">

          {/* Left Column: Logos & Form */}
          <div className="lg:col-span-12 xl:col-span-5 lg:w-[480px] mx-auto flex flex-col justify-between p-6 sm:p-8 space-y-8">

            {/* Top Logo Branding */}
            <DigafLogo />

            {/* Form Section */}
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                  {mode === 'login' ? t('Admin login') : t('Reset Password')}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed font-sans">
                  {mode === 'login'
                    ? t('Access the Digaf operations dashboard with your staff credentials.')
                    : t('Verification Alert: resetting active terminals')}
                </p>
              </div>

              {/* Global Notifications / Alert Banner */}
              {forceResetUser ? (
                <form onSubmit={handleForcePasswordResetSubmit} className="space-y-4 font-sans text-left animate-fade-in">
                  <div className="p-3 mb-2 bg-[#FEE2E2] border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 font-extrabold leading-normal">
                    <span className="shrink-0 text-base mt-[-1px]">🔒</span>
                    <span>ADMINISTRATIVE KEY SECURITY: Administrator '{forceResetUser.tempPassword ? 'Aman' : 'Zewdneh'}' has updated your login authority. You are strictly required to change your passcode before continuing.</span>
                  </div>

                  {forceResetError && (
                    <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-xs text-rose-700 font-semibold leading-relaxed">
                      {forceResetError}
                    </div>
                  )}

                  <div className="space-y-1.5 font-sans font-medium">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block pl-0.5">
                      New Passcode / Password
                    </label>
                    <input
                      type="password"
                      required
                      value={forceResetNewPass}
                      onChange={(e) => setForceResetNewPass(e.target.value)}
                      placeholder="Enter minimum 4 digits/characters"
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 dark:border-slate-800 text-sm p-3 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5 font-sans font-medium">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block pl-0.5">
                      Confirm New Passcode
                    </label>
                    <input
                      type="password"
                      required
                      value={forceResetConfirmPass}
                      onChange={(e) => setForceResetConfirmPass(e.target.value)}
                      placeholder="Retype password to confirm parity"
                      className="w-full bg-[#E8EEF9]/60 border border-slate-100 dark:border-slate-800 text-sm p-3 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 font-bold text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'SAVE WORKSTATION CREDENTIALS'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForceResetUser(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold text-xs uppercase rounded-xl transition-all cursor-pointer"
                  >
                    Go Back
                  </button>
                </form>
              ) : (
                <>
                  {typeof window !== 'undefined' && window.location.search.includes('qrScan=true') && (
                    <div className="p-3 mb-2 bg-violet-50 border border-violet-150 rounded-xl flex items-start gap-2.5 text-xs text-[#8B5CF6] font-extrabold leading-relaxed">
                      <span className="shrink-0 text-base mt-[-2px]">⏰</span>
                      <span>Office QR Code Scanned! Log in with your phone & password to instantly confirm your attendance check-in.</span>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2 text-xs text-rose-700 font-semibold leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-semibold leading-relaxed">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Dynamic Mode Switch Form */}
                  {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4 font-sans">
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block pl-0.5">
                          {t('Phone Number')}
                        </label>
                        <div className="relative font-sans">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <Phone className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="e.g. +251 911 22 33 44"
                            className="w-full bg-[#E8EEF9]/60 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-sm p-3 pl-11 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all font-sans"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block pl-0.5">
                          {t('Password')}
                        </label>
                        <div className="relative font-sans">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <Lock className="w-4 h-4" />
                          </span>
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-[#E8EEF9]/60 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-sm p-3 pl-11 pr-11 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Remember Me checkbox */}
                      <div className="flex items-center justify-between pt-1 font-sans">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded-md border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer transition-all"
                          />
                          <span className="text-xs font-medium text-slate-500">{t('Remember me')}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-xs font-bold text-[#8B5CF6] hover:underline cursor-pointer"
                        >
                          {t('Forgot password?')}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 duration-100 text-white text-xs font-black rounded-xl shadow-lg shadow-violet-500/10 cursor-pointer transition-all flex items-center justify-center gap-2 uppercase tracking-wider mt-2"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {t('Verifying...')}
                          </>
                        ) : (
                          <>
                            {t('Login')}
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {mode === 'forgot' && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 block pl-0.5 font-sans">
                          {t('Phone Number')}
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <Phone className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            required
                            value={forgotPhone}
                            onChange={(e) => setForgotPhone(e.target.value)}
                            placeholder="e.g. +251911223344"
                            className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-sm p-3 pl-11 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold text-slate-800 placeholder-slate-400 font-sans transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 block pl-0.5 font-sans">
                            {t('New Password')}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                              <Lock className="w-4 h-4" />
                            </span>
                            <input
                              type={showNewPassword ? "text" : "password"}
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••"
                              className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-sm p-3 pl-11 pr-10 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold text-slate-800 placeholder-slate-400 font-sans transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 block pl-0.5 font-sans">
                            {t('Confirm Password')}
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                              <Lock className="w-4 h-4" />
                            </span>
                            <input
                              type={showConfirmNewPassword ? "text" : "password"}
                              required
                              value={confirmNewPassword}
                              onChange={(e) => setConfirmNewPassword(e.target.value)}
                              placeholder="••••"
                              className="w-full bg-[#E8EEF9]/60 border border-slate-100 text-sm p-3 pl-11 pr-10 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold text-slate-800 placeholder-slate-400 font-sans transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Secure alert indicator */}
                      <div className="p-3.5 bg-rose-50 border border-slate-100/50 rounded-xl flex items-start gap-2.5 mt-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-rose-900 leading-normal">{t('Self-Service Decoupled')}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-normal">
                            {t('By security decree, unsecure self-service reset PIN bypasses are permanently removed. Please query Aman (Admin) or Zewdneh (Owner) in-person for credentials update.')}
                          </p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider mt-2"
                      >
                        {t('Verify & Reset Password')}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            {/* Bottom Section */}
            <div className="space-y-4">
              {mode !== 'login' && (
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs font-bold leading-normal">
                  <span className="text-slate-400 font-medium">{t('Already registered?')}</span>
                  <button
                    onClick={() => setMode('login')}
                    className="text-[#8B5CF6] hover:underline hover:text-[#7C3AED] cursor-pointer"
                  >
                    {t('Back to Sign In')}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-[1.5px] font-sans pt-1">
                {"SYSTEM POWERED BY ዘውድ".split("").map((char, idx) => {
                  const letterColors = [
                    "text-emerald-500", "text-emerald-600", "text-teal-500", "text-teal-600",
                    "text-cyan-500", "text-cyan-600", "text-sky-500", "text-sky-600",
                    "text-blue-500", "text-blue-600"
                  ];
                  const colorClass = letterColors[idx % letterColors.length];
                  if (char === " ") return <span key={idx} className="w-1.5" />;
                  return (
                    <span key={idx} className={`text-[10px] font-black uppercase tracking-wider select-none ${colorClass}`}>
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Beautiful photo Cover Card */}
          <div className="lg:col-span-12 xl:col-span-7 hidden lg:flex relative rounded-[2rem] overflow-hidden shadow-2xl h-[580px] bg-gradient-to-br from-[#0B1330] via-[#1E1B4B] to-[#311042] p-10 flex-col justify-between group transition-all duration-300">
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-[4000ms]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />

            <div className="flex-1 flex items-center justify-center relative z-10">
              <div className="transform transition-all duration-700 group-hover:scale-105 group-hover:rotate-1 flex flex-col items-center">
                <div className="relative w-36 h-36 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10">
                  <DigafIcon className="w-full h-full" isDarkBackground={true} />
                </div>
                <div className="mt-5 text-center">
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-violet-300/80">Operational Intelligence</div>
                  <div className="text-3xs font-mono text-slate-400 mt-1 select-none">MFI AGILITY & RENEWALS PLATFORM</div>
                </div>
              </div>
            </div>

            <div className="relative z-10 text-white space-y-2">
              <span className="inline-block px-2.5 py-1 rounded-full text-[9px] bg-[#8B5CF6]/20 text-violet-300 font-extrabold uppercase tracking-widest border border-[#8B5CF6]/30">Standard Terminal</span>
              <h2 className="text-3xl font-extrabold font-sans tracking-tight leading-tight mt-3">
                {t('Access Beyond Limit')}
              </h2>
              <p className="text-xs font-sans tracking-normal opacity-85 font-medium max-w-md leading-relaxed text-indigo-100/90">
                {t('Accessible financing operations, organized for the teams who keep every loan moving.')}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}