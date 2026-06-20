import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextValue {
  theme: 'dark';
  actualTheme: 'dark';
  setTheme: () => void;
  toggleTheme: () => void;
  isDark: true;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', '#000000');
    }
  }, []);

  const value: ThemeContextValue = {
    theme: 'dark',
    actualTheme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
    isDark: true,
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
