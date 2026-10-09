import { useState, useEffect } from 'react';
import { Palette, RotateCcw, Sun, Moon, ShieldCheck, ChevronDown, Layers, Check, X, Save } from 'lucide-react';
import api from '../../lib/api';
import { applyAppearance, DEFAULT_APPEARANCE, Appearance } from '../../lib/appearance';
import { useTheme } from '../../context/ThemeContext';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

type ColorKey = Exclude<keyof Appearance, 'requirePasswordOnDelete'>;
const COLOR_FIELDS: [ColorKey, string, string][] = [
  ['menuBarColor', 'Menu Bar', 'Background of the admin top menu bar and the public site navigation bar.'],
  ['buttonColor', 'Buttons', 'Primary call-to-action button color across the site (e.g. "Track Now", "Get a Free Quote").'],
  ['paneColor', 'Panes', 'Tint applied to panels, cards, and glass panes across the admin and customer site.'],
  ['pageBackgroundColor', 'Page Background', 'Overall site background color, behind every panel and card.'],
  ['headingTextColor', 'Heading Text', 'Color used for page titles and bold headings.'],
  ['bodyTextColor', 'Body Text', 'Color used for paragraph and secondary text.'],
];

// Full web design themes — one click sets every color field at once (menu bar,
// buttons, headings, body text, panel tint, and page background), for a complete
// site-wide look change rather than tweaking one color at a time. These built-ins
// are auto-seeded into the SavedTheme table the first time this page loads (see
// ensureBuiltInThemes below); after that they're just regular saved themes an
// admin can also delete or add to via "Save current as new theme".
type ThemeColors = Omit<Appearance, 'requirePasswordOnDelete'>;
interface SavedThemeRow extends ThemeColors { id: string; name: string }

