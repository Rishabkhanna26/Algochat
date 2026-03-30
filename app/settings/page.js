'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Input from '../components/common/Input.jsx';
import Badge from '../components/common/Badge.jsx';
import GeminiSelect from '../components/common/GeminiSelect.jsx';
import { useToast } from '../components/common/ToastProvider.jsx';
import { useAuth } from '../components/auth/AuthProvider.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faPalette,
  faMobileScreen,
  faShieldHalved,
  faCheck,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_THEME,
  THEMES,
  applyAccentColor,
  applyTheme,
  getStoredAccentColor,
  getStoredTheme,
  storeAccentColor,
  storeTheme,
} from '../../lib/appearance.js';
import { getBackendJwt } from '../../lib/backend-auth.js';
import { getBusinessTypeLabel, hasProductAccess } from '../../lib/business.js';
import { isRestrictedModeUser } from '../../lib/access.js';

const WHATSAPP_API_BASE =
  process.env.NEXT_PUBLIC_WHATSAPP_API_BASE || 'http://localhost:4000';
const WHATSAPP_SOCKET_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_SOCKET_URL || WHATSAPP_API_BASE;
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const buildWhatsAppOriginCandidates = (baseUrl) => {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (typeof window !== 'undefined') {
    try {
      const parsed = new URL(baseUrl, window.location.origin);
      if (
        LOCALHOST_HOSTS.has(parsed.hostname) &&
        !LOCALHOST_HOSTS.has(window.location.hostname)
      ) {
        parsed.hostname = window.location.hostname;
        addCandidate(parsed.origin);
      }
    } catch (_error) {
      // Ignore malformed env values and keep the original candidate only.
    }
  }

  addCandidate(baseUrl);

  return candidates;
};

const BUSINESS_TYPE_OPTIONS = [
  { value: 'product', label: 'Product-based' },
  { value: 'service', label: 'Service-based' },
  { value: 'both', label: 'Product + Service' },
];

const FREE_DELIVERY_SCOPE_OPTIONS = [
  { value: 'combined', label: 'Combined order total' },
  { value: 'eligible_only', label: 'Only marked products' },
];

