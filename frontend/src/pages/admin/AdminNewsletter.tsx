import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Send, Code2, LayoutTemplate, Bold, Italic, Underline, List, ListOrdered, Link2, Image as ImageIcon, Heading1, Heading2, Pilcrow, Eraser, Newspaper, Sparkles } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import MailIcon from '../../components/icons/MailIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface Newsletter {
  id: string;
  subject: string;
  htmlContent: string;
  status: string;
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'build' | 'html';

// Starter template — gives the admin something reasonable to start editing instead of
// a blank white box.
const STARTER_HTML = `<div style="font-family:-apple-system,Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h1 style="color:#111827;">Your headline here</h1>
  <p style="color:#374151;line-height:1.6;">Write your news or promotion here. You can format this text, add links and images using the toolbar above, or switch to HTML view to paste your own markup.</p>
  <p style="color:#374151;line-height:1.6;">— RXL Logistics</p>
</div>`;

export default function AdminNewsletter() {
  const { confirmDelete } = useDeleteGuard();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState(STARTER_HTML);
  const [viewMode, setViewMode] = useState<ViewMode>('build');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);

  const [testModalFor, setTestModalFor] = useState<Newsletter | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState('');

  const [sendConfirmFor, setSendConfirmFor] = useState<Newsletter | null>(null);
  const [activeCustomerCount, setActiveCustomerCount] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = () => {
    setLoading(true);
    api.get('/newsletters')
      .then(r => setNewsletters(r.data))
      .catch(() => showToast('Failed to load newsletters'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Sync the contentEditable's DOM whenever we switch INTO build mode (or load a
  // different draft) — contentEditable is uncontrolled, so we imperatively set its
  // innerHTML rather than re-rendering it every keystroke (that would fight the
  // browser's caret position).
  useEffect(() => {
    if (viewMode === 'build' && editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      editorRef.current.innerHTML = htmlContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, editingId, panelOpen]);

  const syncFromEditor = () => {
    if (editorRef.current) setHtmlContent(editorRef.current.innerHTML);
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const handleInsertLink = () => {
    const url = window.prompt('Link URL (https://…)');
    if (url) exec('createLink', url);
  };

  const handleInsertImage = () => {
    const url = window.prompt('Image URL (https://…)');
    if (url) exec('insertImage', url);
  };

  const resetForm = () => {
    setSubject('');
    setHtmlContent(STARTER_HTML);
    setViewMode('build');
  };

  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setFormError('');
    setPanelOpen(true);
  };

  const openEdit = (n: Newsletter) => {
    setEditingId(n.id);
    setSubject(n.subject);
    setHtmlContent(n.htmlContent || STARTER_HTML);
    setViewMode('build');
    setFormError('');
    setPanelOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = { subject: subject.trim(), htmlContent };
      if (editingId) await api.put(`/newsletters/${editingId}`, payload);
      else await api.post('/newsletters', payload);
      showToast(editingId ? 'Draft updated' : 'Draft saved');
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save newsletter');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) { setAiError('Describe what the email should say'); return; }
    setAiGenerating(true);
    setAiError('');
    try {
      const { data } = await api.post('/newsletters/generate', { prompt: aiPrompt.trim() });
      setSubject(data.subject);
      setHtmlContent(data.html);
      // The build-mode editor is uncontrolled — push the new HTML into the DOM
      // directly so it shows up immediately even if we were already in build mode.
      if (editorRef.current) editorRef.current.innerHTML = data.html;
      setViewMode('build');
      setAiModalOpen(false);
      setAiPrompt('');
      showToast('AI draft generated — review before sending');
    } catch (err: any) {
      setAiError(err?.response?.data?.error || 'Failed to generate content');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDelete = async (n: Newsletter) => {
    if (!(await confirmDelete(`Permanently delete "${n.subject}"? This cannot be undone.`))) return;
    try {
      await api.delete(`/newsletters/${n.id}`);
      showToast('Newsletter deleted');
      load();
    } catch {
      showToast('Failed to delete newsletter');
    }
  };

  // "Send Test" from the list acts on a saved newsletter directly; from inside the
  // compose panel (unsaved changes), save first so the test reflects what's on screen.
  const openTestFromPanel = async () => {
    if (!subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    try {
      const payload = { subject: subject.trim(), htmlContent };
      const { data } = editingId ? await api.put(`/newsletters/${editingId}`, payload) : await api.post('/newsletters', payload);
      if (!editingId) setEditingId(data.id);
      setTestModalFor(data);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save newsletter');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalFor?.id) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) { setTestError('Enter a valid email address'); return; }
    setTestSending(true);
    setTestError('');
    try {
      const { data } = await api.post(`/newsletters/${testModalFor.id}/send-test`, { to: testEmail.trim() });
      showToast(data.simulated ? `Test logged for ${testEmail.trim()} (SMTP not configured)` : `Test sent to ${testEmail.trim()}`);
      setTestModalFor(null);
      setTestEmail('');
    } catch (err: any) {
      setTestError(err?.response?.data?.error || 'Failed to send test');
    } finally {
      setTestSending(false);
    }
  };

  const openSendConfirmFromPanel = async () => {
    if (!subject.trim()) { setFormError('Subject is required'); return; }
    setSaving(true);
    try {
      const payload = { subject: subject.trim(), htmlContent };
      const { data } = editingId ? await api.put(`/newsletters/${editingId}`, payload) : await api.post('/newsletters', payload);
      if (!editingId) setEditingId(data.id);
      openSendConfirm(data);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save newsletter');
    } finally {
      setSaving(false);
    }
  };

  const openSendConfirm = (n: Newsletter) => {
    setSendConfirmFor(n);
    setActiveCustomerCount(null);
    api.get('/customers', { params: { status: 'ACTIVE', limit: 1 } })
      .then(r => setActiveCustomerCount(r.data.total ?? 0))
      .catch(() => setActiveCustomerCount(null));
  };

  const handleConfirmSend = async () => {
    if (!sendConfirmFor?.id) return;
    setSending(true);
    try {
      const { data } = await api.post(`/newsletters/${sendConfirmFor.id}/send`);
      showToast(`Sent to ${data.totalRecipients} customer${data.totalRecipients === 1 ? '' : 's'}${data.simulatedCount ? ` (${data.simulatedCount} simulated — SMTP not configured)` : ''}`);
      setSendConfirmFor(null);
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to send newsletter');
    } finally {
      setSending(false);
    }
  };

  const toolbarBtn = 'w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors';

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Newsletter <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Newsletter</span></div>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-white/50 -mt-1">
          Compose a news or promotional email using the visual builder or raw HTML, preview it, then send a test copy to yourself before sending to all active customers.
        </p>

        <div className="panel-glass rounded-2xl">
          <button onClick={() => (panelOpen ? setPanelOpen(false) : openAdd())} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Newsletter <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Compose</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

              <button
                type="button"
                onClick={() => { setAiError(''); setAiModalOpen(true); }}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-300 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors text-sm font-semibold px-4 py-2 rounded-xl"
              >
                <Sparkles className="w-4 h-4" /> Generate with AI
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Subject *</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New route to Kingston + July promo" className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80">Content</label>
                  <div className="flex items-center bg-gray-100 dark:bg-white/[0.06] rounded-lg p-0.5">
                    <button type="button" onClick={() => setViewMode('build')} className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${viewMode === 'build' ? 'bg-brand-800 text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
                      <LayoutTemplate className="w-3.5 h-3.5" /> Build
                    </button>
                    <button type="button" onClick={() => { syncFromEditor(); setViewMode('html'); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${viewMode === 'html' ? 'bg-brand-800 text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'}`}>
                      <Code2 className="w-3.5 h-3.5" /> HTML
                    </button>
                  </div>
                </div>

                {viewMode === 'build' ? (
                  <div className="border rounded-xl overflow-hidden dark:border-white/10">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-gray-50 dark:bg-white/[0.04] dark:border-white/10 flex-wrap">
                      <button type="button" title="Bold" onClick={() => exec('bold')} className={toolbarBtn}><Bold className="w-4 h-4" /></button>
                      <button type="button" title="Italic" onClick={() => exec('italic')} className={toolbarBtn}><Italic className="w-4 h-4" /></button>
                      <button type="button" title="Underline" onClick={() => exec('underline')} className={toolbarBtn}><Underline className="w-4 h-4" /></button>
                      <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
                      <button type="button" title="Heading" onClick={() => exec('formatBlock', 'h1')} className={toolbarBtn}><Heading1 className="w-4 h-4" /></button>
                      <button type="button" title="Subheading" onClick={() => exec('formatBlock', 'h2')} className={toolbarBtn}><Heading2 className="w-4 h-4" /></button>
                      <button type="button" title="Paragraph" onClick={() => exec('formatBlock', 'p')} className={toolbarBtn}><Pilcrow className="w-4 h-4" /></button>
                      <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
                      <button type="button" title="Bullet list" onClick={() => exec('insertUnorderedList')} className={toolbarBtn}><List className="w-4 h-4" /></button>
                      <button type="button" title="Numbered list" onClick={() => exec('insertOrderedList')} className={toolbarBtn}><ListOrdered className="w-4 h-4" /></button>
                      <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
                      <button type="button" title="Insert link" onClick={handleInsertLink} className={toolbarBtn}><Link2 className="w-4 h-4" /></button>
                      <button type="button" title="Insert image" onClick={handleInsertImage} className={toolbarBtn}><ImageIcon className="w-4 h-4" /></button>
                      <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
                      <button type="button" title="Clear formatting" onClick={() => exec('removeFormat')} className={toolbarBtn}><Eraser className="w-4 h-4" /></button>
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncFromEditor}
                      onBlur={syncFromEditor}
                      className="min-h-[280px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm text-gray-800 dark:text-white/80 bg-white dark:bg-white/[0.02] focus:outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_a]:text-brand-600 [&_a]:underline [&_p]:my-2"
                    />
                  </div>
                ) : (
                  <textarea
                    value={htmlContent}
                    onChange={e => setHtmlContent(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    className="w-full border rounded-xl px-3 py-2.5 text-xs font-mono bg-white dark:bg-white/5 dark:border-white/10 dark:text-white resize-y"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-2">Preview</label>
                <iframe title="Newsletter preview" srcDoc={htmlContent} className="w-full h-72 border rounded-xl bg-white dark:border-white/10" />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => { setPanelOpen(false); resetForm(); }} className="flex items-center gap-1.5 border text-gray-600 dark:text-white/60 text-sm font-medium px-4 py-2 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button type="button" disabled={saving} onClick={openTestFromPanel} className="flex items-center gap-1.5 border border-brand-700 dark:border-brand-400 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
                  <MailIcon className="w-4 h-4" /> Send Test
                </button>
                <button type="button" disabled={saving} onClick={openSendConfirmFromPanel} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 ml-auto">
                  <Send className="w-4 h-4" /> Send to All Customers
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900 dark:text-white text-[15px]">Campaigns</h2>
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> New Newsletter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Recipients</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Sent / Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : newsletters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-gray-400 dark:text-white/40">
                      <Newspaper className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-white/20" />
                      No newsletters yet.
                    </td>
                  </tr>
                ) : newsletters.map(n => (
                  <tr key={n.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button title="Edit" onClick={() => openEdit(n)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        <button title="Send Test" onClick={() => setTestModalFor(n)} className="w-8 h-8 rounded-lg text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/25 flex items-center justify-center transition-colors"><MailIcon className="w-3.5 h-3.5" /></button>
                        <button title="Send to All Customers" onClick={() => openSendConfirm(n)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><Send className="w-3.5 h-3.5" /></button>
                        <button title="Delete" onClick={() => handleDelete(n)} className="w-8 h-8 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs truncate">{n.subject}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${n.status === 'SENT' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'}`}>
                        {n.status === 'SENT' ? 'Sent' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-white/60">{n.status === 'SENT' ? n.recipientCount : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-white/60">
                      {new Date(n.sentAt || n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-300" /> Generate with AI</h3>
              <button onClick={() => setAiModalOpen(false)} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">Describe what the email should say — this replaces the current subject and content.</p>
            <form onSubmit={handleGenerateAi}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Topic / instructions</label>
              <textarea
                autoFocus
                value={aiPrompt}
                onChange={e => { setAiPrompt(e.target.value); setAiError(''); }}
                rows={4}
                placeholder="e.g. Announce our new Kingston express route, 3-5 day delivery, and a 15% off first shipment promo through end of month."
                className="w-full border rounded-lg px-3 py-2 text-sm mb-1 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white resize-none"
              />
              {aiError && <p className="text-xs text-red-600 mb-2">{aiError}</p>}
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setAiModalOpen(false)} className="flex-1 border rounded-xl py-2 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
                <button type="submit" disabled={aiGenerating} className="flex-1 flex items-center justify-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 transition-colors">
                  {aiGenerating ? 'Generating…' : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {testModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 w-full max-w-sm shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white">Send Test Email</h3>
              <button onClick={() => setTestModalFor(null)} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">Send yourself a preview copy before emailing all customers.</p>
            <form onSubmit={handleSendTest}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Email address</label>
              <input
                type="email"
                autoFocus
                value={testEmail}
                onChange={e => { setTestEmail(e.target.value); setTestError(''); }}
                placeholder="name@example.com"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-1 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
              {testError && <p className="text-xs text-red-600 mb-2">{testError}</p>}
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setTestModalFor(null)} className="flex-1 border rounded-xl py-2 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
                <button type="submit" disabled={testSending} className="flex-1 bg-brand-800 hover:bg-brand-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 transition-colors">
                  {testSending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sendConfirmFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 w-full max-w-sm shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 dark:text-white">Send to All Customers</h3>
              <button onClick={() => setSendConfirmFor(null)} className="text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">
              This will immediately email every active customer{activeCustomerCount !== null ? ` — ${activeCustomerCount} recipient${activeCustomerCount === 1 ? '' : 's'}` : ''}. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSendConfirmFor(null)} className="flex-1 border rounded-xl py-2 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
              <button type="button" onClick={handleConfirmSend} disabled={sending} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50 transition-colors">
                {sending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