const BUILT_IN_THEMES: { name: string; colors: ThemeColors }[] = [
  // The site's original/current look, saved under its own name per request.
  { name: 'RXL Cleanimal', colors: { menuBarColor: '#000000', buttonColor: '#dc2626', headingTextColor: '#1d1d1f', bodyTextColor: '#6e6e73', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  { name: 'Ocean', colors: { menuBarColor: '#0a2540', buttonColor: '#0071e3', headingTextColor: '#0a2540', bodyTextColor: '#4b5f7a', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  { name: 'Royal', colors: { menuBarColor: '#1e1b4b', buttonColor: '#7c3aed', headingTextColor: '#1e1b4b', bodyTextColor: '#5b5b70', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  { name: 'Emerald', colors: { menuBarColor: '#022c22', buttonColor: '#059669', headingTextColor: '#022c22', bodyTextColor: '#4b5f57', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  { name: 'Sunset', colors: { menuBarColor: '#1c1917', buttonColor: '#ea580c', headingTextColor: '#1c1917', bodyTextColor: '#6b6560', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  { name: 'Monochrome', colors: { menuBarColor: '#000000', buttonColor: '#111827', headingTextColor: '#111827', bodyTextColor: '#6b7280', paneColor: '#ffffff', pageBackgroundColor: '#ffffff' } },
  // Warm cream/gold/black palette, based on the reference logistics site screenshot.
  { name: 'Motion Hub Gold', colors: { menuBarColor: '#faf6ef', buttonColor: '#a9812f', headingTextColor: '#1a1a1a', bodyTextColor: '#6b6355', paneColor: '#ffffff', pageBackgroundColor: '#f3ecdf' } },
];

export default function AdminAppearance() {
  const { theme, setTheme } = useTheme();
  const { setRequirePasswordOnDelete, confirmDelete } = useDeleteGuard();
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [togglingSecurity, setTogglingSecurity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingTheme, setApplyingTheme] = useState<string | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [savedThemes, setSavedThemes] = useState<SavedThemeRow[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [newThemeName, setNewThemeName] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    api.get('/appearance')
      .then(r => setAppearance({ ...DEFAULT_APPEARANCE, ...r.data }))
      .catch(() => showToast('Failed to load appearance settings'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-seeds the built-in theme library into the SavedTheme table the first
  // time anyone opens this page after this feature shipped — after that it's a
  // no-op (each built-in is only created once, matched by name).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<SavedThemeRow[]>('/saved-themes');
        const existingNames = new Set(data.map(t => t.name));
        const missing = BUILT_IN_THEMES.filter(t => !existingNames.has(t.name));
        if (missing.length > 0) {
          await Promise.all(missing.map(t => api.post('/saved-themes', { name: t.name, ...t.colors }).catch(() => {})));
          const refreshed = await api.get<SavedThemeRow[]>('/saved-themes');
          setSavedThemes(refreshed.data);
        } else {
          setSavedThemes(data);
        }
      } catch {
        // Saved-themes API unavailable — the picker just won't have anything to show.
      } finally {
        setThemesLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/appearance', appearance);
      setAppearance({ ...DEFAULT_APPEARANCE, ...data });
      applyAppearance(data);
      showToast('Appearance saved');
    } catch {
      showToast('Failed to save appearance');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAppearance(DEFAULT_APPEARANCE);
    applyAppearance(DEFAULT_APPEARANCE);
  };

  const handleApplyTheme = async (name: string, colors: ThemeColors) => {
    const updated = { ...appearance, ...colors };
    setAppearance(updated);
    applyAppearance(updated);
    setApplyingTheme(name);
    try {
      const { data } = await api.put('/appearance', updated);
      setAppearance(a => ({ ...a, ...data }));
      applyAppearance(data);
      showToast(`${name} theme applied`);
    } catch {
      showToast('Failed to save theme');
    } finally {
      setApplyingTheme(null);
    }
  };

  const isActiveTheme = (colors: ThemeColors) =>
    (Object.keys(colors) as (keyof ThemeColors)[]).every(k => appearance[k]?.toLowerCase() === colors[k].toLowerCase());

  const handleSaveCurrentAsTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newThemeName.trim();
    if (!name) return;
    setSavingTheme(true);
    try {
      const { menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor, pageBackgroundColor } = appearance;
      const { data } = await api.post('/saved-themes', { name, menuBarColor, buttonColor, headingTextColor, bodyTextColor, paneColor, pageBackgroundColor });
      setSavedThemes(list => [...list, data]);
      setNewThemeName('');
      showToast(`Saved current design as "${name}"`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save theme');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleDeleteTheme = async (t: SavedThemeRow) => {
    if (!(await confirmDelete(`Remove theme "${t.name}"?`))) return;
    try {
      await api.delete(`/saved-themes/${t.id}`);
      setSavedThemes(list => list.filter(x => x.id !== t.id));
    } catch {
      showToast('Failed to remove theme');
    }
  };

  const handleToggleRequirePassword = async (checked: boolean) => {
    const updated = { ...appearance, requirePasswordOnDelete: checked };
    setAppearance(updated);
    setTogglingSecurity(true);
    try {
      const { data } = await api.put('/appearance', updated);
      setAppearance(a => ({ ...a, ...data }));
      setRequirePasswordOnDelete(!!data.requirePasswordOnDelete);
      showToast(checked ? 'Password now required to delete records' : 'Password no longer required to delete records');
    } catch {
      setAppearance(a => ({ ...a, requirePasswordOnDelete: !checked }));
      showToast('Failed to update setting');
    } finally {
      setTogglingSecurity(false);
    }
  };

  return (
    <div className="min-h-full bg-white dark:bg-[#0c0d12]">
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white dark:bg-transparent border-b border-gray-100 dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Appearance
          <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Theme &amp; Colors</span>
        </h1>
        <div className="text-sm text-gray-400 dark:text-white/40">
          Dashboard <span className="mx-1">/</span>
          <span className="text-gray-600 dark:text-white/70"> Appearance</span>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-2xl">
        {/* Dark / Light mode switch */}
        <div className="glass-ios p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Mode</h2>
          <p className="text-sm text-gray-500 dark:text-white/50 mb-4">Switch between light and dark mode for the whole site. In light mode, backgrounds go white with dark text; in dark mode, panels stay frosted glass on black.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${theme === 'light' ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-white/10 dark:border-white/20 dark:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5'}`}
            >
              <Sun className="w-5 h-5" /> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${theme === 'dark' ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-white/10 dark:border-white/20 dark:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5'}`}
            >
              <Moon className="w-5 h-5" /> Dark
            </button>
          </div>
        </div>

        {/* Web design theme */}
        <div className="glass-ios p-5">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-gray-400 dark:text-white/40" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Web Design Theme</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-white/50 mb-4">Switch the whole site's complete look — menu bar, buttons, headings, body text, panels, and page background — in one click. Saved instantly.</p>

          {themesLoading ? (
            <div className="text-center py-10 text-gray-400 dark:text-white/40 text-sm">Loading themes…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {savedThemes.map(t => {
                const active = isActiveTheme(t);
                return (
                  <div key={t.id} className={`relative group rounded-xl border transition-colors ${active ? 'border-brand-500 bg-brand-50 dark:bg-white/10 dark:border-brand-400' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <button
                      type="button"
                      disabled={applyingTheme !== null}
                      onClick={() => handleApplyTheme(t.name, t)}
                      className="w-full flex flex-col items-start gap-2.5 p-3.5 text-left disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: t.pageBackgroundColor }} />
                        <span className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: t.menuBarColor }} />
                        <span className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: t.buttonColor }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white pr-4">{t.name}</span>
                      {active && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 absolute top-3 right-3" />}
                    </button>
                    {!active && (
                      <button type="button" title="Delete theme" onClick={() => handleDeleteTheme(t)} className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg text-gray-300 dark:text-white/30 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleSaveCurrentAsTheme} className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
            <input value={newThemeName} onChange={e => setNewThemeName(e.target.value)} placeholder="Save current design as…" className="flex-1 border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm" />
            <button type="submit" disabled={savingTheme || !newThemeName.trim()} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 flex-shrink-0">
              <Save className="w-3.5 h-3.5" /> {savingTheme ? 'Saving…' : 'Save as new theme'}
            </button>
          </form>
        </div>

        {/* Color customization — minimized by default; expand to fine-tune individual colors. */}
        <div className="glass-ios">
          <button type="button" onClick={() => setColorsOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-5 py-2 border-b border-gray-100 dark:border-white/10">
            <span className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400 dark:text-white/40" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Custom Colors</h2>
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-white/40 transition-transform ${colorsOpen ? 'rotate-180' : ''}`} />
          </button>
          {!colorsOpen ? null : loading ? (
            <div className="text-center py-16 text-gray-400 dark:text-white/40 text-sm">Loading…</div>
          ) : (
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <p className="text-sm text-gray-500 dark:text-white/50 -mt-1">
                Controls the colors used across both the customer site and this admin panel. Changes apply immediately for everyone.
              </p>

              {COLOR_FIELDS.map(([key, label, desc]) => (
                <div key={key} className="flex items-start gap-4 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <label className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={appearance[key]}
                      onChange={e => setAppearance(a => ({ ...a, [key]: e.target.value }))}
                      className="w-12 h-12 rounded-lg border border-gray-200 dark:border-white/10 cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
                      <input
                        value={appearance[key]}
                        onChange={e => setAppearance(a => ({ ...a, [key]: e.target.value }))}
                        className="w-24 border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white rounded-lg px-2 py-2 text-xs font-mono text-right"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <button type="submit" disabled={saving} className="bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save appearance'}
                </button>
                <button type="button" onClick={handleReset} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security */}
        <div className="glass-ios p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-gray-400 dark:text-white/40" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Security</h2>
          </div>
          <label className="flex items-start gap-3 pt-3">
            <input
              type="checkbox"
              checked={appearance.requirePasswordOnDelete}
              disabled={togglingSecurity}
              onChange={e => handleToggleRequirePassword(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">Require password to delete records</span>
              <span className="block text-xs text-gray-500 dark:text-white/40 leading-relaxed mt-0.5">
                When on, admins must re-enter their account password before deleting any record across the site (customers, batches, shipments, bulletins, presets, staff roles, and more). Saved instantly.
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
