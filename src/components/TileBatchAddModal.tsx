import React, { useMemo, useRef, useState } from 'react';
import { Product } from '../types';
import { generateId } from '../lib/utils';
import { CheckCircle2, Download, FileSpreadsheet, Plus, Trash2, Upload, X } from 'lucide-react';

interface TileBatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchSaveProducts: (products: Product[]) => void | Promise<void>;
  currencySymbol: string;
}

interface BatchRow {
  id: string;
  sourceRow: number;
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

const MAX_BATCH = 500;
const CSV_HEADER = 'Name,SKU,HSN,Unit,Cost,Selling Price,Stock,Reorder Level,GST';
const CSV_SAMPLE = '18X12 DIG WALL TILES PRE,TL-001,6907,BOX,80,108.69,10,2,18';

const newRow = (sourceRow = 0): BatchRow => ({
  id: generateId('batch'), sourceRow, name: '', sku: '', hsnCode: '', unit: 'BOX',
  costPrice: 0, sellingPrice: 0, stock: 0, reorderLevel: 0, taxRate: 18
});

const toProduct = (row: BatchRow): Product => ({
  id: generateId('prod'), sku: row.sku.trim(), barcode: row.sku.trim(), name: row.name.trim(), category: 'General',
  hsnCode: row.hsnCode.trim() || undefined, costPrice: Number(row.costPrice) || 0, sellingPrice: Number(row.sellingPrice) || 0,
  stock: Number(row.stock) || 0, reorderLevel: Number(row.reorderLevel) || 0, taxRate: Number(row.taxRate) || 0,
  unit: row.unit.trim().toUpperCase() || 'BOX', updatedAt: new Date().toISOString()
});

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += ch;
  }
  values.push(value.trim());
  return values;
};

