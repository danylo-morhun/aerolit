import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ThemeName = 'light' | 'dark';

/** Shared with the pre-paint script in index.html — keep both in sync. */
export const THEME_STORAGE_KEY = 'aerolit:theme';

const DARK_CLASS = 'dark';
const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)');

function readStoredTheme(): ThemeName | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private mode or storage disabled: behave as if nothing was ever stored.
    return null;
  }
}

/**
 * The active theme.
 *
 * `index.html` resolves and applies the theme before first paint (so a dark
 * reload never flashes light), which makes the `.dark` class on <html> the
 * authoritative starting value — the store reads it rather than recomputing it
 * and risking a mismatch. From then on the store owns the class.
 *
 * An explicit choice wins permanently; with no stored choice the app keeps
 * following the OS, including changes made while it is open.
 */
export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeName>(
    document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light',
  );
  const isExplicit = ref(readStoredTheme() !== null);

  const isDark = computed(() => current.value === 'dark');

  function apply(theme: ThemeName): void {
    current.value = theme;
    document.documentElement.classList.toggle(DARK_CLASS, theme === 'dark');
  }

  function set(theme: ThemeName): void {
    apply(theme);
    isExplicit.value = true;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Preference simply won't survive the reload; the UI still works.
    }
  }

  function toggle(): void {
    set(isDark.value ? 'light' : 'dark');
  }

  /** Called once from the app root; returns a teardown for tests. */
  function followSystem(): () => void {
    const media = prefersDark();
    const onChange = (event: MediaQueryListEvent) => {
      if (!isExplicit.value) apply(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }

  return { current, isDark, isExplicit, set, toggle, followSystem };
});
