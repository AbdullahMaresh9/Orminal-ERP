// Formatting utilities — clean Latin digits with Arabic currency suffix
// Numbers always render with Latin digits (1,234.50) for table readability;
// currency uses compact "ر.س" suffix. Locale-aware date formatting.

const CURRENCY_SUFFIX_AR = 'ر.س'
const CURRENCY_SUFFIX_EN = 'SAR'

export function formatCurrency(amount: number | null | undefined, currency: string = 'SAR'): string {
  const v = Number(amount ?? 0)
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
  return `${num} ${CURRENCY_SUFFIX_AR}`
}

export function formatCurrencyEn(amount: number | null | undefined, currency: string = 'SAR'): string {
  const v = Number(amount ?? 0)
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
  return `${CURRENCY_SUFFIX_EN} ${num}`
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

export function formatInt(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat('en-US').format(v)
}

export function formatPercent(n: number | null | undefined, decimals = 1): string {
  const v = Number(n ?? 0)
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

export function formatDate(date: Date | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  if (locale === 'ar') {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export function formatDateTime(date: Date | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const dateStr = formatDate(d, locale)
  const timeStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${dateStr} ${timeStr}`
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'الآن'
  const min = Math.floor(sec / 60)
  if (min < 60) return `قبل ${min} دقيقة`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `قبل ${hr} ساعة`
  const day = Math.floor(hr / 24)
  if (day < 30) return `قبل ${day} يوم`
  return formatDate(d)
}

export function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
