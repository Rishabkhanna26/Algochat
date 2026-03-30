'use client';
import { useEffect, useMemo, useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Modal from '../components/common/Modal.jsx';
import Input from '../components/common/Input.jsx';
import Loader from '../components/common/Loader.jsx';
import GeminiSelect from '../components/common/GeminiSelect.jsx';
import { useToast } from '../components/common/ToastProvider.jsx';
import { useAuth } from '../components/auth/AuthProvider.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faBoxOpen,
  faPenToSquare,
  faTrashCan,
  faCopy,
  faToggleOn,
  faToggleOff,
  faMagnifyingGlass,
  faTags,
  faClock,
  faArrowUp,
  faArrowDown,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import {
  canUseCatalogItemType,
  getAppointmentCapabilityLabel,
  getCatalogLabel,
  hasProductAccess,
  hasServiceAccess,
} from '../../lib/business.js';
import { isRestrictedModeUser } from '../../lib/access.js';

const DEFAULT_SERVICE_PROMPT =
  'Please share your service details (requirements and any specific concerns).';
const DEFAULT_PRODUCT_PROMPT =
  'Please share product details (variant/size, quantity, and any preferences).';
const DURATION_UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];
const PRODUCT_QUANTITY_UNITS = ['g', 'kg', 'ml', 'liter', 'meter', 'pcs', 'custom'];

const buildEmptyForm = (type = 'service') => ({
  item_type: type,
  name: '',
  category: '',
  price_label: '',
  duration_value: '',
  duration_unit: 'minutes',
  description: '',
  details_prompt: type === 'service' ? DEFAULT_SERVICE_PROMPT : DEFAULT_PRODUCT_PROMPT,
  keywords: '',
  quantity_value: '',
  quantity_unit: 'kg',
  quantity_unit_custom: '',
  is_active: true,
  sort_order: 0,
  is_bookable: false,
  is_time_based: false,
  payment_required: false,
  free_delivery_eligible: false,
  show_on_whatsapp: true,
  whatsapp_sort_order: '',
});

const formatKeywords = (keywords) => {
  if (Array.isArray(keywords)) return keywords.join(', ');
  return keywords || '';
};

const parseNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const DURATION_UNIT_MINUTE_FACTORS = {
  minutes: 1,
  hours: 60,
  weeks: 60 * 24 * 7,
  months: 60 * 24 * 30,
};

const normalizePriceLabel = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.includes('₹')) {
    return text.replace(/₹\s*/g, '₹ ').replace(/\s{2,}/g, ' ').trim();
  }
  let normalized = text.replace(/^\s*(?:inr|rs\.?|rupees?)\s*/i, '₹ ');
  if (!normalized.includes('₹') && /^\d/.test(normalized)) {
    normalized = `₹ ${normalized}`;
  }
  return normalized.replace(/\s{2,}/g, ' ').trim();
};

const parsePriceAmount = (value) => {
  const raw = String(value || '').replace(/,/g, '');
  const matched = raw.match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const amount = Number(matched[1]);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : null;
};

const formatDurationLabel = (item) => {
  const durationValue = parseNumber(item?.duration_value, null);
  const durationUnit = String(item?.duration_unit || '').trim().toLowerCase();
  if (durationValue && durationUnit) {
    const unitLabel = durationValue === 1 ? durationUnit.replace(/s$/, '') : durationUnit;
    return `${durationValue} ${unitLabel}`;
  }
  const durationMinutes = parseNumber(item?.duration_minutes, null);
  if (durationMinutes) return `${durationMinutes} min`;
  return '';
};

const formatQuantityLabel = (item) => {
  const value = parseNumber(item?.quantity_value, null);
  const unit = String(item?.quantity_unit || '').trim();
  if (!value) return '';
  return `${value} ${unit || 'unit'}`;
};

const clampWhatsappLimit = (value, fallback = 3) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const normalized = Math.trunc(num);
  if (normalized < 0) return 0;
  if (normalized > 25) return 25;
  return normalized;
};

