import api from './api';

export interface Appearance {
  menuBarColor: string;
  buttonColor: string;
  headingTextColor: string;
  bodyTextColor: string;
  paneColor: string;
  // Overall site page background — separate from paneColor (panel/card background).
  pageBackgroundColor: string;
  requirePasswordOnDelete: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  menuBarColor: '#000000',
  buttonColor: '#dc2626',
  headingTextColor: '#ffffff',
  bodyTextColor: '#6e6e73',
  paneColor: '#ffffff',
  pageBackgroundColor: '#ffffff',
  requirePasswordOnDelete: false,
};

// Applies the theme colors as CSS custom properties on the document root.
// tailwind.config.js reads these same variable names (with matching fallbacks)
// for the `accent-500`, `gray-900` and `gray-600` tokens, and the nav/sidebar
// backgrounds reference `--rxl-menubar-bg` directly — so this one call re-themes
// the whole app without touching individual components.
export function applyAppearance(a: Partial<Appearance>) {
  const root = document.documentElement;
  if (a.menuBarColor) root.style.setProperty('--rxl-menubar-bg', a.menuBarColor);
  if (a.buttonColor) root.style.setProperty('--rxl-button-bg', a.buttonColor);
  if (a.headingTextColor) root.style.setProperty('--rxl-text-heading', a.headingTextColor);
  if (a.bodyTextColor) root.style.setProperty('--rxl-text-body', a.bodyTextColor);
  if (a.paneColor) root.style.setProperty('--rxl-pane-bg', a.paneColor);
  if (a.pageBackgroundColor) root.style.setProperty('--rxl-page-bg', a.pageBackgroundColor);
}

export async function loadAndApplyAppearance(): Promise<Appearance> {
  try {
    const { data } = await api.get('/appearance');
    const merged = { ...DEFAULT_APPEARANCE, ...data };
    applyAppearance(merged);
    return merged;
  } catch {
    applyAppearance(DEFAULT_APPEARANCE);
    return DEFAULT_APPEARANCE;
  }
}
