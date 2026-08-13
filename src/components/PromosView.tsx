import React, { useState } from 'react';
import { PromoRule, DiscountType } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import {
  Tag,
  Plus,
  Sparkles,
  Percent,
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  ShoppingBag,
  Gift,
  X,
  Bot
} from 'lucide-react';

interface PromosViewProps {
  promos: PromoRule[];
  onSavePromo: (promo: PromoRule) => void;
  onTogglePromoActive: (promoId: string) => void;
  currencySymbol: string;
}

export const PromosView: React.FC<PromosViewProps> = ({
  promos,
  onSavePromo,
  onTogglePromoActive,
  currencySymbol
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // New Promo Form State
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(15);
  const [minOrderValue, setMinOrderValue] = useState<number>(50);
  const [autoApply, setAutoApply] = useState(false);

  // AI Generated Output State
  const [aiOutput, setAiOutput] = useState<any>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;

    const newPromo: PromoRule = {
      id: generateId('promo'),
      code: code.trim().toUpperCase(),
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: '2026-12-31',
      isActive: true,
      autoApply,
      usageCount: 0
    };

    onSavePromo(newPromo);
    setIsAddModalOpen(false);

    // Reset Form
    setCode('');
    setTitle('');
    setDescription('');
  };

  const handleGenerateAiPromo = async () => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'promo_generator' })
      });

      const data = await response.json();
      setAiOutput(data);

      if (data.promoCode) {
        setCode(data.promoCode || 'FESTIVE15');
        setTitle(data.title || 'Festive Season Special');
        setDescription(data.marketingCopy || data.description || 'Special storewide discount');
        setDiscountValue(15);
        setMinOrderValue(data.recommendedMinSpend || 50);
      }
    } catch (err) {
      console.error('Error generating AI promo:', err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Promo Engine Controls */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Tag className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-black text-white">Discounts & Special Promo Engine</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure automated checkout discounts, promotional coupon codes, percentage rules, and AI-generated marketing copy campaigns.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setIsAiGeneratorOpen(true);
              handleGenerateAiPromo();
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-2xl flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate AI Promo Campaign</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promo Rule</span>
          </button>
        </div>
      </div>

      {/* Promos Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promos.map((p) => {
          return (
            <div
              key={p.id}
              className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-4 ${
                p.isActive
                  ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 shadow-lg'
                  : 'bg-slate-900/40 border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-black text-white bg-indigo-600/30 text-indigo-300 px-3 py-1 rounded-xl border border-indigo-500/40 tracking-wider">
                    {p.code}
                  </span>

                  <button
                    onClick={() => onTogglePromoActive(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                      p.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <h3 className="font-bold text-sm text-white">{p.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Discount Value:</span>
                  <span className="font-extrabold text-indigo-400">
                    {p.discountType === 'PERCENTAGE'
                      ? `${p.discountValue}% OFF`
                      : `${formatCurrency(p.discountValue, currencySymbol)} FLAT OFF`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Min Order Spend:</span>
                  <span className="font-semibold text-slate-200">
                    {formatCurrency(p.minOrderValue, currencySymbol)}
                  </span>
                </div>

                {p.autoApply && (
                  <div className="flex items-center space-x-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Auto-applies at POS checkout</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Usage: {p.usageCount} times</span>
                  <span>Valid until {p.validUntil}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Promo Generator Modal */}
      {isAiGeneratorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">AI Smart Promo Copy Generator</h3>
              </div>
              <button onClick={() => setIsAiGeneratorOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-12 text-center space-y-3">
                <Bot className="w-10 h-10 text-amber-400 animate-bounce mx-auto" />
                <p className="text-xs text-slate-300">Gemini AI is crafting a high-conversion marketing campaign...</p>
              </div>
            ) : aiOutput ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg">
                      {aiOutput.promoCode || code}
                    </span>
                    <span className="text-[10px] text-amber-400/80">AI Recommended</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{aiOutput.title}</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">{aiOutput.marketingCopy || aiOutput.description}</p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => {
                      setIsAiGeneratorOpen(false);
                      setIsAddModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs"
                  >
                    Use This Promo Setup
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Manual Create Promo Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Create Promo Code Rule</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Promo Code Name</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER20"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Mega Sale"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Description / Promo Terms</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 15% discount on all purchases above $50"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT_AMOUNT">Flat Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Minimum Order Spend ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="autoApply"
                  checked={autoApply}
                  onChange={(e) => setAutoApply(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoApply" className="text-slate-300 cursor-pointer">
                  Auto-apply discount when order threshold is met
                </label>
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow"
                >
                  Save Promo Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
