'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCircleCheck,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLayerGroup,
  faLock,
  faPhone,
  faUser,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../components/auth/AuthProvider.jsx';
import GeminiSelect from '../components/common/GeminiSelect.jsx';

export default function SignupPage() {
  const router = useRouter();
  const { refresh, user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    businessCategory: '',
    businessType: 'both',
    password: '',
    confirm: '',
  });
  const [pricing, setPricing] = useState(null);
  const [pricingError, setPricingError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [showExistsPopup, setShowExistsPopup] = useState(false);
  const [existsMessage, setExistsMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const businessTypeChoices = [
    {
      value: 'both',
      label: 'Both (Product + Service)',
      hint: 'Enable catalog, booking and orders together.',
    },
    {
      value: 'product',
      label: 'Product-based',
      hint: 'Focus on products, inventory and order workflow.',
    },
    {
      value: 'service',
      label: 'Service-based',
      hint: 'Focus on services, bookings and appointments.',
    },
  ];
  const businessCategoryChoices = [
    { value: 'Retail', label: 'Retail' },
    { value: 'Services', label: 'Services' },
    { value: 'Retail + Services', label: 'Retail + Services' },
    { value: 'Food & Beverage', label: 'Food & Beverage' },
    { value: 'Beauty & Wellness', label: 'Beauty & Wellness' },
    { value: 'Education & Coaching', label: 'Education & Coaching' },
    { value: 'Other', label: 'Other' },
  ];
  const selectedBusinessTypeChoice =
    businessTypeChoices.find((choice) => choice.value === form.businessType) || businessTypeChoices[0];

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    let active = true;
    const loadPricing = async () => {
      try {
        const response = await fetch('/api/public/pricing');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Failed to load pricing');
        if (active) setPricing(payload?.data || null);
      } catch (err) {
        if (active) setPricingError(err.message || 'Failed to load pricing');
      }
    };
    loadPricing();
    return () => {
      active = false;
    };
  }, []);

  const formatInr = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(num);
    } catch (_err) {
      return `₹${num.toFixed(0)}`;
    }
  };

  const formatPrice = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 'Contact';
    return formatInr(num);
  };

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const signupPayload = () => ({
    name: form.name,
    email: form.email,
    phone: form.phone,
    business_category: form.businessCategory,
    business_type: form.businessType,
    password: form.password,
  });

  const showConflict = (data) => {
    const fields = data.fields || {};
    let message = data.error || 'Account already exists';
    if (fields.phone && fields.email) {
      message = 'This phone number and email already exist.';
    } else if (fields.phone) {
      message = 'This phone number already exists.';
    } else if (fields.email) {
      message = 'This email already exists.';
    }
    setExistsMessage(message);
    setShowExistsPopup(true);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name || !form.email || !form.phone || !form.businessCategory || !form.password) {
      setError('Name, email, phone, business category, and password are required.');
      return;
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupPayload(),
          action: 'request_code',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          showConflict(data);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to send verification code');
      }

      const data = await response.json().catch(() => ({}));
      setIsVerificationStep(true);
      setVerificationCode('');
      setSuccess(
        data?.email
          ? `Verification code sent to ${data.email}. Enter the code below to complete signup.`
          : 'Verification code sent. Enter the code below to complete signup.'
      );
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!verificationCode.trim()) {
      setError('Verification code is required.');
      return;
    }

    setVerifyLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'verify_code',
          email: form.email,
          verification_code: verificationCode.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          showConflict(data);
          return;
        }
        throw new Error(data.error || 'Verification failed');
      }

      if (data?.requires_activation) {
        setSuccess('Email verified. Your account is pending super admin activation.');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      console.error('Signup verification error:', err);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setResendLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupPayload(),
          action: 'request_code',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification code');
      }

      setSuccess('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setResendLoading(false);
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
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full border border-white/20" />
          <div className="absolute -bottom-24 -right-20 h-[430px] w-[430px] rounded-full border border-white/15" />

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
              Join AlgoChat
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-white/85 aa-auth-reveal-up" style={{ animationDelay: '300ms' }}>
              Launch your WhatsApp growth stack from day one.
            </p>
            <div className="space-y-4">
              {[
                'Free to get started with email verification flow',
                'Business type aware setup for product and service workflows',
                'Secure onboarding with super admin approval',
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
            <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                Pricing
              </p>
              {!pricing && !pricingError ? (
                <p className="mt-3 text-sm text-white/80">Loading pricing…</p>
              ) : pricing ? (
                <div className="mt-4 space-y-3 text-sm text-white/90">
                  <div className="flex items-center justify-between">
                    <span>Product-based</span>
                    <span className="font-semibold">{formatPrice(pricing.product_inr)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Service-based</span>
                    <span className="font-semibold">{formatPrice(pricing.service_inr)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Product + Service</span>
                    <span className="font-semibold">{formatPrice(pricing.both_inr)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Booking add-on</span>
                    <span>{formatPrice(pricing.booking_inr)}/mo</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/80">Pricing unavailable.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="relative flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:w-1/2 lg:flex-none lg:px-12">
          <div className="aa-auth-decor pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgb(148 163 184 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 184 / 0.35) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
            <div className="absolute left-10 top-24 h-12 w-12 rounded-full border border-aa-dark-blue/20 bg-white/35 backdrop-blur-md aa-auth-float" />
            <div className="absolute right-20 top-20 h-16 w-16 rounded-2xl border border-aa-orange/20 bg-white/40 backdrop-blur-md aa-auth-float aa-auth-float-delay" />
            <div className="absolute bottom-20 right-24 h-8 w-8 rounded-md border border-aa-orange/20 bg-white/40 aa-auth-float aa-auth-float-slow" />
            <div className="absolute left-12 top-16 grid grid-cols-4 gap-2 opacity-40">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={`signup-dot-top-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              ))}
            </div>
            <div className="absolute bottom-14 right-14 grid grid-cols-4 gap-2 opacity-35">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={`signup-dot-bottom-${i}`} className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              ))}
            </div>
          </div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-5 flex justify-center lg:hidden aa-auth-reveal-up sm:mb-7" style={{ animationDelay: '140ms' }}>
              <div className="rounded-2xl border border-white/70 bg-white/90 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.2)] sm:p-2.5">
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

            <div className="aa-auth-card rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-7 lg:p-8 aa-auth-card-reveal">
              <div
                className="mb-6 rounded-2xl border border-[#ffd8b0] bg-gradient-to-r from-[#fff7ee] via-[#fffaf5] to-white p-4 aa-auth-reveal-up sm:p-5"
                style={{ animationDelay: '120ms' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-aa-orange">
                  New Workspace
                </p>
                <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
                  Create account
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Set up your workspace for product and service workflows.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              {!isVerificationStep ? (
                <>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="aa-auth-reveal-up" style={{ animationDelay: '240ms' }}>
                      <AuthField
                        label="Full Name"
                        icon={<FontAwesomeIcon icon={faUser} style={{ fontSize: 14 }} />}
                        value={form.name}
                        onChange={update('name')}
                        placeholder="Your name"
                      />
                    </div>

                    <div className="aa-auth-reveal-up" style={{ animationDelay: '290ms' }}>
                      <AuthField
                        label="Email"
                        icon={<FontAwesomeIcon icon={faEnvelope} style={{ fontSize: 14 }} />}
                        type="email"
                        value={form.email}
                        onChange={update('email')}
                        placeholder="your@email.com"
                      />
                    </div>

                    <div className="aa-auth-reveal-up" style={{ animationDelay: '340ms' }}>
                      <AuthField
                        label="Phone"
                        icon={<FontAwesomeIcon icon={faPhone} style={{ fontSize: 14 }} />}
                        value={form.phone}
                        onChange={update('phone')}
                        placeholder="9876543210"
                      />
                    </div>

                    <div
                      className="relative z-20 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 aa-auth-reveal-up"
                      style={{ animationDelay: '390ms' }}
                    >
                      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-aa-orange shadow-sm">
                          <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 12 }} />
                        </span>
                        Business Setup
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Business Category
                          </label>
                          <GeminiSelect
                            value={form.businessCategory}
                            onChange={(value) => setForm((prev) => ({ ...prev, businessCategory: value }))}
                            options={businessCategoryChoices}
                            variant="vibrant"
                            size="sm"
                            menuClassName="z-50"
                            placeholder="Retail, Services..."
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                            Business Type
                          </label>
                          <GeminiSelect
                            value={form.businessType}
                            onChange={(value) => setForm((prev) => ({ ...prev, businessType: value }))}
                            options={businessTypeChoices.map((choice) => ({
                              value: choice.value,
                              label: choice.label,
                            }))}
                            variant="vibrant"
                            size="sm"
                            menuClassName="z-50"
                          />
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-aa-gray">
                          Selected Plan
                        </p>
                        <p className="mt-1 text-sm font-semibold text-aa-text-dark">
                          {selectedBusinessTypeChoice?.label}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                          {selectedBusinessTypeChoice?.hint}
                        </p>
                      </div>
                    </div>

                    <div className="aa-auth-reveal-up" style={{ animationDelay: '440ms' }}>
                      <AuthField
                        label="Password"
                        icon={<FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} />}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={update('password')}
                        placeholder="••••••••"
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

                    <div className="aa-auth-reveal-up" style={{ animationDelay: '490ms' }}>
                      <AuthField
                        label="Confirm Password"
                        icon={<FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} />}
                        type={showConfirm ? 'text' : 'password'}
                        value={form.confirm}
                        onChange={update('confirm')}
                        placeholder="••••••••"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowConfirm((prev) => !prev)}
                            className="text-slate-500 transition hover:text-slate-700"
                            aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          >
                            <FontAwesomeIcon icon={showConfirm ? faEyeSlash : faEye} />
                          </button>
                        }
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#0f4a9e] px-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,74,158,0.28)] transition hover:opacity-95 disabled:opacity-60 aa-auth-reveal-up"
                      style={{ animationDelay: '540ms' }}
                    >
                      <FontAwesomeIcon icon={faUserPlus} />
                      {loading ? 'Sending code...' : 'Send Verification Code'}
                    </button>
                  </form>

                  <div className="my-5 flex items-center gap-3 aa-auth-reveal-up" style={{ animationDelay: '590ms' }}>
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-500">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/api/auth/google/start';
                    }}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 aa-auth-reveal-up"
                    style={{ animationDelay: '640ms' }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign up with Google
                  </button>
                </>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 aa-auth-reveal-up" style={{ animationDelay: '240ms' }}>
                    Verification code sent to <span className="font-semibold">{form.email}</span>.
                    Enter the code to complete account creation.
                  </div>

                  <div className="aa-auth-reveal-up" style={{ animationDelay: '300ms' }}>
                    <AuthField
                      label="Verification Code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      icon={<FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} />}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>

                    <button
                      type="submit"
                      disabled={verifyLoading}
                      className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#0f4a9e] px-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,74,158,0.28)] transition hover:opacity-95 disabled:opacity-60 aa-auth-reveal-up"
                      style={{ animationDelay: '360ms' }}
                    >
                    <FontAwesomeIcon icon={faUserPlus} />
                    {verifyLoading ? 'Verifying...' : 'Verify Code & Create Account'}
                  </button>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 aa-auth-reveal-up" style={{ animationDelay: '420ms' }}>
                    <button
                      type="button"
                      disabled={resendLoading || verifyLoading}
                      onClick={handleResendCode}
                      className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resendLoading ? 'Resending...' : 'Resend Code'}
                    </button>
                    <button
                      type="button"
                      disabled={verifyLoading}
                      onClick={() => {
                        setIsVerificationStep(false);
                        setVerificationCode('');
                        setSuccess('');
                        setError('');
                      }}
                      className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit Details
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Pricing
                </p>
                {!pricing && !pricingError ? (
                  <p className="mt-2 text-sm text-slate-600">Loading pricing…</p>
                ) : pricing ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>Product-based</span>
                      <span className="font-semibold">{formatPrice(pricing.product_inr)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Service-based</span>
                      <span className="font-semibold">{formatPrice(pricing.service_inr)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Product + Service</span>
                      <span className="font-semibold">{formatPrice(pricing.both_inr)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Booking add-on</span>
                      <span>{formatPrice(pricing.booking_inr)}/mo</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Pricing unavailable.</p>
                )}
              </div>

              <p className="mt-6 text-center text-sm text-slate-500 aa-auth-reveal-up" style={{ animationDelay: '700ms' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="inline-flex items-center gap-1 font-semibold text-aa-orange hover:underline"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </section>
      </div>

      {showExistsPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowExistsPopup(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-xl font-bold text-slate-900">Account Already Exists</h2>
            <p className="mb-6 text-sm text-slate-600">{existsMessage}</p>
            <button
              type="button"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#0f4a9e] px-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,74,158,0.25)]"
              onClick={() => setShowExistsPopup(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthField({ label, icon, rightElement, ...props }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          {...props}
          required
          className={`h-12 w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-aa-orange focus:ring-2 focus:ring-orange-100 ${
            icon ? 'pl-10' : 'px-3'
          } ${rightElement ? 'pr-11' : 'pr-3'}`}
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
