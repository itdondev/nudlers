import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/client-logger';

type Language = 'he' | 'en' | 'ru';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
  getTranslatedName: (transaction: any) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('he');
  const [isLoading, setIsLoading] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const response = await fetch('/api/translations/language');
        if (response.ok) {
          const data = await response.json();
          setLanguageState(data.language || 'he');
        }
      } catch (error) {
        logger.error({ error }, 'Failed to load language preference');
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  // Update language preference
  const setLanguage = async (lang: Language) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/translations/language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: lang }),
      });

      if (!response.ok) {
        throw new Error('Failed to update language preference');
      }

      setLanguageState(lang);
      logger.info({ language: lang }, 'Language preference updated');
    } catch (error) {
      logger.error({ error, language: lang }, 'Failed to set language');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get translated name for a transaction based on current language
   */
  const getTranslatedName = (transaction: any): string => {
    if (!transaction) return '';

    switch (language) {
      case 'en':
        return transaction.name_en || transaction.name_original || transaction.name || '';
      case 'ru':
        return transaction.name_ru || transaction.name_original || transaction.name || '';
      case 'he':
      default:
        return transaction.name_original || transaction.name || '';
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading, getTranslatedName }}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access language context
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

/**
 * Helper function to get language display name
 */
export const getLanguageName = (lang: Language): string => {
  switch (lang) {
    case 'he':
      return 'עברית';
    case 'en':
      return 'English';
    case 'ru':
      return 'Русский';
    default:
      return 'עברית';
  }
};

/**
 * Helper function to get language flag emoji
 */
export const getLanguageFlag = (lang: Language): string => {
  switch (lang) {
    case 'he':
      return '🇮🇱';
    case 'en':
      return '🇬🇧';
    case 'ru':
      return '🇷🇺';
    default:
      return '🇮🇱';
  }
};
