import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextValue {
  theme: 'light';
  actualTheme: 'light';
  setTheme: () => void;
  isDark: false;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', '#faf8f2');
    }
  }, []);

  const value: ThemeContextValue = {
    theme: 'light',
    actualTheme: 'light',
    setTheme: () => {},
    isDark: false,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
