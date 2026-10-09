import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, X, Check, Package } from 'lucide-react';
import DeleteIcon from '../../components/icons/DeleteIcon';
import PencilIcon from '../../components/icons/PencilIcon';
import BlockIcon from '../../components/icons/BlockIcon';
import api from '../../lib/api';
import { useDeleteGuard } from '../../context/DeleteGuardContext';

interface Category { id: string; name: string; slug: string; _count?: { products: number } }
interface Product {
  id: string; name: string; description: string; price: number; discountPrice: number | null; image: string | null;
  images: string | null; videoUrl: string | null; condition: string; location: string;
  categoryId: string; category: Category; stock: number; sku: string; weight: number | null;
  active: boolean; updatedAt: string;
}

// Product photos are stored as a JSON-stringified array on `images`. Older products may
// only have the single legacy `image` field set — fall back to treating that as a
// one-item array.
function parseProductImages(images: string | null, image: string | null): string[] {
  if (images) {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  return image ? [image] : [];
}

const PAGE_SIZE = 10;
const EMPTY_FORM = { name: '', description: '', price: '', discountPrice: '', categoryId: '', stock: '', sku: '', weight: '', condition: 'NEW', location: 'Florida, USA' };

export default function AdminStore() {
  const { confirmDelete } = useDeleteGuard();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [removingImageUrl, setRemovingImageUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [importing, setImporting] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [addCategoryName, setAddCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadCategories = () => api.get('/products/meta/categories').then(r => setCategories(r.data));

  const load = (pageOverride?: number) => {
    setLoading(true);
    api.get('/products/admin/all', { params: { search: search || undefined, page: pageOverride ?? page, limit: PAGE_SIZE } })
      .then(r => { setProducts(r.data.products); setTotal(r.data.total); })
      .catch(() => showToast('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { load(); }, [page]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setImageFiles([]); setExistingImageUrls([]);
    setVideoFile(null); setVideoPreview(null); setExistingVideoUrl(null);
    setNewCategoryOpen(false); setNewCategoryName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const openAdd = () => { setEditingId(null); resetForm(); setFormError(''); setPanelOpen(true); };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description || '', price: String(p.price),
      discountPrice: p.discountPrice != null ? String(p.discountPrice) : '', categoryId: p.categoryId,
      stock: String(p.stock), sku: p.sku, weight: p.weight != null ? String(p.weight) : '',
      condition: p.condition === 'USED' ? 'USED' : 'NEW',
      location: p.location === 'Montego Bay, Jamaica' ? 'Montego Bay, Jamaica' : 'Florida, USA',
    });
    setImageFiles([]); setExistingImageUrls(parseProductImages(p.images, p.image));
    setVideoFile(null); setVideoPreview(null); setExistingVideoUrl(p.videoUrl || null);
    setNewCategoryOpen(false); setNewCategoryName('');
    setFormError('');
    setPanelOpen(true);
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setImageFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const handleRemovePendingImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = async (url: string) => {
    if (!editingId) return;
    setRemovingImageUrl(url);
    try {
      const { data } = await api.delete(`/products/${editingId}/images`, { data: { url } });
      setExistingImageUrls(parseProductImages(data.images, data.image));
    } catch {
      showToast('Failed to remove photo');
    } finally {
      setRemovingImageUrl(null);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    setVideoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleRemoveVideo = () => {
    setVideoFile(null); setVideoPreview(null); setExistingVideoUrl(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const { data } = await api.post('/products/meta/categories', { name: newCategoryName.trim() });
      await loadCategories();
      setForm(f => ({ ...f, categoryId: data.id }));
      setNewCategoryOpen(false);
      setNewCategoryName('');
      showToast(`Category "${data.name}" added`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to add category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleImportShopfnds = async () => {
    setImporting(true);
    try {
      const { data } = await api.post('/products/import/shopfnds');
      showToast(`Imported: ${data.created} added, ${data.updated} updated${data.skipped ? `, ${data.skipped} skipped` : ''} (of ${data.total} found)`);
      loadCategories();
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const openManageCategories = () => {
    setManageCategoriesOpen(true);
    setCategoryEditId(null);
    setAddCategoryName('');
  };

  const handleAddCategoryModal = async () => {
    if (!addCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const { data } = await api.post('/products/meta/categories', { name: addCategoryName.trim() });
      await loadCategories();
      setAddCategoryName('');
      showToast(`Category "${data.name}" added`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to add category');
    } finally {
      setAddingCategory(false);
    }
  };

  const startRenameCategory = (c: Category) => {
    setCategoryEditId(c.id);
    setCategoryEditName(c.name);
  };

  const handleRenameCategory = async (c: Category) => {
    const name = categoryEditName.trim();
    if (!name || name === c.name) { setCategoryEditId(null); return; }
    setCategoryBusyId(c.id);
    try {
      await api.put(`/products/meta/categories/${c.id}`, { name });
      await loadCategories();
      load();
      setCategoryEditId(null);
      showToast('Category renamed');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to rename category');
    } finally {
      setCategoryBusyId(null);
    }
  };

  const handleDeleteCategory = async (c: Category) => {
    if (!(await confirmDelete(`Delete category "${c.name}"? This can't be undone.`))) return;
    setCategoryBusyId(c.id);
    try {
      await api.delete(`/products/meta/categories/${c.id}`);
      await loadCategories();
      showToast('Category deleted');
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete category');
    } finally {
      setCategoryBusyId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.categoryId) {
      setFormError('Name, price and category are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('discountPrice', form.discountPrice || '');
      fd.append('categoryId', form.categoryId);
      fd.append('stock', form.stock || '0');
      fd.append('condition', form.condition);
      fd.append('location', form.location);
      if (form.sku) fd.append('sku', form.sku);
      if (form.weight) fd.append('weight', form.weight);
      imageFiles.forEach(f => fd.append('images', f));
      if (videoFile) fd.append('video', videoFile);

      if (editingId) await api.put(`/products/${editingId}`, fd);
      else await api.post('/products', fd);

      showToast(editingId ? 'Product updated' : 'Product added');
      setPanelOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    try {
      await api.patch(`/products/${p.id}/status`);
      showToast(p.active ? 'Product deactivated' : 'Product activated');
      load();
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleDelete = async (p: Product) => {
    if (!(await confirmDelete(`Permanently delete ${p.name}? This removes it completely, including any order history for it, and cannot be undone.`))) return;
    try {
      await api.delete(`/products/${p.id}`);
      showToast('Product permanently deleted');
      load();
    } catch {
      showToast('Failed to delete product');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-sm">{toast}</div>}

      <div className="bg-white border-b dark:bg-[#141414] dark:border-white/10 px-6 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store <span className="text-gray-400 dark:text-white/40 font-normal text-base ml-2">Product Management</span></h1>
        <div className="text-sm text-gray-400 dark:text-white/40">Dashboard <span className="mx-1">/</span> <span className="text-gray-600 dark:text-white/60">Store Management</span></div>
      </div>

      <div className="p-6 space-y-5">
        <div className="panel-glass rounded-2xl">
          <button onClick={() => setPanelOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Product <span className="text-gray-400 dark:text-white/40 font-normal text-sm ml-1">Add/Update</span></h2>
            {panelOpen ? <Minus className="w-4 h-4 text-gray-400 dark:text-white/40" /> : <Plus className="w-4 h-4 text-gray-400 dark:text-white/40" />}
          </button>
          {panelOpen && (
            <form onSubmit={handleSave} className="border-t p-5 space-y-5 max-w-2xl">
              {formError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Product Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Category *</label>
                  {!newCategoryOpen ? (
                    <div className="flex gap-2">
                      <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                        <option value="">Select category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setNewCategoryOpen(true)} className="flex-shrink-0 border rounded-lg px-3 py-2 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors whitespace-nowrap">
                        + New
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" className="w-full border rounded-lg px-3 py-2 text-sm" />
                      <button type="button" disabled={creatingCategory} onClick={handleCreateCategory} className="flex-shrink-0 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50">
                        {creatingCategory ? '...' : 'Add'}
                      </button>
                      <button type="button" onClick={() => { setNewCategoryOpen(false); setNewCategoryName(''); }} className="flex-shrink-0 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white px-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Price (USD) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Discount Price (USD)</label>
                <input type="number" step="0.01" value={form.discountPrice} onChange={e => setForm(f => ({ ...f, discountPrice: e.target.value }))} placeholder="Leave blank for no discount" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">When set, the customer store shows the original price struck through next to this discounted price.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">SKU</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Auto-generated if blank" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Weight (lbs)</label>
                  <input type="number" step="0.01" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Condition</label>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="NEW">New</option>
                    <option value="USED">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Product Location</label>
                  <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="Florida, USA">🇺🇸 Florida, USA</option>
                    <option value="Montego Bay, Jamaica">🇯🇲 Montego Bay, Jamaica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Product Photos</label>
                {existingImageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {existingImageUrls.map(url => (
                      <div key={url} className="relative group">
                        <img src={url} alt="Product" className="w-24 h-24 object-cover rounded-lg border" />
                        <button type="button" onClick={() => handleRemoveExistingImage(url)} disabled={removingImageUrl === url}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600 disabled:opacity-50">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {imageFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {imageFiles.map((f, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(f)} alt="Pending upload" className="w-24 h-24 object-cover rounded-lg border-2 border-dashed" />
                        <button type="button" onClick={() => handleRemovePendingImage(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-500 text-white text-xs flex items-center justify-center shadow hover:bg-gray-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" multiple accept="image/gif,image/jpeg,image/png,image/webp" onChange={handleFilesChange} className="text-sm" />
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                  Photos must be .gif, .jpg, .jpeg, .png or .webp and must not be larger than 5MB each. The first photo is used as the cover image. New photos upload when you click Save.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Product Video</label>
                <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleVideoChange} className="text-sm" />
                <p className="text-xs text-gray-400 dark:text-white/40 mt-1">
                  Video must be .mp4, .mov or .webm and must not be larger than 30MB
                  {(videoPreview || existingVideoUrl) && (
                    <button type="button" onClick={handleRemoveVideo} className="ml-2 text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 text-xs font-semibold px-2 py-0.5 rounded transition-colors">remove</button>
                  )}
                </p>
                {(videoPreview || existingVideoUrl) && (
                  <video src={videoPreview || existingVideoUrl || ''} controls className="mt-3 w-full max-w-xs rounded-lg border" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white/80 mb-1">Description</label>
                <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setPanelOpen(false); resetForm(); }} className="flex items-center gap-1.5 border text-gray-600 dark:text-white/60 text-sm font-medium px-4 py-2 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="panel-glass rounded-2xl">
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-b">
            <button onClick={openManageCategories} className="flex items-center gap-1.5 border rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 dark:text-white/70 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              Manage Categories
            </button>
            <button onClick={handleImportShopfnds} disabled={importing} className="flex items-center gap-1.5 border rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 dark:text-white/70 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50">
              {importing ? 'Importing…' : 'Import from shopfnds.com'}
            </button>
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3">
            <div className="text-sm text-gray-600 dark:text-white/60">Show entries</div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/60">
              Search:
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1); } }} className="border rounded-lg px-3 py-2 text-sm w-56" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b text-left text-gray-600 dark:text-white/60">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap"></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Product</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">SKU</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Price</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Stock</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">Loading…</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400 dark:text-white/40">No products match this search.</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 w-8">
                        <button title="Edit" onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                        {p.active ? (
                          <button title="Deactivate" onClick={() => handleToggleStatus(p)} className="w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><BlockIcon className="w-4 h-4" /></button>
                        ) : (
                          <button title="Activate" onClick={() => handleToggleStatus(p)} className="w-8 h-8 rounded-lg text-green-600 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25 flex items-center justify-center transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        <button title="Delete" onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors"><DeleteIcon className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-gray-300 dark:text-white/20" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white max-w-[220px] truncate block">{p.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.condition === 'USED' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">USED</span>}
                            {p.videoUrl && <span title="Has a product video" className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">VIDEO</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/50 whitespace-nowrap">{p.sku}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-white/60 whitespace-nowrap">{p.category?.name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.discountPrice != null && p.discountPrice < p.price ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 dark:text-white/30 line-through text-xs">${p.price.toFixed(2)}</span>
                          <span className="text-green-600 dark:text-green-400 font-semibold">${p.discountPrice.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-900 dark:text-white font-medium">${p.price.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={p.stock === 0 ? 'text-red-600 dark:text-red-300 font-medium' : p.stock < 10 ? 'text-orange-600 dark:text-orange-300 font-medium' : 'text-gray-600 dark:text-white/60'}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded ${p.active ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t flex-wrap gap-3">
            <div className="text-sm text-gray-400 dark:text-white/40">Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} entries</div>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-sm px-3 py-2 rounded border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5">Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`text-sm px-3 py-2 rounded border dark:border-white/10 ${p === page ? 'bg-brand-800 text-white border-brand-800' : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/10'}`}>{p}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="text-sm px-3 py-2 rounded border dark:border-white/10 text-gray-600 dark:text-white/60 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5">Next</button>
            </div>
          </div>
        </div>
      </div>

      {manageCategoriesOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Manage Categories</h3>
              <button onClick={() => setManageCategoriesOpen(false)}><X className="w-5 h-5 text-gray-400 dark:text-white/40" /></button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto -mx-1 px-1">
              {categories.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-white/40 text-center py-4">No categories yet.</p>
              )}
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-white/5">
                  {categoryEditId === c.id ? (
                    <>
                      <input
                        autoFocus
                        value={categoryEditName}
                        onChange={e => setCategoryEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(c); if (e.key === 'Escape') setCategoryEditId(null); }}
                        className="flex-1 min-w-0 border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
                      />
                      <button disabled={categoryBusyId === c.id} onClick={() => handleRenameCategory(c)} className="flex-shrink-0 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-50">
                        {categoryBusyId === c.id ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setCategoryEditId(null)} className="flex-shrink-0 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white px-1">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white">{c.name}</span>
                      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-white/40">{c._count?.products ?? 0} item{(c._count?.products ?? 0) === 1 ? '' : 's'}</span>
                      <button title="Rename" onClick={() => startRenameCategory(c)} className="flex-shrink-0 w-8 h-8 rounded-lg text-orange-600 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/25 flex items-center justify-center transition-colors"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button title="Delete" disabled={categoryBusyId === c.id} onClick={() => handleDeleteCategory(c)} className="flex-shrink-0 w-8 h-8 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25 flex items-center justify-center transition-colors disabled:opacity-50"><DeleteIcon className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t dark:border-white/10">
              <input
                value={addCategoryName}
                onChange={e => setAddCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategoryModal(); }}
                placeholder="New category name"
                className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
              <button disabled={addingCategory} onClick={handleAddCategoryModal} className="flex-shrink-0 bg-brand-800 hover:bg-brand-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {addingCategory ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