const csvEscape = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const TileBatchAddModal: React.FC<TileBatchAddModalProps> = ({ isOpen, onClose, onBatchSaveProducts }) => {
  const [rows, setRows] = useState<BatchRow[]>(() => Array.from({ length: 10 }, (_, i) => newRow(i + 1)));
  const [csvText, setCsvText] = useState('');
  const [mode, setMode] = useState<'ENTRY' | 'CSV'>('ENTRY');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = useMemo(() => rows.filter((r) => r.name.trim() && r.sku.trim()), [rows]);
  const duplicateSkus = useMemo(() => {
    const counts = new Map<string, number>();
    validRows.forEach((r) => counts.set(r.sku.trim().toUpperCase(), (counts.get(r.sku.trim().toUpperCase()) || 0) + 1));
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku));
  }, [validRows]);

  if (!isOpen) return null;

  const updateRow = (id: string, field: keyof BatchRow, value: string | number) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setErrors([]); setMessage('');
  };

  const addRows = () => {
    setRows((current) => current.length >= MAX_BATCH ? current : [...current, ...Array.from({ length: Math.min(10, MAX_BATCH - current.length) }, (_, i) => newRow(current.length + i + 1))]);
  };

  const removeRow = (id: string) => setRows((current) => current.length <= 1 ? current : current.filter((row) => row.id !== id));

  const parseRows = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) { setMessage('The CSV file is empty.'); return; }
    const first = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const hasHeader = first.some((x) => x === 'name' || x === 'item name' || x === 'sku');
    const dataLines = lines.slice(hasHeader ? 1 : 0);
    const parsed: BatchRow[] = [];
    const parseErrors: string[] = [];
    dataLines.slice(0, MAX_BATCH).forEach((line, index) => {
      const sourceRow = index + (hasHeader ? 2 : 1);
      const cols = parseCsvLine(line);
      const name = cols[0] || ''; const sku = cols[1] || '';
      if (!name.trim() || !sku.trim()) { parseErrors.push(`Row ${sourceRow}: Item Name and SKU are required.`); return; }
      const numbers = [4, 5, 6, 7, 8].map((i) => cols[i] === '' || cols[i] == null ? 0 : Number(cols[i]));
      if (numbers.some((n) => !Number.isFinite(n))) { parseErrors.push(`Row ${sourceRow}: Cost, Selling Price, Stock, Reorder Level and GST must be numeric.`); return; }
      const [costPrice, sellingPrice, stock, reorderLevel, taxRate] = numbers;
      if (costPrice < 0 || sellingPrice < 0 || stock < 0 || reorderLevel < 0 || taxRate < 0 || taxRate > 100) { parseErrors.push(`Row ${sourceRow}: numeric values are outside the allowed range.`); return; }
      parsed.push({ id: generateId('csv'), sourceRow, name: name.trim(), sku: sku.trim(), hsnCode: cols[2] || '', unit: (cols[3] || 'BOX').trim().toUpperCase(), costPrice, sellingPrice, stock, reorderLevel, taxRate: cols[8] === '' || cols[8] == null ? 18 : taxRate });
    });
    if (dataLines.length > MAX_BATCH) parseErrors.push(`Only the first ${MAX_BATCH} data rows were loaded. Save this batch before importing the next file/batch.`);
    setRows(parsed.length ? parsed : [newRow(1)]); setMode('ENTRY'); setErrors(parseErrors); setMessage(`${parsed.length} rows loaded${parseErrors.length ? ` with ${parseErrors.length} validation warning(s)` : ''}.`);
  };

  const parseCsv = () => parseRows(csvText);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const allowed = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    if (!allowed) { setMessage('Please select a CSV file. Excel .xlsx support will be added separately; use Save As CSV for now.'); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage('File is too large. Maximum CSV size is 10 MB.'); return; }
    setMessage(`Reading ${file.name}...`); parseRows(await file.text());
  };

  const downloadTemplate = () => {
    const content = `${CSV_HEADER}\n${CSV_SAMPLE}\n`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'AVASurface_Inventory_Bulk_Upload_Template.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  const validate = () => {
    const nextErrors = [...errors];
    if (!validRows.length) nextErrors.push('Enter at least Item Name and SKU before saving.');
    if (duplicateSkus.size) nextErrors.push(`Duplicate SKU(s) in this batch: ${[...duplicateSkus].join(', ')}`);
    validRows.forEach((row) => {
      if (row.sellingPrice < 0 || row.costPrice < 0 || row.stock < 0 || row.reorderLevel < 0) nextErrors.push(`Row ${row.sourceRow}: negative numeric value is not allowed.`);
      if (row.taxRate < 0 || row.taxRate > 100) nextErrors.push(`Row ${row.sourceRow}: GST must be between 0 and 100.`);
      if (!row.unit.trim()) nextErrors.push(`Row ${row.sourceRow}: Unit is required.`);
    });
    return [...new Set(nextErrors)];
  };

  const save = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (validationErrors.length) { setMessage('Please correct the validation errors before saving.'); return; }
    const products = validRows.map(toProduct); setSaving(true); setMessage(`Saving ${products.length} item(s) to the inventory master...`);
    try {
      await onBatchSaveProducts(products);
      setRows(Array.from({ length: 10 }, (_, i) => newRow(i + 1))); setCsvText(''); setErrors([]); setMessage(`${products.length} item(s) saved successfully. Existing SKUs are updated; new SKUs are created.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Batch save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl max-h-[92vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-black">Inventory Data Entry</p><h2 className="text-xl font-black text-white">Bulk Upload &amp; Batch Entry</h2><p className="text-xs text-slate-500 mt-1">Up to {MAX_BATCH} rows per batch. Existing SKU = update; new SKU = create. Deactivation status is never changed by upload.</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2"><button onClick={() => setMode('ENTRY')} className={`px-3 py-2 rounded-xl text-xs font-black ${mode === 'ENTRY' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Manual Entry</button><button onClick={() => setMode('CSV')} className={`px-3 py-2 rounded-xl text-xs font-black ${mode === 'CSV' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}><FileSpreadsheet className="inline w-4 h-4 mr-1" /> File / CSV Import</button></div>
          <div className="flex gap-2"><button onClick={downloadTemplate} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"><Download className="inline w-4 h-4 mr-1" /> Download Template</button><span className="px-3 py-2 rounded-xl bg-slate-950 text-[11px] font-bold text-slate-500">{validRows.length} valid / {rows.length} rows</span></div>
        </div>
        {mode === 'CSV' ? <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4"><p className="text-sm font-black text-white">Upload CSV file</p><p className="text-xs text-slate-400 mt-1">Columns: <b className="text-slate-200">Name, SKU, HSN, Unit, Cost, Selling Price, Stock, Reorder Level, GST</b></p><p className="text-[11px] text-slate-500 mt-1">Maximum 10 MB and {MAX_BATCH} rows per batch. Quoted commas in item names are supported.</p><div className="flex flex-wrap gap-2 mt-3"><input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} /><button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black"><Upload className="inline w-4 h-4 mr-1" /> Choose CSV File</button><button onClick={downloadTemplate} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold"><Download className="inline w-4 h-4 mr-1" /> Template</button></div></div>
          <div><p className="text-xs text-slate-400 mb-2">Or paste CSV data</p><textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full h-64 p-3 rounded-2xl bg-slate-950 border border-slate-700 text-white font-mono text-xs" placeholder={`${CSV_HEADER}\n${CSV_SAMPLE}`} /><button onClick={parseCsv} disabled={!csvText.trim()} className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-40">Load Preview</button></div>
        </div> : <div className="overflow-auto flex-1 p-5"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase text-[10px]"><tr><th className="p-2">Item Name *</th><th className="p-2">SKU *</th><th className="p-2">HSN</th><th className="p-2">Unit</th><th className="p-2">Cost</th><th className="p-2">Selling</th><th className="p-2">Stock</th><th className="p-2">Reorder</th><th className="p-2">GST %</th><th className="p-2"></th></tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row) => { const duplicate = duplicateSkus.has(row.sku.trim().toUpperCase()); return <tr key={row.id} className={duplicate ? 'bg-rose-950/20' : ''}><td className="p-2"><input value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} className="w-56 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td><td className="p-2"><input value={row.sku} onChange={(e) => updateRow(row.id, 'sku', e.target.value)} className={`w-32 p-2 rounded-lg bg-slate-950 border text-white font-mono ${duplicate ? 'border-rose-500' : 'border-slate-800'}`} /></td><td className="p-2"><input value={row.hsnCode} onChange={(e) => updateRow(row.id, 'hsnCode', e.target.value)} className="w-24 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td><td className="p-2"><input value={row.unit} onChange={(e) => updateRow(row.id, 'unit', e.target.value.toUpperCase())} className="w-20 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td>{(['costPrice','sellingPrice','stock','reorderLevel','taxRate'] as const).map((field) => <td className="p-2" key={field}><input type="number" min="0" step="0.01" value={row[field]} onChange={(e) => updateRow(row.id, field, Number(e.target.value))} className="w-24 p-2 rounded-lg bg-slate-950 border border-slate-800 text-white" /></td>)}<td className="p-2"><button onClick={() => removeRow(row.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></td></tr>; })}</tbody></table></div>}
        {errors.length > 0 && <div className="mx-5 mb-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 max-h-28 overflow-auto"><p className="text-[11px] font-black text-rose-300 mb-1">Validation</p>{errors.slice(0, 20).map((error) => <p key={error} className="text-[11px] text-rose-300">• {error}</p>)}</div>}
        <div className="px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="text-xs text-slate-400">{message || 'Download the template, fill the products, upload the CSV, review the rows and save.'}</div><div className="flex gap-2">{mode === 'ENTRY' && <button disabled={rows.length >= MAX_BATCH} onClick={addRows} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold disabled:opacity-40"><Plus className="inline w-4 h-4 mr-1" /> Add 10 Rows</button>}<button disabled={saving || validRows.length === 0} onClick={save} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40"><CheckCircle2 className="inline w-4 h-4 mr-1" /> {saving ? 'Saving...' : `Save Batch (${validRows.length})`}</button></div></div>
      </div>
    </div>
  );
};