const formatHourAmPm = (hour) => {
  const normalized = ((Number(hour) % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12} ${suffix}`;
};

const toBusinessHoursRange = (startHour, endHour) =>
  `${formatHourAmPm(startHour)} - ${formatHourAmPm(endHour)}`;

const parseBusinessHoursRange = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.match(
    /(\d{1,2})(?::\d{1,2})?\s*(am|pm)\s*(?:to|-|–|—)\s*(\d{1,2})(?::\d{1,2})?\s*(am|pm)/i
  );
  if (!match) return null;
  const to24Hour = (rawHour, rawPeriod) => {
    const hour = Number.parseInt(rawHour, 10);
    if (!Number.isFinite(hour) || hour < 1 || hour > 12) return null;
    const period = String(rawPeriod || '').toLowerCase();
    if (period === 'am') return hour % 12;
    if (period === 'pm') return (hour % 12) + 12;
    return null;
  };
  const start = to24Hour(match[1], match[2]);
  const end = to24Hour(match[3], match[4]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
};

const BUSINESS_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: formatHourAmPm(hour),
}));

const normalizeFreeDeliveryProductRules = (rules) => {
  if (!Array.isArray(rules)) return [];
  const seen = new Set();
  const normalized = [];
  rules.forEach((entry) => {
    const productIdRaw =
      entry?.catalog_item_id ?? entry?.catalogItemId ?? entry?.product_id ?? entry?.productId;
    const minAmountRaw = entry?.min_amount ?? entry?.minAmount;
    const productNameRaw =
      entry?.product_name ?? entry?.productName ?? entry?.name ?? '';
    const productId = Math.trunc(Number(productIdRaw));
    const minAmount = Number(minAmountRaw);
    if (!Number.isFinite(productId) || productId <= 0) return;
    if (!Number.isFinite(minAmount) || minAmount <= 0) return;
    if (seen.has(productId)) return;
    seen.add(productId);
    normalized.push({
      catalog_item_id: String(productId),
      min_amount: String(Number(minAmount.toFixed(2))),
      product_name: String(productNameRaw || ''),
    });
  });
  return normalized.slice(0, 100);
};

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
        className={`pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-aa-gray shadow-md transition ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
};

export default function SettingsPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    business_name: '',
    business_category: '',
    business_type: 'both',
    business_address: '',
    business_hours: '',
    business_map_url: '',
    two_factor_enabled: false,
    free_delivery_enabled: false,
    free_delivery_min_amount: '',
    free_delivery_scope: 'combined',
    free_delivery_product_rules: [],
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [businessTypeRequest, setBusinessTypeRequest] = useState({
    desired: 'product',
    reason: '',
    existing: null,
    loading: false,
    error: '',
    success: '',
  });
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappCanReconnect, setWhatsappCanReconnect] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('idle');
  const [whatsappAuthMethod, setWhatsappAuthMethod] = useState('code');
  const [whatsappQr, setWhatsappQr] = useState('');
  const [whatsappPairingCode, setWhatsappPairingCode] = useState('');
  const [whatsappPairingPhoneInput, setWhatsappPairingPhoneInput] = useState('');
  const [whatsappQrVersion, setWhatsappQrVersion] = useState(0);
  const whatsappAuthMethodRef = useRef('code');
  const whatsappQrRef = useRef('');
  const whatsappQrJobRef = useRef(0);
  const whatsappSocketClosingRef = useRef(false);
  const settingsMountedRef = useRef(true);
  const [whatsappActionStatus, setWhatsappActionStatus] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState('');
  const [whatsappConfig, setWhatsappConfig] = useState({
    phone: '',
    businessName: '',
    category: '',
    businessType: 'both',
  });
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentLink, setPaymentLink] = useState(null);
  const [paymentActionStatus, setPaymentActionStatus] = useState('');
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
  const [freeDeliveryProducts, setFreeDeliveryProducts] = useState([]);
  const [freeDeliveryLoading, setFreeDeliveryLoading] = useState(false);
  const [freeDeliveryError, setFreeDeliveryError] = useState('');
  const restrictedMode = isRestrictedModeUser(user);
  const productAccess = Boolean(user?.id) && (restrictedMode || hasProductAccess(user));
  const eligibleFreeDeliveryProducts = freeDeliveryProducts.filter(
    (item) => item?.item_type === 'product' && item?.is_active && item?.free_delivery_eligible
  );
  const parsedBusinessHours = parseBusinessHoursRange(profile.business_hours);
  const businessStartHour = parsedBusinessHours?.start ?? 10;
  const businessEndHour = parsedBusinessHours?.end ?? 19;
  const eligibleFreeDeliveryProductOptions = eligibleFreeDeliveryProducts.map((item) => ({
    value: String(item.id),
    label: item.name || `Product #${item.id}`,
  }));

  const setFreeDeliveryRuleAt = (index, nextRule) => {
    setProfile((prev) => {
      const currentRules = Array.isArray(prev.free_delivery_product_rules)
        ? prev.free_delivery_product_rules
        : [];
      const nextRules = [...currentRules];
      nextRules[index] = { ...(nextRules[index] || {}), ...nextRule };
      return {
        ...prev,
        free_delivery_product_rules: nextRules,
      };
    });
  };

  const addFreeDeliveryRule = () => {
    setProfile((prev) => {
      const currentRules = Array.isArray(prev.free_delivery_product_rules)
        ? prev.free_delivery_product_rules
        : [];
      if (currentRules.length >= 100) return prev;
      return {
        ...prev,
        free_delivery_product_rules: [
          ...currentRules,
          {
            catalog_item_id: '',
            min_amount: '',
            product_name: '',
          },
        ],
      };
    });
  };

  const removeFreeDeliveryRule = (index) => {
    setProfile((prev) => {
      const currentRules = Array.isArray(prev.free_delivery_product_rules)
        ? prev.free_delivery_product_rules
        : [];
      return {
        ...prev,
        free_delivery_product_rules: currentRules.filter((_, idx) => idx !== index),
      };
    });
  };

  const getToastTone = useCallback((message, fallback = 'success') => {
    const text = String(message || '').toLowerCase();
    if (
      text.includes('fail') ||
      text.includes('error') ||
      text.includes('unable') ||
      text.includes('could not') ||
      text.includes('invalid')
    ) {
      return 'error';
    }
    return fallback;
  }, []);

  useEffect(() => {
    if (!saveStatus) return;
    pushToast({
      type: getToastTone(saveStatus),
      title: getToastTone(saveStatus) === 'error' ? 'Not saved' : 'Saved',
      message: saveStatus,
    });
  }, [saveStatus, getToastTone, pushToast]);

  useEffect(() => {
    if (!passwordStatus) return;
    pushToast({
      type: getToastTone(passwordStatus),
      title: getToastTone(passwordStatus) === 'error' ? 'Not saved' : 'Saved',
      message: passwordStatus,
    });
  }, [passwordStatus, getToastTone, pushToast]);

  useEffect(() => {
    if (!whatsappActionStatus) return;
    pushToast({
      type: 'error',
      title: 'Action failed',
      message: whatsappActionStatus,
    });
    setWhatsappActionStatus('');
  }, [whatsappActionStatus, pushToast]);

  useEffect(() => {
    settingsMountedRef.current = true;
    return () => {
      settingsMountedRef.current = false;
    };
  }, []);

  const updatePasswordField = (field) => (event) =>
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));

  const setWhatsappAuthMode = useCallback((nextMethod) => {
    const normalized = String(nextMethod || '').trim().toLowerCase() === 'qr' ? 'qr' : 'code';
    whatsappAuthMethodRef.current = normalized;
    setWhatsappAuthMethod(normalized);
  }, []);

  const updateWhatsappQr = useCallback((nextQr) => {
    const normalized = nextQr || '';
    if (whatsappQrRef.current === normalized) return;
    whatsappQrRef.current = normalized;
    setWhatsappQr(normalized);
    setWhatsappQrVersion((prev) => prev + 1);
    whatsappQrJobRef.current += 1;
  }, []);

  const normalizePairingPhone = useCallback((value) => {
    return String(value || '').replace(/\D/g, '').slice(0, 15);
  }, []);

  const markWhatsappDisconnectedUi = useCallback(({ allowReconnect = true } = {}) => {
    setWhatsappStatus('disconnected');
    setWhatsappConnected(false);
    setWhatsappAuthMode('code');
    if (!allowReconnect) {
      setWhatsappCanReconnect(false);
    }
    updateWhatsappQr('');
    setWhatsappPairingCode('');
  }, [setWhatsappAuthMode, updateWhatsappQr]);

  const applyWhatsappStatusPayload = useCallback((payload = {}) => {
    const nextStatus = String(payload?.status || 'disconnected');
    const isCurrentAdmin =
      !payload?.activeAdminId || !user?.id || payload.activeAdminId === user.id;
    const nextAuthMethod =
      String(payload?.authMethod || '').trim().toLowerCase() === 'qr'
        ? 'qr'
        : String(payload?.authMethod || '').trim().toLowerCase() === 'code'
        ? 'code'
        : whatsappAuthMethodRef.current;
    let derivedStatus =
      nextStatus === 'connected' && !isCurrentAdmin
        ? 'connected_other'
        : nextStatus;
    const isConnected = derivedStatus === 'connected' && isCurrentAdmin;
    const canReconnect = Boolean(payload?.canReconnect);

    setWhatsappAuthMode(nextAuthMethod);
    setWhatsappStatus(derivedStatus);
    setWhatsappConnected(isConnected);
    setWhatsappCanReconnect(canReconnect);
    setWhatsappActionStatus('');

    if (isConnected) {
      updateWhatsappQr('');
      setWhatsappPairingCode('');
      return;
    }
    if (payload?.pairingCode) {
      setWhatsappAuthMode('code');
      updateWhatsappQr('');
      setWhatsappPairingCode(String(payload.pairingCode));
      if (payload?.pairingPhoneNumber) {
        setWhatsappPairingPhoneInput(
          normalizePairingPhone(payload.pairingPhoneNumber)
        );
      }
      return;
    }
    if (payload?.qrImage && nextAuthMethod !== 'code') {
      setWhatsappPairingCode('');
      updateWhatsappQr(payload.qrImage);
      return;
    }
    if (derivedStatus !== 'qr' && derivedStatus !== 'code') {
      updateWhatsappQr('');
      setWhatsappPairingCode('');
    }
  }, [normalizePairingPhone, setWhatsappAuthMode, updateWhatsappQr, user?.id]);

  const fetchWhatsAppApi = useCallback(async (path, options = {}, retry = true) => {
    const response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
    });

    if (response.status === 401 && retry) {
      await getBackendJwt({ forceRefresh: true });
      return fetch(`/api${path}`, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
      });
    }

    return response;
  }, []);

  const fetchPaymentsApi = useCallback(async (path, options = {}) => {
    const response = await fetch(`/api/payments${path}`, {
      ...options,
      credentials: 'include',
    });
    return response;
  }, []);

  const loadPaymentSummary = useCallback(async () => {
    if (!user?.id) return;
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await fetchPaymentsApi('/summary');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load payment summary.');
      }
      setPaymentSummary(payload?.data || null);
      setRazorpayForm((prev) => ({
        ...prev,
        keyId: prev.keyId || payload?.data?.razorpay_key_id || '',
      }));
    } catch (error) {
      setPaymentError(error.message || 'Failed to load payment summary.');
    } finally {
      setPaymentLoading(false);
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
            input_price_usd_per_1m:
              row?.input_price_usd_per_1m ?? '',
            output_price_usd_per_1m:
              row?.output_price_usd_per_1m ?? '',
          },
        }))
      );
    } catch (error) {
      setBillingAdminsStatus(error.message || 'Failed to load admin billing settings.');
    } finally {
      setBillingAdminsLoading(false);
    }
  }, [fetchPaymentsApi, user?.admin_tier, user?.id]);

  const updateBillingAdminField = (adminId, field, value) => {
    setBillingAdmins((prev) =>
      prev.map((admin) =>
        admin.id === adminId
          ? { ...admin, edit: { ...admin.edit, [field]: value } }
          : admin
      )
    );
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
      await loadPaymentSummary();
    } catch (error) {
      setRazorpayStatus(error.message || 'Failed to update Razorpay settings.');
    } finally {
      setRazorpaySaving(false);
    }
  };

  const createBillingPaymentLink = async () => {
    setPaymentActionStatus('');
    try {
      const response = await fetchPaymentsApi('/pay', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create payment link.');
      }
      setPaymentLink(payload?.data || null);
      if (payload?.data?.short_url) {
        const popup = window.open(payload.data.short_url, '_blank', 'noopener,noreferrer');
        if (!popup) {
          window.location.href = payload.data.short_url;
        }
      }
    } catch (error) {
      setPaymentActionStatus(error.message || 'Failed to create payment link.');
    }
  };

  const verifyBillingPayment = async () => {
    if (!paymentLink?.payment_link_id) return;
    setPaymentActionStatus('');
    try {
      const response = await fetchPaymentsApi('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_link_id: paymentLink.payment_link_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to verify payment.');
      }
      setPaymentActionStatus('Payment verified.');
      await loadPaymentSummary();
    } catch (error) {
      setPaymentActionStatus(error.message || 'Failed to verify payment.');
    }
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
    } catch (error) {
      setBillingAdminsStatus(error.message || 'Failed to update billing settings.');
    }
  };

  useEffect(() => {
    const storedAccent = getStoredAccentColor();
    const initialAccent = storedAccent || DEFAULT_ACCENT_COLOR;
    setAccentColor(initialAccent);
    applyAccentColor(initialAccent);
    const storedTheme = getStoredTheme(user?.id);
    const initialTheme = THEMES.includes(storedTheme) ? storedTheme : DEFAULT_THEME;
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (activeTab === 'payments') {
      loadPaymentSummary();
      loadBillingAdmins();
    }
  }, [activeTab, loadBillingAdmins, loadPaymentSummary, user?.id]);

  const handleAccentChange = (color) => {
    setAccentColor(color);
    applyAccentColor(color);
    storeAccentColor(color);
  };

  const handleThemeChange = (nextTheme) => {
    const resolved = nextTheme === 'dark' ? 'dark' : 'light';
    setTheme(resolved);
    applyTheme(resolved);
    storeTheme(resolved, user?.id);
  };

  const renderQrFromRaw = useCallback(
    async (qrText) => {
      if (!qrText) return;
      const jobId = (whatsappQrJobRef.current += 1);
      try {
        const { toDataURL } = await import('qrcode');
        const dataUrl = await toDataURL(qrText);
        if (whatsappQrJobRef.current !== jobId) return;
        updateWhatsappQr(dataUrl);
      } catch (error) {
        console.error('Failed to render WhatsApp QR:', error);
      }
    },
    [updateWhatsappQr]
  );

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        business_name: user.business_name || prev.business_name,
        business_category: user.business_category || prev.business_category,
        business_type: user.business_type || prev.business_type,
        business_address: user.business_address || prev.business_address,
        business_hours: user.business_hours || prev.business_hours,
        business_map_url: user.business_map_url || prev.business_map_url,
        two_factor_enabled:
          user.two_factor_enabled != null
            ? Boolean(user.two_factor_enabled)
            : Boolean(prev.two_factor_enabled),
        free_delivery_enabled: Boolean(user.free_delivery_enabled ?? prev.free_delivery_enabled),
        free_delivery_min_amount:
          user.free_delivery_min_amount != null
            ? String(user.free_delivery_min_amount)
            : prev.free_delivery_min_amount,
        free_delivery_scope: user.free_delivery_scope || prev.free_delivery_scope,
        free_delivery_product_rules: normalizeFreeDeliveryProductRules(
          user.free_delivery_product_rules || prev.free_delivery_product_rules
        ),
      }));
    }
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfileError('');
        const response = await fetch('/api/profile', { credentials: 'include' });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(text || 'Something went wrong. Please try again.');
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load your profile.');
        }
        setProfile({
          name: data.data?.name || '',
          email: data.data?.email || '',
          phone: data.data?.phone || '',
          business_name: data.data?.business_name || '',
          business_category: data.data?.business_category || '',
          business_type: data.data?.business_type || 'both',
          business_address: data.data?.business_address || '',
          business_hours: data.data?.business_hours || '',
          business_map_url: data.data?.business_map_url || '',
          two_factor_enabled: Boolean(data.data?.two_factor_enabled),
          free_delivery_enabled: Boolean(data.data?.free_delivery_enabled),
          free_delivery_min_amount:
            data.data?.free_delivery_min_amount != null ? String(data.data.free_delivery_min_amount) : '',
          free_delivery_scope: data.data?.free_delivery_scope || 'combined',
          free_delivery_product_rules: normalizeFreeDeliveryProductRules(
            data.data?.free_delivery_product_rules
          ),
        });
        setProfilePhotoPreview(data.data?.profile_photo_url || null);
        if (data.data?.whatsapp_number || data.data?.whatsapp_name) {
          setWhatsappConfig((prev) => ({
            ...prev,
            phone: data.data?.whatsapp_number || prev.phone,
            businessName:
              data.data?.whatsapp_name || data.data?.business_name || prev.businessName,
          }));
          setWhatsappPairingPhoneInput((prev) =>
            prev || normalizePairingPhone(data.data?.whatsapp_number || '')
          );
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setProfileError(error.message);
      } finally {
        setProfileLoading(false);
      }
    };

    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }
    loadProfile();
  }, [authLoading, normalizePairingPhone, user]);

  useEffect(() => {
    if (!user?.id || !productAccess) return;
    let isMounted = true;
    const loadFreeDeliveryProducts = async () => {
      try {
        setFreeDeliveryLoading(true);
        setFreeDeliveryError('');
        const response = await fetch('/api/catalog?limit=500', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Could not load products for free-delivery rules.');
        }
        if (!isMounted) return;
        const nextProducts = Array.isArray(data?.data)
          ? data.data.filter((item) => item?.item_type === 'product')
          : [];
        setFreeDeliveryProducts(nextProducts);
      } catch (error) {
        if (!isMounted) return;
        setFreeDeliveryProducts([]);
        setFreeDeliveryError(error.message || 'Could not load products for free-delivery rules.');
      } finally {
        if (isMounted) {
          setFreeDeliveryLoading(false);
        }
      }
    };
    loadFreeDeliveryProducts();
    return () => {
      isMounted = false;
    };
  }, [productAccess, user?.id]);

  useEffect(() => {
    setWhatsappConfig((prev) => ({
      ...prev,
      category: profile.business_category || 'General',
      businessType: profile.business_type || 'both',
    }));
  }, [profile.business_category, profile.business_type]);

  useEffect(() => {
    if (!user || user.admin_tier === 'super_admin') return;
    const nextDesired =
      BUSINESS_TYPE_OPTIONS.find((option) => option.value !== profile.business_type)?.value ||
      'product';
    setBusinessTypeRequest((prev) => ({
      ...prev,
      desired:
        prev.desired && prev.desired !== profile.business_type ? prev.desired : nextDesired,
    }));
  }, [profile.business_type, user]);

  useEffect(() => {
    if (!user || user.admin_tier === 'super_admin') return;
    let isMounted = true;
    const loadRequest = async () => {
      try {
        setBusinessTypeRequest((prev) => ({ ...prev, loading: true, error: '', success: '' }));
        const response = await fetch('/api/profile/business-type-request', {
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load business type request.');
        }
        if (!isMounted) return;
        setBusinessTypeRequest((prev) => ({
          ...prev,
          existing: data.data || null,
          loading: false,
        }));
      } catch (error) {
        if (!isMounted) return;
        setBusinessTypeRequest((prev) => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load request.',
        }));
      }
    };
    loadRequest();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const fetchWhatsAppStatus = useCallback(async (isMountedRef = { current: true }) => {
    try {
      if (!user?.id) return;
      const response = await fetchWhatsAppApi(
        `/whatsapp/status?adminId=${user.id}&ts=${Date.now()}`,
        {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        }
      );
      if (response.status === 304) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to load WhatsApp status');
      }
      const payload = await response.json();
      if (!isMountedRef.current) return;
      applyWhatsappStatusPayload(payload);
      return payload;
    } catch (error) {
      if (isMountedRef.current) {
        markWhatsappDisconnectedUi();
      }
    }
    return null;
  }, [applyWhatsappStatusPayload, fetchWhatsAppApi, markWhatsappDisconnectedUi, user?.id]);

  useEffect(() => {
    const isMountedRef = { current: true };
    let socket = null;
    whatsappSocketClosingRef.current = false;
    if (!user?.id) {
      return () => {
        isMountedRef.current = false;
        whatsappSocketClosingRef.current = true;
        if (socket) socket.disconnect();
      };
    }
    fetchWhatsAppStatus(isMountedRef);
    const pollTimer = setInterval(() => {
      fetchWhatsAppStatus(isMountedRef);
    }, 5000);
    const handleFocus = () => {
      fetchWhatsAppStatus(isMountedRef);
    };
    window.addEventListener('focus', handleFocus);

    (async () => {
      try {
        const token = await getBackendJwt();
        if (!isMountedRef.current) return;
        socket = io(buildWhatsAppOriginCandidates(WHATSAPP_SOCKET_URL)[0] || WHATSAPP_SOCKET_URL, {
          query: { adminId: user?.id },
          auth: { token },
        });

        socket.on('connect', () => {
          whatsappSocketClosingRef.current = false;
        });

        socket.on('whatsapp:status', (payload) => {
          applyWhatsappStatusPayload(payload);
        });

        socket.on('whatsapp:qr', (payload) => {
          if (!payload) return;
          if (whatsappAuthMethodRef.current === 'code') return;
          setWhatsappPairingCode('');
          if (typeof payload === 'string') {
            updateWhatsappQr(payload);
            return;
          }
          if (payload?.qrImage) {
            updateWhatsappQr(payload.qrImage);
            return;
          }
          if (payload?.qr) {
            renderQrFromRaw(payload.qr);
          }
        });

        socket.on('whatsapp:code', (payload) => {
          const code =
            typeof payload === 'string'
              ? payload.trim()
              : String(payload?.code || '').trim();
          if (!code) return;
          setWhatsappAuthMode('code');
          setWhatsappStatus('code');
          setWhatsappConnected(false);
          updateWhatsappQr('');
          setWhatsappPairingCode(code);
          const incomingPhone =
            typeof payload === 'object' && payload?.phoneNumber
              ? normalizePairingPhone(payload.phoneNumber)
              : '';
          if (incomingPhone) {
            setWhatsappPairingPhoneInput(incomingPhone);
          }
          setWhatsappCanReconnect(false);
        });

        socket.on('connect_error', () => {
          if (!isMountedRef.current || whatsappSocketClosingRef.current) return;
          markWhatsappDisconnectedUi();
        });

        socket.on('disconnect', () => {
          if (!isMountedRef.current || whatsappSocketClosingRef.current) return;
          markWhatsappDisconnectedUi();
        });
      } catch (error) {
        if (!isMountedRef.current) return;
        markWhatsappDisconnectedUi();
      }
    })();

    return () => {
      isMountedRef.current = false;
      whatsappSocketClosingRef.current = true;
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      if (socket) socket.disconnect();
    };
  }, [
    applyWhatsappStatusPayload,
    fetchWhatsAppStatus,
    markWhatsappDisconnectedUi,
    normalizePairingPhone,
    renderQrFromRaw,
    setWhatsappAuthMode,
    updateWhatsappQr,
    user?.id,
  ]);

  const handleStartWhatsApp = async ({ usePairingCode = false } = {}) => {
    try {
      setWhatsappActionStatus('');
      setWhatsappAuthMode(usePairingCode ? 'code' : 'qr');
      // Optimistic UI: immediately reflect that a connection attempt is in progress.
      setWhatsappStatus('starting');
      setWhatsappConnected(false);
      setWhatsappCanReconnect(false);
      setWhatsappPairingCode('');
      updateWhatsappQr('');
      const pairingPhoneNumber = normalizePairingPhone(whatsappPairingPhoneInput);
      if (usePairingCode && (pairingPhoneNumber.length < 8 || pairingPhoneNumber.length > 15)) {
        throw new Error('Enter a valid phone number with country code. Use digits only.');
      }
      const response = await fetchWhatsAppApi('/whatsapp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user?.id,
          authMethod: usePairingCode ? 'code' : 'qr',
          ...(usePairingCode
            ? {
                phoneNumber: pairingPhoneNumber,
              }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not start WhatsApp.');
      }
      if (payload?.pairingCode) {
        setWhatsappPairingCode(String(payload.pairingCode));
      } else if (usePairingCode) {
        setWhatsappPairingCode('');
      }
      if (usePairingCode) {
        updateWhatsappQr('');
      }
      await fetchWhatsAppStatus(settingsMountedRef);

      // Some environments block/slow Socket.IO; poll briefly so QR / link-code appears quickly.
      for (let i = 0; i < 8; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!settingsMountedRef.current) break;
        await fetchWhatsAppStatus(settingsMountedRef);
      }
    } catch (error) {
      setWhatsappActionStatus(error.message);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      setWhatsappActionStatus('');
      const response = await fetchWhatsAppApi('/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user?.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not disconnect WhatsApp.');
      }
      setWhatsappPairingCode('');
      updateWhatsappQr('');
      await fetchWhatsAppStatus();
    } catch (error) {
      setWhatsappActionStatus(error.message);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: faUser, hint: 'Identity and account data' },
    { id: 'appearance', name: 'Appearance', icon: faPalette, hint: 'Theme and accent colors' },
    { id: 'whatsapp', name: 'WhatsApp', icon: faMobileScreen, hint: 'Connect and link' },
    { id: 'security', name: 'Security', icon: faShieldHalved, hint: 'Password and login' },
  ];

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const isWhatsappPending =
    whatsappStatus === 'starting' ||
    whatsappStatus === 'qr' ||
    whatsappStatus === 'code';
  const showReconnectAction =
    (whatsappStatus === 'disconnected' ||
      whatsappStatus === 'idle' ||
      whatsappStatus === 'error' ||
      whatsappStatus === 'auth_failure') &&
    !whatsappConnected &&
    whatsappCanReconnect;
  const showFreshConnectActions =
    (whatsappStatus === 'disconnected' ||
      whatsappStatus === 'idle' ||
      whatsappStatus === 'error' ||
      whatsappStatus === 'auth_failure') &&
    !whatsappConnected &&
    !whatsappCanReconnect;
  const isStartBlocked =
    whatsappConnected ||
    whatsappStatus === 'connected_other' ||
    isWhatsappPending;
  const showDisconnectAction = Boolean(whatsappConnected || isWhatsappPending);
  const whatsappTone = whatsappConnected ? 'green' : isWhatsappPending ? 'amber' : 'red';
  const showPairingCodePanel = Boolean(whatsappPairingCode && !whatsappConnected);
  const showQrPanel = Boolean(!whatsappConnected && whatsappQr && whatsappAuthMethod !== 'code');
  const whatsappStatusLabel = whatsappConnected
    ? 'Connected'
    : whatsappStatus === 'connected_other'
    ? 'Connected (Another Admin)'
    : whatsappStatus === 'auth_failure'
    ? 'Auth Failed'
    : whatsappStatus === 'error'
    ? 'Error'
    : whatsappStatus === 'idle'
    ? 'Idle'
    : whatsappStatus === 'starting'
    ? whatsappAuthMethod === 'code'
      ? 'Starting Link Code'
      : 'Starting QR'
    : whatsappStatus === 'qr'
    ? 'Waiting for QR Scan'
    : whatsappStatus === 'code'
    ? 'Waiting for Link Code Confirm'
    : 'Disconnected';
  const whatsappStatusMessage = whatsappConnected
    ? 'WhatsApp is connected for this admin.'
    : whatsappStatus === 'connected_other'
    ? 'WhatsApp is connected under a different admin account.'
    : whatsappStatus === 'auth_failure'
    ? 'WhatsApp rejected the login attempt. Try connecting again (QR or link code).'
    : whatsappStatus === 'error'
    ? 'WhatsApp failed to start. Try connecting again. If it keeps failing, check Railway logs for the WhatsApp agent service.'
    : whatsappStatus === 'idle'
    ? 'WhatsApp is not started yet. Use QR or link code to begin.'
    : whatsappStatus === 'starting'
    ? whatsappAuthMethod === 'code'
      ? 'Starting WhatsApp link code. Please wait...'
      : 'Starting WhatsApp QR. Please wait...'
    : whatsappStatus === 'qr'
    ? 'Scan the QR code below with WhatsApp to connect.'
    : whatsappStatus === 'code'
    ? 'Use the code below in WhatsApp > Linked Devices > Link with phone number.'
    : showReconnectAction
    ? 'Saved WhatsApp login was found for this admin. Click Reconnect to restore the connection.'
    : 'WhatsApp is not connected right now.';

  return (
    <div
      className="space-y-6 rounded-3xl border border-white/60 bg-[radial-gradient(circle_at_top_right,_#fff4ea_0%,_#ffffff_42%,_#eef4ff_100%)] p-4 sm:p-6"
      data-testid="settings-page"
    >
      <Card className="border border-white/70 bg-white/85 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-aa-dark-blue">Settings</h1>
            <p className="text-aa-gray mt-2">Manage your account and preferences from one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                whatsappTone === 'green'
                  ? 'green'
                  : whatsappTone === 'amber'
                  ? 'yellow'
                  : 'red'
              }
            >
              WhatsApp: {whatsappStatusLabel}
            </Badge>
            <Badge variant="blue">Current: {activeTabMeta.name}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="border border-white/70 bg-white/90 backdrop-blur p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    activeTab === tab.id
                      ? 'border-aa-orange bg-aa-orange/10 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-aa-orange/40 hover:bg-gray-50'
                  }`}
                  data-testid={`settings-tab-${tab.id}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        activeTab === tab.id
                          ? 'bg-aa-orange text-white'
                          : 'bg-aa-dark-blue/10 text-aa-dark-blue'
                      }`}
                    >
                      <FontAwesomeIcon icon={tab.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-aa-text-dark">{tab.name}</span>
                      <span className="mt-0.5 hidden text-xs text-aa-gray sm:block">
                        {tab.hint}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card className="border border-white/70 bg-white/90 backdrop-blur">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-aa-dark-blue">Profile Settings</h2>
                <p className="mt-1 text-sm text-aa-gray">
                  Keep your account details up to date for appointments and reporting.
                </p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                    <p className="text-xs uppercase tracking-wide text-aa-gray">Profile Photo</p>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-24 w-24 rounded-2xl bg-aa-dark-blue flex items-center justify-center overflow-hidden shadow-sm">
                        {profilePhotoPreview ? (
                          <img
                            src={profilePhotoPreview}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-3xl">
                            {profile.name?.charAt(0) || 'A'}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <input
                          id="profile-photo-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setProfilePhoto(file);
                            setProfilePhotoPreview(URL.createObjectURL(file));
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className="min-w-[132px]"
                            onClick={() => document.getElementById('profile-photo-input')?.click()}
                          >
                            Change Photo
                          </Button>
                          {profilePhotoPreview && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setProfilePhoto(null);
                                setProfilePhotoPreview(null);
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-aa-gray">JPG, PNG. Max 2MB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-aa-orange/20 bg-aa-orange/5 p-4 sm:p-5">
                    <p className="text-xs uppercase tracking-wide text-aa-gray">Account Summary</p>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-col gap-1 rounded-xl bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-aa-gray">Role</span>
                        <span className="text-sm font-semibold text-aa-text-dark sm:text-right">
                          {user?.admin_tier === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-aa-gray">Business Name</span>
                        <span className="text-sm font-semibold text-aa-text-dark sm:text-right break-words">
                          {profile.business_name || 'Not added'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-aa-gray">Business Category</span>
                        <span className="text-sm font-semibold text-aa-text-dark sm:text-right break-words">
                          {profile.business_category || 'General'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-aa-gray">Business Type</span>
                        <span className="text-sm font-semibold text-aa-text-dark sm:text-right break-words">
                          {getBusinessTypeLabel(profile.business_type)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {profileError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {profileError}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  {profileLoading ? (
                    <div className="rounded-xl bg-gray-50 px-4 py-6 text-sm text-aa-gray">
                      Loading profile data...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input
                        label="Full Name"
                        value={profile.name}
                        onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Enter your name"
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={profile.email}
                        onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="Enter your email"
                      />
                      <Input
                        label="Phone"
                        value={profile.phone}
                        onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="Enter phone number"
                        disabled
                      />
                      <div className="w-full">
                        <label className="mb-2 block text-sm font-semibold text-aa-text-dark">
                          Business Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={profile.business_name}
                          onChange={(event) =>
                            setProfile((prev) => ({ ...prev, business_name: event.target.value }))
                          }
                          placeholder="Your shop or business name"
                          className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-aa-orange sm:py-3 sm:text-base"
                        />
                        <p className="mt-1 text-xs text-aa-gray">
                          This is the name customers will see.
                        </p>
                      </div>
                      <div className="w-full">
                        <Input
                          label="Business Category (optional)"
                          value={profile.business_category}
                          onChange={(event) =>
                            setProfile((prev) => ({ ...prev, business_category: event.target.value }))
                          }
                          placeholder="Retail, Salon, Coaching..."
                        />
                        <p className="mt-1 text-xs text-aa-gray">
                          Helps customers understand what you sell.
                        </p>
                      </div>
                      <div className="w-full">
                        {user?.admin_tier === 'super_admin' ? (
                          <>
                            <GeminiSelect
                              label="Business Type *"
                              value={profile.business_type}
                              onChange={(value) =>
                                setProfile((prev) => ({ ...prev, business_type: value }))
                              }
                              options={BUSINESS_TYPE_OPTIONS}
                              variant="vibrant"
                            />
                            <p className="mt-1 text-xs text-aa-gray">
                              Product-based shows orders, service-based shows appointments, both shows both.
                            </p>
                          </>
                        ) : (
                          <>
                            <label className="mb-2 block text-sm font-semibold text-aa-text-dark">
                              Business Type <span className="text-red-500">*</span>
                            </label>
                            <div className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-aa-text-dark sm:py-3 sm:text-base">
                              {getBusinessTypeLabel(profile.business_type)}
                            </div>
                            <p className="mt-1 text-xs text-aa-gray">
                              Business type changes require a request and payment approval by super admin.
                            </p>
                          </>
                        )}
                      </div>
                      {user?.admin_tier !== 'super_admin' && (
                        <div className="md:col-span-2 rounded-2xl border border-aa-orange/20 bg-[#fff8f1] p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aa-orange">
                                Business Type Request
                              </p>
                              <p className="mt-2 text-lg font-semibold text-aa-text-dark">
                                Request a business type change
                              </p>
                              <p className="mt-1 text-sm text-aa-gray">
                                Super admin approves changes after payment. Downgrades show the refund gap.
                              </p>
                            </div>
                            {businessTypeRequest?.existing?.payment_required &&
                              businessTypeRequest?.existing?.payment_status !== 'paid' &&
                              businessTypeRequest?.existing?.payment_link_url && (
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    const url = businessTypeRequest.existing.payment_link_url;
                                    const popup = window.open(url, '_blank', 'noopener,noreferrer');
                                    if (!popup) {
                                      window.location.href = url;
                                    }
                                  }}
                                >
                                  Pay Now
                                </Button>
                              )}
                          </div>
                          {businessTypeRequest?.existing?.status === 'pending' ? (
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                                <p className="text-xs uppercase text-aa-gray">Requested</p>
                                <p className="mt-1 font-semibold text-aa-text-dark">
                                  {getBusinessTypeLabel(businessTypeRequest.existing.requested_business_type)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                                <p className="text-xs uppercase text-aa-gray">Payment</p>
                                <p className="mt-1 font-semibold text-aa-text-dark">
                                  {businessTypeRequest.existing.payment_required
                                    ? businessTypeRequest.existing.payment_status === 'paid'
                                      ? 'Paid'
                                      : 'Pending'
                                    : 'Not required'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                                <p className="text-xs uppercase text-aa-gray">Gap</p>
                                <p className="mt-1 font-semibold text-aa-text-dark">
                                  {Number(businessTypeRequest.existing.monthly_delta_inr || 0) === 0
                                    ? '—'
                                    : `₹ ${Number(
                                        Math.abs(Number(businessTypeRequest.existing.monthly_delta_inr || 0))
                                      ).toFixed(2)}`}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-[#f3d4ac] bg-white p-4 sm:p-5">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <GeminiSelect
                                  label="Requested Business Type"
                                  value={businessTypeRequest.desired}
                                  onChange={(value) =>
                                    setBusinessTypeRequest((prev) => ({ ...prev, desired: value }))
                                  }
                                  options={BUSINESS_TYPE_OPTIONS.filter(
                                    (option) => option.value !== profile.business_type
                                  )}
                                  variant="vibrant"
                                  size="sm"
                                />
                                <Input
                                  label="Reason (optional)"
                                  value={businessTypeRequest.reason}
                                  onChange={(event) =>
                                    setBusinessTypeRequest((prev) => ({
                                      ...prev,
                                      reason: event.target.value,
                                    }))
                                  }
                                  placeholder="Why do you want to change?"
                                />
                              </div>
                              <Button
                                variant="primary"
                                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#FE8802] to-[#FDA913] text-white shadow-lg shadow-[#FE8802]/20 hover:opacity-95 hover:shadow-xl hover:shadow-[#FE8802]/35"
                                onClick={async () => {
                                  try {
                                    setBusinessTypeRequest((prev) => ({
                                      ...prev,
                                      loading: true,
                                      error: '',
                                      success: '',
                                    }));
                                    const response = await fetch(
                                      '/api/profile/business-type-request',
                                      {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          business_type: businessTypeRequest.desired,
                                          reason: businessTypeRequest.reason,
                                        }),
                                      }
                                    );
                                    const data = await response.json();
                                    if (!response.ok) {
                                      throw new Error(data.error || 'Could not submit request.');
                                    }
                                    setBusinessTypeRequest((prev) => ({
                                      ...prev,
                                      existing: data.data || null,
                                      loading: false,
                                      success: data.data?.payment?.short_url
                                        ? 'Request submitted. Complete payment to proceed.'
                                        : 'Request submitted.',
                                    }));
                                  } catch (error) {
                                    setBusinessTypeRequest((prev) => ({
                                      ...prev,
                                      loading: false,
                                      error: error.message || 'Failed to submit request.',
                                    }));
                                  }
                                }}
                                disabled={businessTypeRequest.loading}
                              >
                                {businessTypeRequest.loading ? 'Submitting...' : 'Submit Request'}
                              </Button>
                            </div>
                          )}
                          {(businessTypeRequest.error || businessTypeRequest.success) && (
                            <div
                              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                                businessTypeRequest.error
                                  ? 'border border-red-200 bg-red-50 text-red-700'
                                  : 'border border-green-200 bg-green-50 text-green-700'
                              }`}
                            >
                              {businessTypeRequest.error || businessTypeRequest.success}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-aa-text-dark">
                          Business Address
                        </label>
                        <textarea
                          value={profile.business_address}
                          onChange={(event) =>
                            setProfile((prev) => ({ ...prev, business_address: event.target.value }))
                          }
                          placeholder="Add your exact showroom / office / shop address for WhatsApp AI replies"
                          rows={3}
                          className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-sm outline-none focus:border-aa-orange sm:text-base"
                        />
                        <p className="mt-1 text-xs text-aa-gray">
                          Customers asking for location or address will get this exact detail.
                        </p>
                      </div>
                      <div className="md:col-span-2 rounded-2xl border border-aa-orange/20 bg-[#fff8f1] p-4 sm:p-5">
                        <p className="text-sm font-semibold text-aa-text-dark">Business Hours</p>
                        <p className="mt-1 text-xs text-aa-gray">
                          AI uses this timing when customers ask for opening/closing hours.
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <GeminiSelect
                              label="Start Time"
                              value={businessStartHour}
                              onChange={(value) => {
                                const nextStart = Number(value);
                                if (!Number.isFinite(nextStart)) return;
                                setProfile((prev) => ({
                                  ...prev,
                                  business_hours: toBusinessHoursRange(nextStart, businessEndHour),
                                }));
                              }}
                              options={BUSINESS_HOUR_OPTIONS}
                              variant="vibrant"
                              size="sm"
                            />
                          </div>
                          <div>
                            <GeminiSelect
                              label="End Time"
                              value={businessEndHour}
                              onChange={(value) => {
                                const nextEnd = Number(value);
                                if (!Number.isFinite(nextEnd)) return;
                                setProfile((prev) => ({
                                  ...prev,
                                  business_hours: toBusinessHoursRange(businessStartHour, nextEnd),
                                }));
                              }}
                              options={BUSINESS_HOUR_OPTIONS}
                              variant="vibrant"
                              size="sm"
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-aa-gray">
                          Saved format: {profile.business_hours || '10 AM - 7 PM'}
                        </p>
                      </div>
                      <Input
                        label="Map URL"
                        value={profile.business_map_url}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, business_map_url: event.target.value }))
                        }
                        placeholder="https://maps.google.com/..."
                      />
                      {productAccess && (
                        <div className="md:col-span-2 rounded-2xl border border-aa-orange/20 bg-[#fff8f1] p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="max-w-2xl">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aa-orange">
                                Free Delivery Rule
                              </p>
                              <p className="mt-2 text-lg font-semibold text-aa-text-dark">
                                Tell customers when delivery becomes free
                              </p>
                              <p className="mt-1 text-sm text-aa-gray">
                                The WhatsApp checkout will confirm free delivery or tell the customer how much more they need to add.
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer self-start">
                              <input
                                type="checkbox"
                                checked={profile.free_delivery_enabled}
                                onChange={(event) =>
                                  setProfile((prev) => ({
                                    ...prev,
                                    free_delivery_enabled: event.target.checked,
                                  }))
                                }
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                            </label>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="w-full">
                              <GeminiSelect
                                label="Apply Rule To"
                                value={profile.free_delivery_scope}
                                onChange={(value) =>
                                  setProfile((prev) => {
                                    const nextRules = Array.isArray(prev.free_delivery_product_rules)
                                      ? prev.free_delivery_product_rules
                                      : [];
                                    const shouldSeedRule =
                                      value === 'eligible_only' && nextRules.length === 0;
                                    return {
                                      ...prev,
                                      free_delivery_scope: value,
                                      free_delivery_product_rules: shouldSeedRule
                                        ? [{ catalog_item_id: '', min_amount: '', product_name: '' }]
                                        : nextRules,
                                    };
                                  })
                                }
                                options={FREE_DELIVERY_SCOPE_OPTIONS}
                                variant="vibrant"
                                disabled={!profile.free_delivery_enabled}
                              />
                            </div>
                            {profile.free_delivery_scope === 'combined' ? (
                              <Input
                                label="Free Delivery Above"
                                type="number"
                                value={profile.free_delivery_min_amount}
                                onChange={(event) =>
                                  setProfile((prev) => ({
                                    ...prev,
                                    free_delivery_min_amount: event.target.value,
                                  }))
                                }
                                placeholder="1499"
                                disabled={!profile.free_delivery_enabled}
                              />
                            ) : (
                              <div className="rounded-xl border border-[#f1dcc5] bg-white px-4 py-3 text-sm text-aa-gray">
                                Set product-wise thresholds below. Each selected product can have a different free-delivery amount.
                              </div>
                            )}
                          </div>

                          {profile.free_delivery_scope === 'eligible_only' && (
                            <div className="mt-4 rounded-2xl border border-[#f1dcc5] bg-white p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-aa-text-dark">
                                  Product-wise free-delivery thresholds
                                </p>
                                <p className="text-xs text-aa-gray">
                                  Pick marked products and set the amount needed for each one.
                                </p>
                              </div>
                              {freeDeliveryLoading ? (
                                <p className="text-xs text-aa-gray">Loading products...</p>
                              ) : freeDeliveryError ? (
                                <p className="text-xs text-red-600">{freeDeliveryError}</p>
                              ) : eligibleFreeDeliveryProducts.length === 0 ? (
                                <p className="text-xs text-aa-gray">
                                  No marked products found. Mark products as{' '}
                                  <span className="font-semibold text-aa-text-dark">Free delivery eligible</span>{' '}
                                  in Catalog first.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {profile.free_delivery_product_rules.map((rule, index) => (
                                    <div
                                      key={`free-delivery-rule-${index}`}
                                      className="grid grid-cols-1 gap-3 rounded-xl border border-[#f1dcc5] bg-[#fffaf4] p-3 md:grid-cols-[minmax(0,1fr)_150px_auto]"
                                    >
                                      <GeminiSelect
                                        label={`Product ${index + 1}`}
                                        value={String(rule?.catalog_item_id || '')}
                                        onChange={(value) => {
                                          const selected = eligibleFreeDeliveryProducts.find(
                                            (item) => String(item.id) === String(value)
                                          );
                                          setFreeDeliveryRuleAt(index, {
                                            catalog_item_id: String(value),
                                            product_name: selected?.name || '',
                                          });
                                        }}
                                        options={eligibleFreeDeliveryProductOptions}
                                        variant="warm"
                                        size="sm"
                                        disabled={!profile.free_delivery_enabled}
                                        placeholder="Select product"
                                      />
                                      <Input
                                        label="Free Above"
                                        type="number"
                                        value={rule?.min_amount || ''}
                                        onChange={(event) =>
                                          setFreeDeliveryRuleAt(index, {
                                            min_amount: event.target.value,
                                          })
                                        }
                                        placeholder="1499"
                                        disabled={!profile.free_delivery_enabled}
                                      />
                                      <div className="flex items-end">
                                        <Button
                                          variant="outline"
                                          type="button"
                                          className="w-full md:w-auto"
                                          onClick={() => removeFreeDeliveryRule(index)}
                                          disabled={!profile.free_delivery_enabled}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addFreeDeliveryRule}
                                    disabled={
                                      !profile.free_delivery_enabled ||
                                      eligibleFreeDeliveryProducts.length === 0 ||
                                      profile.free_delivery_product_rules.length >= 100
                                    }
                                  >
                                    Add Product Rule
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          <p className="mt-3 text-xs text-aa-gray">
                            Use <span className="font-semibold text-aa-text-dark">Combined order total</span> for one common threshold, or choose <span className="font-semibold text-aa-text-dark">Only marked products</span> for product-wise thresholds.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="order-2 sm:order-1">
                    {saveStatus && (
                      <span
                        className={`text-sm font-semibold ${
                          saveStatus.includes('Failed') || saveStatus.includes('error')
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {saveStatus}
                      </span>
                    )}
                  </div>
                  <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setProfileLoading(true);
                        setProfileError('');
                        try {
                          const response = await fetch('/api/profile', { credentials: 'include' });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data.error || 'Could not reset.');
                          }
                          setProfile({
                            name: data.data?.name || '',
                            email: data.data?.email || '',
                            phone: data.data?.phone || '',
                            business_name: data.data?.business_name || '',
                            business_category: data.data?.business_category || '',
                            business_type: data.data?.business_type || 'both',
                            business_address: data.data?.business_address || '',
                            business_hours: data.data?.business_hours || '',
                            business_map_url: data.data?.business_map_url || '',
                            two_factor_enabled: Boolean(data.data?.two_factor_enabled),
                            free_delivery_enabled: Boolean(data.data?.free_delivery_enabled),
                            free_delivery_min_amount:
                              data.data?.free_delivery_min_amount != null
                                ? String(data.data.free_delivery_min_amount)
                                : '',
                            free_delivery_scope: data.data?.free_delivery_scope || 'combined',
                            free_delivery_product_rules: normalizeFreeDeliveryProductRules(
                              data.data?.free_delivery_product_rules
                            ),
                          });
                          setProfilePhoto(null);
                          setProfilePhotoPreview(data.data?.profile_photo_url || null);
                          setSaveStatus('');
                        } catch (error) {
                          setProfileError(error.message);
                        } finally {
                          setProfileLoading(false);
                        }
                      }}
                      disabled={profileLoading}
                      className="w-full sm:w-auto"
                    >
                      Reset
                    </Button>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        try {
                          setSaveStatus('');
                          if (profilePhoto) {
                            const formData = new FormData();
                            formData.append('photo', profilePhoto);
                            const photoResponse = await fetch('/api/profile/photo', {
                              method: 'POST',
                              body: formData,
                            });
                            const photoData = await photoResponse.json().catch(() => ({}));
                            if (!photoResponse.ok) {
                              throw new Error(photoData.error || 'Could not upload photo.');
                            }
                            if (photoData?.url) {
                              setProfilePhotoPreview(photoData.url);
                            }
                            setProfilePhoto(null);
                          }
                          const normalizedProductRules = normalizeFreeDeliveryProductRules(
                            profile.free_delivery_product_rules
                          );
                          if (
                            profile.free_delivery_enabled &&
                            profile.free_delivery_scope === 'eligible_only' &&
                            normalizedProductRules.length === 0
                          ) {
                            throw new Error('Add at least one product rule for free delivery.');
                          }
                          const response = await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              name: profile.name,
                              email: profile.email,
                              business_name: profile.business_name,
                              business_category: profile.business_category,
                              ...(user?.admin_tier === 'super_admin'
                                ? { business_type: profile.business_type }
                                : {}),
                              business_address: profile.business_address,
                              business_hours:
                                String(profile.business_hours || '').trim() ||
                                toBusinessHoursRange(businessStartHour, businessEndHour),
                              business_map_url: profile.business_map_url,
                              two_factor_enabled: profile.two_factor_enabled,
                              free_delivery_enabled: profile.free_delivery_enabled,
                              free_delivery_min_amount:
                                profile.free_delivery_enabled &&
                                profile.free_delivery_scope === 'combined'
                                  ? profile.free_delivery_min_amount
                                  : null,
                              free_delivery_scope: profile.free_delivery_scope,
                              free_delivery_product_rules:
                                profile.free_delivery_enabled &&
                                profile.free_delivery_scope === 'eligible_only'
                                  ? normalizedProductRules
                                  : [],
                            }),
                          });
                          const contentType = response.headers.get('content-type') || '';
                          if (!contentType.includes('application/json')) {
                            const text = await response.text();
                            throw new Error(text || 'Something went wrong. Please try again.');
                          }
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data.error || 'Could not save.');
                          }
                          setProfile({
                            name: data.data?.name || '',
                            email: data.data?.email || '',
                            phone: data.data?.phone || '',
                            business_name: data.data?.business_name || '',
                            business_category: data.data?.business_category || '',
                            business_type: data.data?.business_type || 'both',
                            business_address: data.data?.business_address || '',
                            business_hours: data.data?.business_hours || '',
                            business_map_url: data.data?.business_map_url || '',
                            two_factor_enabled: Boolean(data.data?.two_factor_enabled),
                            free_delivery_enabled: Boolean(data.data?.free_delivery_enabled),
                            free_delivery_min_amount:
                              data.data?.free_delivery_min_amount != null
                                ? String(data.data.free_delivery_min_amount)
                                : '',
                            free_delivery_scope: data.data?.free_delivery_scope || 'combined',
                            free_delivery_product_rules: normalizeFreeDeliveryProductRules(
                              data.data?.free_delivery_product_rules
                            ),
                          });
                          await refresh();
                          setSaveStatus('Profile updated.');
                          setTimeout(() => setSaveStatus(''), 2000);
                        } catch (error) {
                          console.error('Failed to save profile:', error);
                          setSaveStatus(error.message);
                        }
                      }}
                      disabled={profileLoading}
                      className="w-full sm:w-auto"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Notifications Settings */}
          {/* {activeTab === 'notifications' && (
            <Card>
              <h2 className="text-2xl font-bold text-aa-dark-blue mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { title: 'New Messages', description: 'Get notified when you receive new messages' },
                  { title: 'New Leads', description: 'Get notified when new leads are created' },
                  { title: 'Broadcast Sent', description: 'Get notified when broadcasts are successfully sent' },
                  { title: 'Team Updates', description: 'Get notified about team member activities' },
                  { title: 'System Updates', description: 'Get notified about system maintenance and updates' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-aa-text-dark">{item.title}</p>
                      <p className="text-sm text-aa-gray mt-1">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          )} */}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card className="border border-white/70 bg-white/90 backdrop-blur">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-aa-dark-blue">Appearance</h2>
                <p className="mt-1 text-sm text-aa-gray">
                  Personalize your workspace theme and accent.
                </p>
              </div>
              <div className="space-y-6">
                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <label className="mb-3 block text-xs uppercase tracking-wide text-aa-gray">Theme</label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`rounded-2xl border-2 p-4 text-left transition ${
                        theme === 'light'
                          ? 'border-aa-orange bg-aa-orange/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-aa-orange/50'
                      }`}
                    >
                      <div className="mb-3 h-24 rounded-xl border border-white/70 bg-[linear-gradient(130deg,_#ffd4b0_0%,_#ffffff_50%,_#dbeafe_100%)]" />
                      <p className="font-semibold text-aa-text-dark">Light Theme</p>
                      <p className="mt-1 text-xs text-aa-gray">Best for daytime and brighter displays.</p>
                      <Badge variant={theme === 'light' ? 'orange' : 'default'} className="mt-3">
                        {theme === 'light' ? 'Active' : 'Use'}
                      </Badge>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`rounded-2xl border-2 p-4 text-left transition ${
                        theme === 'dark'
                          ? 'border-aa-orange bg-aa-orange/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-aa-orange/50'
                      }`}
                    >
                      <div className="mb-3 h-24 rounded-xl border border-slate-700/70 bg-[linear-gradient(130deg,_#0f172a_0%,_#1e293b_52%,_#334155_100%)]" />
                      <p className="font-semibold text-aa-text-dark">Dark Theme</p>
                      <p className="mt-1 text-xs text-aa-gray">Reduced glare for low-light environments.</p>
                      <Badge variant={theme === 'dark' ? 'orange' : 'default'} className="mt-3">
                        {theme === 'dark' ? 'Active' : 'Use'}
                      </Badge>
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <label className="mb-3 block text-xs uppercase tracking-wide text-aa-gray">Accent Color</label>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-8">
                    {ACCENT_COLORS.map((color) => {
                      const isActive =
                        accentColor?.toUpperCase() === color.toUpperCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={isActive}
                          title={`Set accent color ${color}`}
                          onClick={() => handleAccentChange(color)}
                          className={`group relative flex h-12 w-full items-center justify-center rounded-xl border-2 transition ${
                            isActive
                              ? 'border-aa-dark-blue ring-2 ring-aa-orange/30'
                              : 'border-gray-200 hover:border-aa-dark-blue/50'
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {isActive && (
                            <span className="text-sm text-white drop-shadow">
                              <FontAwesomeIcon icon={faCheck} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </Card>
          )}

          {/* WhatsApp Settings */}
          {activeTab === 'whatsapp' && (
            <Card className="border border-white/70 bg-white/90 backdrop-blur">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-aa-dark-blue">WhatsApp Setup</h2>
                <p className="mt-1 text-sm text-aa-gray">
                  Link your WhatsApp so chats appear in Inbox.
                </p>
              </div>

              <div className="space-y-5">
                <div
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    whatsappTone === 'green'
                      ? 'bg-green-50 border-green-200'
                      : whatsappTone === 'amber'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          whatsappTone === 'green'
                            ? 'bg-green-500 animate-pulse'
                            : whatsappTone === 'amber'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-red-500'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          whatsappTone === 'green'
                            ? 'text-green-700'
                            : whatsappTone === 'amber'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {whatsappStatusLabel}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {showReconnectAction ? (
                        <Button
                          variant="primary"
                          onClick={() => handleStartWhatsApp({ usePairingCode: true })}
                          disabled={isStartBlocked}
                          className="w-full sm:w-auto"
                        >
                          Reconnect
                        </Button>
                      ) : null}
                      {showFreshConnectActions ? (
                        <Button
                          variant="primary"
                          onClick={() => handleStartWhatsApp({ usePairingCode: true })}
                          disabled={isStartBlocked}
                          className="w-full sm:w-auto"
                        >
                          {whatsappStatus === 'starting' ? 'Starting...' : 'Connect with Code'}
                        </Button>
                      ) : null}
                      {showFreshConnectActions ? (
                        <Button
                          variant="outline"
                          onClick={() => handleStartWhatsApp({ usePairingCode: false })}
                          disabled={isStartBlocked}
                          className="w-full sm:w-auto"
                        >
                          Connect with QR
                        </Button>
                      ) : null}
                      {showDisconnectAction ? (
                        <Button
                          variant="outline"
                          className="w-full border-red-600 text-red-600 hover:bg-red-50 sm:w-auto"
                          onClick={handleDisconnectWhatsApp}
                        >
                          Disconnect
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`mt-3 text-sm ${
                      whatsappTone === 'green'
                        ? 'text-green-700'
                        : whatsappTone === 'amber'
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {whatsappStatusMessage}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                    <p className="text-xs uppercase tracking-wide text-aa-gray">Business Profile</p>
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Input
                        label="Phone Number"
                        value={whatsappConfig.phone}
                        onChange={(event) =>
                          setWhatsappConfig((prev) => ({ ...prev, phone: event.target.value }))
                        }
                        placeholder="Not connected"
                        disabled
                      />
                      <Input
                        label="Business Name"
                        value={whatsappConfig.businessName}
                        onChange={(event) =>
                          setWhatsappConfig((prev) => ({
                            ...prev,
                            businessName: event.target.value,
                          }))
                        }
                        placeholder="Not connected"
                        disabled
                      />
                      <div className="min-w-0 flex flex-col">
                        <Input
                          label="Business Category"
                          value={whatsappConfig.category}
                          disabled
                        />
                        <p className="mt-1 text-xs text-aa-gray">
                          Category describes your domain like retail, shop, crackers, clinic, etc.
                        </p>
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <Input
                          label="Business Type"
                          value={getBusinessTypeLabel(whatsappConfig.businessType)}
                          disabled
                        />
                        <p className="mt-1 text-xs text-aa-gray">
                          Type controls whether orders, appointments, or both are shown.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-dashed border-gray-200 bg-white p-4 sm:p-5">
                    <p className="text-xs uppercase tracking-wide text-aa-gray">Link Options</p>

                    <div className="mt-3">
                      <Input
                        label="Phone Number for Link Code"
                        value={whatsappPairingPhoneInput}
                        onChange={(event) =>
                          setWhatsappPairingPhoneInput(
                            normalizePairingPhone(event.target.value)
                          )
                        }
                        placeholder="e.g. 919876543210"
                        disabled={isStartBlocked}
                      />
                      <p className="mt-1 text-xs text-aa-gray">
                        Enter country code and number with digits only.
                      </p>
                    </div>

                    {showPairingCodePanel ? (
                      <div className="mt-4 min-w-0 rounded-xl border border-aa-orange/30 bg-aa-orange/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-aa-gray">Link Code</p>
                        <p className="mt-2 break-all text-lg font-bold tracking-[0.12em] text-aa-dark-blue sm:text-2xl sm:tracking-[0.2em]">
                          {whatsappPairingCode}
                        </p>
                        <p className="mt-2 text-xs text-aa-gray">
                          WhatsApp &gt; Linked Devices &gt; Link with phone number instead.
                        </p>
                      </div>
                    ) : null}

                    {showQrPanel ? (
                      <div className="mt-4 flex min-w-0 flex-col items-center gap-3">
                        <img
                          key={whatsappQrVersion}
                          src={whatsappQr}
                          alt="WhatsApp QR Code"
                          className="h-52 w-52 max-w-full rounded-xl border border-gray-200 bg-white p-2"
                        />
                        <p className="text-center text-xs text-aa-gray">
                          WhatsApp &gt; Linked Devices &gt; Link a device
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 min-w-0 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-aa-gray">
                        QR code or link code will show here after you start.
                      </div>
                    )}
                  </div>
                </div>

                {whatsappActionStatus && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {whatsappActionStatus}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Integrations */}
          {/* {activeTab === 'integrations' && (
            <Card>
              <h2 className="text-2xl font-bold text-aa-dark-blue mb-6">Integrations</h2>
              <div className="space-y-4">
                {[
                  { name: 'Google Calendar', description: 'Sync your meetings and appointments', connected: true },
                  { name: 'Slack', description: 'Get notifications in your Slack workspace', connected: false },
                  { name: 'Zapier', description: 'Connect with 5000+ apps', connected: false },
                  { name: 'Google Drive', description: 'Store and share files', connected: true },
                  { name: 'Stripe', description: 'Accept payments and manage subscriptions', connected: false }
                ].map((integration, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-aa-orange">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-aa-dark-blue/10 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon icon={faGlobe} className="text-aa-dark-blue" style={{ fontSize: 24 }} />
                      </div>
                      <div>
                        <p className="font-semibold text-aa-text-dark">{integration.name}</p>
                        <p className="text-sm text-aa-gray">{integration.description}</p>
                      </div>
                    </div>
                    {integration.connected ? (
                      <Badge variant="green">Connected</Badge>
                    ) : (
                      <Button variant="outline" className="text-sm">Connect</Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )} */}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card className="border border-white/70 bg-white/90 backdrop-blur">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-aa-dark-blue">Login & Security</h2>
                <p className="mt-1 text-sm text-aa-gray">
                  Change your password and keep your account safe.
                </p>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-aa-text-dark">Change Password</h3>
                  <p className="mt-1 text-xs text-aa-gray">Use at least 8 characters.</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordForm.current}
                      onChange={updatePasswordField('current')}
                      disabled={passwordLoading}
                      className="md:col-span-2"
                    />
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                      value={passwordForm.next}
                      onChange={updatePasswordField('next')}
                      disabled={passwordLoading}
                    />
                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordForm.confirm}
                      onChange={updatePasswordField('confirm')}
                      disabled={passwordLoading}
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      variant="primary"
                      onClick={async () => {
                        setPasswordStatus('');
                        if (!passwordForm.next || passwordForm.next.length < 8) {
                          setPasswordStatus('New password must be at least 8 characters.');
                          return;
                        }
                        if (passwordForm.next !== passwordForm.confirm) {
                          setPasswordStatus('Passwords do not match.');
                          return;
                        }
                        setPasswordLoading(true);
                        try {
                          const response = await fetch('/api/profile/password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              currentPassword: passwordForm.current,
                              newPassword: passwordForm.next,
                            }),
                          });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data.error || 'Could not update password.');
                          }
                          setPasswordForm({ current: '', next: '', confirm: '' });
                          setPasswordStatus('Password updated.');
                        } catch (error) {
                          setPasswordStatus(error.message);
                        } finally {
                          setPasswordLoading(false);
                        }
                      }}
                      disabled={passwordLoading}
                      className="w-full sm:w-auto"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </Button>
                    {passwordStatus && (
                      <span
                        className={`text-sm font-semibold ${
                          passwordStatus.includes('updated') ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {passwordStatus}
                      </span>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-aa-text-dark">Extra Login Security (2FA)</h3>
                  <div className="mt-3 flex flex-col gap-3 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-aa-text-dark">Turn on 2-step login</p>
                      <p className="mt-1 text-sm text-aa-gray">
                        If enabled, every login requires a temporary password sent to your email.
                      </p>
                      {!profile.email && (
                        <p className="mt-1 text-xs text-amber-700">
                          Add a valid email first to enable this.
                        </p>
                      )}
                    </div>
                    <Button
                      variant={profile.two_factor_enabled ? 'primary' : 'outline'}
                      className="w-full sm:w-auto"
                      disabled={twoFactorSaving || !profile.email}
                      onClick={async () => {
                        setTwoFactorStatus('');
                        if (!profile.email) {
                          setTwoFactorStatus('Add a valid email before enabling 2-step login.');
                          return;
                        }
                        const nextValue = !profile.two_factor_enabled;
                        setTwoFactorSaving(true);
                        try {
                          const response = await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ two_factor_enabled: nextValue }),
                          });
                          const data = await response.json().catch(() => ({}));
                          if (!response.ok) {
                            throw new Error(data.error || 'Could not update 2-step login.');
                          }
                          const enabled = Boolean(data?.data?.two_factor_enabled);
                          setProfile((prev) => ({ ...prev, two_factor_enabled: enabled }));
                          await refresh();
                          setTwoFactorStatus(
                            enabled
                              ? '2-step login enabled. Temporary password will be required on every login.'
                              : '2-step login disabled.'
                          );
                        } catch (error) {
                          setTwoFactorStatus(error.message || 'Could not update 2-step login.');
                        } finally {
                          setTwoFactorSaving(false);
                        }
                      }}
                    >
                      {twoFactorSaving
                        ? 'Updating...'
                        : profile.two_factor_enabled
                        ? 'Turn Off'
                        : 'Turn On'}
                    </Button>
                  </div>
                  {twoFactorStatus && (
                    <p
                      className={`mt-3 text-sm ${
                        twoFactorStatus.toLowerCase().includes('could not') ||
                        twoFactorStatus.toLowerCase().includes('add a valid email')
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {twoFactorStatus}
                    </p>
                  )}
                </section>

              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
