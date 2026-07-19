import { create } from 'zustand';

export type Theme = 'dark';

interface ThemeState {
  theme: Theme;
}

export const useThemeStore = create<ThemeState>()(() => ({
  theme: 'dark',
}));

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}
