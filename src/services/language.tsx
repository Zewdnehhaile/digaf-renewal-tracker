import React, { createContext, useContext, useState } from 'react';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { en } from '../locales/en';
import { am } from '../locales/am';
import { om } from '../locales/om';

export type LanguageCode = 'en' | 'am' | 'om';

export interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  am,
  om,
};

// Configure i18next
const resources = {
  en: { translation: en },
  am: { translation: am },
  om: { translation: om },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('digaf_applied_language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t: i18nT, i18n: i18nInstance } = useTranslation();
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    return (localStorage.getItem('digaf_applied_language') as LanguageCode) || 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    localStorage.setItem('digaf_applied_language', lang);
    i18nInstance.changeLanguage(lang);
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const trimmed = key.trim();
    const res = i18nT(trimmed);
    if (res !== trimmed) {
      return res;
    }
    // Try original key
    const resOrig = i18nT(key);
    return resOrig;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
