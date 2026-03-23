'use client';

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Button from './Button.jsx';

export default function SubscriptionExpiredBanner({ subscriptionExpiresAt, showDismiss = false }) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (dismissed) return null;

  const expiryDate = subscriptionExpiresAt 
    ? new Date(subscriptionExpiresAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'N/A';

  return (
    <div className="w-full">
      <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-lg" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-red-800">
              Your access period is over
            </h3>
            <p className="mt-1 text-sm text-red-700">
              Access period ended on <strong>{expiryDate}</strong>. You can view your data but cannot update, delete, or create any new information until your subscription is renewed or access is restored.
            </p>
            <p className="mt-2 text-sm text-red-700">
              Please contact the super admin to reactivate your account or purchase a new subscription.
            </p>
            
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => router.push('/billing')}
                className="bg-red-600 hover:bg-red-700"
              >
                View Billing
              </Button>
              <Button
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-600"
              >
                Contact Admin
              </Button>
            </div>
          </div>

          {showDismiss && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 text-red-500 hover:text-red-700"
              aria-label="Dismiss"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
