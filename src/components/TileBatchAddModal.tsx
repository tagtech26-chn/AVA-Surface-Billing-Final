import React, { useState } from 'react';
import { Product } from '../types';
import { generateId } from '../lib/utils';
import {
  X,
  Plus,
  Trash2,
  FileSpreadsheet,
  Grid,
  Layers,
  Download,
  Upload,
  CheckCircle2,
  Sparkles,
  Calculator,
  Boxes
} from 'lucide-react';

interface TileBatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchSaveProducts: (products: Product[]) => void;
  currencySymbol: string;
}

interface BatchItemRow {
  id: string;
  name: string;
  category: string;
  tileDimensions: string;
  pcsPerBox: number;
  sqftPerBox: number;
  tileFinish: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  batchNo: string;
  reorderLevel: number;
}

const COMMON_DIMENSIONS = [
  { label: '600x600 mm (2x2 ft)', pcs: 4, sqft: 15.5 },
  { label: '1200x600 mm (4x2 ft)', pcs: 2, sqft: 15.5 },
  { label: '800x1600 mm (2.6x5.2 ft)', pcs: 2, sqft: 27.56 },
  { label: '300x600 mm (1x2 ft)', pcs: 8, sqft: 15.5 },
  { label: '300x450 mm (1x1.5 ft)', pcs: 8, sqft: 11.62 },
  { label: '400x400 mm (1.3x1.3 ft)', pcs: 6, sqft: 10.33 },
  { label: '200x1200 mm (Wood Plank)', pcs: 6, sqft: 15.5 },
  { label: 'Chemical / Adhesive Bag', pcs: 1, sqft: 50.0 }
];

const FINISH_OPTIONS = [
  'High Gloss Polish',
  'Silk Matt / Satin',
  'Carving Metallic',
  'Sugar Finish',
  'Rustic Anti-Skid',
  'Glazed Ceramic'
];

const CATEGORY_OPTIONS = [
  'Vitrified Floor Tiles',
  'GVT / PGVT Slabs',
  'Ceramic Wall Tiles',
  'Outdoor & Parking',
  'Wood Plank Tiles',
  'Adhesives & Chemicals'
];

