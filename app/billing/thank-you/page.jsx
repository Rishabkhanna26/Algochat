'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '../../components/common/Button.jsx';

const getMessage = (status) => {
  if (status === 'paid') return 'Payment received. Your dashboard access is being updated.';
  if (status === 'failed') return 'Payment failed. Please try again.';
  if (status === 'cancelled') return 'Payment was cancelled. You can retry anytime.';
  if (status === 'expired') return 'Payment link expired. Please create a new one.';
  if (status === 'verifying') return 'Verifying your payment…';
  return 'Payment update received. Redirecting you to billing.';
};

export default function BillingThankYouPage() {
  const router = useRouter();
  const params = useSearchParams();
  const linkId = params.get('razorpay_payment_link_id');
  const initialStatus = String(params.get('razorpay_payment_link_status') || 'verifying').toLowerCase();
  const [status, setStatus] = useState(initialStatus);
  const message = useMemo(() => getMessage(status), [status]);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!linkId) return;
      setStatus('verifying');
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
        if (active) setStatus(String(payload?.data?.status || 'paid').toLowerCase());
      } catch (_err) {
        if (active && status === 'verifying') setStatus(initialStatus || 'unknown');
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [initialStatus, linkId, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/billing');
    }, 7000);
    return () => clearTimeout(timer);
  }, [router, status]);

  useEffect(() => {
    if (!linkId) return;
    const cleanTimer = setTimeout(() => {
      router.replace('/billing/thank-you');
    }, 1200);
    return () => clearTimeout(cleanTimer);
  }, [linkId, router]);

  return (
    <div className="min-h-screen bg-aa-light-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-aa-dark-blue">Thank You</h1>
        <p className="mt-3 text-sm text-aa-gray">{message}</p>
        <p className="mt-2 text-xs text-aa-gray">Redirecting to Billing in a few seconds…</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => router.push('/billing')}>
            Go to Billing
          </Button>
        </div>
      </div>
    </div>
  );
}
