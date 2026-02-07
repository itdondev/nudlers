import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { AppThemeProvider } from '../context/ThemeContext';
import { StatusProvider } from '../context/StatusContext';
import { LanguageProvider } from '../context/LanguageContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppThemeProvider>
      <StatusProvider>
        <LanguageProvider>
          <Component {...pageProps} />
        </LanguageProvider>
      </StatusProvider>
    </AppThemeProvider>
  );
}

export default MyApp;
