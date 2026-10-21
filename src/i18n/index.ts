import 'intl-pluralrules';

import { getLocales, type Locale } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import zhHans from './locales/zh-Hans';

export const SUPPORTED_LANGUAGES = ['en', 'zh-Hans'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = AppLanguage | 'system';

/** Picks the first supported language from the device's preferred locales. */
export function languageFromLocales(locales: Pick<Locale, 'languageCode'>[]): AppLanguage {
  for (const locale of locales) {
    if (locale.languageCode === 'zh') return 'zh-Hans';
    if (locale.languageCode === 'en') return 'en';
  }
  return 'en';
}

export function resolveLanguage(
  preference: LanguagePreference,
  locales: Pick<Locale, 'languageCode'>[]
): AppLanguage {
  return preference === 'system' ? languageFromLocales(locales) : preference;
}

// i18next's documented setup; `use` is also a named export, which trips this rule.
// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
  },
  lng: languageFromLocales(getLocales()),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
