import React, { useMemo, useState } from 'react';
import { Product } from '../types';
import { generateId } from '../lib/utils';
import { CheckCircle2, FileSpreadsheet, Plus, Trash2, Upload, X } from 'lucide-react';

interface TileBatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchSaveProducts: (products: Product[]) => void | Promise<void>;
  currencySymbol: string;
}

interface BatchRow {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  taxRate: number;
}

const MAX_BATCH = 50;

const newRow = (): BatchRow => ({
  id: generateId('batch'),
  name: '',
  sku: '',
  hsnCode: '',
  unit: 'BOX',
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  reorderLevel: 0,
  taxRate: 18
});

const toProduct = (row: BatchRow): Product => ({
  id: generateId('prod'),
  sku: row.sku.trim(),
  barcode: row.sku.trim(),
  name: row.name.trim(),
  category: 'General',
  hsnCode: row.hsnCode.trim() || undefined,
  costPrice: Number(row.costPrice) || 0,
  sellingPrice: Number(row.sellingPrice) || 0,
  stock: Number(row.stock) || 0,
  reorderLevel: Number(row.reorderLevel) || 0,
  taxRate: Number(row.taxRate) || 0,
  unit: row.unit.trim() || 'BOX',
  updatedAt: new Date().toISOString()
});

export const TileBatchAddModal: React.FC<TileBatchAddModalProps> = ({ isOpen, onClose, onBatchSaveProducts }) => {
  const [rows, setRows] = useState<BatchRow[]>(() => Array.from({ length: 10 }, newRow));
  const [csvText, setCsvText] = useState('');
  const [mode, setMode] = useState<'ENTRY' | 'CSV'>('ENTRY');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const validRows = useMemo(() => rows.filter((r) => r.name.trim() && r.sku.trim()), [rows]);

  if (!isOpen) return null;

  const updateRow = (id: string, field: keyof BatchRow, value: string | number) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  const addRows = () => {
    setRows((current) => current.length >= MAX_BATCH ? current : [...current, ...Array.from({ length: Math.min(10, MAX_BATCH - current.length) }, newRow)]);
  };

  const removeRow = (id: string) => {
    setRows((current) => current.length <= 1 ? current : current.filter((row) => row.id !== id));
  };

  const parseCsv = () => {
    const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    const start = lines[0].toLowerCase().includes('name') ? 1 : 0;
    const parsed: BatchRow[] = [];
    for (const line of lines.slice(start, start + MAX_BATCH)) {
      const cols = line.split(',').map((v) => v.trim());
      if (!cols[0] || !cols[1]) continue;
      parsed.push({
        id: generateId('csv'), name: cols[0], sku: cols[1], hsnCode: cols[2] || '', unit: cols[3] || 'BOX',
        costPrice: Number(cols[4]) || 0, sellingPrice: Number(cols[5]) || 0, stock: Number(cols[6]) || 0,
        reorderLevel: Number(cols[7]) || 0, taxRate: Number(cols[8]) || 18
      });
    }
    setRows(parsed.length ? parsed : [newRow()]);
    setMode('ENTRY');
    setMessage(lines.length > MAX_BATCH ? `Only the first ${MAX_BATCH} rows were loaded. Save this batch, then import the next batch.` : `${parsed.length} rows loaded.`);
  };

  const save = async () => {
    const products = validRows.map(toProduct);
    if (!products.length) {
      setMessage('Enter at least Item Name and SKU before saving.');
      return;
    }
    setSaving(true);
    setMessage('Saving batch to the inventory master...');
    try {
      await onBatchSaveProducts(products);
      setRows(Array.from({ length: 10 }, newRow));
      setCsvText('');
      setMessage('Saved successfully. Ready for the next batch.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Batch save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl max-h-[92vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-black">Inventory Data Entry</p><h2 className="text-xl font-black text-white">Create &amp; Save Stock Items</h2><p className="text-xs text-slate-500 mt-1">Maximum 50 unsaved rows. Save first, then continue with the next batch.</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex gap-2"><button onClick={() => setMode('ENTRY')} className={`px-3 py-2 rounded-xl text-xs font-black ${mode === 'ENTRY' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Manual Entry</button><button onClick={() => setMode('CSV')} className={`px-3 py-2 rounded-xl text-xs font-black ${mode === 'CSV' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}><FileSpreadsheet className="inline w-4 h-4 mr-1" /> CSV Import</button></div>
          <span className="text-[11px] font-bold text-slate-500">{validRows.length} valid / {rows.length} rows</span>
        </div>

        {mode === 'CSV' ? <div className="p-5 space-y-3 overflow-y-auto flex-1"><p className="text-xs text-slate-400">Paste CSV columns: <b className="text-slate-200">Name, SKU, HSN, Unit, Cost, Selling Price, Stock, Reorder Level, GST</b>.</p><textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full h-72 p-3 rounded-2xl bg-slate-950 border border-slate-700 text-white font-mono text-xs" placeholder="Name,SKU,HSN,Unit,Cost,Selling Price,Stock,Reorder Level,GST\n18X12 DIG WALL TILES PRE,TL-001,6907,BOX,80,108.69,10,2,18" /><button onClick={parseCsv} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black"><Upload className="inline w-4 h-4 mr-1" /> Load First 50 Rows</button></div> : <div className="overflow-auto flex-1 p-5"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase text-[10px]"><tr><th className="p-2">Item Name *</th><th className="p-2">SKU *</th><th className="p-2">HSN</th><th className="p-2">Unit</th><th className="p-2">Cost</th><th className="p-2">Selling</th><th className="p-2">Stock</th><th className="p-2">Reorder</th><th className="p-2">GST %</th><th className="p-2"></th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row) => <tr key={row.id}><td className="p-2"><input value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} className="w-56 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td><td className="p-2"><input value={row.sku} onChange={(e) => updateRow(row.id, 'sku', e.target.value)} className="w-32 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono" /></td><td className="p-2"><input value={row.hsnCode} onChange={(e) => updateRow(row.id, 'hsnCode', e.target.value)} className="w-24 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td><td className="p-2"><input value={row.unit} onChange={(e) => updateRow(row.id, 'unit', e.target.value.toUpperCase())} className="w-20 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td>{(['costPrice','sellingPrice','stock','reorderLevel','taxRate'] as const).map((field) => <td className="p-2" key={field}><input type="number" step="0.01" value={row[field]} onChange={(e) => updateRow(row.id, field, Number(e.target.value))} className="w-24 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td>)}<td className="p-2"><button onClick={() => removeRow(row.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>}

        <div className="px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="text-xs text-slate-400">{message || 'Use Save Batch after entering the current set of items.'}</div><div className="flex gap-2">{mode === 'ENTRY' && <button disabled={rows.length >= MAX_BATCH} onClick={addRows} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold disabled:opacity-40"><Plus className="inline w-4 h-4 mr-1" /> Add 10 Rows</button>}<button disabled={saving || validRows.length === 0} onClick={save} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40"><CheckCircle2 className="inline w-4 h-4 mr-1" /> {saving ? 'Saving...' : `Save Batch (${validRows.length})`}</button></div></div>
      </div>
    </div>
  );
};