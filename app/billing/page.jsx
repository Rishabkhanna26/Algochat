'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faCircleInfo,
  faCoins,
  faCreditCard,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Badge from '../components/common/Badge.jsx';
import GeminiSelect from '../components/common/GeminiSelect.jsx';
import { useAuth } from '../components/auth/AuthProvider.jsx';
import { useToast } from '../components/common/ToastProvider.jsx';

const InfoHint = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        className="ml-1 inline-flex items-center text-aa-gray hover:text-aa-dark-blue"
        aria-label="Info"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
      >
        <FontAwesomeIcon icon={faCircleInfo} className="text-[12px]" />
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-60 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-aa-gray shadow-md transition ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
};

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

const getPurchaseLabel = (purpose) => {
  if (purpose === 'dashboard') return 'Dashboard Subscription';
  if (purpose === 'business_type_change') return 'Business Type Change';
  if (purpose === 'prepaid') return 'Prepaid Tokens';
  return 'Pay-as-you-go';
};

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const canUseTokenSystem =
    user?.admin_tier === 'super_admin' || user?.token_system_enabled === true;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paygLink, setPaygLink] = useState(null);
  const [prepaidLink, setPrepaidLink] = useState(null);
  const [actionStatus, setActionStatus] = useState('');
  const [prepaidAmount, setPrepaidAmount] = useState('500');
  const [razorpayForm, setRazorpayForm] = useState({
    keyId: '',
    keySecret: '',
    showSecret: false,
    clearSecret: false,
  });
  const [razorpaySaving, setRazorpaySaving] = useState(false);
  const [razorpayStatus, setRazorpayStatus] = useState('');
  const [billingAdmins, setBillingAdmins] = useState([]);
  const [billingAdminsLoading, setBillingAdminsLoading] = useState(false);
  const [billingAdminsStatus, setBillingAdminsStatus] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesStatus, setPurchasesStatus] = useState('');
  const [deletingPurchaseId, setDeletingPurchaseId] = useState(null);
  const [dashboardForm, setDashboardForm] = useState({
    service_inr: '',
    product_inr: '',
    both_inr: '',
    booking_inr: '',
  });
  const [dashboardSaving, setDashboardSaving] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState('');
  const [dashboardLabels, setDashboardLabels] = useState({
    service_label: '',
    product_label: '',
  });
  const [dashboardMonths, setDashboardMonths] = useState('1');
  const [renewProfileType, setRenewProfileType] = useState('');
  const [renewBookingEnabled, setRenewBookingEnabled] = useState(false);
  const [renewProfileTouched, setRenewProfileTouched] = useState(false);
  const [dashboardLabelSaving, setDashboardLabelSaving] = useState(false);
  const [dashboardLabelStatus, setDashboardLabelStatus] = useState('');

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
    if (!razorpayStatus) return;
    pushToast({
      type: razorpayStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: razorpayStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: razorpayStatus,
    });
  }, [razorpayStatus, pushToast]);

  useEffect(() => {
    if (!billingAdminsStatus) return;
    pushToast({
      type: billingAdminsStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: billingAdminsStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: billingAdminsStatus,
    });
  }, [billingAdminsStatus, pushToast]);

  useEffect(() => {
    if (!purchasesStatus) return;
    pushToast({
      type: purchasesStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: purchasesStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: purchasesStatus,
    });
  }, [purchasesStatus, pushToast]);

  useEffect(() => {
    if (!dashboardStatus) return;
    pushToast({
      type: dashboardStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: dashboardStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: dashboardStatus,
    });
  }, [dashboardStatus, pushToast]);

  useEffect(() => {
    if (!dashboardLabelStatus) return;
    pushToast({
      type: dashboardLabelStatus.toLowerCase().includes('fail') ? 'error' : 'success',
      title: dashboardLabelStatus.toLowerCase().includes('fail') ? 'Not saved' : 'Saved',
      message: dashboardLabelStatus,
    });
  }, [dashboardLabelStatus, pushToast]);

  const fetchPaymentsApi = useCallback(async (path, options = {}) => {
    const response = await fetch(`/api/payments${path}`, {
      ...options,
      credentials: 'include',
    });
    return response;
  }, []);

  const loadSummary = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetchPaymentsApi('/summary');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load billing summary.');
      }
      setSummary(payload?.data || null);
      const dashboard = payload?.data?.dashboard || {};
      if (dashboard?.rates) {
        setDashboardForm({
          service_inr: dashboard?.rates?.service_inr ?? '',
          product_inr: dashboard?.rates?.product_inr ?? '',
          both_inr: dashboard?.rates?.both_inr ?? '',
          booking_inr: dashboard?.rates?.booking_inr ?? '',
        });
      }
      if (dashboard?.profile) {
        setDashboardLabels({
          service_label: dashboard?.profile?.service_label || 'Service',
          product_label: dashboard?.profile?.product_label || 'Product',
        });
      }
      setRazorpayForm((prev) => ({
        ...prev,
        keyId: prev.keyId || payload?.data?.razorpay_key_id || '',
      }));
    } catch (err) {
      setError(err.message || 'Failed to load billing summary.');
    } finally {
      setLoading(false);
    }
  }, [fetchPaymentsApi, user?.id]);

  const loadBillingAdmins = useCallback(async () => {
    if (!user?.id || user?.admin_tier !== 'super_admin') return;
    setBillingAdminsLoading(true);
    setBillingAdminsStatus('');
    try {
      const response = await fetchPaymentsApi('/admins');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load admin billing settings.');
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBillingAdmins(
        rows.map((row) => ({
          ...row,
          edit: {
            charge_enabled: row?.charge_enabled !== false,
            free_days: '',
            input_price_usd_per_1m: row?.input_price_usd_per_1m ?? '',
            output_price_usd_per_1m: row?.output_price_usd_per_1m ?? '',
            dashboard_charge_enabled: row?.dashboard_charge_enabled !== false,
          },
        }))
      );
    } catch (err) {
      setBillingAdminsStatus(err.message || 'Failed to load admin billing settings.');
    } finally {
      setBillingAdminsLoading(false);
    }
  }, [fetchPaymentsApi, user?.admin_tier, user?.id]);

  const loadPurchases = useCallback(async () => {
    if (!user?.id) return;
    setPurchasesLoading(true);
    setPurchasesStatus('');
    try {
      const response = await fetchPaymentsApi('/purchases');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load purchases.');
      }
      setPurchases(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setPurchasesStatus(err.message || 'Failed to load purchases.');
    } finally {
      setPurchasesLoading(false);
    }
  }, [fetchPaymentsApi, user?.id]);

  const updateBillingAdminField = (adminId, field, value) => {
    setBillingAdmins((prev) =>
      prev.map((admin) =>
        admin.id === adminId
          ? { ...admin, edit: { ...admin.edit, [field]: value } }
          : admin
      )
    );
  };

  const saveAdminBilling = async (adminId) => {
    const admin = billingAdmins.find((item) => item.id === adminId);
    if (!admin) return;
    setBillingAdminsStatus('');
    try {
      const payload = {
        charge_enabled: admin.edit.charge_enabled,
        free_days: admin.edit.free_days,
        input_price_usd_per_1m: admin.edit.input_price_usd_per_1m,
        output_price_usd_per_1m: admin.edit.output_price_usd_per_1m,
      };
      const response = await fetchPaymentsApi(`/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update billing settings.');
      }
      setBillingAdminsStatus('Billing settings updated.');
      await loadBillingAdmins();
    } catch (err) {
      setBillingAdminsStatus(err.message || 'Failed to update billing settings.');
    }
  };

  const saveDashboardCharge = async (adminId) => {
    const admin = billingAdmins.find((item) => item.id === adminId);
    if (!admin) return;
    setBillingAdminsStatus('');
    try {
      const payload = {
        dashboard_charge_enabled: admin.edit.dashboard_charge_enabled,
      };
      const response = await fetchPaymentsApi(`/admins/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update dashboard charges.');
      }
      setBillingAdminsStatus('Dashboard charge settings updated.');
      await loadBillingAdmins();
    } catch (err) {
      setBillingAdminsStatus(err.message || 'Failed to update dashboard charges.');
    }
  };

  const saveDashboardRates = async () => {
    setDashboardSaving(true);
    setDashboardStatus('');
    try {
      const payload = {
        service_inr: toNumber(dashboardForm.service_inr, 0),
        product_inr: toNumber(dashboardForm.product_inr, 0),
        both_inr: toNumber(dashboardForm.both_inr, 0),
        booking_inr: toNumber(dashboardForm.booking_inr, 0),
      };
      const response = await fetchPaymentsApi('/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update dashboard rates.');
      }
      setDashboardStatus('Dashboard rates updated.');
      await loadSummary();
    } catch (err) {
      setDashboardStatus(err.message || 'Failed to update dashboard rates.');
    } finally {
      setDashboardSaving(false);
    }
  };

  const saveDashboardLabels = async () => {
    setDashboardLabelSaving(true);
    setDashboardLabelStatus('');
    try {
      const payload = {
        service_label: dashboardLabels.service_label,
        product_label: dashboardLabels.product_label,
      };
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Failed to update label names.');
      }
      setDashboardLabelStatus('Dashboard label names updated.');
      await loadSummary();
    } catch (err) {
      setDashboardLabelStatus(err.message || 'Failed to update label names.');
    } finally {
      setDashboardLabelSaving(false);
    }
  };

  const saveRazorpaySettings = async () => {
    setRazorpaySaving(true);
    setRazorpayStatus('');
    try {
      const payload = {
        razorpay_key_id: razorpayForm.keyId,
      };
      if (razorpayForm.keySecret.trim() || razorpayForm.clearSecret) {
        payload.razorpay_key_secret = razorpayForm.keySecret;
      }
      const response = await fetchPaymentsApi('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update Razorpay settings.');
      }
      setRazorpayForm((prev) => ({
        ...prev,
        keySecret: '',
        clearSecret: false,
      }));
      setRazorpayStatus('Razorpay settings updated.');
      await loadSummary();
    } catch (err) {
      setRazorpayStatus(err.message || 'Failed to update Razorpay settings.');
    } finally {
      setRazorpaySaving(false);
    }
  };

  const openPaymentUrl = useCallback((url) => {
    if (!url) return;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = url;
    }
  }, []);

  const createPaygPaymentLink = async () => {
    if (!canUseTokenSystem) {
      pushToast({
        type: 'error',
        title: 'Not allowed',
        message: 'Token billing is disabled for your account.',
      });
      return;
    }
    router.push('/billing/checkout?type=payg');
  };

  const createPrepaidPaymentLink = async () => {
    if (!canUseTokenSystem) {
      pushToast({
        type: 'error',
        title: 'Not allowed',
        message: 'Token billing is disabled for your account.',
      });
      return;
    }
    const amount = toNumber(prepaidAmount, 0);
    if (amount < minTopupInr) {
      pushToast({
        type: 'error',
        title: 'Not saved',
        message: `Minimum top-up is ${formatInr(minTopupInr)}.`,
      });
      return;
    }
    router.push(`/billing/checkout?type=prepaid&amount=${encodeURIComponent(amount)}`);
  };

  const createDashboardPaymentLink = async () => {
    const profile = ['service', 'product', 'both'].includes(renewProfileType)
      ? renewProfileType
      : dashboardProfile.business_type || 'both';
    const booking = bookingAddonAllowed
      ? resolvedRenewBooking
      : false;
    const params = new URLSearchParams({
      type: 'dashboard',
      months: String(selectedDashboardMonths),
      profile,
      booking: booking ? '1' : '0',
    });
    router.push(`/billing/checkout?${params.toString()}`);
  };

  const verifyBillingPayment = async (paymentLinkId) => {
    if (!paymentLinkId) return;
    setActionStatus('');
    try {
      const response = await fetchPaymentsApi('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_link_id: paymentLinkId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to verify payment.');
      }
      setActionStatus('Payment verified.');
      await loadSummary();
      await loadPurchases();
    } catch (err) {
      setActionStatus(err.message || 'Failed to verify payment.');
    }
  };

  const downloadPurchaseInvoice = useCallback(async (purchase) => {
    const purchaseId = Number(purchase?.id || 0);
    if (!purchaseId) return;
    try {
      const response = await fetch(`/api/payments/invoice?purchase_id=${encodeURIComponent(purchaseId)}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to download invoice PDF.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${purchaseId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      pushToast({
        type: 'success',
        title: 'Saved',
        message: 'Invoice PDF downloaded.',
      });
    } catch (_error) {
      pushToast({
        type: 'error',
        title: 'Not saved',
        message: 'Failed to download invoice PDF.',
      });
    }
  }, [pushToast]);

  const deletePurchaseHistory = async (purchase) => {
    const purchaseId = Number(purchase?.id || 0);
    if (!purchaseId) return;
    const confirmed = window.confirm('Delete this payment history entry?');
    if (!confirmed) return;
    setDeletingPurchaseId(purchaseId);
    setPurchasesStatus('');
    try {
      const response = await fetchPaymentsApi('/purchases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_id: purchaseId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete payment history.');
      }
      setPurchasesStatus('Payment history deleted.');
      await loadPurchases();
      await loadSummary();
    } catch (err) {
      setPurchasesStatus(err.message || 'Failed to delete payment history.');
    } finally {
      setDeletingPurchaseId(null);
    }
  };

  useEffect(() => {
    loadSummary();
    loadBillingAdmins();
    loadPurchases();
  }, [loadBillingAdmins, loadPurchases, loadSummary]);

  useEffect(() => {
    if (renewProfileTouched) return;
    const profile = summary?.dashboard?.profile;
    if (!profile) return;
    setRenewProfileType(profile.business_type || 'both');
    setRenewBookingEnabled(Boolean(profile.booking_enabled));
  }, [summary?.dashboard?.profile, renewProfileTouched]);

  const prepaidEstimate = useMemo(() => {
    const amount = toNumber(prepaidAmount, 0);
    const pricing = summary?.pricing || {};
    const rate = toNumber(pricing?.usd_to_inr_rate, 0);
    const inputUsd = toNumber(pricing?.input_usd_per_1m, 0);
    const outputUsd = toNumber(pricing?.output_usd_per_1m, 0);
    if (!amount || !rate || !inputUsd || !outputUsd) {
      return { inputTokens: 0, outputTokens: 0 };
    }
    const inputAmount = amount / 2;
    const outputAmount = amount - inputAmount;
    const inputTokens = Math.floor((inputAmount / (inputUsd * rate)) * 1_000_000);
    const outputTokens = Math.floor((outputAmount / (outputUsd * rate)) * 1_000_000);
    return { inputTokens, outputTokens };
  }, [prepaidAmount, summary?.pricing]);

  const balances = summary?.balances || {};
  const paygDue = summary?.totals?.total_due_inr || 0;
  const monthlyPayg = summary?.payg || {};
  const dashboard = summary?.dashboard || {};
  const dashboardRates = dashboard?.rates || {};
  const dashboardProfile = dashboard?.profile || {};
  const dashboardAmounts = dashboard?.amounts || {};
  const minTopupInr = toNumber(summary?.prepaid?.min_topup_inr, 500);
  const purchaseTotalPaid = purchases.reduce((sum, purchase) => {
    if (String(purchase?.status || '').toLowerCase() !== 'paid') return sum;
    const paidValue = Number(purchase?.paid_amount || purchase?.amount || 0);
    return sum + (Number.isFinite(paidValue) ? paidValue : 0);
  }, 0);

  const resolveDashboardRate = (value, fallback) => {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
    return toNumber(fallback, 0);
  };

  const effectiveDashboardRates = {
    service: resolveDashboardRate(dashboardForm.service_inr, dashboardRates.service_inr),
    product: resolveDashboardRate(dashboardForm.product_inr, dashboardRates.product_inr),
    both: resolveDashboardRate(dashboardForm.both_inr, dashboardRates.both_inr),
    booking: resolveDashboardRate(dashboardForm.booking_inr, dashboardRates.booking_inr),
  };

  const computeAdminDashboardCharge = (admin) => {
    const type = String(admin?.business_type || 'both').toLowerCase();
    const base =
      type === 'service'
        ? effectiveDashboardRates.service
        : type === 'product'
        ? effectiveDashboardRates.product
        : effectiveDashboardRates.both;
    const bookingCharge = admin?.booking_enabled ? effectiveDashboardRates.booking : 0;
    return {
      base,
      bookingCharge,
      total: base + bookingCharge,
    };
  };
  const serviceLabel = dashboardProfile.service_label || 'Service';
  const productLabel = dashboardProfile.product_label || 'Product';
  const dashboardTypeLabel =
    dashboardProfile.business_type === 'service'
      ? `${serviceLabel}-based`
      : dashboardProfile.business_type === 'product'
      ? `${productLabel}-based`
      : `${productLabel} + ${serviceLabel}`;
  const dashboardSubscription = dashboard?.subscription || {};
  const dashboardChargeEnabled = dashboard?.charge_enabled !== false;
  const maintenancePct = toNumber(summary?.pricing?.maintenance_fee_pct, 12);
  const dashboardOfferOptions = [
    { months: 1, label: '1 month', discount: 0 },
    { months: 3, label: '3 months', discount: 8 },
    { months: 6, label: '6 months', discount: 10 },
    { months: 12, label: '12 months', discount: 12 },
  ];
  const selectedDashboardMonths = dashboardOfferOptions.find(
    (option) => String(option.months) === String(dashboardMonths)
  )?.months || 1;
  const selectedDashboardDiscount =
    dashboardOfferOptions.find((option) => option.months === selectedDashboardMonths)?.discount || 0;
  const resolvedRenewProfile = ['service', 'product', 'both'].includes(renewProfileType)
    ? renewProfileType
    : dashboardProfile.business_type || 'both';
  const bookingAddonAllowed = resolvedRenewProfile !== 'product';
  const resolvedRenewBooking = bookingAddonAllowed
    ? Boolean(renewBookingEnabled)
    : false;
  const renewalBaseMonthly =
    resolvedRenewProfile === 'service'
      ? toNumber(dashboardRates.service_inr, 0)
      : resolvedRenewProfile === 'product'
      ? toNumber(dashboardRates.product_inr, 0)
      : toNumber(dashboardRates.both_inr, 0);
  const renewalBookingMonthly = resolvedRenewBooking
    ? toNumber(dashboardRates.booking_inr, 0)
    : 0;
  const renewalMonthlyCharge = dashboardChargeEnabled ? renewalBaseMonthly + renewalBookingMonthly : 0;
  const renewalBaseTotal = renewalBaseMonthly * selectedDashboardMonths;
  const renewalBookingTotal = renewalBookingMonthly * selectedDashboardMonths;
  const renewalDiscountAmount = Number(
    (renewalBaseTotal * (selectedDashboardDiscount / 100)).toFixed(2)
  );
  const renewalDiscountedBase = Number((renewalBaseTotal - renewalDiscountAmount).toFixed(2));
  const renewalSubtotal = Number((renewalDiscountedBase + renewalBookingTotal).toFixed(2));
  const renewalMaintenanceFee = Number((renewalSubtotal * (maintenancePct / 100)).toFixed(2));
  const renewalTotalDue = Number((renewalSubtotal + renewalMaintenanceFee).toFixed(2));

  return (
    <div className="aa-page-shell aa-stagger-children" data-testid="billing-page">
      <div className="aa-page-header">
        <div className="aa-page-header__body">
        <h1 className="aa-page-title">
          {canUseTokenSystem ? 'Billing & Tokens' : 'Billing'}
        </h1>
        <p className="aa-page-subtitle">
          {canUseTokenSystem
            ? 'Manage free tokens, prepaid top-ups, and pay-as-you-go charges.'
            : 'Your token system is disabled. Dashboard access controls remain available.'}
        </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!canUseTokenSystem && (
        <Card className="border border-gray-200 bg-white">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-aa-gray">
            Token balances, token purchases, and monthly token billing are disabled for your admin account.
            Contact your super admin if you need token billing access.
          </div>
        </Card>
      )}

      {canUseTokenSystem && (
      <>
      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <FontAwesomeIcon icon={faCoins} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aa-text-dark">Token Balances</h2>
              <p className="text-xs text-aa-gray">
                Free tokens renew monthly and carry over until the cap.
              </p>
            </div>
          </div>
          {summary?.billing_state === 'free' ? (
            <Badge variant="green">Free Tokens Active</Badge>
          ) : summary?.billing_state === 'prepaid' ? (
            <Badge variant="blue">Using Prepaid Tokens</Badge>
          ) : (
            <Badge variant="orange">Pay-as-you-go</Badge>
          )}
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-4 text-sm text-aa-gray">
            Loading token balances...
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Free Tokens</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Input</p>
                  <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                    {balances.free_input_tokens || 0}
                  </p>
                  <p className="text-[11px] text-aa-gray">/ {balances.free_input_cap || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Output</p>
                  <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                    {balances.free_output_tokens || 0}
                  </p>
                  <p className="text-[11px] text-aa-gray">/ {balances.free_output_cap || 0}</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-aa-gray">
                Adds {balances.monthly_free_input || 0} input + {balances.monthly_free_output || 0} output each month.
              </div>
              {balances.next_reset_at && (
                <div className="mt-1 text-xs text-aa-gray">
                  Next refresh: {new Date(balances.next_reset_at).toLocaleDateString('en-IN')}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Prepaid Tokens</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Input</p>
                  <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                    {balances.paid_input_tokens || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Output</p>
                  <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                    {balances.paid_output_tokens || 0}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-aa-gray">Prepaid tokens never expire.</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">AI Usage</p>
              <div className="mt-3 space-y-2 text-sm text-aa-text-dark">
                <p>
                  Conversations:{' '}
                  <span className="font-semibold">{summary?.usage?.conversation_count || 0}</span>
                </p>
                <p>
                  Input tokens:{' '}
                  <span className="font-semibold">{summary?.usage?.input_tokens || 0}</span>
                  <InfoHint text="Input tokens are the words users send to the bot." />
                </p>
                <p>
                  Output tokens:{' '}
                  <span className="font-semibold">{summary?.usage?.output_tokens || 0}</span>
                  <InfoHint text="Output tokens are the words the bot sends back." />
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
      </>
      )}

      {canUseTokenSystem && (
      <>
      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aa-text-dark">Pay-as-you-go (Monthly)</h2>
              <p className="text-xs text-aa-gray">
                Charges start only after free and prepaid tokens are used.
              </p>
              <p className="text-xs text-aa-gray">
                A 12% maintenance charge is added at checkout.
              </p>
            </div>
          </div>
          <Badge variant={paygDue > 0 ? 'orange' : 'green'}>
            {paygDue > 0 ? 'Payment Due' : 'All Paid'}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">This Month</p>
            <div className="mt-3 space-y-2 text-sm text-aa-text-dark">
              <p>
                Input tokens: <span className="font-semibold">{monthlyPayg.month_input_tokens || 0}</span>
              </p>
              <p>
                Output tokens: <span className="font-semibold">{monthlyPayg.month_output_tokens || 0}</span>
              </p>
              <p className="text-base">
                Estimated cost: <span className="font-semibold">{formatInr(monthlyPayg.month_cost_inr || 0)}</span>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Total Due</p>
            <div className="mt-3 space-y-2 text-sm text-aa-text-dark">
              <p className="text-2xl font-semibold">{formatInr(paygDue)}</p>
              <p className="text-xs text-aa-gray">Includes service + Razorpay fees.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={createPaygPaymentLink}
                disabled={loading || paygDue <= 0}
              >
                Pay Monthly Bill
              </Button>
              {paygLink?.short_url && (
                <Button
                  variant="outline"
                  onClick={() => openPaymentUrl(paygLink.short_url)}
                >
                  Open Payment Link
                </Button>
              )}
              {paygLink?.payment_link_id && (
                <Button variant="ghost" onClick={() => verifyBillingPayment(paygLink.payment_link_id)}>
                  Verify Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
      </>
      )}

      {canUseTokenSystem && (
      <>
      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aa-text-dark">Prepaid Token Top-up</h2>
              <p className="text-xs text-aa-gray">
                Minimum top-up is ₹{summary?.prepaid?.min_topup_inr || 500}. Split 50/50 between input and output.
              </p>
              <p className="mt-1 text-xs text-aa-gray">
                Pricing uses the current plan rates for input and output tokens.
              </p>
              <p className="mt-1 text-xs text-aa-gray">
                A 12% maintenance charge is added at checkout.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <Input
              label="Top-up Amount (INR)"
              type="number"
              value={prepaidAmount}
              onChange={(event) => setPrepaidAmount(event.target.value)}
              placeholder="500"
              min={minTopupInr}
            />
            <p className="mt-2 text-xs text-aa-gray">
              Minimum top-up is {formatInr(minTopupInr)}.
            </p>
            <p className="mt-1 text-xs text-aa-gray">GST will be added by the payment gateway if applicable.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Estimated Tokens</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Input</p>
                <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                  {prepaidEstimate.inputTokens || 0}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-aa-gray">Output</p>
                <p className="mt-1 text-lg font-semibold text-aa-text-dark">
                  {prepaidEstimate.outputTokens || 0}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-aa-gray">
              Calculated using your current pricing. This estimate updates if pricing changes.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={createPrepaidPaymentLink}
                disabled={loading || toNumber(prepaidAmount, 0) < minTopupInr}
              >
                Buy Tokens
              </Button>
              {prepaidLink?.short_url && (
                <Button
                  variant="outline"
                  onClick={() => openPaymentUrl(prepaidLink.short_url)}
                >
                  Open Payment Link
                </Button>
              )}
              {prepaidLink?.payment_link_id && (
                <Button variant="ghost" onClick={() => verifyBillingPayment(prepaidLink.payment_link_id)}>
                  Verify Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
      </>
      )}

      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aa-text-dark">Dashboard Charges</h2>
              <p className="text-xs text-aa-gray">
                Set monthly dashboard pricing and control who gets charged.
              </p>
            </div>
          </div>
        </div>

        {user?.admin_tier === 'super_admin' ? (
          <div className="mt-4 space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <Input
                label="Service-based (INR / month)"
                type="number"
                value={dashboardForm.service_inr}
                onChange={(event) =>
                  setDashboardForm((prev) => ({ ...prev, service_inr: event.target.value }))
                }
                placeholder="0"
              />
              <Input
                label="Product-based (INR / month)"
                type="number"
                value={dashboardForm.product_inr}
                onChange={(event) =>
                  setDashboardForm((prev) => ({ ...prev, product_inr: event.target.value }))
                }
                placeholder="0"
              />
              <Input
                label="Product + Service (INR / month)"
                type="number"
                value={dashboardForm.both_inr}
                onChange={(event) =>
                  setDashboardForm((prev) => ({ ...prev, both_inr: event.target.value }))
                }
                placeholder="0"
              />
              <Input
                label="Booking add-on (INR / month)"
                type="number"
                value={dashboardForm.booking_inr}
                onChange={(event) =>
                  setDashboardForm((prev) => ({ ...prev, booking_inr: event.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={saveDashboardRates} disabled={dashboardSaving}>
                {dashboardSaving ? 'Saving...' : 'Save Dashboard Rates'}
              </Button>
              {dashboardStatus && <span className="text-sm text-aa-gray">{dashboardStatus}</span>}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-aa-text-dark">Per-admin Access</h3>
                  <p className="text-xs text-aa-gray">
                    Turn dashboard billing on/off for each admin.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {billingAdmins.map((admin) => {
                  const charges = computeAdminDashboardCharge(admin);
                  const chargeEnabled = admin.edit?.dashboard_charge_enabled !== false;
                  return (
                    <div key={`dashboard-admin-${admin.id}`} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-aa-text-dark">
                            {admin.name || admin.email || admin.phone || `Admin #${admin.id}`}
                          </p>
                          <p className="text-xs text-aa-gray">
                            {admin.business_type || 'both'} • {admin.booking_enabled ? 'Booking on' : 'Booking off'}
                          </p>
                        </div>
                        <Badge variant={chargeEnabled ? 'orange' : 'default'}>
                          {chargeEnabled ? formatInr(charges.total) : 'Free'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-aa-gray">
                        <span>Base: {formatInr(charges.base)}</span>
                        {admin.booking_enabled && <span>Booking: {formatInr(charges.bookingCharge)}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-aa-text-dark">
                          <input
                            type="checkbox"
                            checked={chargeEnabled}
                            onChange={(event) =>
                              updateBillingAdminField(admin.id, 'dashboard_charge_enabled', event.target.checked)
                            }
                          />
                          Charges enabled
                        </label>
                        <Button variant="outline" onClick={() => saveDashboardCharge(admin.id)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-aa-gray">Your Plan</p>
                  <p className="text-sm text-aa-text-dark">Current dashboard billing summary.</p>
                </div>
                <Badge variant={dashboardChargeEnabled ? (dashboardSubscription?.active ? 'green' : 'orange') : 'default'}>
                  {dashboardChargeEnabled
                    ? dashboardSubscription?.active
                      ? 'Active'
                      : 'Expired'
                    : 'Disabled'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-aa-gray">Profile</span>
                  <span className="font-semibold text-aa-text-dark">{dashboardTypeLabel}</span>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-aa-gray">Base charge</span>
                  <span className="font-semibold text-aa-text-dark">{formatInr(dashboardAmounts.base_inr || 0)}</span>
                </div>
                {dashboardProfile.booking_enabled && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.18em] text-aa-gray">Booking add-on</span>
                    <span className="font-semibold text-aa-text-dark">{formatInr(dashboardAmounts.booking_inr || 0)}</span>
                  </div>
                )}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-aa-gray">Total</span>
                  <span className="font-semibold text-aa-text-dark">{formatInr(dashboardAmounts.total_inr || 0)}</span>
                </div>
              </div>
              {dashboardChargeEnabled ? (
                <p className="mt-3 text-xs text-aa-gray">
                  Subscription {dashboardSubscription?.active ? 'renews by' : 'expired on'}{' '}
                  {dashboardSubscription?.expires_at
                    ? new Date(dashboardSubscription.expires_at).toLocaleString('en-IN')
                    : 'N/A'}
                </p>
              ) : (
                <p className="mt-3 text-xs text-aa-gray">Dashboard charges are currently disabled for you.</p>
              )}
            </div>

            {dashboardChargeEnabled && (
              <div className="rounded-2xl border border-[#f1dcc5] bg-gradient-to-br from-white via-[#fff8ef] to-[#fff1dd] px-4 py-4">
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
                  <div className="flex-1">
                    <div className="rounded-2xl border border-[#f3d9b8] bg-white p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-aa-gray">
                            Renew Dashboard Access
                          </p>
                          <p className="mt-1 text-sm font-medium text-aa-text-dark">
                            Choose a plan length. Longer plans unlock discounts.
                          </p>
                        </div>
                        <span className="self-start rounded-full bg-[#fff3e2] px-3 py-1 text-xs font-semibold whitespace-nowrap text-aa-dark-blue">
                          Live renewal
                        </span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-[#f2dfc2] bg-[#fffaf2] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-aa-gray">Renewal Profile</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <GeminiSelect
                            label="Business profile"
                            value={resolvedRenewProfile}
                            onChange={(value) => {
                              const nextType = value;
                              setRenewProfileType(nextType);
                              setRenewProfileTouched(true);
                              if (nextType === 'product') {
                                setRenewBookingEnabled(false);
                              }
                            }}
                            options={[
                              { value: 'service', label: `${serviceLabel}-based` },
                              { value: 'product', label: `${productLabel}-based` },
                              { value: 'both', label: `${productLabel} + ${serviceLabel}` },
                            ]}
                            variant="vibrant"
                            size="sm"
                          />
                          <div className="rounded-xl border border-[#f2dfc2] bg-white p-3">
                            <p className="text-xs font-semibold text-aa-gray">Booking add-on</p>
                            <label
                              className={`mt-2 flex w-full items-start gap-2 text-sm leading-relaxed ${
                                bookingAddonAllowed ? 'text-aa-text-dark' : 'text-aa-gray'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={resolvedRenewBooking}
                                onChange={(event) => {
                                  setRenewBookingEnabled(event.target.checked);
                                  setRenewProfileTouched(true);
                                }}
                                disabled={!bookingAddonAllowed}
                                className="mt-0.5 h-4 w-4 shrink-0"
                              />
                              <span className="min-w-0 break-words">
                                Include booking add-on
                                {dashboardRates.booking_inr ? ` (+${formatInr(dashboardRates.booking_inr)}/month)` : ''}
                              </span>
                            </label>
                            {!bookingAddonAllowed && (
                              <p className="mt-1 text-xs text-aa-gray">
                                Booking add-on is available for service or combined profiles.
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-aa-gray">
                          Changing the profile here will update your account once the payment is verified.
                        </p>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                        {dashboardOfferOptions.map((option) => {
                          const isSelected = option.months === selectedDashboardMonths;
                          return (
                            <button
                              key={`dashboard-offer-${option.months}`}
                              type="button"
                              onClick={() => setDashboardMonths(String(option.months))}
                              className={`group h-full rounded-2xl border px-4 py-4 text-left text-sm transition ${
                                isSelected
                                  ? 'border-aa-orange bg-white text-aa-text-dark shadow-[0_12px_30px_rgba(255,107,53,0.15)]'
                                  : 'border-gray-200 bg-white text-aa-gray hover:border-aa-orange/60 hover:text-aa-text-dark'
                              }`}
                            >
                              <div className="flex h-full flex-col gap-2">
                                <div className="text-base font-semibold">{option.label}</div>
                                <span
                                  className={`inline-flex w-fit items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    option.discount
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {option.discount ? `${option.discount}% off` : 'Standard'}
                                </span>
                                <div className="text-xs text-aa-gray">
                                  {option.months === 1 ? 'Pay monthly' : `Billed once for ${option.months} months`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="w-full lg:w-auto lg:min-w-[320px]">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.28em] text-aa-gray">Summary</p>
                      <div className="mt-3 space-y-2 text-sm text-aa-text-dark">
                        <div className="flex items-center justify-between">
                          <span className="text-aa-gray">Base</span>
                          <span className="font-semibold">{formatInr(renewalBaseTotal)}</span>
                        </div>
                        {renewalBookingTotal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-aa-gray">Booking add-on</span>
                            <span className="font-semibold">{formatInr(renewalBookingTotal)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-aa-gray">Discount</span>
                          <span className="font-semibold text-emerald-600">
                            -{formatInr(renewalDiscountAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-aa-gray">Maintenance ({maintenancePct}%)</span>
                          <span className="font-semibold">{formatInr(renewalMaintenanceFee)}</span>
                        </div>
                        <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-base">
                          <span className="font-semibold text-aa-text-dark">Total</span>
                          <span className="font-semibold text-aa-text-dark">{formatInr(renewalTotalDue)}</span>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        onClick={createDashboardPaymentLink}
                        disabled={renewalMonthlyCharge <= 0}
                        className="mt-4 w-full"
                      >
                        Pay Subscription
                      </Button>
                      {renewalMonthlyCharge <= 0 && (
                        <p className="mt-2 text-xs text-aa-gray">
                          Dashboard rates are not configured yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-aa-gray">Label Names</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Service label"
                  value={dashboardLabels.service_label}
                  onChange={(event) =>
                    setDashboardLabels((prev) => ({ ...prev, service_label: event.target.value }))
                  }
                  placeholder="Service"
                />
                <Input
                  label="Product label"
                  value={dashboardLabels.product_label}
                  onChange={(event) =>
                    setDashboardLabels((prev) => ({ ...prev, product_label: event.target.value }))
                  }
                  placeholder="Product"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={saveDashboardLabels} disabled={dashboardLabelSaving}>
                  {dashboardLabelSaving ? 'Saving...' : 'Save Label Names'}
                </Button>
                {dashboardLabelStatus && <span className="text-sm text-aa-gray">{dashboardLabelStatus}</span>}
              </div>
            </div>
          </div>
        )}
      </Card>
      <Card className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-aa-text-dark">Purchase History</h2>
            <p className="text-xs text-aa-gray">
              {user?.admin_tier === 'super_admin'
                ? 'All admin payments, subscriptions, and token purchases.'
                : 'Your payment history and subscription purchases.'}
            </p>
          </div>
          <Button variant="outline" onClick={loadPurchases} disabled={purchasesLoading}>
            Refresh
          </Button>
        </div>

        {purchasesStatus && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {purchasesStatus}
          </div>
        )}

        {purchasesLoading ? (
          <div className="mt-4 rounded-xl bg-gray-50 px-4 py-4 text-sm text-aa-gray">
            Loading purchases...
          </div>
        ) : purchases.length === 0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 px-4 py-4 text-sm text-aa-gray">
            No purchases yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-aa-text-dark">
              Total paid: <span className="font-semibold">{formatInr(purchaseTotalPaid)}</span>
            </div>
            {purchases.map((purchase) => {
              const total = Number(purchase.amount || 0);
              const baseAmount = Number(purchase.base_amount || 0) || total;
              const maintenanceFee = Number(purchase.maintenance_fee || 0);
              const isPrepaid = purchase.purpose === 'prepaid';
              const isDashboard = purchase.purpose === 'dashboard';
              const label = getPurchaseLabel(purchase.purpose);
              return (
                <div key={purchase.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">
                        {label}
                      </p>
                      <p className="text-xs text-aa-gray">
                        {new Date(purchase.created_at).toLocaleString('en-IN')}
                      </p>
                      {user?.admin_tier === 'super_admin' && (
                        <p className="text-xs text-aa-gray">
                          {purchase.admin_name || purchase.admin_email || purchase.admin_phone || `Admin #${purchase.admin_id}`}
                        </p>
                      )}
                    </div>
                    <Badge variant={purchase.status === 'paid' ? 'green' : 'default'}>
                      {purchase.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-aa-gray sm:grid-cols-3">
                    <span>Base: {formatInr(baseAmount)}</span>
                    <span>Maintenance (12%): {formatInr(maintenanceFee)}</span>
                    <span>Total: {formatInr(total)}</span>
                  </div>
                  {isPrepaid && canUseTokenSystem && (
                    <div className="mt-2 text-xs text-aa-gray">
                      Tokens: {purchase.input_tokens || 0} input + {purchase.output_tokens || 0} output
                    </div>
                  )}
                  {isDashboard && (
                    <div className="mt-2 text-xs text-aa-gray">
                      {purchase.subscription_months || 0} months • Monthly {formatInr(purchase.dashboard_monthly_amount || 0)} • Discount {purchase.discount_pct || 0}%
                    </div>
                  )}
                  {purchase.paid_at && (
                    <div className="mt-2 text-xs text-aa-gray">
                      Paid at: {new Date(purchase.paid_at).toLocaleString('en-IN')}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {purchase.status === 'paid' && (
                      <Button
                        variant="outline"
                        onClick={() => downloadPurchaseInvoice(purchase)}
                      >
                        Download Invoice
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => deletePurchaseHistory(purchase)}
                      disabled={deletingPurchaseId === purchase.id}
                      className="text-red-600 hover:bg-red-50"
                    >
                      {deletingPurchaseId === purchase.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {canUseTokenSystem && (
      <>
      <Card className="border border-gray-200 bg-white">
        <h3 className="text-base font-semibold text-aa-text-dark">Razorpay Payout Keys</h3>
        <p className="mt-1 text-xs text-aa-gray">
          Add your own Razorpay Key ID & Secret to receive customer payments. If empty, the super admin account is used.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Razorpay Key ID"
            value={razorpayForm.keyId}
            onChange={(event) =>
              setRazorpayForm((prev) => ({ ...prev, keyId: event.target.value }))
            }
            placeholder="rzp_test_xxxxx"
          />
          <Input
            label="Razorpay Key Secret"
            type={razorpayForm.showSecret ? 'text' : 'password'}
            value={razorpayForm.keySecret}
            onChange={(event) =>
              setRazorpayForm((prev) => ({
                ...prev,
                keySecret: event.target.value,
                clearSecret: false,
              }))
            }
            placeholder={summary?.razorpay_has_secret ? 'Secret saved' : 'Enter secret'}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() =>
              setRazorpayForm((prev) => ({
                ...prev,
                showSecret: !prev.showSecret,
              }))
            }
          >
            {razorpayForm.showSecret ? 'Hide Secret' : 'Show Secret'}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setRazorpayForm((prev) => ({
                ...prev,
                keySecret: '',
                clearSecret: true,
              }))
            }
          >
            Clear Secret
          </Button>
          <Button variant="primary" onClick={saveRazorpaySettings} disabled={razorpaySaving}>
            {razorpaySaving ? 'Saving...' : 'Save Keys'}
          </Button>
          {razorpayStatus && <span className="text-sm text-aa-gray">{razorpayStatus}</span>}
        </div>
      </Card>

      {user?.admin_tier === 'super_admin' && (
        <Card className="border border-gray-200 bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-aa-text-dark">Admin Billing Overrides</h3>
              <p className="text-xs text-aa-gray">
                Control who is charged, set free windows, and override per-admin pricing.
              </p>
              <p className="mt-1 text-xs text-aa-gray">
                Leave Input/Output pricing empty to use the default $5/$10 per 1M tokens.
              </p>
            </div>
            <Button variant="outline" onClick={loadBillingAdmins} disabled={billingAdminsLoading}>
              Refresh
            </Button>
          </div>

          {billingAdminsStatus && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {billingAdminsStatus}
            </div>
          )}

          {billingAdminsLoading ? (
            <div className="mt-4 rounded-xl bg-gray-50 px-4 py-4 text-sm text-aa-gray">
              Loading admin billing settings...
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {billingAdmins.map((admin) => (
                <div key={admin.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">
                        {admin.name || admin.email || admin.phone || `Admin #${admin.id}`}
                      </p>
                      <p className="text-xs text-aa-gray">
                        {admin.admin_tier === 'super_admin' ? 'Super Admin' : 'Admin'} • {admin.status}
                      </p>
                    </div>
                    <Badge variant={admin.edit?.charge_enabled === false ? 'default' : 'orange'}>
                      {admin.edit?.charge_enabled === false ? 'Free' : 'Chargeable'}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={admin.edit?.charge_enabled !== false}
                        onChange={(event) =>
                          updateBillingAdminField(admin.id, 'charge_enabled', event.target.checked)
                        }
                      />
                      <span className="text-sm text-aa-text-dark">Charges enabled</span>
                    </div>
                    <Input
                      label="Free days"
                      type="number"
                      value={admin.edit?.free_days || ''}
                      onChange={(event) =>
                        updateBillingAdminField(admin.id, 'free_days', event.target.value)
                      }
                      placeholder="30"
                    />
                    <Input
                      label="Input USD/1M"
                      type="number"
                      value={admin.edit?.input_price_usd_per_1m ?? ''}
                      onChange={(event) =>
                        updateBillingAdminField(admin.id, 'input_price_usd_per_1m', event.target.value)
                      }
                      placeholder="5"
                    />
                    <Input
                      label="Output USD/1M"
                      type="number"
                      value={admin.edit?.output_price_usd_per_1m ?? ''}
                      onChange={(event) =>
                        updateBillingAdminField(admin.id, 'output_price_usd_per_1m', event.target.value)
                      }
                      placeholder="10"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-aa-gray">
                      Free until:{' '}
                      {admin.free_until
                        ? new Date(admin.free_until).toLocaleDateString('en-IN')
                        : 'Not set'}
                    </span>
                    <Button variant="primary" onClick={() => saveAdminBilling(admin.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      </>
      )}

      {actionStatus && <div className="text-sm text-aa-gray">{actionStatus}</div>}
    </div>
  );
}
