'use client';

import { useState } from 'react';
import Button from './Button.jsx';
import Modal from './Modal.jsx';

export default function ActionButton({ 
  subscriptionExpired = false,
  children, 
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  icon,
  actionType = 'modify' // 'modify', 'update', 'delete', 'create'
}) {
  const [showWarning, setShowWarning] = useState(false);
  
  const isDisabled = disabled || subscriptionExpired;
  const tooltipMessage = subscriptionExpired 
    ? 'Your access period is over. You can only view data.' 
    : '';

  const handleClick = (e) => {
    if (subscriptionExpired) {
      setShowWarning(true);
      return;
    }
    onClick?.(e);
  };

  return (
    <>
      <div className="relative inline-block" title={tooltipMessage}>
        <Button
          variant={variant}
          onClick={handleClick}
          type={type}
          disabled={isDisabled}
          className={className}
          icon={icon}
        >
          {children}
        </Button>
      </div>

      <Modal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        title="Access Period Over"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Your access period is over. You can view your data but cannot {actionType} it.
          </p>
          <p className="text-sm text-gray-600">
            Please contact the super admin to reactivate your account or purchase a new subscription.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWarning(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowWarning(false);
                window.location.href = '/billing';
              }}
            >
              Go to Billing
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
