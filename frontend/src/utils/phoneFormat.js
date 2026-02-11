/**
 * Formats a phone number as (xxx) xxx-xxxx.
 * Strips non-digits and limits to 10 digits.
 * @param {string} value - Raw input (digits, formatted, or mixed)
 * @returns {string} Formatted phone string
 */
export function formatPhoneInput(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
