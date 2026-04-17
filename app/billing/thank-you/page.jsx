'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '../../components/common/Button.jsx';

const STATUS_META = {
  paid: {
    title: 'Payment Successful',
    message: 'Your payment was verified and access updates are being applied.',
    badge: 'Paid',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  failed: {
    title: 'Payment Failed',
    message: 'The payment did not complete. Please try again from Billing.',
    badge: 'Failed',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  cancelled: {
    title: 'Payment Cancelled',
    message: 'The payment was cancelled. You can generate a new link anytime.',
    badge: 'Cancelled',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  expired: {
    title: 'Payment Link Expired',
    message: 'This payment link is expired. Please create a new payment link.',
    badge: 'Expired',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  verifying: {
    title: 'Verifying Payment',
    message: 'We are checking your payment status with Razorpay.',
    badge: 'Verifying',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  unknown: {
    title: 'Payment Update Received',
    message: 'Status was received. Please check Billing for latest details.',
    badge: 'Updated',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

const formatInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '-';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_err) {
    return `₹${amount.toFixed(2)}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN');
};

export default function BillingThankYouPage() {
  const router = useRouter();
  const params = useSearchParams();
  const linkId = params.get('razorpay_payment_link_id');
  const initialStatus = String(params.get('razorpay_payment_link_status') || 'verifying').toLowerCase();
  const initialPaymentId = params.get('razorpay_payment_id');
  const [status, setStatus] = useState(initialStatus);
  const [countdown, setCountdown] = useState(8);
  const [verifyData, setVerifyData] = useState({
    paid_amount: 0,
    currency: 'INR',
    paid_at: null,
  });
  const [verifyError, setVerifyError] = useState('');
  const statusMeta = useMemo(() => STATUS_META[status] || STATUS_META.unknown, [status]);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!linkId) return;
      setStatus('verifying');
      setVerifyError('');
      try {
        const response = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ payment_link_id: linkId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Verification failed');
        }
        if (active) {
          setStatus(String(payload?.data?.status || 'paid').toLowerCase());
          setVerifyData({
            paid_amount: Number(payload?.data?.paid_amount || 0),
            currency: String(payload?.data?.currency || 'INR').toUpperCase(),
            paid_at: payload?.data?.paid_at || null,
          });
        }
      } catch (_err) {
        if (active) {
          setStatus(initialStatus || 'unknown');
          setVerifyError('Verification could not be completed automatically. Please check Billing.');
        }
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [initialStatus, linkId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (countdown !== 0) return;
    router.push('/billing');
  }, [countdown, router]);

  useEffect(() => {
    if (!linkId) return;
    const cleanTimer = setTimeout(() => {
      router.replace('/billing/thank-you');
    }, 1200);
    return () => clearTimeout(cleanTimer);
  }, [linkId, router]);

  return (
    <div className="min-h-screen bg-aa-light-bg px-4 py-10">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-aa-dark-blue">{statusMeta.title}</h1>
            <p className="mt-2 text-sm text-aa-gray">{statusMeta.message}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
            {statusMeta.badge}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-aa-text-dark">Payment Details</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-aa-gray">Payment Link ID</p>
              <p className="mt-1 break-all font-medium text-aa-text-dark">{linkId || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-aa-gray">Payment ID</p>
              <p className="mt-1 break-all font-medium text-aa-text-dark">{initialPaymentId || '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-aa-gray">Paid Amount</p>
              <p className="mt-1 font-medium text-aa-text-dark">
                {verifyData.currency === 'INR' ? formatInr(verifyData.paid_amount) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-aa-gray">Paid At</p>
              <p className="mt-1 font-medium text-aa-text-dark">{formatDateTime(verifyData.paid_at)}</p>
            </div>
          </div>
        </div>

        {verifyError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {verifyError}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-aa-text-dark">Next Steps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-aa-gray">
            <li>Open Billing to review updated subscription and payment status.</li>
            <li>Use Purchase History to download invoice.</li>
            <li>Contact support only if status remains incorrect after refresh.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => router.push('/billing')}>
            Open Billing
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>

        <div className="mt-4 text-xs text-aa-gray">
          Redirecting to Billing in {countdown}s...
        </div>
      </div>
    </div>
  );
}
