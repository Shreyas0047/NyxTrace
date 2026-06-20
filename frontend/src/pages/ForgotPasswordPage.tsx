import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicLayout } from '../components/PublicLayout';
import api from '../services/api';

type Step = 'email' | 'otp' | 'password' | 'success';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const clearError = useCallback(() => setError(null), []);

  const startCooldown = () => {
    setCooldown(30);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setDevOtp(null);

    if (!email) { setError('Please enter your email address'); return; }

    setIsLoading(true);
    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        startCooldown();
        if (response.data?.devOtp) setDevOtp(response.data.devOtp);
        setStep('otp');
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    clearError();
    setDevOtp(null);
    setIsLoading(true);
    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        startCooldown();
        if (response.data?.devOtp) setDevOtp(response.data.devOtp);
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit OTP'); return; }

    setIsLoading(true);
    try {
      const response = await api.verifyResetOtp(email, otp);
      if (response.success && response.data?.passwordResetToken) {
        setPasswordResetToken(response.data.passwordResetToken);
        setStep('password');
      } else {
        setError(response.message || 'Invalid OTP');
      }
    } catch { setError('Invalid OTP. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!password || password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!passwordResetToken) { setError('Session expired. Please start over.'); return; }

    setIsLoading(true);
    try {
      const response = await api.resetPassword(email, password, confirmPassword, passwordResetToken);
      if (response.success) {
        setStep('success');
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch { setError('Failed to reset password. Please try again.'); }
    finally { setIsLoading(false); }
  };

  return (
    <PublicLayout>
      <div className="w-full max-w-sm mt-[150px]">
        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6 text-center"
            >
              <div className="space-y-1">
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Reset Password</h1>
                <p className="text-[1.25rem] text-white/50 font-light">Enter your email</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center"
                    required
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>

              <div>
                <Link to="/login" className="text-white/40 hover:text-white/60 transition-colors text-sm underline underline-offset-4">
                  Back to Login
                </Link>
              </div>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6 text-center"
            >
              <div className="space-y-1">
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Verify Code</h1>
                <p className="text-[1.25rem] text-white/50 font-light">Check your inbox</p>
              </div>

              <div className="p-4 border border-white/10 rounded-xl text-xs font-mono tracking-wider text-white/50">
                CODE SENT TO: <span className="text-white">{email}</span>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setStep('email'); setError(null); }} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                  &lt; Back
                </button>
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
                              const next = document.querySelector<HTMLInputElement>(`[data-fp-otp="${i + 1}"]`);
                              next?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otp[i] && i > 0) {
                              const prev = document.querySelector<HTMLInputElement>(`[data-fp-otp="${i - 1}"]`);
                              prev?.focus();
                            }
                          }}
                          data-fp-otp={i}
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

              {devOtp && (
                <div className="text-emerald-400 text-xs font-mono">
                  [DEV MODE] OTP: {devOtp}
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">
                  {error}
                </motion.div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.length !== 6}
                className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  'Verify Code'
                )}
              </button>

              <button
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isLoading}
                className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white disabled:opacity-50 transition-colors"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
              </button>
            </motion.div>
          )}

          {step === 'password' && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6 text-center"
            >
              <div className="space-y-1">
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">New Password</h1>
                <p className="text-[1.25rem] text-white/50 font-light">Choose a strong password</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setStep('otp'); setError(null); }} className="text-xs font-mono uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                  &lt; Back
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 pr-12 focus:outline-none focus:border-white/30 text-center"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-sm"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full backdrop-blur-[1px] text-white border border-white/10 rounded-full py-3 px-4 focus:outline-none focus:border-white/30 text-center"
                    required
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
              className="space-y-6 text-center"
            >
              <div className="space-y-1">
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">Password Reset!</h1>
                <p className="text-[1.25rem] text-white/50 font-light">Your password has been reset</p>
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
                onClick={() => navigate('/login')}
                className="w-full rounded-full bg-white text-black font-medium py-3 hover:bg-white/90 transition-colors"
              >
                Back to Login
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PublicLayout>
  );
}

export default ForgotPasswordPage;
