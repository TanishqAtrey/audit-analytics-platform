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
