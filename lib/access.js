export const PUBLIC_PATHS = ['/login', '/signup', '/payment/success'];
const DASHBOARD_ONLY_PATHS = new Set(['/', '/dashboard']);

export const ROLE_PATHS = {
  super_admin: null,
  client_admin: null,
};

export function normalizePath(pathname = '') {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPathAllowed(role, pathname) {
  const current = normalizePath(pathname);
  if (PUBLIC_PATHS.includes(current)) return true;
  if (current === '/') return true;

  const user =
    role && typeof role === 'object'
      ? role
      : null;
  const resolvedRole = user?.admin_tier || (typeof role === 'string' ? role : null);

  if (isRestrictedModeUser(user)) {
    return DASHBOARD_ONLY_PATHS.has(current);
  }

  return Boolean(resolvedRole);
}

export function filterMenuItems(role, items) {
  const user =
    role && typeof role === 'object'
      ? role
      : null;
  const resolvedRole = user?.admin_tier || (typeof role === 'string' ? role : null);

  if (!resolvedRole) return [];

  const visible = items.filter((item) => {
    if (!item?.roles || item.roles.length === 0) return true;
    return item.roles.includes(resolvedRole);
  });
  return visible;
}

export function isRestrictedModeUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.admin_tier === 'super_admin') return false;
  if (user.restricted_mode === true) return true;
  return String(user.status || '').toLowerCase() !== 'active';
}
