const CURRENCY_STORAGE_KEY = 'kc_currency';

export const APPLICATION_EXCHANGE_RATE = 4050;

export const normalizeCurrency = (currency) => (currency === 'USD' ? 'USD' : 'KHR');

export const getPreferredCurrency = () => normalizeCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY));

export const setPreferredCurrency = (currency) => {
  localStorage.setItem(CURRENCY_STORAGE_KEY, normalizeCurrency(currency));
};

export const getDisplayExchangeRate = (exchangeRate) => {
  const rate = Number(exchangeRate);
  return Number.isFinite(rate) && rate > 0 ? rate : APPLICATION_EXCHANGE_RATE;
};

export const formatKHR = (value) => `${Math.round(Number(value || 0)).toLocaleString('en-US')}៛`;

export const formatUSD = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const khrToUsd = (value, exchangeRate = APPLICATION_EXCHANGE_RATE) => Number(value || 0) / getDisplayExchangeRate(exchangeRate);

export const usdToKhr = (value, exchangeRate = APPLICATION_EXCHANGE_RATE) => Number(value || 0) * getDisplayExchangeRate(exchangeRate);

export const formatCurrencyValue = (value, currency) =>
  normalizeCurrency(currency) === 'USD' ? formatUSD(value) : formatKHR(value);

export const calculateEquivalentTotals = ({ khr = 0, usd = 0, exchangeRate } = {}) => {
  const rate = getDisplayExchangeRate(exchangeRate);
  const originalKHR = Number(khr || 0);
  const originalUSD = Number(usd || 0);
  const totalKHR = originalKHR + usdToKhr(originalUSD, rate);
  const totalUSD = originalUSD + khrToUsd(originalKHR, rate);

  return {
    rate,
    totalKHR,
    totalUSD,
    originalKHR,
    originalUSD,
    hasMixedCurrencies: originalKHR > 0 && originalUSD > 0,
  };
};

export const formatCurrencyTotals = ({ khr = 0, usd = 0, exchangeRate } = {}) => {
  const totals = calculateEquivalentTotals({ khr, usd, exchangeRate });
  return {
    ...totals,
    usdLabel: formatUSD(totals.totalUSD),
    khrLabel: formatKHR(totals.totalKHR),
  };
};

export const formatCurrencyPair = ({ khr = 0, usd = 0, preferredCurrency = getPreferredCurrency(), exchangeRate } = {}) => {
  const totals = formatCurrencyTotals({ khr, usd, exchangeRate });
  const primaryCurrency = normalizeCurrency(preferredCurrency);
  const secondaryCurrency = primaryCurrency === 'USD' ? 'KHR' : 'USD';

  return {
    primary: primaryCurrency === 'USD' ? totals.usdLabel : totals.khrLabel,
    equivalent: secondaryCurrency === 'USD' ? totals.usdLabel : totals.khrLabel,
    primaryCurrency,
    secondaryCurrency,
    hasExchangeRate: true,
    hasMixedCurrencies: totals.hasMixedCurrencies,
    combinedKHR: totals.totalKHR,
    combinedUSD: totals.totalUSD,
    rate: totals.rate,
  };
};