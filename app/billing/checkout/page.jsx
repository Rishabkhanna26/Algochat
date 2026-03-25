'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import { useToast } from '../../components/common/ToastProvider.jsx';
import { useAuth } from '../../components/auth/AuthProvider.jsx';

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatInr = (value) => {
  const num = toNumber(value, 0);
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

export default function BillingCheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, refresh } = useAuth();
  const { pushToast } = useToast();
  const canUseTokenSystem =
    user?.admin_tier === 'super_admin' || user?.token_system_enabled === true;
  const rawType = params.get('type');
  const type = rawType === 'payg' ? 'payg' : rawType === 'dashboard' ? 'dashboard' : 'prepaid';
  const amountParam = params.get('amount');
  const monthsParam = params.get('months');
  const profileParam = params.get('profile');
  const bookingParam = params.get('booking');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);

  useEffect(() => {
    if (!error) return;
    pushToast({ type: 'error', title: 'Not saved', message: error });
  }, [error, pushToast]);

  useEffect(() => {
    if (!actionStatus) return;
    pushToast({
      type: actionStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: actionStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: actionStatus,
    });
  }, [actionStatus, pushToast]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/payments/summary', { credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load billing summary.');
        }
        setSummary(payload?.data || null);
      } catch (err) {
        setError(err.message || 'Failed to load billing summary.');
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [user?.id]);

  const pricing = summary?.pricing || {};
  const maintenancePct = toNumber(pricing?.maintenance_fee_pct, 12);
  const dashboardChargeEnabled = summary?.dashboard?.charge_enabled !== false;
  const dashboardRates = summary?.dashboard?.rates || {};
  const currentProfile = summary?.dashboard?.profile || {};
  const normalizedProfileParam =
    ['service', 'product', 'both'].includes(String(profileParam || '').trim().toLowerCase())
      ? String(profileParam).trim().toLowerCase()
      : null;
  const selectedProfileType = normalizedProfileParam || currentProfile.business_type || 'both';
  const selectedBookingEnabled = (() => {
    if (bookingParam === null || bookingParam === undefined) {
      return Boolean(currentProfile.booking_enabled);
    }
    const normalized = String(bookingParam).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return Boolean(currentProfile.booking_enabled);
  })();
  const resolvedBookingEnabled = selectedProfileType === 'product' ? false : selectedBookingEnabled;
  const dashboardBaseMonthly =
    selectedProfileType === 'service'
      ? toNumber(dashboardRates.service_inr, 0)
      : selectedProfileType === 'product'
      ? toNumber(dashboardRates.product_inr, 0)
      : toNumber(dashboardRates.both_inr, 0);
  const dashboardBookingMonthly = resolvedBookingEnabled ? toNumber(dashboardRates.booking_inr, 0) : 0;
  const dashboardMonthly = dashboardChargeEnabled ? dashboardBaseMonthly + dashboardBookingMonthly : 0;
  const subscriptionMonthsRaw = Math.max(1, Math.trunc(Number(monthsParam) || 1));
  const subscriptionMonths = [1, 3, 6, 12].includes(subscriptionMonthsRaw) ? subscriptionMonthsRaw : 1;
  const subscriptionDiscountPct =
    subscriptionMonths === 3 ? 5 : subscriptionMonths === 6 ? 8 : subscriptionMonths === 12 ? 10 : 0;
  const dashboardBaseTotal = dashboardMonthly * subscriptionMonths;
  const dashboardDiscount = Number((dashboardBaseTotal * (subscriptionDiscountPct / 100)).toFixed(2));
  const dashboardDiscountedBase = Number((dashboardBaseTotal - dashboardDiscount).toFixed(2));

  const baseInr =
    type === 'payg'
      ? toNumber(summary?.totals?.total_due_inr, 0)
      : type === 'dashboard'
      ? dashboardDiscountedBase
      : toNumber(amountParam, 0);
  const minTopup = toNumber(summary?.prepaid?.min_topup_inr, 500);
  const hasValidPrepaid = type === 'prepaid' ? baseInr >= minTopup : true;
  const hasValidDashboard =
    type === 'dashboard' ? dashboardChargeEnabled && dashboardMonthly > 0 : true;
  const maintenanceFee = Number((baseInr * (maintenancePct / 100)).toFixed(2));
  const totalAmount = Number((baseInr + maintenanceFee).toFixed(2));

  const prepaidEstimate = useMemo(() => {
    if (type !== 'prepaid') return { inputTokens: 0, outputTokens: 0 };
    const rate = toNumber(pricing?.usd_to_inr_rate, 0);
    const inputUsd = toNumber(pricing?.input_usd_per_1m, 0);
    const outputUsd = toNumber(pricing?.output_usd_per_1m, 0);
    if (!baseInr || !rate || !inputUsd || !outputUsd) {
      return { inputTokens: 0, outputTokens: 0 };
    }
    const inputAmount = baseInr / 2;
    const outputAmount = baseInr - inputAmount;
    const inputTokens = Math.floor((inputAmount / (inputUsd * rate)) * 1_000_000);
    const outputTokens = Math.floor((outputAmount / (outputUsd * rate)) * 1_000_000);
    return { inputTokens, outputTokens };
  }, [baseInr, pricing, type]);

  const openPaymentUrl = (url) => {
    if (!url) return;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = url;
    }
  };

  const handleCreatePayment = async () => {
    if ((type === 'payg' || type === 'prepaid') && !canUseTokenSystem) {
      setActionStatus('Token billing is disabled for your account.');
      return;
    }
    setProcessing(true);
    setActionStatus('');
    try {
      const response =
        type === 'payg'
          ? await fetch('/api/payments/pay', { method: 'POST', credentials: 'include' })
          : type === 'dashboard'
          ? await fetch('/api/payments/dashboard/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                subscription_months: subscriptionMonths,
                business_type: selectedProfileType,
                booking_enabled: resolvedBookingEnabled,
              }),
            })
          : await fetch('/api/payments/prepaid', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ amount_inr: baseInr }),
            });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create payment link.');
      }
      setPaymentLink(payload?.data || null);
      if (payload?.data?.short_url) {
        openPaymentUrl(payload.data.short_url);
      }
      setActionStatus('Payment link created.');
    } catch (err) {
      setActionStatus(err.message || 'Failed to create payment link.');
    } finally {
      setProcessing(false);
    }
  };

  const verifyPayment = async () => {
    if (!paymentLink?.payment_link_id) return;
    setActionStatus('');
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_link_id: paymentLink.payment_link_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to verify payment.');
      }
      setActionStatus('Payment verified.');
      await refresh();
    } catch (err) {
      setActionStatus(err.message || 'Failed to verify payment.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-aa-gray">Loading billing details...</div>
      </div>
    );
  }

  if ((type === 'payg' || type === 'prepaid') && !canUseTokenSystem) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Card className="border border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-aa-text-dark">Token Billing Disabled</h2>
          <p className="mt-2 text-sm text-aa-gray">
            Your super admin has disabled token billing for this account.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const paygUsage = summary?.payg || {};

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-aa-dark-blue">Thank You</h1>
        <p className="text-aa-gray mt-1">
          Please review the details below before completing your payment.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-aa-text-dark">
              {type === 'payg'
                ? 'Pay-as-you-go Bill'
                : type === 'dashboard'
                ? 'Dashboard Subscription'
                : 'Prepaid Token Top-up'}
            </h2>
            <p className="text-xs text-aa-gray">
              Maintenance charge ({maintenancePct}%) is added at checkout.
            </p>
          </div>
          <Badge variant={type === 'payg' ? 'orange' : type === 'dashboard' ? 'green' : 'blue'}>
            {type === 'payg' ? 'Monthly Bill' : type === 'dashboard' ? 'Dashboard' : 'Prepaid'}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-aa-gray">Base Amount</p>
            <p className="mt-2 text-base font-semibold text-aa-text-dark">
              {formatInr(baseInr)}
            </p>
            {type === 'payg' && (
              <div className="mt-2 text-xs text-aa-gray">
                Input: {paygUsage.month_input_tokens || 0} • Output: {paygUsage.month_output_tokens || 0}
              </div>
            )}
            {type === 'dashboard' && (
              <div className="mt-2 text-xs text-aa-gray">
                Monthly: {formatInr(dashboardMonthly)} • Months: {subscriptionMonths} • Discount: {subscriptionDiscountPct}%
                <div className="mt-1">
                  Profile: {selectedProfileType === 'service'
                    ? `${currentProfile.service_label || 'Service'}-based`
                    : selectedProfileType === 'product'
                    ? `${currentProfile.product_label || 'Product'}-based`
                    : `${currentProfile.product_label || 'Product'} + ${currentProfile.service_label || 'Service'}`} • Booking: {resolvedBookingEnabled ? 'Yes' : 'No'}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-aa-gray">Maintenance Charge</p>
            <p className="mt-2 text-base font-semibold text-aa-text-dark">
              {formatInr(maintenanceFee)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-aa-gray">Total To Pay</p>
            <p className="mt-2 text-base font-semibold text-aa-text-dark">
              {formatInr(totalAmount)}
            </p>
          </div>
        </div>

        {type === 'dashboard' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Profile changes selected here will be applied to your account once the payment is verified.
          </div>
        )}

        {type === 'prepaid' && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-aa-text-dark">
            <p className="font-semibold">Estimated Tokens</p>
            <p className="mt-1 text-xs text-aa-gray">
              Input: {prepaidEstimate.inputTokens} • Output: {prepaidEstimate.outputTokens}
            </p>
            <p className="mt-1 text-xs text-aa-gray">
              Split 50/50 between input and output based on current pricing.
            </p>
            {!hasValidPrepaid && (
              <p className="mt-2 text-xs text-red-600">
                Minimum top-up is {formatInr(minTopup)}.
              </p>
            )}
          </div>
        )}

        {type === 'dashboard' && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-aa-text-dark">
            <p className="font-semibold">Subscription Details</p>
            <p className="mt-1 text-xs text-aa-gray">
              Base for {subscriptionMonths} month(s): {formatInr(dashboardBaseTotal)}
            </p>
            <p className="mt-1 text-xs text-aa-gray">
              Discount: {formatInr(dashboardDiscount)} ({subscriptionDiscountPct}%)
            </p>
            {!hasValidDashboard && (
              <p className="mt-2 text-xs text-red-600">
                Dashboard charges are not enabled or configured yet.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={handleCreatePayment}
            disabled={processing || baseInr <= 0 || !hasValidPrepaid || !hasValidDashboard}
          >
            {processing ? 'Creating...' : 'Proceed to Pay'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/billing')}>
            Back to Billing
          </Button>
          {paymentLink?.short_url && (
            <Button
              variant="ghost"
              onClick={() => openPaymentUrl(paymentLink.short_url)}
            >
              Open Payment Link
            </Button>
          )}
          {paymentLink?.payment_link_id && (
            <Button variant="ghost" onClick={verifyPayment}>
              Verify Payment
            </Button>
          )}
        </div>
        {type === 'payg' && baseInr <= 0 && (
          <p className="mt-3 text-xs text-aa-gray">
            No outstanding balance to pay this month.
          </p>
        )}
        {type === 'dashboard' && !hasValidDashboard && (
          <p className="mt-3 text-xs text-aa-gray">
            Dashboard billing is disabled or not configured. Contact your super admin.
          </p>
        )}
      </Card>
    </div>
  );
}
