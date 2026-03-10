'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGauge,
  faInbox,
  faUsers,
  faTowerBroadcast,
  faFileLines,
  faChartBar,
  faUserGroup,
  faGear,
  faCalendarCheck,
  faHotel,
  faBoxOpen,
  faCartShopping,
  faWallet,
  faChevronLeft,
  faChevronRight,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../auth/AuthProvider.jsx';
import { filterMenuItems } from '../../../lib/access.js';
import {
  getCatalogLabel,
  hasAppointmentAccess,
  hasBookingAccess,
  hasProductAccess,
} from '../../../lib/business.js';

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onClose }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [inboxCount, setInboxCount] = useState(0);

  const showAppointments = Boolean(user?.id) && hasAppointmentAccess(user);
  const showBooking = Boolean(user?.id) && hasBookingAccess(user);
  const showOrders = Boolean(user?.id) && hasProductAccess(user);
  const catalogLabel = getCatalogLabel(user);

  useEffect(() => {
    if (!user?.id) {
      setInboxCount(0);
      return;
    }
    let mounted = true;
    const inboxKey = `aa_inbox_last_seen_${user.id}`;

    const fetchInboxCount = async () => {
      try {
        const since =
          typeof window !== 'undefined' && localStorage.getItem(inboxKey)
            ? localStorage.getItem(inboxKey)
            : '1970-01-01T00:00:00.000Z';
        const response = await fetch(`/api/users/count?since=${encodeURIComponent(since)}`, {
          credentials: 'include',
        });
        const data = await response.json();
        if (!mounted) return;
        setInboxCount(Math.max(0, Number(data?.count || 0)));
      } catch (error) {
        if (mounted) setInboxCount(0);
      }
    };

    fetchInboxCount();
    const handler = () => fetchInboxCount();
    window.addEventListener('aa-badge-refresh', handler);
    const timer = setInterval(fetchInboxCount, 30000);
    return () => {
      mounted = false;
      window.removeEventListener('aa-badge-refresh', handler);
      clearInterval(timer);
    };
  }, [user?.id]);

  const menuItems = [
    { name: 'Dashboard', icon: faGauge, path: '/dashboard' },
    { name: 'Inbox', icon: faInbox, path: '/inbox', badge: inboxCount > 0 ? String(inboxCount) : null },
    { name: 'Leads', icon: faUsers, path: '/contacts' },
    { name: catalogLabel, icon: faBoxOpen, path: '/catalog' },
    ...(showOrders ? [{ name: 'Orders', icon: faCartShopping, path: '/orders' }] : []),
    ...(showOrders ? [{ name: 'Revenue', icon: faWallet, path: '/revenue' }] : []),
    ...(showAppointments ? [{ name: 'Appointments', icon: faCalendarCheck, path: '/appointments' }] : []),
    ...(showBooking ? [{ name: 'Booking', icon: faHotel, path: '/booking' }] : []),
    { name: 'Reports', icon: faChartBar, path: '/reports' },
    { name: 'Admins', icon: faUserGroup, path: '/admins', roles: ['super_admin'] },
    { name: 'Settings', icon: faGear, path: '/settings' },
    // { name: 'Broadcast', icon: faTowerBroadcast, path: '/broadcast' },
    // { name: 'Templates', icon: faFileLines, path: '/templates' },
  ];
  const visibleItems = filterMenuItems(user?.admin_tier, menuItems);

  const sectionForItem = (itemName = '') => {
    const name = String(itemName || '').toLowerCase();
    if (['dashboard', 'inbox', 'leads'].includes(name)) return 'core';
    if (name.includes('product') || name.includes('service') || ['orders', 'revenue'].includes(name)) {
      return 'commerce';
    }
    if (['appointments', 'booking'].includes(name)) return 'schedule';
    return 'system';
  };

  const sectionMeta = [
    { id: 'core', label: 'Core' },
    { id: 'commerce', label: 'Sell' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'system', label: 'System' },
  ];

  const grouped = sectionMeta
    .map((section) => ({
      ...section,
      items: visibleItems.filter((item) => sectionForItem(item.name) === section.id),
    }))
    .filter((section) => section.items.length > 0);

  const widthClass = collapsed
    ? 'w-[85vw] max-w-[300px] lg:w-20'
    : 'w-[85vw] max-w-[320px] lg:w-64';
  const translateClass = mobileOpen ? 'translate-x-0' : '-translate-x-full';
  const showLabels = !collapsed || mobileOpen;
  const compactDesktop = collapsed && !mobileOpen;

  return (
    <aside
      className={`${widthClass} ${translateClass} lg:translate-x-0 bg-aa-dark-blue h-[100dvh] max-h-[100dvh] fixed left-0 top-0 flex flex-col z-50 overflow-hidden border-r border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.45)] transition-[transform,width] duration-300 ease-out`}
      data-testid="sidebar"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-aa-orange/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/25 to-transparent" />
      </div>

      {/* Logo */}
      <div
        className={
          compactDesktop
            ? 'border-b border-white/10 px-2 py-4'
            : 'border-b border-white/10 px-4 py-4 sm:px-6 sm:py-6'
        }
      >
        <div
          className={
            compactDesktop
              ? 'flex flex-col items-center gap-3'
              : 'flex items-center justify-between gap-3'
          }
        >
          <div
            className={
              compactDesktop
                ? 'flex w-full items-center justify-center'
                : 'flex min-w-0 flex-1 items-center gap-3'
            }
          >
            <div
              className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-white/10 ${
                compactDesktop ? 'h-14 w-14 rounded-xl p-1.5' : 'h-16 w-16 rounded-2xl p-2'
              }`}
            >
              <Image
                src="/cropped_image-2026-03-09T09-25-38.png"
                alt="AlgoChat logo"
                width={64}
                height={64}
                className="h-full w-full object-contain"
                sizes={compactDesktop ? '56px' : '64px'}
                priority
              />
            </div>
            {showLabels && (
              <div className="min-w-0">
                <p className="truncate text-xl font-bold leading-none tracking-tight text-white">
                  AlgoChat
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold tracking-wide text-white/60">
                  WhatsApp CRM
                </p>
              </div>
            )}
          </div>
          <div
            className={
              compactDesktop
                ? 'flex items-center justify-center'
                : 'flex shrink-0 items-center justify-center gap-2 self-center'
            }
          >
            {mobileOpen && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Close sidebar"
              >
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 20 }} />
              </button>
            )}
            <button
              onClick={onToggleCollapse}
              className="hidden h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              data-testid="sidebar-toggle"
            >
              {collapsed ? (
                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 20 }} />
              ) : (
                <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 20 }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-5">
        {grouped.map((section) => (
          <div key={section.id} className="mb-6 last:mb-0">
            {showLabels && (
              <div className="mb-3 px-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  {section.label}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {section.items.map((item) => {
                const isActive = pathname === item.path;
                const compact = collapsed && !mobileOpen;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={mobileOpen ? onClose : undefined}
                    data-testid={`sidebar-${item.name.toLowerCase()}`}
                    title={item.name}
                    className="block"
                  >
                    <div
                      className={`group relative overflow-hidden rounded-2xl ${compact ? 'p-2' : 'px-3 py-2.5'} transition-colors ${
                        isActive ? 'bg-white/10' : 'hover:bg-white/7'
                      }`}
                    >
                      <div
                        className={`absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full transition-opacity ${
                          isActive ? 'bg-aa-orange opacity-100' : 'bg-white/20 opacity-0 group-hover:opacity-70'
                        }`}
                      />
                      <div
                        className={`flex items-center ${compact ? 'justify-center' : 'gap-3'}`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                            isActive
                              ? 'border-aa-orange/40 bg-aa-orange/15 text-white'
                              : 'border-white/10 bg-white/5 text-white/80 group-hover:text-white'
                          } transition-colors`}
                        >
                          <FontAwesomeIcon icon={item.icon} style={{ fontSize: 18 }} />
                        </div>

                        {showLabels && (
                          <div className="min-w-0 flex-1">
                            <p
                              className={`min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-snug tracking-wide ${
                                isActive ? 'text-white' : 'text-white/80 group-hover:text-white'
                              }`}
                            >
                              {item.name}
                            </p>
                          </div>
                        )}

                        {showLabels && item.badge && (
                          <div className="shrink-0">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${
                                isActive ? 'bg-aa-orange text-white' : 'bg-white/10 text-white/80'
                              }`}
                            >
                              {item.badge}
                            </span>
                          </div>
                        )}
                      </div>

                      {isActive && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-aa-orange/20 to-transparent" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
