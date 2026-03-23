'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';
import Loader from '../common/Loader.jsx';
import { ToastProvider } from '../common/ToastProvider.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isPathAllowed, isRestrictedModeUser, PUBLIC_PATHS } from '../../../lib/access.js';
import Button from '../common/Button.jsx';
import {
  applyAccentColor,
  getStoredAccentColor,
  DEFAULT_ACCENT_COLOR,
  applyTheme,
  getStoredTheme,
  DEFAULT_THEME,
} from '../../../lib/appearance.js';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const restrictedMode = isRestrictedModeUser(user);
  const isBillingPath = pathname.startsWith('/billing');
  const subscriptionExpired = user?.dashboard_subscription_expired === true;
  const subscriptionInactive =
    user?.dashboard_charge_enabled &&
    user?.dashboard_subscription_active === false &&
    !subscriptionExpired;
  const accessExpired = Boolean(
    user?.status && String(user.status).toLowerCase() !== 'active'
  );

  const restrictedTitle = accessExpired
    ? 'Access period over.'
    : subscriptionExpired
    ? 'Subscription expired.'
    : subscriptionInactive
    ? 'Subscription inactive.'
    : 'Account is in restricted mode.';

  const restrictedMessage = accessExpired
    ? 'Your access period is over. You can view your data but cannot update, delete, or create anything.'
    : subscriptionExpired
    ? 'Your subscription has expired. You can view your data but cannot update, delete, or create anything.'
    : subscriptionInactive
    ? 'Dashboard access requires an active subscription.'
    : 'You can browse, but add/edit actions are disabled until access is restored.';

  const restrictedActionNote = accessExpired || subscriptionExpired || subscriptionInactive
    ? 'Please contact super admin to reactivate your account or purchase a subscription.'
    : null;

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const storedAccent = getStoredAccentColor();
    applyAccentColor(storedAccent || DEFAULT_ACCENT_COLOR);
    const storedTheme = getStoredTheme(user?.id);
    applyTheme(storedTheme || DEFAULT_THEME);
  }, [user?.id]);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublic) return;
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isPathAllowed(user, pathname)) {
      router.push('/dashboard');
    }
  }, [isPublic, loading, user, pathname, router]);

  useEffect(() => {
    if (isPublic) return;
    if (!user?.id) return;
    if (typeof window === 'undefined') return;
    const now = new Date().toISOString();
    const inboxKey = `aa_inbox_last_seen_${user.id}`;
    const ordersKey = `aa_orders_last_seen_${user.id}`;
    let updated = false;

    if (pathname === '/inbox') {
      localStorage.setItem(inboxKey, now);
      updated = true;
    }

    if (pathname === '/orders') {
      localStorage.setItem(ordersKey, now);
      updated = true;
    }

    if (updated) {
      window.dispatchEvent(new Event('aa-badge-refresh'));
    }
  }, [isPublic, pathname, user?.id]);

  // Login/signup pages should NOT show sidebar/navbar
  if (isPublic) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-aa-light-bg">
        <Loader size="md" text="Checking access..." />
      </div>
    );
  }

  // Normal layout
  const desktopOffset = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64';
  const navbarDesktopOffset = sidebarCollapsed ? 'lg:left-20' : 'lg:left-64';

  return (
    <ToastProvider>
      <div className="min-h-screen bg-aa-light-bg overflow-x-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden aa-fade-in"
          />
        )}
        <div className={`flex min-h-screen flex-col ${desktopOffset}`}>
          <div className={`fixed inset-x-0 top-0 z-40 ${navbarDesktopOffset}`}>
            <Navbar onMenuClick={() => setSidebarOpen(true)} />
          </div>
          <div className="h-16 shrink-0 sm:h-[4.5rem]" aria-hidden="true" />
          <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
            {restrictedMode && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{restrictedTitle}</p>
                  <p className="text-xs text-amber-700">{restrictedMessage}</p>
                  {restrictedActionNote && (
                    <p className="text-xs text-amber-700">{restrictedActionNote}</p>
                  )}
                </div>
                {!isBillingPath && (
                  <Button variant="primary" onClick={() => router.push('/billing')}>
                    Go to Billing
                  </Button>
                )}
              </div>
            )}
            <div className={`min-w-0 ${restrictedMode && !isBillingPath ? 'aa-restricted-readonly' : ''}`}>
              {children}
            </div>
          </main>
        </div>
        <style jsx global>{`
          .aa-restricted-readonly button,
          .aa-restricted-readonly input,
          .aa-restricted-readonly select,
          .aa-restricted-readonly textarea,
          .aa-restricted-readonly [role='button'],
          .aa-restricted-readonly [contenteditable='true'] {
            pointer-events: none;
            opacity: 0.6;
          }
        `}</style>
      </div>
    </ToastProvider>
  );
}