const sortItemsByCatalogOrder = (items = []) =>
  [...items].sort((a, b) => {
    const orderA = parseNumber(a?.sort_order, 0) ?? 0;
    const orderB = parseNumber(b?.sort_order, 0) ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

const getWhatsappFeaturedRank = (item) => {
  const rank = parseNumber(item?.whatsapp_sort_order, 0) ?? 0;
  return rank > 0 ? rank : null;
};

const isWhatsappFeatured = (item) => Boolean(getWhatsappFeaturedRank(item));

const sortItemsForWhatsappPreview = (items = []) =>
  [...items].sort((a, b) => {
    const whatsappOrderA = getWhatsappFeaturedRank(a);
    const whatsappOrderB = getWhatsappFeaturedRank(b);
    const orderA = parseNumber(a?.sort_order, 0) ?? 0;
    const orderB = parseNumber(b?.sort_order, 0) ?? 0;
    if (Boolean(whatsappOrderA) !== Boolean(whatsappOrderB)) return whatsappOrderA ? -1 : 1;
    if (whatsappOrderA && whatsappOrderB && whatsappOrderA !== whatsappOrderB) {
      return whatsappOrderA - whatsappOrderB;
    }
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

const formatWhatsappPreviewEntry = (item, type, index) => {
  const parts = [`${index + 1}. ${item.name}`];
  if (item.price_label) parts.push(`(${normalizePriceLabel(item.price_label)})`);
  const durationText = formatDurationLabel(item);
  if (type === 'service' && durationText) parts.push(durationText);
  if (type === 'product') {
    const quantityText = formatQuantityLabel(item);
    if (quantityText) parts.push(`Pack: ${quantityText}`);
  }
  return parts.join(' ');
};

const buildWhatsappPreviewModel = ({ items, type, limit }) => {
  const eligibleItems = items.filter(
    (item) =>
      item.item_type === type &&
      item.is_active &&
      Boolean(item.show_on_whatsapp ?? true)
  );
  const configuredFeaturedItems = sortItemsForWhatsappPreview(
    eligibleItems.filter((item) => isWhatsappFeatured(item))
  );
  const visibleItems = sortItemsForWhatsappPreview(eligibleItems).slice(0, limit);
  const featuredItems = visibleItems.filter((item) => isWhatsappFeatured(item));
  const autoFillItems = visibleItems.filter((item) => !isWhatsappFeatured(item));

  return {
    limit,
    eligibleCount: eligibleItems.length,
    featuredCount: configuredFeaturedItems.length,
    configuredFeaturedItems,
    visibleItems,
    featuredItems,
    autoFillItems,
    lines: visibleItems.map((item, index) => formatWhatsappPreviewEntry(item, type, index)),
  };
};

export default function CatalogPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    category: 'all',
  });
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [whatsappDisplay, setWhatsappDisplay] = useState({
    serviceLimit: '3',
    productLimit: '3',
  });
  const [whatsappDisplaySaving, setWhatsappDisplaySaving] = useState(false);
  const [itemActionBusy, setItemActionBusy] = useState(false);
  const restrictedMode = isRestrictedModeUser(user);
  const canAddProducts = restrictedMode || hasProductAccess(user);
  const canAddServices = restrictedMode || hasServiceAccess(user);
  const catalogLabel = getCatalogLabel(user);
  const serviceSectionLabel = useMemo(() => {
    if (!canAddServices) return 'Services';
    return user?.booking_enabled ? getAppointmentCapabilityLabel(user) : 'Services';
  }, [canAddServices, user]);
  const isDurationEnabled =
    form.item_type === 'service' && Boolean(form.is_time_based);

  useEffect(() => {
    if (!notice) return;
    pushToast({ type: 'success', title: 'Saved', message: notice });
  }, [notice, pushToast]);

  useEffect(() => {
    if (!error) return;
    pushToast({ type: 'error', title: 'Not saved', message: error });
  }, [error, pushToast]);

  const fetchItems = async ({ bustCache = false, showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const cacheKey = bustCache ? `&ts=${Date.now()}` : '';
      const response = await fetch(`/api/catalog?limit=500${cacheKey}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load catalog');
      }
      setItems(data.data || []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems({ showLoader: true });
  }, []);

  useEffect(() => {
    const fetchWhatsappDisplay = async () => {
      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || 'Failed to load WhatsApp display settings');
        }
        setWhatsappDisplay({
          serviceLimit: String(clampWhatsappLimit(data?.data?.whatsapp_service_limit, 3)),
          productLimit: String(clampWhatsappLimit(data?.data?.whatsapp_product_limit, 3)),
        });
      } catch (_error) {
        setWhatsappDisplay({
          serviceLimit: '3',
          productLimit: '3',
        });
      }
    };

    fetchWhatsappDisplay();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set();
    items.forEach((item) => {
      if (item.category) unique.add(item.category);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const typeOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All' }];
    if (canAddServices) options.push({ value: 'service', label: 'Services' });
    if (canAddProducts) options.push({ value: 'product', label: 'Products' });
    return options;
  }, [canAddProducts, canAddServices]);

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    []
  );

  const categoryOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...categories.map((category) => ({ value: category, label: category }))],
    [categories]
  );

  const durationUnitOptions = useMemo(
    () => DURATION_UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  const quantityUnitOptions = useMemo(
    () =>
      PRODUCT_QUANTITY_UNITS.map((unit) => ({
        value: unit,
        label: unit === 'custom' ? 'Custom' : unit,
      })),
    []
  );

  const serviceTimeTypeOptions = useMemo(
    () => [
      { value: 'time_based', label: 'Time-based (fixed duration)' },
      { value: 'not_time_based', label: 'Not time-based (no time limit)' },
    ],
    []
  );

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.type !== 'all' && item.item_type !== filters.type) return false;
      if (filters.status !== 'all') {
        const isActive = Boolean(item.is_active);
        if (filters.status === 'active' && !isActive) return false;
        if (filters.status === 'inactive' && isActive) return false;
      }
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (search) {
        const haystack = `${item.name} ${item.category || ''} ${item.description || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [items, filters]);

  const filteredServices = useMemo(
    () => sortItemsByCatalogOrder(filteredItems.filter((item) => item.item_type === 'service')),
    [filteredItems]
  );

  const filteredProducts = useMemo(
    () => sortItemsByCatalogOrder(filteredItems.filter((item) => item.item_type === 'product')),
    [filteredItems]
  );

  const filteredSections = useMemo(() => {
    if (filters.type === 'service') {
      return [{ key: 'service', title: serviceSectionLabel, items: filteredServices }];
    }
    if (filters.type === 'product') {
      return [{ key: 'product', title: 'Products', items: filteredProducts }];
    }
    const sections = [];
    if (filteredServices.length) {
      sections.push({ key: 'service', title: serviceSectionLabel, items: filteredServices });
    }
    if (filteredProducts.length) {
      sections.push({ key: 'product', title: 'Products', items: filteredProducts });
    }
    return sections;
  }, [filters.type, filteredProducts, filteredServices, serviceSectionLabel]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.is_active).length;
    const services = items.filter((item) => item.item_type === 'service').length;
    const products = items.filter((item) => item.item_type === 'product').length;
    return { total, active, services, products };
  }, [items]);

  const nextSortOrder = useMemo(() => {
    const maxOrder = items.reduce((max, item) => {
      const order = parseNumber(item?.sort_order, 0) ?? 0;
      return order > max ? order : max;
    }, 0);
    return maxOrder + 10;
  }, [items]);

  const catalogPositionById = useMemo(() => {
    const map = new Map();
    ['service', 'product'].forEach((type) => {
      const orderedItems = sortItemsByCatalogOrder(
        items.filter((item) => item.item_type === type)
      );
      orderedItems.forEach((item, index) => {
        map.set(String(item.id), { index, count: orderedItems.length });
      });
    });
    return map;
  }, [items]);

  const featuredPositionById = useMemo(() => {
    const map = new Map();
    ['service', 'product'].forEach((type) => {
      const featuredItems = sortItemsForWhatsappPreview(
        items.filter((item) => item.item_type === type && isWhatsappFeatured(item))
      );
      featuredItems.forEach((item, index) => {
        map.set(String(item.id), { index, count: featuredItems.length });
      });
    });
    return map;
  }, [items]);

  const whatsappPreview = useMemo(
    () => ({
      service: buildWhatsappPreviewModel({
        items,
        type: 'service',
        limit: clampWhatsappLimit(whatsappDisplay.serviceLimit, 3),
      }),
      product: buildWhatsappPreviewModel({
        items,
        type: 'product',
        limit: clampWhatsappLimit(whatsappDisplay.productLimit, 3),
      }),
    }),
    [items, whatsappDisplay]
  );

  const openCreateModal = (type) => {
    if (!canUseCatalogItemType(user, type)) {
      setError(`You cannot add ${type} items for your selected business type.`);
      return;
    }
    setEditingItem(null);
    setForm({
      ...buildEmptyForm(type),
      sort_order: nextSortOrder,
      whatsapp_sort_order: '',
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    const itemQuantityUnit = String(item.quantity_unit || '').trim().toLowerCase();
    const supportsPresetUnit = PRODUCT_QUANTITY_UNITS.includes(itemQuantityUnit);
    const whatsappOrderValue = parseNumber(item.whatsapp_sort_order, 0) ?? 0;
    setEditingItem(item);
    setForm({
      item_type: item.item_type,
      name: item.name || '',
      category: item.category || '',
      price_label: normalizePriceLabel(item.price_label || ''),
      duration_value: item.is_time_based
        ? item.duration_value ?? item.duration_minutes ?? ''
        : '',
      duration_unit: item.duration_unit || 'minutes',
      description: item.description || '',
      details_prompt: item.details_prompt || (item.item_type === 'service' ? DEFAULT_SERVICE_PROMPT : DEFAULT_PRODUCT_PROMPT),
      keywords: formatKeywords(item.keywords),
      quantity_value: item.quantity_value ?? '',
      quantity_unit: supportsPresetUnit ? itemQuantityUnit : item.quantity_value ? 'custom' : 'kg',
      quantity_unit_custom:
        item.quantity_value && !supportsPresetUnit ? String(item.quantity_unit || '') : '',
      is_active: Boolean(item.is_active),
      sort_order: item.sort_order ?? 0,
      is_bookable: Boolean(item.is_bookable),
      is_time_based: Boolean(item.is_time_based),
      payment_required: Boolean(item.payment_required),
      free_delivery_eligible: Boolean(item.free_delivery_eligible),
      show_on_whatsapp: Boolean(item.show_on_whatsapp ?? true),
      whatsapp_sort_order: whatsappOrderValue > 0 ? whatsappOrderValue : '',
    });
    setShowModal(true);
  };

  const updateCatalogItemRequest = async (itemId, payload) => {
    const response = await fetch(`/api/catalog/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || 'Failed to update item');
    }
    return data?.data || null;
  };

  const runCatalogUpdates = async (updates, successMessage = '') => {
    if (!Array.isArray(updates) || updates.length === 0) {
      if (successMessage) setNotice(successMessage);
      return true;
    }

    setItemActionBusy(true);
    setNotice('');
    setError('');
    try {
      for (const update of updates) {
        await updateCatalogItemRequest(update.id, update.payload);
      }
      await fetchItems({ bustCache: true });
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setItemActionBusy(false);
    }
  };

  const buildFeaturedRankUpdates = (type, nextFeaturedItems) => {
    const nextRankById = new Map(
      nextFeaturedItems.map((item, index) => [String(item.id), index + 1])
    );

    return items
      .filter(
        (item) =>
          item.item_type === type &&
          (nextRankById.has(String(item.id)) || isWhatsappFeatured(item))
      )
      .map((item) => {
        const nextRank = nextRankById.get(String(item.id)) || 0;
        return {
          id: item.id,
          payload: { whatsapp_sort_order: nextRank },
          changed: (getWhatsappFeaturedRank(item) || 0) !== nextRank,
        };
      })
      .filter((update) => update.changed)
      .map(({ changed, ...update }) => update);
  };

  const buildCatalogOrderUpdates = (orderedItems) =>
    orderedItems
      .map((item, index) => {
        const nextOrder = (index + 1) * 10;
        return {
          id: item.id,
          payload: { sort_order: nextOrder },
          changed: (parseNumber(item?.sort_order, 0) ?? 0) !== nextOrder,
        };
      })
      .filter((update) => update.changed)
      .map(({ changed, ...update }) => update);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');

    if (!canUseCatalogItemType(user, form.item_type)) {
      setSaving(false);
      setError(`You cannot add ${form.item_type} items for your selected business type.`);
      return;
    }
    if (form.item_type === 'service' && form.is_bookable && form.payment_required) {
      if (!(Number.isFinite(parsePriceAmount(form.price_label)) && parsePriceAmount(form.price_label) > 0)) {
        setSaving(false);
        setError('Paid services must include a numeric price.');
        return;
      }
    }

    const payload = {
      item_type: form.item_type,
      name: form.name.trim(),
      category: form.category.trim(),
      price_label: normalizePriceLabel(form.price_label),
      duration_value:
        form.item_type === 'service' && form.is_time_based
          ? parseNumber(form.duration_value, null)
          : null,
      duration_unit:
        form.item_type === 'service' && form.is_time_based
          ? form.duration_unit || 'minutes'
          : null,
      duration_minutes:
        form.item_type === 'service' && form.is_time_based
          ? (() => {
              const durationValue = parseNumber(form.duration_value, null);
              const factor = DURATION_UNIT_MINUTE_FACTORS[form.duration_unit] || 1;
              if (!durationValue || durationValue <= 0) return null;
              return Math.round(durationValue * factor);
            })()
          : null,
      quantity_value:
        form.item_type === 'product' ? parseNumber(form.quantity_value, null) : null,
      quantity_unit:
        form.item_type === 'product' && parseNumber(form.quantity_value, null)
          ? (form.quantity_unit === 'custom'
              ? form.quantity_unit_custom.trim()
              : form.quantity_unit || 'unit')
          : null,
      description: form.description.trim(),
      details_prompt: form.details_prompt.trim(),
      keywords: form.keywords,
      is_active: Boolean(form.is_active),
      sort_order: parseNumber(
        form.sort_order,
        editingItem ? parseNumber(editingItem?.sort_order, 0) ?? 0 : nextSortOrder
      ),
      is_bookable: form.item_type === 'service' ? Boolean(form.is_bookable) : false,
      payment_required:
        form.item_type === 'service' && form.is_bookable ? Boolean(form.payment_required) : false,
      free_delivery_eligible:
        form.item_type === 'product' ? Boolean(form.free_delivery_eligible) : false,
      show_on_whatsapp: Boolean(form.show_on_whatsapp),
      whatsapp_sort_order:
        form.is_active && form.show_on_whatsapp
          ? parseNumber(form.whatsapp_sort_order, 0)
          : 0,
      is_time_based: form.item_type === 'service' ? Boolean(form.is_time_based) : false,
    };

    try {
      const response = await fetch(
        editingItem ? `/api/catalog/${editingItem.id}` : '/api/catalog',
        {
          method: editingItem ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save item');
      }
      setShowModal(false);
      setEditingItem(null);
      setNotice(editingItem ? 'Item updated.' : 'Item created.');
      await fetchItems({ bustCache: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    const nextActive = !item.is_active;
    await runCatalogUpdates(
      [
        {
          id: item.id,
          payload: {
            is_active: nextActive,
            whatsapp_sort_order: nextActive ? parseNumber(item.whatsapp_sort_order, 0) : 0,
          },
        },
      ],
      nextActive ? 'Item activated.' : 'Item hidden from the live catalog.'
    );
  };

  const handleToggleWhatsappVisibility = async (item) => {
    const nextVisible = !Boolean(item.show_on_whatsapp ?? true);
    await runCatalogUpdates(
      [
        {
          id: item.id,
          payload: {
            show_on_whatsapp: nextVisible,
            whatsapp_sort_order: nextVisible ? parseNumber(item.whatsapp_sort_order, 0) : 0,
          },
        },
      ],
      nextVisible ? 'Item added back to WhatsApp.' : 'Item hidden from WhatsApp.'
    );
  };

  const handleToggleFeatured = async (item) => {
    if (!item.is_active) {
      setError('Activate this item before adding it to the first WhatsApp message.');
      return;
    }
    if (item.show_on_whatsapp === false) {
      setError('Turn on Show in WhatsApp menu before making this a top pick.');
      return;
    }

    const typeFeaturedItems = sortItemsForWhatsappPreview(
      items.filter((entry) => entry.item_type === item.item_type && isWhatsappFeatured(entry))
    );
    const nextFeaturedItems = isWhatsappFeatured(item)
      ? typeFeaturedItems.filter((entry) => String(entry.id) !== String(item.id))
      : [...typeFeaturedItems, item];

    await runCatalogUpdates(
      buildFeaturedRankUpdates(item.item_type, nextFeaturedItems),
      isWhatsappFeatured(item) ? 'Top pick removed.' : 'Top pick added to the first message.'
    );
  };

  const handleMoveFeaturedItem = async (item, direction) => {
    const featuredItems = sortItemsForWhatsappPreview(
      items.filter((entry) => entry.item_type === item.item_type && isWhatsappFeatured(entry))
    );
    const currentIndex = featuredItems.findIndex((entry) => String(entry.id) === String(item.id));
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= featuredItems.length) return;

    const nextFeaturedItems = [...featuredItems];
    const [movedItem] = nextFeaturedItems.splice(currentIndex, 1);
    nextFeaturedItems.splice(nextIndex, 0, movedItem);

    await runCatalogUpdates(
      buildFeaturedRankUpdates(item.item_type, nextFeaturedItems),
      'First-message order updated.'
    );
  };

  const handleMoveCatalogItem = async (item, direction) => {
    const orderedItems = sortItemsByCatalogOrder(
      items.filter((entry) => entry.item_type === item.item_type)
    );
    const currentIndex = orderedItems.findIndex((entry) => String(entry.id) === String(item.id));
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedItems.length) return;

    const nextOrderedItems = [...orderedItems];
    const [movedItem] = nextOrderedItems.splice(currentIndex, 1);
    nextOrderedItems.splice(nextIndex, 0, movedItem);

    await runCatalogUpdates(
      buildCatalogOrderUpdates(nextOrderedItems),
      'Catalog order updated.'
    );
  };

  const handleDuplicate = async (item) => {
    setSaving(true);
    setNotice('');
    setError('');
    if (!canUseCatalogItemType(user, item?.item_type)) {
      setSaving(false);
      setError(`You cannot add ${item?.item_type || 'this'} item for your selected business type.`);
      return;
    }
    try {
      const response = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_type: item.item_type,
          name: `${item.name} (Copy)`,
          category: item.category || '',
          price_label: normalizePriceLabel(item.price_label || ''),
          duration_value:
            item.item_type === 'service' ? item.duration_value ?? item.duration_minutes ?? null : null,
          duration_unit: item.item_type === 'service' ? item.duration_unit || 'minutes' : null,
          duration_minutes: item.item_type === 'service' ? item.duration_minutes ?? null : null,
          quantity_value: item.item_type === 'product' ? item.quantity_value ?? null : null,
          quantity_unit: item.item_type === 'product' ? item.quantity_unit || null : null,
          description: item.description || '',
          details_prompt: item.details_prompt || '',
          keywords: item.keywords || '',
          is_active: false,
          sort_order: nextSortOrder,
          is_bookable: Boolean(item.is_bookable),
          payment_required: Boolean(item.payment_required),
          free_delivery_eligible: Boolean(item.free_delivery_eligible),
          show_on_whatsapp: Boolean(item.show_on_whatsapp ?? true),
          whatsapp_sort_order: 0,
          is_time_based: Boolean(item.is_time_based),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate item');
      }
      setNotice('Item duplicated.');
      await fetchItems({ bustCache: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!item?.id) {
      setError('Unable to delete item: missing id.');
      return;
    }
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) {
      setDeleteTarget(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/catalog/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data.error || 'Failed to delete item');
      }
      setNotice('Item deleted.');
      setItems((prev) => prev.filter((entry) => String(entry.id) !== String(deleteTarget.id)));
      await fetchItems({ bustCache: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const saveWhatsappDisplaySettings = async () => {
    setWhatsappDisplaySaving(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          whatsapp_service_limit: clampWhatsappLimit(whatsappDisplay.serviceLimit, 3),
          whatsapp_product_limit: clampWhatsappLimit(whatsappDisplay.productLimit, 3),
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Failed to save WhatsApp display settings');
      }
      setWhatsappDisplay({
        serviceLimit: String(clampWhatsappLimit(data?.data?.whatsapp_service_limit, 3)),
        productLimit: String(clampWhatsappLimit(data?.data?.whatsapp_product_limit, 3)),
      });
      setNotice('WhatsApp display settings updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setWhatsappDisplaySaving(false);
    }
  };

  const renderWhatsappPreviewCard = ({ type, title, accentClass, badgeClass }) => {
    const preview = whatsappPreview[type];
    const maxRows = 5;
    const pinnedNow = preview.featuredItems.slice(0, maxRows);
    const visibleNow = preview.visibleItems.slice(0, maxRows);
    const pinnedOverflow = Math.max(preview.featuredItems.length - maxRows, 0);
    const visibleOverflow = Math.max(preview.visibleItems.length - maxRows, 0);

    return (
        <div className="rounded-[26px] border border-[#f1dcc5] bg-white/95 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}>{title}</p>
              <p className="mt-1 text-[11px] text-aa-gray">Preview of the first WhatsApp items customers will see.</p>
            </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap ${badgeClass}`}>
              Live {preview.visibleItems.length}/{preview.limit}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-aa-dark-blue">
              Pinned {preview.featuredItems.length}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <div className="rounded-2xl border border-[#f5e5d4] bg-[#fffaf4] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-aa-dark-blue">Pinned First</p>
              <span className="text-[11px] font-semibold text-aa-gray">{preview.featuredItems.length} now</span>
            </div>
            {preview.featuredItems.length === 0 ? (
              <p className="mt-2 text-sm text-aa-gray">No pinned items.</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-[#f2e4d2] text-[13px] text-aa-text-dark">
                  {pinnedNow.map((item, index) => (
                    <li key={`${type}-featured-${item.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block break-words font-semibold leading-snug">{item.name}</span>
                        {item.price_label ? (
                          <span className="mt-0.5 block text-xs text-aa-gray">
                            {normalizePriceLabel(item.price_label)}
                          </span>
                        ) : null}
                      </span>
                      <span className="rounded-full bg-[#fff1d9] px-2 py-1 text-[11px] font-semibold text-aa-orange">
                        Pin {index + 1}
                      </span>
                    </li>
                  ))}
                </ul>
                {pinnedOverflow > 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-aa-gray">+{pinnedOverflow} more pinned</p>
                ) : null}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#f5e5d4] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-aa-dark-blue">Menu Preview</p>
              <span className="text-[11px] font-semibold text-aa-gray">{preview.autoFillItems.length} auto</span>
            </div>
            {preview.lines.length === 0 ? (
              <p className="mt-2 text-sm text-aa-gray">No items to show.</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-[#f2e4d2] text-[13px] text-aa-text-dark">
                  {visibleNow.map((item, index) => (
                    <li key={`${type}-line-${item.id}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 py-2">
                      <span className="mt-0.5 inline-flex min-w-[38px] items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-aa-dark-blue">
                        {index + 1}
                      </span>
                      <span className="min-w-0 break-words leading-snug">
                        {formatWhatsappPreviewEntry(item, type, index)}
                      </span>
                    </li>
                  ))}
                </ul>
                {visibleOverflow > 0 ? (
                  <p className="mt-2 text-[11px] font-semibold text-aa-gray">+{visibleOverflow} more in menu</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" text="Loading products and services..." />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-aa-dark-blue mb-2">{catalogLabel}</h1>
          <p className="text-aa-gray">
            Control exactly what appears in WhatsApp. Hidden items stay out of WhatsApp, and visible items follow your first-message and menu order.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<FontAwesomeIcon icon={faPlus} style={{ fontSize: 16 }} />}
            onClick={() => openCreateModal(canAddServices ? 'service' : 'product')}
            disabled={!canAddServices && !canAddProducts}
          >
            {canAddServices && canAddProducts
              ? 'Add Product / Service'
              : canAddServices
              ? 'Add Service'
              : 'Add Product'}
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div className="flex flex-col gap-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-aa-gray uppercase mb-1">Total Items</p>
          <p className="text-2xl font-bold text-aa-dark-blue">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-aa-gray uppercase mb-1">Active</p>
          <p className="text-2xl font-bold text-aa-dark-blue">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-aa-gray uppercase mb-1">Services</p>
          <p className="text-2xl font-bold text-aa-dark-blue">{stats.services}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-aa-gray uppercase mb-1">Products</p>
          <p className="text-2xl font-bold text-aa-dark-blue">{stats.products}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1">
            <Input
              label="Search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search by name, category, or description"
              icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
            />
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[34rem] xl:grid-cols-3">
            <GeminiSelect
              label="Type"
              value={filters.type}
              onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
              options={typeOptions}
              size="sm"
              variant="vibrant"
              className="min-w-[11rem]"
            />
            <GeminiSelect
              label="Status"
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              options={statusOptions}
              size="sm"
              variant="warm"
              className="min-w-[11rem]"
            />
            <GeminiSelect
              label="Category"
              value={filters.category}
              onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
              options={categoryOptions}
              size="sm"
              variant="warm"
              className="min-w-[11rem]"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card className="p-4 sm:p-6 text-center">
              <div className="w-14 h-14 bg-aa-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faBoxOpen} className="text-aa-orange" style={{ fontSize: 22 }} />
              </div>
              <h3 className="text-lg font-bold text-aa-dark-blue">No items found</h3>
              <p className="text-aa-gray text-sm mt-2">Add your first product or service to start building the WhatsApp menu.</p>
              <div className="flex justify-center gap-3 mt-4">
                {canAddServices && (
                  <Button variant="outline" onClick={() => openCreateModal('service')}>
                    Add Service
                  </Button>
                )}
                {canAddProducts && (
                  <Button variant="primary" onClick={() => openCreateModal('product')}>
                    Add Product
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            filteredSections.map((section) => (
              <section key={`catalog-section-${section.key}`} className="space-y-4">
                {filteredSections.length > 1 && (
                  <div className="rounded-2xl border border-[#f1dcc5] bg-white/90 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-aa-dark-blue">{section.title}</h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-aa-gray">
                        {section.items.length} item{section.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {section.items.map((item) => {
              const catalogPosition = catalogPositionById.get(String(item.id));
              const featuredPosition = featuredPositionById.get(String(item.id));
              const featuredRank = getWhatsappFeaturedRank(item);
              const actionDisabled = saving || itemActionBusy;
              const normalizedPrice = normalizePriceLabel(item.price_label);
              const durationLabel = formatDurationLabel(item);
              const quantityLabel = formatQuantityLabel(item);
              const pinActionDisabled = actionDisabled || !item.is_active || item.show_on_whatsapp === false;

              return (
                <Card
                  key={item.id}
                  className={`w-full min-w-0 overflow-hidden border ${
                    featuredRank
                      ? 'border-[#f3c061] bg-gradient-to-br from-white via-[#fff9ef] to-[#fff1d9]'
                      : 'border-transparent'
                  }`}
                  data-testid={`catalog-item-${item.id}`}
                >
                  <div className="flex flex-col xl:flex-row">
                    <div className="min-w-0 flex-1 p-4 sm:p-5 xl:pl-6">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-base font-semibold text-aa-dark-blue sm:text-lg">
                              {item.name}
                            </h3>
                            {normalizedPrice && (
                              <span className="break-words text-sm font-semibold text-aa-orange">
                                {normalizedPrice}
                              </span>
                            )}
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            <Badge variant={item.item_type === 'service' ? 'blue' : 'orange'}>
                              {item.item_type === 'service' ? 'Service' : 'Product'}
                            </Badge>
                            <Badge variant={item.is_active ? 'green' : 'default'}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {item.category && <Badge variant="default">{item.category}</Badge>}
                            {item.is_bookable && <Badge variant="yellow">Bookable</Badge>}
                            {item.item_type === 'service' && item.is_bookable && (
                              <Badge variant={item.payment_required ? 'orange' : 'green'}>
                                {item.payment_required ? 'Paid before booking' : 'Free booking'}
                              </Badge>
                            )}
                            {item.item_type === 'product' && item.free_delivery_eligible && (
                              <Badge variant="blue">Free delivery eligible</Badge>
                            )}
                            <Badge variant={item.show_on_whatsapp === false ? 'default' : 'blue'}>
                              {item.show_on_whatsapp === false
                                ? 'Hidden from WhatsApp'
                                : 'Visible in WhatsApp'}
                            </Badge>
                            {item.item_type === 'service' && (
                              <Badge variant="default">
                                {item.is_time_based ? 'Time-based' : 'No time limit'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-aa-gray transition hover:bg-gray-100 hover:text-aa-dark-blue"
                            title="Edit"
                            onClick={() => openEditModal(item)}
                          >
                            <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 14 }} />
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-aa-gray transition ${
                              actionDisabled
                                ? 'cursor-not-allowed opacity-60'
                                : 'hover:bg-gray-100 hover:text-aa-dark-blue'
                            }`}
                            title="Duplicate"
                            onClick={() => handleDuplicate(item)}
                            disabled={actionDisabled}
                          >
                            <FontAwesomeIcon icon={faCopy} style={{ fontSize: 14 }} />
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 transition ${
                              actionDisabled
                                ? 'cursor-not-allowed opacity-60'
                                : 'hover:bg-red-50 hover:text-red-700'
                            }`}
                            title="Delete"
                            onClick={() => handleDelete(item)}
                            disabled={actionDisabled}
                          >
                            <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: 14 }} />
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
                              actionDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-100'
                            }`}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleActive(item)}
                            disabled={actionDisabled}
                          >
                            <FontAwesomeIcon
                              icon={item.is_active ? faToggleOn : faToggleOff}
                              style={{ fontSize: 16 }}
                              className={item.is_active ? 'text-green-500' : 'text-gray-400'}
                            />
                          </button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="mb-3 break-words text-sm text-aa-gray">{item.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-aa-gray">
                        {item.item_type === 'service' && durationLabel && (
                          <span className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faClock} />
                            {durationLabel}
                          </span>
                        )}
                        {item.item_type === 'product' && quantityLabel && (
                          <span className="flex items-center gap-1.5">
                            Pack: {quantityLabel}
                          </span>
                        )}
                        {item.keywords && item.keywords.length > 0 && (
                          <span className="flex items-center gap-1.5 break-words">
                            <FontAwesomeIcon icon={faTags} />
                            Keywords: {item.keywords.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 border-t border-[#f3dfc4] bg-[#fff9f2] p-4 sm:p-5 xl:w-64 xl:border-l xl:border-t-0 2xl:w-72">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-aa-orange">
                        WhatsApp Controls
                      </h4>
                      <p className="mb-3 text-[11px] text-aa-gray">
                        Choose visibility, first-message priority, and menu order.
                      </p>

                      <div className="mb-4 space-y-2">
                        <button
                          type="button"
                          className={`inline-flex h-8 w-full items-center justify-start gap-2 rounded-md border px-3 text-xs font-semibold transition ${
                            actionDisabled
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleToggleWhatsappVisibility(item)}
                          disabled={actionDisabled}
                        >
                          <FontAwesomeIcon
                            icon={item.show_on_whatsapp === false ? faToggleOn : faToggleOff}
                            style={{ fontSize: 13 }}
                          />
                          <span className="break-words text-left">
                            {item.show_on_whatsapp === false ? 'Show in WhatsApp' : 'Hide from WhatsApp'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-8 w-full items-center justify-start gap-2 rounded-md border px-3 text-xs font-semibold transition ${
                            pinActionDisabled
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleToggleFeatured(item)}
                          disabled={pinActionDisabled}
                        >
                          <FontAwesomeIcon icon={faStar} style={{ fontSize: 12 }} />
                          <span className="break-words text-left">
                            {featuredRank ? 'Remove from First Message' : 'Show First in WhatsApp'}
                          </span>
                        </button>
                      </div>

                      <h4 className="mb-1 text-xs font-semibold text-aa-dark-blue">Reorder</h4>
                      <p className="mb-2 text-[11px] text-aa-gray">Move this item in the first message or WhatsApp menu.</p>
                      <div className="mb-3 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-3 text-[11px] font-semibold transition ${
                            actionDisabled || !featuredPosition || featuredPosition.index === 0
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleMoveFeaturedItem(item, -1)}
                          disabled={actionDisabled || !featuredPosition || featuredPosition.index === 0}
                        >
                          <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 11 }} />
                          <span className="break-words">First Up</span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-3 text-[11px] font-semibold transition ${
                            actionDisabled ||
                            !featuredPosition ||
                            featuredPosition.index === featuredPosition.count - 1
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleMoveFeaturedItem(item, 1)}
                          disabled={
                            actionDisabled ||
                            !featuredPosition ||
                            featuredPosition.index === featuredPosition.count - 1
                          }
                        >
                          <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 11 }} />
                          <span className="break-words">First Down</span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-3 text-[11px] font-semibold transition ${
                            actionDisabled || !catalogPosition || catalogPosition.index === 0
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleMoveCatalogItem(item, -1)}
                          disabled={actionDisabled || !catalogPosition || catalogPosition.index === 0}
                        >
                          <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 11 }} />
                          <span className="break-words">Menu Up</span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-3 text-[11px] font-semibold transition ${
                            actionDisabled ||
                            !catalogPosition ||
                            catalogPosition.index === catalogPosition.count - 1
                              ? 'cursor-not-allowed border-gray-200 text-gray-400'
                              : 'border-[#f1dcc5] bg-white text-aa-dark-blue hover:border-aa-orange hover:text-aa-orange'
                          }`}
                          onClick={() => handleMoveCatalogItem(item, 1)}
                          disabled={
                            actionDisabled ||
                            !catalogPosition ||
                            catalogPosition.index === catalogPosition.count - 1
                          }
                        >
                          <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 11 }} />
                          <span className="break-words">Menu Down</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-aa-gray">
                        <span>WhatsApp menu {catalogPosition ? `#${catalogPosition.index + 1}` : 'hidden'}</span>
                        <span>
                          First message{' '}
                          {featuredRank
                            ? `pinned${featuredPosition ? ` #${featuredPosition.index + 1}` : ''}`
                            : 'not pinned'}
                        </span>
                      </div>

                      {featuredRank ? (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-aa-orange">
                          <FontAwesomeIcon icon={faStar} style={{ fontSize: 11 }} />
                          Showing in First Message
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden border border-[#f1dcc5] bg-gradient-to-br from-white via-[#fff9f2] to-[#fdebd7] shadow-md">
            <div className="border-b border-[#f1dcc5] bg-[#10243e] px-5 py-5 text-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5c96d]">
                      WhatsApp Preview
                    </p>
                    <h3 className="mt-2 text-xl font-bold">What customers will see</h3>
                  </div>
                  <span className="self-start rounded-full bg-white/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-white/90">
                    Always visible
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/80">
                  Set how many products and services show first. Items you pin always appear before the rest.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-[26px] border-2 border-[#FDA913] bg-gradient-to-br from-[#fffaf4] via-[#fff2e3] to-[#ffe4bf] p-4 shadow-lg shadow-[#FDA913]/10">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aa-orange">
                      Menu Settings
                      </p>
                      <p className="mt-1 text-sm font-semibold text-aa-dark-blue">
                      Choose how many items appear in WhatsApp.
                      </p>
                    </div>
                    <span className="self-start rounded-full bg-white/90 px-3 py-1 text-xs font-semibold whitespace-nowrap text-aa-dark-blue shadow-sm">
                      Live setup
                    </span>
                  </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {canAddServices && (
                    <Input
                      className="[&_label]:text-aa-dark-blue [&_label]:font-semibold [&_input]:border-[#f2b174] [&_input]:bg-white/95 [&_input]:shadow-sm [&_input]:focus:border-aa-orange"
                      label={`${serviceSectionLabel} shown`}
                      type="number"
                      min="0"
                      max="25"
                      value={whatsappDisplay.serviceLimit}
                      onChange={(event) =>
                        setWhatsappDisplay((prev) => ({
                          ...prev,
                          serviceLimit: event.target.value,
                        }))
                      }
                      placeholder="3"
                    />
                  )}
                  {canAddProducts && (
                    <Input
                      className="[&_label]:text-aa-dark-blue [&_label]:font-semibold [&_input]:border-[#f2b174] [&_input]:bg-white/95 [&_input]:shadow-sm [&_input]:focus:border-aa-orange"
                      label="Products shown"
                      type="number"
                      min="0"
                      max="25"
                      value={whatsappDisplay.productLimit}
                      onChange={(event) =>
                        setWhatsappDisplay((prev) => ({
                          ...prev,
                          productLimit: event.target.value,
                        }))
                      }
                      placeholder="3"
                    />
                  )}
                </div>
                <p className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-aa-dark-blue/80">
                  Use <span className="font-semibold text-aa-text-dark">0</span> to hide a section.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-4 w-full"
                  onClick={saveWhatsappDisplaySettings}
                  disabled={whatsappDisplaySaving}
                >
                  {whatsappDisplaySaving ? 'Saving...' : 'Save Menu Settings'}
                </Button>
              </div>

              <div className="space-y-3">
                {canAddServices &&
                  renderWhatsappPreviewCard({
                    type: 'service',
                    title: serviceSectionLabel,
                    accentClass: 'text-aa-orange',
                    badgeClass: 'bg-[#fff1d9] text-aa-orange',
                  })}
                {canAddProducts &&
                  renderWhatsappPreviewCard({
                    type: 'product',
                    title: 'Products',
                    accentClass: 'text-[#0f4c81]',
                    badgeClass: 'bg-[#e8f3ff] text-[#0f4c81]',
                  })}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
        size="xl"
      >
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-aa-gray">Item type</p>
                    <p className="text-lg font-semibold text-aa-text-dark">
                      Choose how this appears in WhatsApp
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          item_type: 'service',
                          details_prompt: DEFAULT_SERVICE_PROMPT,
                          duration_value: prev.duration_value || '',
                          duration_unit: prev.duration_unit || 'minutes',
                          is_time_based: prev.is_time_based || false,
                          payment_required: prev.payment_required || false,
                          free_delivery_eligible: false,
                        }))
                      }
                      disabled={Boolean(editingItem) || !canAddServices}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                        form.item_type === 'service'
                          ? 'bg-aa-dark-blue text-white'
                          : 'text-aa-gray hover:text-aa-dark-blue'
                      } ${editingItem || !canAddServices ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      Service
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          item_type: 'product',
                          details_prompt: DEFAULT_PRODUCT_PROMPT,
                          duration_value: '',
                          duration_unit: 'minutes',
                          is_time_based: false,
                          payment_required: false,
                        }))
                      }
                      disabled={Boolean(editingItem) || !canAddProducts}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                        form.item_type === 'product'
                          ? 'bg-aa-dark-blue text-white'
                          : 'text-aa-gray hover:text-aa-dark-blue'
                      } ${editingItem || !canAddProducts ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      Product
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g., Personal Astrology Consultation"
                  required
                />
                <Input
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="e.g., Consultations"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Price Label"
                  value={form.price_label}
                  onChange={(event) => setForm((prev) => ({ ...prev, price_label: normalizePriceLabel(event.target.value) }))}
                  placeholder="e.g., ₹ 999 / session"
                />
                {form.item_type === 'service' ? (
                  <Input
                    label="Duration Value"
                    type="number"
                    value={form.duration_value}
                    onChange={(event) => setForm((prev) => ({ ...prev, duration_value: event.target.value }))}
                    placeholder="e.g., 45"
                    disabled={!isDurationEnabled}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-aa-gray">
                    Duration is not needed for products.
                  </div>
                )}
              </div>

              {form.item_type === 'service' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <GeminiSelect
                      label="Duration Unit"
                      value={form.duration_unit}
                      onChange={(value) => setForm((prev) => ({ ...prev, duration_unit: value }))}
                      options={durationUnitOptions}
                      disabled={!isDurationEnabled}
                      variant="warm"
                    />
                  </div>
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-aa-gray">
                    {isDurationEnabled
                      ? 'Set duration only if service has fixed time. Leave empty if time is flexible.'
                      : 'Duration is disabled because this service is set to no time limit.'}
                  </div>
                </div>
              )}

              {form.item_type === 'product' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Pack / Qty Value"
                    type="number"
                    value={form.quantity_value}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantity_value: event.target.value }))}
                    placeholder="e.g., 500"
                  />
                  <div>
                    <GeminiSelect
                      label="Pack / Qty Unit"
                      value={form.quantity_unit}
                      onChange={(value) => setForm((prev) => ({ ...prev, quantity_unit: value }))}
                      options={quantityUnitOptions}
                      variant="warm"
                    />
                  </div>
                  {form.quantity_unit === 'custom' ? (
                    <Input
                      label="Custom Unit"
                      value={form.quantity_unit_custom}
                      onChange={(event) => setForm((prev) => ({ ...prev, quantity_unit_custom: event.target.value }))}
                      placeholder="e.g., sheet, bottle, set"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-aa-gray">
                      Add pack details like g, kg, liter, meter, or custom.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-aa-text-dark mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-aa-text-dark outline-none focus:border-aa-orange focus:ring-2 focus:ring-aa-orange/20"
                  rows="3"
                  placeholder="Short summary for your team"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-aa-text-dark mb-2">WhatsApp Details Prompt</label>
                <textarea
                  value={form.details_prompt}
                  onChange={(event) => setForm((prev) => ({ ...prev, details_prompt: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-aa-text-dark outline-none focus:border-aa-orange focus:ring-2 focus:ring-aa-orange/20"
                  rows="4"
                  placeholder="What should the bot ask next?"
                />
                <p className="text-xs text-aa-gray mt-2">
                  This text is sent when a user selects this item on WhatsApp.
                </p>
              </div>

              <Input
                label="Keywords (comma separated)"
                value={form.keywords}
                onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))}
                placeholder="e.g., kundli, birth chart, horoscope"
              />
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-aa-text-dark">Publishing</p>
                <p className="text-xs text-aa-gray mt-1">
                  Turn visibility on or off here. Use the main list to pin top items and change order.
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-aa-text-dark">Active in catalog</p>
                    <p className="text-xs text-aa-gray">Turn off to hide this item everywhere.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-aa-text-dark">Show in WhatsApp menu</p>
                    <p className="text-xs text-aa-gray">
                      If off, customers will not see this item in WhatsApp. It stays in your catalog here.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="show_on_whatsapp"
                      type="checkbox"
                      checked={form.show_on_whatsapp}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          show_on_whatsapp: event.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                  </label>
                </div>

                {form.item_type === 'service' && (
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">Bookable</p>
                      <p className="text-xs text-aa-gray">Allow customers to pick slots.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="bookable"
                        type="checkbox"
                        checked={form.is_bookable}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            is_bookable: event.target.checked,
                            payment_required: event.target.checked ? prev.payment_required : false,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                    </label>
                  </div>
                )}

                {form.item_type === 'service' && (
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">Require payment</p>
                      <p className="text-xs text-aa-gray">
                        Paid services show only Full Pay and Partial Pay on WhatsApp.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="payment_required"
                        type="checkbox"
                        checked={form.is_bookable && form.payment_required}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            is_bookable: event.target.checked ? true : prev.is_bookable,
                            payment_required: event.target.checked,
                          }))
                        }
                        disabled={!form.is_bookable}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 rounded-full transition-all ${form.is_bookable ? 'bg-gray-200 peer-checked:bg-aa-orange' : 'bg-gray-100 opacity-60'} peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                    </label>
                  </div>
                )}

                {form.item_type === 'product' && (
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">Free delivery eligible</p>
                      <p className="text-xs text-aa-gray">
                        Count this product for the free delivery rule (set in Settings).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="free_delivery_eligible"
                        type="checkbox"
                        checked={form.free_delivery_eligible}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            free_delivery_eligible: event.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aa-orange"></div>
                    </label>
                  </div>
                )}

                {form.item_type === 'service' && (
                  <div className="mt-4">
                    <div>
                      <p className="text-sm font-semibold text-aa-text-dark">Service Time Type</p>
                      <p className="text-xs text-aa-gray">
                        Choose whether this service has fixed duration or no time limit.
                      </p>
                    </div>
                    <GeminiSelect
                      label="Service Time Type"
                      value={form.is_time_based ? 'time_based' : 'not_time_based'}
                      onChange={(value) =>
                        setForm((prev) => {
                          const isTimeBased = value === 'time_based';
                          return {
                            ...prev,
                            is_time_based: isTimeBased,
                            duration_value: isTimeBased ? prev.duration_value : '',
                          };
                        })
                      }
                      options={serviceTimeTypeOptions}
                      className="mt-2"
                      variant="vibrant"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-aa-text-dark">WhatsApp preview</p>
                <p className="text-xs text-aa-gray">A quick look at what customers see in WhatsApp.</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="break-words font-semibold text-aa-text-dark">
                      {form.name || 'Item name'}
                    </span>
                    <span className="text-aa-gray">{normalizePriceLabel(form.price_label) || 'Price label'}</span>
                  </div>
                  <p className="text-xs text-aa-gray">Category: {form.category || '—'}</p>
                  {form.item_type === 'service' && form.is_time_based && form.duration_value && (
                    <p className="text-xs text-aa-gray">
                      Duration: {form.duration_value} {form.duration_unit}
                    </p>
                  )}
                  {form.item_type === 'service' && (
                    <p className="text-xs text-aa-gray">
                      Service Time Type: {form.is_time_based ? 'Time-based (fixed duration)' : 'Not time-based (no time limit)'}
                    </p>
                  )}
                  {form.item_type === 'product' && form.quantity_value && (
                    <p className="text-xs text-aa-gray">
                      Pack: {form.quantity_value}{' '}
                      {form.quantity_unit === 'custom'
                        ? form.quantity_unit_custom || 'unit'
                        : form.quantity_unit}
                    </p>
                  )}
                  <p className="text-xs text-aa-gray">
                    Status: {form.is_active ? 'Active' : 'Hidden'}
                  </p>
                  <p className="text-xs text-aa-gray">
                    WhatsApp menu: {form.show_on_whatsapp ? 'Shown' : 'Hidden'}
                  </p>
                  <p className="text-xs text-aa-gray">
                    Pinned for first message: {parseNumber(form.whatsapp_sort_order, 0) > 0 ? 'Yes' : 'Set from main list'}
                  </p>
                  {form.item_type === 'service' && form.is_bookable && (
                    <p className="text-xs text-aa-gray">
                      Payment: {form.payment_required ? 'Full / partial payment required' : 'Free booking'}
                    </p>
                  )}
                  {form.item_type === 'product' && (
                    <p className="text-xs text-aa-gray">
                      Free delivery: {form.free_delivery_eligible ? 'Eligible' : 'Not included'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
            <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete item?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-aa-text-dark">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{deleteTarget?.name || 'this item'}</span>? This action
            cannot be undone.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={confirmDelete}
              disabled={saving}
            >
              {saving ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
