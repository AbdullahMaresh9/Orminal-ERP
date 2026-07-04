'use client'

import { useI18n } from '@/stores/i18n-store'
import { translate, type DictKey } from '@/lib/i18n/dictionary'

export function useT() {
  const locale = useI18n((s) => s.locale)
  return {
    locale,
    t: (key: DictKey | string) => translate(key, locale),
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    isRTL: locale === 'ar',
  }
}
