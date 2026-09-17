export const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const localeForLanguage = (language) => (language === 'km' ? 'km-KH' : 'en-US');

export const formatDisplayDate = (value, language = 'en') => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatDisplayDateRange = (startDate, endDate, language = 'en') => {
  if (!startDate || startDate === endDate) return formatDisplayDate(startDate, language);
  return `${formatDisplayDate(startDate, language)} - ${formatDisplayDate(endDate, language)}`;
};

export const weekdayLabels = (language = 'en') => {
  const formatter = new Intl.DateTimeFormat(localeForLanguage(language), { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2026, 1, index + 1)));
};

export const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const resolveSaleDate = (value) => {
  if (!value) return formatLocalDate(new Date());

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'today') return formatLocalDate(new Date());
  if (normalized === 'yesterday') return formatLocalDate(addDays(new Date(), -1));
  if (normalized === 'tomorrow') return formatLocalDate(addDays(new Date(), 1));

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);

  return formatLocalDate(new Date());
};

export const dateRangeForFilter = (filter, selectedDate = new Date()) => {
  const anchor = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
  const safeAnchor = Number.isNaN(anchor.getTime()) ? new Date() : anchor;

  if (filter === 'week') {
    const mondayOffset = (safeAnchor.getDay() + 6) % 7;
    const start = addDays(safeAnchor, -mondayOffset);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(addDays(start, 6)) };
  }

  if (filter === 'month') {
    const start = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth(), 1);
    const end = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth() + 1, 0);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
  }

  const date = formatLocalDate(safeAnchor);
  return { startDate: date, endDate: date };
};

export const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export const resolveCurrency = (item) =>
  item.currency || (item.unitPriceKHR !== undefined || item.totalKHR !== undefined || item.total_khr !== undefined ? 'KHR' : 'USD');

export const resolveRawPrice = (item) =>
  Number(firstDefined(item.unit_price, item.unitPrice, item.unitPriceKHR, item.unitPriceUSD, item.price, 0));

export const resolveUnitPrice = (item) => {
  const quantity = Number(item.quantity || 0);
  const rawPrice = resolveRawPrice(item);
  const priceBasis = item.price_basis || item.priceBasis;

  if (priceBasis === 'total' && quantity > 0) {
    return rawPrice / quantity;
  }

  return rawPrice;
};

export const normalizeReviewItem = (item, index = 0) => {
  const description = String(firstDefined(item.description, item.product, item.item, '')).trim();
  const quantity = Number(item.quantity || 1);
  const unitPrice = resolveUnitPrice(item);

  return {
    ...item,
    id: item.id || item.sale_item_id || `${description || 'item'}-${index}`,
    product: description,
    description,
    quantity,
    currency: resolveCurrency(item),
    unit_price: unitPrice,
    price_basis: 'unit',
  };
};

export const saleToPayload = (saleDate, items) => ({
  sale_date: resolveSaleDate(saleDate),
  items: items.map((item) => ({
    description: String(firstDefined(item.description, item.product, item.item, '')).trim(),
    quantity: Number(item.quantity),
    unit_price: resolveUnitPrice(item),
    currency: resolveCurrency(item),
  })),
});

export const normalizeSaleFromApi = (sale) => ({
  id: sale.sale_id,
  saleId: sale.sale_id,
  date: sale.sale_date,
  totalKHR: Number(sale.total_khr || 0),
  totalUSD: Number(sale.total_usd || 0),
  items: (sale.items || []).map((item) => ({
    id: item.sale_item_id,
    sale_item_id: item.sale_item_id,
    product: item.description,
    description: item.description,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    currency: item.currency,
    amount: Number(item.amount || 0),
    price_basis: 'unit',
  })),
});

// Merges line items that are the same product into one entry (summed quantity),
// so a sale rung up as two separate lines still reads as one product.
export const mergeSaleItemsByProduct = (sale) => {
  const items = sale.items || [];
  const merged = new Map();
  items.forEach((item) => {
    const name = item.description || item.product || 'Item';
    merged.set(name, (merged.get(name) || 0) + Number(item.quantity || 0));
  });
  return Array.from(merged.entries()).map(([name, quantity]) => ({ name, quantity }));
};

export const summarizeSaleTitle = (sale) => {
  const merged = mergeSaleItemsByProduct(sale);
  if (!merged.length) return 'General Sale';
  return merged.map(({ name, quantity }) => `${name} x${quantity}`).join(', ');
};

export const aggregateProductSummary = (sales) => {
  const products = new Map();

  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const name = item.description || item.product;
      const currency = item.currency || 'KHR';
      const key = `${name}-${currency}`;
      const current = products.get(key) || {
        id: key,
        product: name,
        currency,
        quantity: 0,
        unitPriceKHR: 0,
        unitPriceUSD: 0,
        totalKHR: 0,
        totalUSD: 0,
      };
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || item.unitPrice || 0);
      const amount = Number(item.amount || quantity * unitPrice);

      current.quantity += quantity;
      if (currency === 'KHR') {
        current.unitPriceKHR = unitPrice;
        current.totalKHR += amount;
      } else {
        current.unitPriceUSD = unitPrice;
        current.totalUSD += amount;
      }
      products.set(key, current);
    });
  });

  return Array.from(products.values());
};