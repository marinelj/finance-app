import { useLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { readSetting, writeSetting } from '@/db/settings';
import { isCurrencyCode, type CurrencyCode } from '@/domain/money';
import { DEFAULT_REMINDER_OFFSETS } from '@/domain/reminders';
import i18n, {
  languageFromLocales,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
  type LanguagePreference,
} from '@/i18n';
import { haptics } from '@/lib/haptics';

export type ReminderPreferences = {
  enabled: boolean;
  /** Days before each due date to remind, e.g. [3, 1]; 0 is the due date itself. */
  daysBefore: number[];
  /** Local hour (0–23) the reminders fire at. */
  hour: number;
};

export type Preferences = {
  language: LanguagePreference;
  homeCurrency: CurrencyCode;
  hideAmounts: boolean;
  haptics: boolean;
  reminders: ReminderPreferences;
};

export const REMINDER_DAY_CHOICES = [0, 1, 2, 3, 5, 7];
export const DEFAULT_REMINDER_HOUR = 9;

export function defaultPreferences(deviceLanguage: AppLanguage): Preferences {
  return {
    language: 'system',
    homeCurrency: deviceLanguage === 'zh-Hans' ? 'CNY' : 'USD',
    hideAmounts: false,
    haptics: true,
    reminders: {
      enabled: true,
      daysBefore: DEFAULT_REMINDER_OFFSETS,
      hour: DEFAULT_REMINDER_HOUR,
    },
  };
}

const STORAGE_KEY = 'preferences';

/** Stored preferences over the defaults, ignoring anything a newer or older build left behind. */
export function mergePreferences(defaults: Preferences, stored: unknown): Preferences {
  if (!stored || typeof stored !== 'object') return defaults;
  const s = stored as Partial<Record<keyof Preferences, unknown>>;
  const r = (s.reminders && typeof s.reminders === 'object' ? s.reminders : {}) as Partial<
    Record<keyof ReminderPreferences, unknown>
  >;
  const language =
    s.language === 'system' || SUPPORTED_LANGUAGES.includes(s.language as AppLanguage)
      ? (s.language as LanguagePreference)
      : defaults.language;
  const days = Array.isArray(r.daysBefore)
    ? r.daysBefore.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 30)
    : defaults.reminders.daysBefore;
  return {
    language,
    homeCurrency:
      typeof s.homeCurrency === 'string' && isCurrencyCode(s.homeCurrency)
        ? s.homeCurrency
        : defaults.homeCurrency,
    hideAmounts: typeof s.hideAmounts === 'boolean' ? s.hideAmounts : defaults.hideAmounts,
    haptics: typeof s.haptics === 'boolean' ? s.haptics : defaults.haptics,
    reminders: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : defaults.reminders.enabled,
      daysBefore: days,
      hour:
        Number.isInteger(r.hour) && (r.hour as number) >= 0 && (r.hour as number) <= 23
          ? (r.hour as number)
          : defaults.reminders.hour,
    },
  };
}

type PreferencesContextValue = {
  prefs: Preferences;
  /** The language actually in use after resolving "system". */
  language: AppLanguage;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/** App preferences, saved in the local database. Must render inside `DatabaseGate`. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const [prefs, setPrefs] = useState(() =>
    mergePreferences(defaultPreferences(languageFromLocales(locales)), readSetting(STORAGE_KEY))
  );
  const language = resolveLanguage(prefs.language, locales);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    haptics.setEnabled(prefs.haptics);
  }, [prefs.haptics]);

  useEffect(() => {
    writeSetting(STORAGE_KEY, prefs);
  }, [prefs]);

  const setPreference: PreferencesContextValue['setPreference'] = (key, value) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  };

  return (
    <PreferencesContext.Provider value={{ prefs, language, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}
