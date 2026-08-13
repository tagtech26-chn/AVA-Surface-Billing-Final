import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { formatCurrency } from '../lib/utils';
import {
  X,
  Calculator,
  Ruler,
  CheckCircle2,
  Boxes,
  Plus,
  Scale
} from 'lucide-react';

interface TileAreaCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCartWithBoxes?: (product: Product, boxCount: number) => void;
  currencySymbol: string;
}

export const TileAreaCalculatorModal: React.FC<TileAreaCalculatorModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCartWithBoxes,
  currencySymbol
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(() => products[0]?.id || '');

  // Calculation Inputs
  const [calcMode, setCalcMode] = useState<'DIMENSIONS' | 'SQFT'>('DIMENSIONS');
  const [roomLengthFt, setRoomLengthFt] = useState<number>(15);
  const [roomWidthFt, setRoomWidthFt] = useState<number>(12);
  const [directSqFt, setDirectSqFt] = useState<number>(180);
  const [wastagePercent, setWastagePercent] = useState<number>(10); // 10% standard wastage allowance

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  const sqftPerBox = selectedProduct?.sqftPerBox || 15.5;

  // Area Calculations
  const rawSqFt = useMemo(() => {
    if (calcMode === 'DIMENSIONS') {
      return (roomLengthFt || 0) * (roomWidthFt || 0);
    }
    return directSqFt || 0;
  }, [calcMode, roomLengthFt, roomWidthFt, directSqFt]);

  const totalSqFtWithWastage = useMemo(() => {
    return rawSqFt + (rawSqFt * (wastagePercent || 0)) / 100;
  }, [rawSqFt, wastagePercent]);

  const boxesRequired = useMemo(() => {
    if (!sqftPerBox || sqftPerBox <= 0) return 0;
    return Math.ceil(totalSqFtWithWastage / sqftPerBox);
  }, [totalSqFtWithWastage, sqftPerBox]);

  const actualDeliveredSqFt = useMemo(() => {
    return boxesRequired * sqftPerBox;
  }, [boxesRequired, sqftPerBox]);

  const totalEstimatedCost = useMemo(() => {
    if (!selectedProduct) return 0;
    return boxesRequired * selectedProduct.sellingPrice;
  }, [boxesRequired, selectedProduct]);

  const totalWeightKg = useMemo(() => {
    if (!selectedProduct) return 0;
    const weightPerBox = selectedProduct.weightPerBoxKg || Math.round(sqftPerBox * 1.8);
    return boxesRequired * weightPerBox;
  }, [boxesRequired, selectedProduct, sqftPerBox]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Tile Area &amp; Box Coverage Calculator</h3>
              <p className="text-xs text-slate-400">
                Convert room square footage to exact box requirements with wastage allowance.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">Select Tile Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 me-1 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.tileDimensions || 'Standard'} • {p.sqftPerBox || 15.5} sqft/box) — {formatCurrency(p.sellingPrice, currencySymbol)}/box
              </option>
            ))}
          </select>
        </div>

        {/* Mode Switcher: Dimensions vs Total Sq.Ft */}
        <div className="space-y-3">
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setCalcMode('DIMENSIONS')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                calcMode === 'DIMENSIONS'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Room Dimensions (Length × Width)
            </button>
            <button
              onClick={() => setCalcMode('SQFT')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                calcMode === 'SQFT'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Direct Total Square Feet
            </button>
          </div>

          {calcMode === 'DIMENSIONS' ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Room Length (Feet)</label>
                <input
                  type="number"
                  min="1"
                  value={roomLengthFt}
                  onChange={(e) => setRoomLengthFt(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Room Width (Feet)</label>
                <input
                  type="number"
                  min="1"
                  value={roomWidthFt}
                  onChange={(e) => setRoomWidthFt(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="text-xs">
              <label className="block text-slate-400 mb-1">Target Square Feet Required</label>
              <input
                type="number"
                min="1"
                value={directSqFt}
                onChange={(e) => setDirectSqFt(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
            </div>
          )}

          {/* Wastage Allowance */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <label className="font-medium">Wastage Allowance (Cutting &amp; Corner Extra %)</label>
              <span className="font-bold text-amber-400">{wastagePercent}% Extra</span>
            </div>
            <div className="flex space-x-2">
              {[5, 8, 10, 12, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setWastagePercent(pct)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    wastagePercent === pct
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Calculation Result Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Net Area</span>
              <span className="text-sm font-extrabold text-white">{rawSqFt.toFixed(1)} sq ft</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">With +{wastagePercent}% Wastage</span>
              <span className="text-sm font-extrabold text-amber-400">{totalSqFtWithWastage.toFixed(1)} sq ft</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Boxes Needed</span>
              <span className="text-lg font-black text-indigo-400">{boxesRequired} Boxes</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Delivered Area</span>
              <span className="text-sm font-extrabold text-emerald-400">{actualDeliveredSqFt.toFixed(1)} sq ft</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400 flex items-center space-x-1">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>Est. Freight Weight: <strong className="text-slate-200">{totalWeightKg} kg</strong></span>
            </span>

            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Total Bill Amount:</span>
              <span className="text-lg font-black text-white">{formatCurrency(totalEstimatedCost, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
          >
            Close
          </button>

          {onAddToCartWithBoxes && selectedProduct && (
            <button
              type="button"
              onClick={() => {
                onAddToCartWithBoxes(selectedProduct, boxesRequired);
                onClose();
              }}
              disabled={boxesRequired <= 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add {boxesRequired} Boxes ({actualDeliveredSqFt.toFixed(1)} sq ft) to POS Bill</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
