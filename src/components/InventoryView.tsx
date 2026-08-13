import React, { useState, useMemo } from 'react';
import { Product, StockAdjustment, UserRole } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { TileBatchAddModal } from './TileBatchAddModal';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Edit,
  History,
  TrendingUp,
  Boxes,
  DollarSign,
  Tag,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Ruler,
  Layers,
  Sparkles
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onStockAdjustment: (adjustment: StockAdjustment) => void;
  stockLogs: StockAdjustment[];
  userRole: UserRole;
  currencySymbol: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onSaveProduct,
  onStockAdjustment,
  stockLogs,
  userRole,
  currencySymbol
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modals
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  // Stock Adjustment Form
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'RESTOCK' | 'DAMAGE' | 'LOSS' | 'AUDIT_CORRECTION'>('RESTOCK');
  const [adjustReason, setAdjustReason] = useState('');

  // Extract Categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['ALL', ...cats];
  }, [products]);

  // Financial & Tile Metrics of Inventory
  const metrics = useMemo(() => {
    const totalCostValue = products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
    const totalRetailValue = products.reduce((acc, p) => acc + p.sellingPrice * p.stock, 0);
    const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;

    // Tile total square footage in warehouse stock
    const totalTileSqFtInStock = products.reduce((acc, p) => {
      const sqft = p.sqftPerBox || 15.5;
      return acc + sqft * p.stock;
    }, 0);

    return {
      totalCostValue,
      totalRetailValue,
      potentialProfit: totalRetailValue - totalCostValue,
      lowStockCount,
      totalSkus: products.length,
      totalTileSqFtInStock
    };
  }, [products]);

  const handleBatchSaveProducts = (newProducts: Product[]) => {
    newProducts.forEach((prod) => onSaveProduct(prod));
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.category.toLowerCase().includes(term) ||
        (p.tileFinish && p.tileFinish.toLowerCase().includes(term)) ||
        (p.tileDimensions && p.tileDimensions.toLowerCase().includes(term));

      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'LOW_STOCK') {
        matchesStock = p.stock > 0 && p.stock <= p.reorderLevel;
      } else if (stockFilter === 'OUT_OF_STOCK') {
        matchesStock = p.stock <= 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  const handleStockAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const qtyChange = adjustType === 'RESTOCK' ? adjustQty : -adjustQty;

    const adjustment: StockAdjustment = {
      id: generateId('stk'),
      productId: adjustingProduct.id,
      productName: adjustingProduct.name,
      quantityChange: qtyChange,
      type: adjustType,
      reason: adjustReason || `${adjustType} recorded`,
      performedBy: userRole,
      date: new Date().toISOString()
    };

    onStockAdjustment(adjustment);

    // Save updated product
    const newStock = Math.max(0, adjustingProduct.stock + qtyChange);
    onSaveProduct({
      ...adjustingProduct,
      stock: newStock,
      updatedAt: new Date().toISOString()
    });

    setAdjustingProduct(null);
    setAdjustReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Inventory Financial Valuation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400">Total Catalog Items</span>
          <p className="text-2xl font-black text-white">{metrics.totalSkus} SKUs</p>
          <p className="text-[11px] text-indigo-400">Products &amp; Tile Catalog</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400">Warehouse Tile Coverage</span>
          <p className="text-2xl font-black text-indigo-400">{metrics.totalTileSqFtInStock.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-sm font-bold">Sq.Ft</span></p>
          <p className="text-[11px] text-slate-400">Total area ready in stock</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400">Stock Cost Valuation</span>
          <p className="text-xl font-black text-white">{formatCurrency(metrics.totalCostValue, currencySymbol)}</p>
          <p className="text-[11px] text-slate-400">At wholesale cost price</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400">Retail Potential</span>
          <p className="text-xl font-black text-emerald-400">{formatCurrency(metrics.totalRetailValue, currencySymbol)}</p>
          <p className="text-[11px] text-emerald-500/80">Est. Profit: {formatCurrency(metrics.potentialProfit, currencySymbol)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs font-semibold text-slate-400">Low Stock Alerts</span>
          <p className="text-2xl font-black text-amber-400">{metrics.lowStockCount} Items</p>
          <p className="text-[11px] text-amber-500/80">Below reorder threshold</p>
        </div>
      </div>

      {/* Control Bar: Search, Category & Stock Filter */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, SKU, or category..."
              className="w-full pl-10 pr-9 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="LOW_STOCK">Low Stock Only</option>
              <option value="OUT_OF_STOCK">Out of Stock Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-200" />
            <span>Regular Multi-Item / CSV Entry</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct({
                id: generateId('prod'),
                sku: `TL-${Math.floor(100 + Math.random() * 900)}`,
                barcode: `8901234${Math.floor(10000 + Math.random() * 90000)}`,
                name: '',
                category: 'Vitrified Floor Tiles',
                costPrice: 400.0,
                sellingPrice: 650.0,
                stock: 50,
                reorderLevel: 15,
                taxRate: 18,
                unit: 'box',
                tileDimensions: '600x600 mm (2x2 ft)',
                pcsPerBox: 4,
                sqftPerBox: 15.5,
                tileFinish: 'High Gloss Polish',
                batchNo: `LOT-${new Date().getFullYear()}-A1`,
                updatedAt: new Date().toISOString()
              });
              setIsAddModalOpen(true);
            }}
            className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Tile Item</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Item & Category</th>
                <th className="p-4">SKU / Barcode</th>
                <th className="p-4">Cost Price</th>
                <th className="p-4">Selling Price</th>
                <th className="p-4">Stock Level</th>
                <th className="p-4">Margin %</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredProducts.map((p) => {
                const marginPercent = Math.round(((p.sellingPrice - p.costPrice) / (p.sellingPrice || 1)) * 100);
                const isLowStock = p.stock <= p.reorderLevel;

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={p.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150&auto=format&fit=crop&q=80'}
                          alt={p.name}
                          className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700"
                        />
                        <div>
                          <p className="font-bold text-slate-100">{p.name}</p>
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            {p.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-mono text-slate-300">
                      <div>{p.sku}</div>
                      <div className="text-[10px] text-slate-500">{p.barcode}</div>
                    </td>

                    <td className="p-4 font-medium text-slate-300">
                      {formatCurrency(p.costPrice, currencySymbol)}
                    </td>

                    <td className="p-4 font-extrabold text-white">
                      {formatCurrency(p.sellingPrice, currencySymbol)}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-sm ${isLowStock ? 'text-amber-400' : 'text-slate-100'}`}>
                          {p.stock} {p.unit}
                        </span>
                        {isLowStock && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" title="Low Stock Alert" />
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        +{marginPercent}%
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setAdjustingProduct(p);
                            setAdjustQty(10);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition"
                          title="Stock Adjustment / Restock"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setIsAddModalOpen(true);
                          }}
                          className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[11px] font-semibold transition"
                          title="Edit Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Product Modal */}
      {isAddModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {editingProduct.id ? 'Edit Product Details' : 'Add New Inventory Item'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveProduct(editingProduct);
                setIsAddModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.costPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Selling Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Current Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Reorder Alert Threshold</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.reorderLevel}
                    onChange={(e) => setEditingProduct({ ...editingProduct, reorderLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                {/* Tile Specifications */}
                <div>
                  <label className="block text-slate-300 mb-1">Tile Size / Dimensions</label>
                  <input
                    type="text"
                    placeholder="e.g. 600x600 mm (2x2 ft)"
                    value={editingProduct.tileDimensions || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, tileDimensions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Pcs Per Box</label>
                  <input
                    type="number"
                    value={editingProduct.pcsPerBox || 4}
                    onChange={(e) => setEditingProduct({ ...editingProduct, pcsPerBox: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Sq.Ft Per Box</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.sqftPerBox || 15.5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sqftPerBox: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-indigo-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Tile Surface Finish</label>
                  <input
                    type="text"
                    placeholder="e.g. High Gloss Polish, Silk Matt"
                    value={editingProduct.tileFinish || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, tileFinish: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Tile Batch / Lot No.</label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-2026-A1"
                    value={editingProduct.batchNo || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, batchNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tile Batch Add Modal */}
      <TileBatchAddModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onBatchSaveProducts={handleBatchSaveProducts}
        currencySymbol={currencySymbol}
      />

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-base text-white">
              Stock Adjustment for {adjustingProduct.name}
            </h3>
            <form onSubmit={handleStockAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Adjustment Action</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="RESTOCK">Restock (+) Increase</option>
                  <option value="DAMAGE">Damage (-) Decrease</option>
                  <option value="LOSS">Shrinkage/Loss (-) Decrease</option>
                  <option value="AUDIT_CORRECTION">Audit Correction (+/-)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Quantity Units</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Received shipment from TechSource"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow"
                >
                  Apply Stock Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