export const TileBatchAddModal: React.FC<TileBatchAddModalProps> = ({
  isOpen,
  onClose,
  onBatchSaveProducts,
  currencySymbol
}) => {
  const [activeTab, setActiveTab] = useState<'GRID' | 'GENERATOR' | 'CSV'>('GRID');

  // TAB 1: Grid Batch Items
  const createEmptyRow = (): BatchItemRow => ({
    id: generateId('temp'),
    name: '',
    category: 'Vitrified Floor Tiles',
    tileDimensions: '600x600 mm (2x2 ft)',
    pcsPerBox: 4,
    sqftPerBox: 15.5,
    tileFinish: 'High Gloss Polish',
    costPrice: 400,
    sellingPrice: 650,
    stock: 50,
    batchNo: `LOT-${new Date().getFullYear()}-A1`,
    reorderLevel: 15
  });

  const [batchRows, setBatchRows] = useState<BatchItemRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow()
  ]);

  // TAB 2: Series Generator
  const [seriesName, setSeriesName] = useState('Royal Statuario Marble');
  const [selectedCategory, setSelectedCategory] = useState('Vitrified Floor Tiles');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['600x600 mm (2x2 ft)', '1200x600 mm (4x2 ft)']);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>(['High Gloss Polish', 'Silk Matt / Satin']);
  const [baseCostPrice, setBaseCostPrice] = useState<number>(450);
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(700);
  const [initialStockBoxes, setInitialStockBoxes] = useState<number>(60);
  const [generatedPreview, setGeneratedPreview] = useState<BatchItemRow[]>([]);

  // TAB 3: CSV Bulk Paste
  const [csvText, setCsvText] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<BatchItemRow[]>([]);
  const [csvError, setCsvError] = useState('');

  if (!isOpen) return null;

  // Handlers for Grid
  const handleUpdateRow = (id: string, field: keyof BatchItemRow, value: any) => {
    setBatchRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };

          // Auto update pcs and sqft if dimension changed
          if (field === 'tileDimensions') {
            const found = COMMON_DIMENSIONS.find((d) => d.label === value);
            if (found) {
              updated.pcsPerBox = found.pcs;
              updated.sqftPerBox = found.sqft;
            }
          }
          return updated;
        }
        return row;
      })
    );
  };

  const handleAddMoreRows = (count: number = 3) => {
    const newRows: BatchItemRow[] = Array.from({ length: count }, () => createEmptyRow());
    setBatchRows((prev) => [...prev, ...newRows]);
  };

  const handleRemoveRow = (id: string) => {
    if (batchRows.length <= 1) return;
    setBatchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveGridItems = () => {
    const validRows = batchRows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('Please enter at least 1 valid tile item name');
      return;
    }

    const newProducts: Product[] = validRows.map((r, idx) => {
      const sku = `TL-${r.category.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const priceSqFt = r.sqftPerBox > 0 ? parseFloat((r.sellingPrice / r.sqftPerBox).toFixed(2)) : 0;

      return {
        id: generateId('prod'),
        sku,
        barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: r.name,
        category: r.category,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        stock: r.stock,
        reorderLevel: r.reorderLevel,
        taxRate: 18,
        unit: 'box',
        description: `${r.tileDimensions} ${r.tileFinish} Tile. ${r.pcsPerBox} Pcs/Box (${r.sqftPerBox} Sq.Ft/Box).`,
        imageUrl: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=300&auto=format&fit=crop&q=80',
        updatedAt: new Date().toISOString(),
        tileDimensions: r.tileDimensions,
        pcsPerBox: r.pcsPerBox,
        sqftPerBox: r.sqftPerBox,
        tileFinish: r.tileFinish,
        tileType: r.category,
        batchNo: r.batchNo || `LOT-${new Date().getFullYear()}`,
        pricePerSqFt: priceSqFt,
        weightPerBoxKg: Math.round(r.sqftPerBox * 1.8)
      };
    });

    onBatchSaveProducts(newProducts);
    onClose();
  };

  // Handlers for Series Generator
  const handleGenerateSeriesVariants = () => {
    if (!seriesName.trim()) return;

    const generated: BatchItemRow[] = [];
    selectedSizes.forEach((dim) => {
      const dimObj = COMMON_DIMENSIONS.find((d) => d.label === dim) || { pcs: 4, sqft: 15.5 };
      selectedFinishes.forEach((finish) => {
        const shortSize = dim.split(' ')[0];
        const shortFinish = finish.split(' ')[0];
        generated.push({
          id: generateId('gen'),
          name: `${seriesName} ${shortFinish} (${shortSize})`,
          category: selectedCategory,
          tileDimensions: dim,
          pcsPerBox: dimObj.pcs,
          sqftPerBox: dimObj.sqft,
          tileFinish: finish,
          costPrice: baseCostPrice,
          sellingPrice: baseSellingPrice,
          stock: initialStockBoxes,
          batchNo: `LOT-${new Date().getFullYear()}-GEN`,
          reorderLevel: 15
        });
      });
    });

    setGeneratedPreview(generated);
  };

  const handleSaveGeneratedSeries = () => {
    if (generatedPreview.length === 0) return;

    const newProducts: Product[] = generatedPreview.map((r) => {
      const sku = `TL-GEN-${Math.floor(1000 + Math.random() * 9000)}`;
      const priceSqFt = r.sqftPerBox > 0 ? parseFloat((r.sellingPrice / r.sqftPerBox).toFixed(2)) : 0;

      return {
        id: generateId('prod'),
        sku,
        barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: r.name,
        category: r.category,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        stock: r.stock,
        reorderLevel: r.reorderLevel,
        taxRate: 18,
        unit: 'box',
        description: `${r.tileDimensions} ${r.tileFinish} Series Tile. ${r.pcsPerBox} Pcs/Box (${r.sqftPerBox} Sq.Ft/Box).`,
        imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
        updatedAt: new Date().toISOString(),
        tileDimensions: r.tileDimensions,
        pcsPerBox: r.pcsPerBox,
        sqftPerBox: r.sqftPerBox,
        tileFinish: r.tileFinish,
        tileType: r.category,
        batchNo: r.batchNo,
        pricePerSqFt: priceSqFt,
        weightPerBoxKg: Math.round(r.sqftPerBox * 1.8)
      };
    });

    onBatchSaveProducts(newProducts);
    onClose();
  };

  // Handlers for CSV Import
  const handleParseCsv = () => {
    setCsvError('');
    if (!csvText.trim()) {
      setCsvError('Please paste CSV text or data');
      return;
    }

    try {
      const lines = csvText.trim().split('\n');
      const parsed: BatchItemRow[] = [];

      lines.forEach((line, index) => {
        // Skip header if line contains 'Name' or 'SKU'
        if (index === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('category'))) {
          return;
        }

        const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 3 && cols[0].length > 0) {
          const name = cols[0];
          const category = cols[1] || 'Vitrified Floor Tiles';
          const dims = cols[2] || '600x600 mm (2x2 ft)';
          const pcs = parseInt(cols[3]) || 4;
          const sqft = parseFloat(cols[4]) || 15.5;
          const finish = cols[5] || 'High Gloss Polish';
          const cost = parseFloat(cols[6]) || 400;
          const price = parseFloat(cols[7]) || 650;
          const stock = parseInt(cols[8]) || 50;
          const batch = cols[9] || 'LOT-2026-IMP';

          parsed.push({
            id: generateId('csv'),
            name,
            category,
            tileDimensions: dims,
            pcsPerBox: pcs,
            sqftPerBox: sqft,
            tileFinish: finish,
            costPrice: cost,
            sellingPrice: price,
            stock,
            batchNo: batch,
            reorderLevel: 15
          });
        }
      });

      if (parsed.length === 0) {
        setCsvError('No valid tile rows could be parsed. Check comma formatting.');
      } else {
        setCsvPreviewRows(parsed);
      }
    } catch (err) {
      setCsvError('Failed to parse CSV string');
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent =
      'Name,Category,Dimensions,PcsPerBox,SqftPerBox,Finish,CostPrice,SellingPrice,StockBoxes,BatchNo\n' +
      'Royal Statuario Gold,Vitrified Floor Tiles,600x600 mm (2x2 ft),4,15.50,High Gloss Polish,420,680,100,LOT-2026-T1\n' +
      'Armani Silk Grey,GVT / PGVT Slabs,1200x600 mm (4x2 ft),2,15.50,Silk Matt / Satin,800,1250,60,LOT-2026-T2\n' +
      'Beveled White Subway,Ceramic Wall Tiles,300x600 mm (1x2 ft),8,15.50,High Gloss Glazed,260,410,120,LOT-2026-W1';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Tile_Catalog_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveCsvItems = () => {
    if (csvPreviewRows.length === 0) return;

    const newProducts: Product[] = csvPreviewRows.map((r) => {
      const sku = `TL-CSV-${Math.floor(1000 + Math.random() * 9000)}`;
      const priceSqFt = r.sqftPerBox > 0 ? parseFloat((r.sellingPrice / r.sqftPerBox).toFixed(2)) : 0;

      return {
        id: generateId('prod'),
        sku,
        barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: r.name,
        category: r.category,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        stock: r.stock,
        reorderLevel: r.reorderLevel,
        taxRate: 18,
        unit: 'box',
        description: `${r.tileDimensions} ${r.tileFinish} Imported Tile. ${r.pcsPerBox} Pcs/Box (${r.sqftPerBox} Sq.Ft/Box).`,
        imageUrl: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=300&auto=format&fit=crop&q=80',
        updatedAt: new Date().toISOString(),
        tileDimensions: r.tileDimensions,
        pcsPerBox: r.pcsPerBox,
        sqftPerBox: r.sqftPerBox,
        tileFinish: r.tileFinish,
        tileType: r.category,
        batchNo: r.batchNo,
        pricePerSqFt: priceSqFt,
        weightPerBoxKg: Math.round(r.sqftPerBox * 1.8)
      };
    });

    onBatchSaveProducts(newProducts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Regular Bulk Tile Entry & Import Hub</h2>
              <p className="text-xs text-slate-400">
                Streamlined multi-item batch entry, series generator, and Excel CSV bulk import tailored for Tiles companies.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-800 flex space-x-2 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('GRID')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 transition border-b-2 ${
              activeTab === 'GRID'
                ? 'bg-slate-900 text-indigo-400 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Multi-Row Batch Grid</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px]">{batchRows.length} rows</span>
          </button>

          <button
            onClick={() => setActiveTab('GENERATOR')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 transition border-b-2 ${
              activeTab === 'GENERATOR'
                ? 'bg-slate-900 text-indigo-400 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Tile Series Variant Generator</span>
          </button>

          <button
            onClick={() => setActiveTab('CSV')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 transition border-b-2 ${
              activeTab === 'CSV'
                ? 'bg-slate-900 text-indigo-400 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / CSV Bulk Import</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: MULTI-ROW BATCH GRID */}
          {activeTab === 'GRID' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Fill tile dimensions, finishes, box coverage sqft & prices across multiple rows simultaneously:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAddMoreRows(3)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add +3 Rows</span>
                  </button>
                  <button
                    onClick={() => handleAddMoreRows(5)}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-semibold rounded-xl flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add +5 Rows</span>
                  </button>
                </div>
              </div>

              {/* Batch Entry Table */}
              <div className="border border-slate-800 rounded-2xl overflow-x-auto bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3 w-48">Tile Item Name</th>
                      <th className="p-3 w-36">Category</th>
                      <th className="p-3 w-44">Dimensions (Size)</th>
                      <th className="p-3 w-20">Pcs/Box</th>
                      <th className="p-3 w-24">Sq.Ft/Box</th>
                      <th className="p-3 w-36">Finish</th>
                      <th className="p-3 w-24">Cost / Box</th>
                      <th className="p-3 w-24">Price / Box</th>
                      <th className="p-3 w-20">Stock (Box)</th>
                      <th className="p-3 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {batchRows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-slate-900/60 transition">
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                            placeholder={`Tile Item ${index + 1}`}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>

                        <td className="p-2">
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-[11px]"
                          >
                            {CATEGORY_OPTIONS.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <select
                            value={row.tileDimensions}
                            onChange={(e) => handleUpdateRow(row.id, 'tileDimensions', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-[11px]"
                          >
                            {COMMON_DIMENSIONS.map((d) => (
                              <option key={d.label} value={d.label}>{d.label}</option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            value={row.pcsPerBox}
                            onChange={(e) => handleUpdateRow(row.id, 'pcsPerBox', parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-mono text-center"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.sqftPerBox}
                            onChange={(e) => handleUpdateRow(row.id, 'sqftPerBox', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-indigo-300 font-bold text-center"
                          />
                        </td>

                        <td className="p-2">
                          <select
                            value={row.tileFinish}
                            onChange={(e) => handleUpdateRow(row.id, 'tileFinish', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-[11px]"
                          >
                            {FINISH_OPTIONS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            value={row.costPrice}
                            onChange={(e) => handleUpdateRow(row.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-300"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            value={row.sellingPrice}
                            onChange={(e) => handleUpdateRow(row.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-emerald-400 font-bold"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            value={row.stock}
                            onChange={(e) => handleUpdateRow(row.id, 'stock', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white font-bold text-center"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  Ready to batch save {batchRows.filter((r) => r.name.trim().length > 0).length} valid tile products to inventory catalog.
                </span>

                <button
                  onClick={handleSaveGridItems}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Batch Items to Inventory</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TILE SERIES VARIANT GENERATOR */}
          {activeTab === 'GENERATOR' && (
            <div className="space-y-5">
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-1">
                <h4 className="font-bold text-sm text-indigo-300 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Auto-Generate Complete Tile Series Across Sizes &amp; Finishes</span>
                </h4>
                <p className="text-xs text-slate-400">
                  When receiving a new design series (e.g., "Calacatta Gold Marble"), automatically generate SKUs across 600x600, 1200x600, 800x1600 sizes and High Gloss / Matt finishes in 1 click!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Tile Series Base Name</label>
                  <input
                    type="text"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    placeholder="e.g. Royal Statuario Marble"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Tile Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Size Checkboxes */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-slate-300 font-bold">Select Target Tile Dimensions (Sizes)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_DIMENSIONS.map((dim) => {
                      const isChecked = selectedSizes.includes(dim.label);
                      return (
                        <button
                          key={dim.label}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedSizes(selectedSizes.filter((s) => s !== dim.label));
                            } else {
                              setSelectedSizes([...selectedSizes, dim.label]);
                            }
                          }}
                          className={`p-2 rounded-xl text-xs font-semibold text-left border transition flex items-center justify-between ${
                            isChecked
                              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{dim.label}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-1">({dim.sqft} sqft)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Finish Checkboxes */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-slate-300 font-bold">Select Surface Finishes</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FINISH_OPTIONS.map((finish) => {
                      const isChecked = selectedFinishes.includes(finish);
                      return (
                        <button
                          key={finish}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedFinishes(selectedFinishes.filter((f) => f !== finish));
                            } else {
                              setSelectedFinishes([...selectedFinishes, finish]);
                            }
                          }}
                          className={`p-2 rounded-xl text-xs font-semibold text-left border transition ${
                            isChecked
                              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {finish}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Base Cost Price / Box ({currencySymbol})</label>
                  <input
                    type="number"
                    value={baseCostPrice}
                    onChange={(e) => setBaseCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Base Selling Price / Box ({currencySymbol})</label>
                  <input
                    type="number"
                    value={baseSellingPrice}
                    onChange={(e) => setBaseSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-indigo-300"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleGenerateSeriesVariants}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Preview Generated {selectedSizes.length * selectedFinishes.length} SKUs</span>
                </button>
              </div>

              {/* Preview Grid */}
              {generatedPreview.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <h4 className="font-bold text-xs text-slate-300">
                    Generated Series Preview ({generatedPreview.length} Tile Variants):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {generatedPreview.map((item) => (
                      <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <p className="font-bold text-white text-xs">{item.name}</p>
                        <p className="text-[11px] text-slate-400">{item.tileDimensions} • {item.tileFinish}</p>
                        <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
                          <span className="text-slate-400">{item.pcsPerBox} pcs ({item.sqftPerBox} sqft)</span>
                          <span className="font-extrabold text-emerald-400">{currencySymbol}{item.sellingPrice} / box</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleSaveGeneratedSeries}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save All {generatedPreview.length} Series SKUs to Inventory</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CSV BULK IMPORT */}
          {activeTab === 'CSV' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-white">Import Tiles Catalog from Excel or CSV</h4>
                  <p className="text-slate-400 text-[11px]">
                    Paste comma-separated rows or download our pre-structured Tile Import Template.
                  </p>
                </div>

                <button
                  onClick={handleDownloadCsvTemplate}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold rounded-xl flex items-center space-x-1.5 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Sample Tile CSV Template</span>
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Paste Comma-Separated CSV Data (Header: Name, Category, Dimensions, PcsPerBox, SqftPerBox, Finish, CostPrice, SellingPrice, StockBoxes, BatchNo):
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Royal Statuario Gold, Vitrified Floor Tiles, 600x600 mm (2x2 ft), 4, 15.50, High Gloss Polish, 420, 680, 100, LOT-2026-T1\nArmani Silk Grey, GVT / PGVT Slabs, 1200x600 mm (4x2 ft), 2, 15.50, Silk Matt / Satin, 800, 1250, 60, LOT-2026-T2`}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {csvError && <p className="text-rose-400 text-xs font-semibold">{csvError}</p>}

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleParseCsv}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Parse CSV &amp; Preview Items</span>
                </button>
              </div>

              {/* CSV Preview */}
              {csvPreviewRows.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <h4 className="font-bold text-xs text-white">
                    Parsed CSV Items Preview ({csvPreviewRows.length} Tile Items):
                  </h4>

                  <div className="border border-slate-800 rounded-2xl overflow-x-auto max-h-48">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="p-2">Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Dimensions</th>
                          <th className="p-2">Coverage (Pcs/SqFt)</th>
                          <th className="p-2">Finish</th>
                          <th className="p-2">Cost / Price</th>
                          <th className="p-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {csvPreviewRows.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-900/60">
                            <td className="p-2 font-bold text-white">{r.name}</td>
                            <td className="p-2 text-slate-300">{r.category}</td>
                            <td className="p-2 text-slate-300">{r.tileDimensions}</td>
                            <td className="p-2 text-slate-300">{r.pcsPerBox} pcs / {r.sqftPerBox} sqft</td>
                            <td className="p-2 text-slate-300">{r.tileFinish}</td>
                            <td className="p-2 font-bold text-emerald-400">{currencySymbol}{r.costPrice} / {currencySymbol}{r.sellingPrice}</td>
                            <td className="p-2 font-bold text-white">{r.stock} boxes</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveCsvItems}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm &amp; Import All {csvPreviewRows.length} Tile Items</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
