import { useLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { CurrencyCode } from '@/domain/money';
import i18n, {
  languageFromLocales,
  resolveLanguage,
  type AppLanguage,
  type LanguagePreference,
} from '@/i18n';
import { haptics } from '@/lib/haptics';

export type Preferences = {
  language: LanguagePreference;
  homeCurrency: CurrencyCode;
  hideAmounts: boolean;
  haptics: boolean;
};

export function defaultPreferences(deviceLanguage: AppLanguage): Preferences {
  return {
    language: 'system',
    homeCurrency: deviceLanguage === 'zh-Hans' ? 'CNY' : 'USD',
    hideAmounts: false,
    haptics: true,
  };
}

type PreferencesContextValue = {
  prefs: Preferences;
  /** The language actually in use after resolving "system". */
  language: AppLanguage;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const [prefs, setPrefs] = useState(() => defaultPreferences(languageFromLocales(locales)));
  const language = resolveLanguage(prefs.language, locales);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    haptics.setEnabled(prefs.haptics);
  }, [prefs.haptics]);

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
