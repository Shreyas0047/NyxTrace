import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { PublicLayout } from '../components/PublicLayout';

type Step = 'role' | 'email' | 'otp' | 'password';
type RegistrationRole = 'analyst' | 'admin';

interface VerifyOtpResponse {
  verified: boolean;
  role: RegistrationRole;
  emailVerificationToken: string;
}

interface RegisterData {
  user: { id: string; email: string; role: string };
  tokens: { accessToken: string; refreshToken: string };
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_ERROR = 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuthState = useAuthStore.setState;
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<RegistrationRole | ''>('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otp, setOtp] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [initialReverse, setInitialReverse] = useState(false);
  const [reverseActive, setReverseActive] = useState(false);

  const clearError = useCallback(() => setError(''), []);

  const startOtpCooldown = () => {
    setOtpCooldown(30);
    const interval = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRoleSelect = (selectedRole: RegistrationRole) => {
    setRole(selectedRole);
    setOtp('');
    setEmailVerificationToken('');
    clearError();
    setSuccess('');
    setStep('email');
  };

  const handleSendOTP = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!role) { setError('Please choose a role first'); return; }

    setLoading(true);
    clearError();
    setSuccess('');
    setOtp('');
    setEmailVerificationToken('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.post<{ devOtp?: string }>('/auth/send-otp', { email: normalizedEmail, role });
      if (response.success) {
        setEmail(normalizedEmail);
        setStep('otp');
        setSuccess('OTP sent to your email. Check your inbox.');
        startOtpCooldown();
        if (response.data?.devOtp) setSuccess(`[DEV MODE] OTP: ${response.data.devOtp}`);
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not reach the server.');
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (otpCooldown > 0) return;
    await handleSendOTP();
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit OTP'); return; }
    setLoading(true);
    clearError();
    try {
      const response = await api.post<VerifyOtpResponse>('/auth/verify-otp', { email: email.trim().toLowerCase(), otp });
      if (response.success && response.data?.verified && response.data.emailVerificationToken) {
        setEmailVerificationToken(response.data.emailVerificationToken);
        setStep('password');
        setSuccess('Email verified. Set your name and password.');
      } else {
        setError(response.message || 'Invalid OTP.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not verify OTP.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!role) { setError('Please choose a role'); return; }
    if (!emailVerificationToken) { setError('Please verify your email first.'); return; }
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your name'); return; }
    if (!PASSWORD_REGEX.test(password)) { setError(PASSWORD_ERROR); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    clearError();
    try {
      const response = await api.post<RegisterData>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        role: role === 'analyst' ? 'forensic_analyst' : 'admin',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailVerificationToken,
      });

      if (response.success && response.data) {
        localStorage.setItem('accessToken', response.data.tokens.accessToken);
        if (response.data.tokens.refreshToken) localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
        setAuthState({
          user: response.data.user as any,
          token: response.data.tokens.accessToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        setReverseActive(true);
        setTimeout(() => setInitialReverse(true), 50);
        setTimeout(() => setRegisterSuccess(true), 2000);
      } else {
        setError(response.message || 'Registration failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <PublicLayout reverse={initialReverse} className={reverseActive ? 'with-reverse' : ''}>
      <div className="w-full max-w-sm mt-[150px]">
        {registerSuccess ? (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
            className="space-y-6 text-center"
          >
            <div className="space-y-1">
              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">You're in!</h1>
              <p className="text-[1.25rem] text-white/50 font-light">Account created</p>
            </div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="py-10"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/70 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </motion.div>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={() => navigate('/dashboard')}
              className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors"
            >
              Continue to Dashboard
            </motion.button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {step === 'role' && (
              <motion.div key="role" initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="space-y-6 text-center">
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Create Identity</h1>
                  <p className="text-[1.8rem] text-white/70 font-light">Choose your role</p>
                </div>
                <div className="space-y-4">
                  <button onClick={() => handleRoleSelect('analyst')} className="w-full p-6 border border-white/10 rounded-2xl hover:border-white/30 transition-all text-left group/btn bg-transparent">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-white">Analyst</div>
                      <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="text-sm text-gray-400">Investigate digital evidence and intelligence</div>
                  </button>
                  <button onClick={() => handleRoleSelect('admin')} className="w-full p-6 border border-white/10 rounded-2xl hover:border-white/30 transition-all text-left group/btn bg-transparent">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-white">Administrator</div>
                      <svg className="w-5 h-5 text-gray-400 group-hover/btn:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div className="text-sm text-gray-400">Full system control and user governance</div>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="space-y-6 text-center">
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Identity Verification</h1>
                  <p className="text-[1.8rem] text-white/70 font-light">Enter your email</p>
                </div>
                <div className="p-4 border border-white/10 rounded-xl text-xs font-mono tracking-wider text-white/50">
                  REGISTERING AS: <span className="text-white uppercase">{role}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('role')} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors">&lt; Back</button>
                </div>
                <input
                  type="email"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setOtp(''); setEmailVerificationToken(''); }}
                  className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center"
                  required
                />
                {error && <div className="text-red-400 text-sm">{error}</div>}
                {success && <div className="text-emerald-400 text-sm">{success}</div>}
                <button onClick={handleSendOTP} className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50" disabled={loading}>
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Request Access Code'}
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="space-y-6 text-center">
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Verify Code</h1>
                  <p className="text-[1.25rem] text-white/50 font-light">Check your inbox</p>
                </div>
                <div className="p-4 border border-white/10 rounded-xl text-xs font-mono tracking-wider text-white/50">
                  CODE SENT TO: <span className="text-white">{email}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('email')} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors">&lt; Back</button>
                </div>
                <div className="relative rounded-full py-4 px-5 border border-white/10 bg-transparent">
                  <div className="flex items-center justify-center">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={otp[i] || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 1);
                              const newOtp = otp.split('');
                              newOtp[i] = val;
                              setOtp(newOtp.join(''));
                              if (val && i < 5) {
                                const next = document.querySelector<HTMLInputElement>(`[data-otp="${i + 1}"]`);
                                next?.focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !otp[i] && i > 0) {
                                const prev = document.querySelector<HTMLInputElement>(`[data-otp="${i - 1}"]`);
                                prev?.focus();
                              }
                            }}
                            data-otp={i}
                            className="w-8 text-center text-xl bg-transparent text-white border-none focus:outline-none focus:ring-0 appearance-none"
                            style={{ caretColor: 'transparent' }}
                          />
                          {!otp[i] && (
                            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
                              <span className="text-xl text-white/20">0</span>
                            </div>
                          )}
                        </div>
                        {i < 5 && <span className="text-white/20 text-xl">|</span>}
                      </div>
                    ))}
                  </div>
                </div>
                {error && <div className="text-red-400 text-sm">{error}</div>}
                <button onClick={handleVerifyOTP} className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50" disabled={loading || otp.length !== 6}>
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Sign Up'}
                </button>
                <button onClick={handleResendOTP} disabled={otpCooldown > 0 || loading} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white disabled:opacity-50 transition-colors">
                  {otpCooldown > 0 ? `Retry in ${otpCooldown}s` : 'Request New Code'}
                </button>
              </motion.div>
            )}

            {step === 'password' && (
              <motion.div key="password" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="space-y-6 text-center">
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Finalize Identity</h1>
                  <p className="text-[1.8rem] text-white/70 font-light">Set your credentials</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('otp')} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors">&lt; Back</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center" />
                  <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center" />
                </div>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 pr-12 focus:outline-none focus:border-white/30 text-center" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-sm">{showPassword ? 'Hide' : 'Show'}</button>
                </div>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center" />
                </div>
                {error && <div className="text-red-400 text-sm">{error}</div>}
                <button onClick={handleRegister} className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50" disabled={loading}>
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Establish Identity'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!registerSuccess && (
          <div className="mt-10 text-center">
            <p className="text-sm text-white/40">
              Existing operative?{' '}
              <Link to="/login" className="text-white/60 hover:text-white underline underline-offset-4 transition-colors">Sign In</Link>
            </p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export default RegisterPage;
