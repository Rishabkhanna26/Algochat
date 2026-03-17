'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Modal from '../components/common/Modal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
  faRightToBracket,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../components/auth/AuthProvider.jsx';

export default function LoginPage() {
  const router = useRouter();
  const { refresh, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [oauthNotice, setOauthNotice] = useState(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const oauth = String(new URLSearchParams(window.location.search).get('oauth') || '')
      .trim()
      .toLowerCase();
    if (!oauth) {
      setOauthNotice(null);
      return;
    }
    if (oauth === 'pending_approval') {
      setOauthNotice({
        tone: 'amber',
        text: 'Google login successful. Your account is waiting for super admin approval.',
      });
      return;
    }
    if (oauth === 'access_expired') {
      setOauthNotice({
        tone: 'red',
        text: 'Your access period is over. Please contact super admin to reactivate your account.',
      });
      return;
    }
    if (oauth === 'failed') {
      setOauthNotice({
        tone: 'red',
        text: 'Google sign-in failed. Please try again.',
      });
      return;
    }
    setOauthNotice(null);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Login failed');
        return;
      }

      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send temporary password');
      }
      setForgotOpen(false);
      setResetOpen(true);
      setTempPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetError('');
      setResetSuccess('');
    } catch (err) {
      setForgotError(err.message || 'Failed to send temporary password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!tempPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setResetError('All fields are required.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: forgotIdentifier,
          tempPassword,
          newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      setResetSuccess('Password updated. You can now log in.');
      setTimeout(() => {
        setResetOpen(false);
        setTempPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetError('');
      }, 1500);
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="aa-auth-page relative min-h-screen overflow-hidden bg-[#f3f6fb]">
      <div className="aa-auth-bg pointer-events-none absolute inset-0">
        <div className="absolute -left-36 -top-40 h-[580px] w-[580px] rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute -bottom-44 -right-36 h-[640px] w-[640px] rounded-full bg-orange-200/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(15 23 42) 1px, transparent 1px), linear-gradient(90deg, rgb(15 23 42) 1px, transparent 1px)',
            backgroundSize: '58px 58px',
          }}
        />
      </div>

      <div className="relative flex min-h-screen w-full">
        <aside className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="absolute inset-0 aa-auth-left-bg" />
          <div className="absolute inset-0 aa-auth-left-overlay" />
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full border border-white/20" />
          <div className="absolute -bottom-24 -left-20 h-[450px] w-[450px] rounded-full border border-white/15" />

          <div className="relative z-10 flex flex-col justify-center px-14 xl:px-20 aa-auth-reveal-left">
            <Image
              src="/algoaura_logo.png"
              alt="AlgoChat"
              width={152}
              height={152}
              priority
              className="mb-8 rounded-3xl border border-white/80 bg-white/92 p-4 shadow-[0_24px_50px_rgba(15,23,42,0.26)] backdrop-blur-sm aa-auth-reveal-up aa-auth-logo-image"
              style={{ animationDelay: '120ms' }}
            />
            <h2 className="mb-4 text-4xl font-black leading-tight text-white xl:text-5xl aa-auth-reveal-up" style={{ animationDelay: '220ms' }}>
              AlgoChat CRM
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-white/85 aa-auth-reveal-up" style={{ animationDelay: '300ms' }}>
              Your WhatsApp operations, all in one command center.
            </p>
            <div className="space-y-4">
              {[
                'Single dashboard for conversations and sales pipeline',
                'Role-based access with secure admin controls',
                'Automation-ready workflows for faster response time',
              ].map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 aa-auth-reveal-up"
                  style={{ animationDelay: `${420 + index * 120}ms` }}
                >
                  <FontAwesomeIcon icon={faCircleCheck} className="mt-1 text-white/90" />
                  <p className="text-sm font-medium text-white/90">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:w-1/2 lg:flex-none lg:px-12">
          <div className="aa-auth-decor pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgb(148 163 184 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 184 / 0.35) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
            <div className="absolute right-16 top-20 h-16 w-16 rounded-2xl border border-aa-orange/20 bg-white/40 backdrop-blur-md aa-auth-float" />
            <div className="absolute bottom-24 left-10 h-12 w-12 rounded-full border border-aa-dark-blue/20 bg-white/35 backdrop-blur-md aa-auth-float aa-auth-float-delay" />
            <div className="absolute right-20 top-1/2 h-8 w-8 rounded-md border border-aa-orange/20 bg-white/40 aa-auth-float aa-auth-float-slow" />
            <div className="absolute left-14 top-14 grid grid-cols-4 gap-2 opacity-40">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={`login-dot-top-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              ))}
            </div>
            <div className="absolute bottom-16 right-16 grid grid-cols-4 gap-2 opacity-35">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={`login-dot-bottom-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              ))}
            </div>
          </div>

          <div className="relative z-10 w-full max-w-md">
            <div className="mb-7 flex justify-center lg:hidden aa-auth-reveal-up" style={{ animationDelay: '140ms' }}>
              <div className="rounded-2xl border border-white/70 bg-white/90 p-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.2)]">
                <Image
                  src="/algoaura_logo.png"
                  alt="AlgoChat"
                  width={88}
                  height={88}
                  priority
                  className="aa-auth-logo-image"
                />
              </div>
            </div>

            <div className="aa-auth-card rounded-3xl border border-white/80 bg-white/90 p-7 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8 aa-auth-card-reveal">
              <h1 className="mb-2 text-3xl font-black text-slate-900 aa-auth-reveal-up" style={{ animationDelay: '120ms' }}>Sign in</h1>
              <p className="mb-6 text-sm text-slate-500 aa-auth-reveal-up" style={{ animationDelay: '180ms' }}>Log in to continue managing your workspace.</p>

              {oauthNotice && !error && (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    oauthNotice.tone === 'red'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {oauthNotice.text}
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="aa-auth-reveal-up" style={{ animationDelay: '240ms' }}>
                  <AuthField
                    label="Email or User ID"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="User ID, email, or phone"
                    icon={<FontAwesomeIcon icon={faEnvelope} style={{ fontSize: 14 }} />}
                  />
                </div>

                <div className="aa-auth-reveal-up" style={{ animationDelay: '300ms' }}>
                  <AuthField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    icon={<FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} />}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-slate-500 transition hover:text-slate-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                      </button>
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#0f4a9e] text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,74,158,0.28)] transition hover:opacity-95 disabled:opacity-60 aa-auth-reveal-up"
                  style={{ animationDelay: '360ms' }}
                >
                  <FontAwesomeIcon icon={faRightToBracket} />
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 aa-auth-reveal-up" style={{ animationDelay: '420ms' }}>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-500">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google/start';
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 aa-auth-reveal-up"
                style={{ animationDelay: '470ms' }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm aa-auth-reveal-up" style={{ animationDelay: '520ms' }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(true);
                    setForgotError('');
                    setForgotIdentifier(email || '');
                  }}
                  className="font-semibold text-aa-orange hover:underline"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/signup')}
                  className="font-semibold text-[#0f4a9e] hover:text-aa-orange"
                >
                  Create an account
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Forgot Password"
        size="sm"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <p className="text-sm text-aa-gray">
            Enter your email or phone. We will send a temporary password to your email.
          </p>
          <Input
            label="Email or Phone"
            value={forgotIdentifier}
            onChange={(e) => setForgotIdentifier(e.target.value)}
            placeholder="you@example.com or phone"
            required
          />
          {forgotError && (
            <p className="text-sm text-red-600">{forgotError}</p>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="flex-1" disabled={forgotLoading}>
              {forgotLoading ? 'Sending...' : 'Send Temporary Password'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setForgotOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Password"
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="Temporary Password"
            type="text"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Enter the temp password from email"
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          {resetSuccess && <p className="text-sm text-green-600">{resetSuccess}</p>}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="flex-1" disabled={resetLoading}>
              {resetLoading ? 'Saving...' : 'Save New Password'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setResetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AuthField({ label, icon, rightElement, ...props }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          {...props}
          required
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-11 text-sm text-slate-900 outline-none transition focus:border-aa-orange focus:ring-2 focus:ring-orange-100"
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </span>
        )}
      </div>
    </div>
  );
}
