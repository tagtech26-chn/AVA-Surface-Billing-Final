import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Edit3, FileSpreadsheet, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Product } from '../types';
import { TileBatchAddModal } from './TileBatchAddModal';

interface InventoryCatalogViewProps {
  onSaveProduct: (product: Product) => void;
  onStockAdjustment: (adjustment: any) => void;
  userRole: string;
  currencySymbol: string;
}

type ApiProduct = {
  id: string;
  sku: string;
  name: string;
  hsnCode?: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  taxRate: number;
  isActive: boolean;
};

type ProductPage = {
  items: ApiProduct[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const emptyProduct = (): Product => ({
  id: crypto.randomUUID(),
  sku: '',
  barcode: '',
  name: '',
  category: 'General',
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  reorderLevel: 0,
  taxRate: 18,
  unit: 'box',
  description: '',
  updatedAt: new Date().toISOString()
});

const toProduct = (p: ApiProduct): Product => ({
  id: p.id,
  sku: p.sku,
  barcode: p.sku,
  name: p.name,
  category: 'General',
  costPrice: Number(p.costPrice),
  sellingPrice: Number(p.sellingPrice),
  stock: Number(p.stock),
  reorderLevel: Number(p.reorderLevel),
  taxRate: Number(p.taxRate),
  unit: p.unit,
  hsnCode: p.hsnCode || undefined,
  updatedAt: new Date().toISOString()
});

export const InventoryCatalogView: React.FC<InventoryCatalogViewProps> = ({
  onSaveProduct,
  userRole,
  currencySymbol
}) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductPage>({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const canEdit = userRole === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      if (stockFilter !== 'ALL') params.set('stockFilter', stockFilter);
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error(`Inventory API HTTP ${response.status}`);
      const payload = await response.json() as ProductPage;
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, stockFilter]);

  useEffect(() => {
    const timer = window.setTimeout(load, search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, stockFilter, pageSize]);

  const visibleRows = useMemo(() => result.items.map(toProduct), [result.items]);
  const lowStockOnPage = result.items.filter((p) => p.stock <= p.reorderLevel).length;

  const saveSingle = async () => {
    if (!editing || !editing.name.trim() || !editing.sku.trim()) return;
    setSaving(true);
    try {
      const isNew = !result.items.some((p) => p.id === editing.id);
      const body = {
        companyId: null,
        sku: editing.sku.trim(),
        name: editing.name.trim(),
        hsnCode: editing.hsnCode || null,
        unit: editing.unit || 'PCS',
        costPrice: Number(editing.costPrice) || 0,
        sellingPrice: Number(editing.sellingPrice) || 0,
        stock: Number(editing.stock) || 0,
        reorderLevel: Number(editing.reorderLevel) || 0,
        gstRate: Number(editing.taxRate) || 0,
        isActive: true
      };
      const response = await fetch(isNew ? '/api/products' : `/api/products/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text() || `Save failed (${response.status})`);
      onSaveProduct(editing);
      setEditing(null);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const saveBatch = async (products: Product[]) => {
    const chunkSize = 50;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const response = await fetch('/api/products/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          hsnCode: p.hsnCode || null,
          unit: p.unit,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          stock: p.stock,
          reorderLevel: p.reorderLevel,
          taxRate: p.taxRate
        })))
      });
      if (!response.ok) throw new Error(await response.text() || `Batch import failed (${response.status})`);
    }
    setBatchOpen(false);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-400 font-black">Inventory Master</p>
          <h1 className="text-2xl font-black text-white mt-1">Stock Items &amp; Locations</h1>
          <p className="text-xs text-slate-400 mt-1">Data-entry first. Search and page through the master instead of loading the entire catalogue.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canEdit && <>
            <button onClick={() => setBatchOpen(true)} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Batch / CSV Entry
            </button>
            <button onClick={() => setEditing(emptyProduct())} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Item
            </button>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-[10px] text-slate-500 uppercase font-black">Items in master</p><p className="text-2xl font-black text-white mt-1">{result.totalCount.toLocaleString()}</p></div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-[10px] text-slate-500 uppercase font-black">Current page</p><p className="text-2xl font-black text-indigo-300 mt-1">{result.items.length}</p></div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-[10px] text-slate-500 uppercase font-black">Low stock shown</p><p className="text-2xl font-black text-amber-400 mt-1">{lowStockOnPage}</p></div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p className="text-[10px] text-slate-500 uppercase font-black">Page</p><p className="text-2xl font-black text-white mt-1">{result.page} <span className="text-sm text-slate-500">/ {result.totalPages || 1}</span></p></div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type item name, SKU or HSN..." className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-indigo-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-500"><X className="w-4 h-4" /></button>}
        </div>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)} className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold">
          <option value="ALL">All stock</option><option value="LOW_STOCK">Low stock</option><option value="OUT_OF_STOCK">Out of stock</option>
        </select>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold">
          <option value="25">25 / page</option><option value="50">50 / page</option><option value="100">100 / page</option>
        </select>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 px-4 py-3 text-xs font-bold">{error}</div>}

      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-black">
              <tr><th className="p-4">Item</th><th className="p-4">SKU / HSN</th><th className="p-4">Unit</th><th className="p-4 text-right">Cost</th><th className="p-4 text-right">Selling</th><th className="p-4 text-right">Stock</th><th className="p-4 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? <tr><td colSpan={7} className="p-12 text-center text-slate-500 text-sm">Loading inventory...</td></tr> : result.items.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-slate-500 text-sm">No items found.</td></tr> : result.items.map((p) => {
                const low = p.stock <= p.reorderLevel;
                return <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-4"><p className="font-bold text-white text-sm">{p.name}</p><p className="text-[10px] text-slate-500 mt-1">MSSQL master record</p></td>
                  <td className="p-4 font-mono text-xs"><p className="text-slate-200">{p.sku}</p><p className="text-slate-500">{p.hsnCode || '—'}</p></td>
                  <td className="p-4 text-xs text-slate-300">{p.unit}</td>
                  <td className="p-4 text-right text-xs text-slate-300">{currencySymbol}{Number(p.costPrice).toFixed(2)}</td>
                  <td className="p-4 text-right text-sm font-black text-white">{currencySymbol}{Number(p.sellingPrice).toFixed(2)}</td>
                  <td className="p-4 text-right"><span className={`font-black ${low ? 'text-amber-400' : 'text-emerald-400'}`}>{Number(p.stock).toLocaleString()} {p.unit}</span>{low && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-amber-400" />}</td>
                  <td className="p-4 text-right">{canEdit && <button onClick={() => setEditing(toProduct(p))} className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white"><Edit3 className="w-4 h-4" /></button>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40">
          <span className="text-[11px] text-slate-500">Showing {result.totalCount === 0 ? 0 : ((result.page - 1) * result.pageSize) + 1}–{Math.min(result.page * result.pageSize, result.totalCount)} of {result.totalCount.toLocaleString()}</span>
          <div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><button disabled={page >= result.totalPages || loading} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div>
        </div>
      </div>

      {editing && <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl"><div className="flex justify-between items-center pb-4 border-b border-slate-800"><div><p className="text-[10px] uppercase tracking-widest text-indigo-400 font-black">Stock Item Master</p><h2 className="text-xl font-black text-white">{result.items.some((p) => p.id === editing.id) ? 'Alter Item' : 'Create Item'}</h2></div><button onClick={() => setEditing(null)}><X className="w-5 h-5 text-slate-400" /></button></div><div className="grid grid-cols-2 gap-3 py-5 text-xs">
        {([['name','Item Name'],['sku','SKU'],['hsnCode','HSN Code'],['unit','Unit']] as const).map(([field,label]) => <label key={field} className="text-slate-400">{label}<input value={String(editing[field] || '')} onChange={(e) => setEditing({ ...editing, [field]: e.target.value })} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></label>)}
        <label className="text-slate-400">Cost Price<input type="number" step="0.01" value={editing.costPrice} onChange={(e) => setEditing({ ...editing, costPrice: Number(e.target.value) })} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></label>
        <label className="text-slate-400">Selling Price<input type="number" step="0.01" value={editing.sellingPrice} onChange={(e) => setEditing({ ...editing, sellingPrice: Number(e.target.value) })} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></label>
        <label className="text-slate-400">Opening / Current Stock<input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></label>
        <label className="text-slate-400">Reorder Level<input type="number" value={editing.reorderLevel} onChange={(e) => setEditing({ ...editing, reorderLevel: Number(e.target.value) })} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></label>
      </div><div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button><button disabled={saving || !editing.name.trim() || !editing.sku.trim()} onClick={saveSingle} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-40">{saving ? 'Saving...' : 'Save Item'}</button></div></div></div>}

      <TileBatchAddModal isOpen={batchOpen} onClose={() => setBatchOpen(false)} onBatchSaveProducts={saveBatch} currencySymbol={currencySymbol} />
    </div>
  );
};