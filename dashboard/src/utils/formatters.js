/**
 * Format currency dynamically based on currency code (defaults to INR / ₹).
 */
export function formatCurrency(amount, currency = 'INR') {
  const curr = String(currency).toUpperCase().trim()
  
  const symbolMap = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
  }
  
  const symbol = symbolMap[curr] || (curr ? `${curr} ` : '₹')
  if (amount === undefined || amount === null || isNaN(amount)) return '-'
  const locale = curr === 'INR' ? 'en-IN' : 'en-US'
  
  return `${symbol}${Number(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format compact currency for charts and axis labels (e.g. ₹100, ₹1K, ₹10K, ₹100K, ₹1M or $10K).
 */
export function formatCompactCurrency(amount, currency = 'INR') {
  const curr = String(currency).toUpperCase().trim()
  const symbolMap = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
  }
  const symbol = symbolMap[curr] || (curr ? `${curr} ` : '₹')
  const num = Number(amount)
  if (isNaN(num)) return '-'
  if (num === 0) return `${symbol}0`

  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  if (abs >= 10000000) {
    const v = abs / 10000000
    return `${sign}${symbol}${v >= 10 || v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} Cr`
  }
  if (abs >= 100000) {
    const v = abs / 100000
    return `${sign}${symbol}${v >= 10 || v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} L`
  }
  if (abs >= 1000) {
    const v = abs / 1000
    return `${sign}${symbol}${v >= 10 || v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`
  }
  return `${sign}${symbol}${Math.round(abs).toLocaleString('en-IN')}`
}
