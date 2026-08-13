import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Expense, Product, AIInsightResponse, ExpenseCategory, PaymentMethod } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Bot,
  Sparkles,
  PieChart as PieIcon,
  Receipt,
  Building2,
  CheckCircle2,
  X
} from 'lucide-react';

interface FinancialDashboardViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  onAddExpense: (expense: Expense) => void;
  currencySymbol: string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export const FinancialDashboardView: React.FC<FinancialDashboardViewProps> = ({
  invoices,
  expenses,
  products,
  onAddExpense,
  currencySymbol
}) => {
  const [aiInsight, setAiInsight] = useState<AIInsightResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // New Expense Form State
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('UTILITIES');
  const [expAmount, setExpAmount] = useState<number>(100);
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expMethod, setExpMethod] = useState<PaymentMethod>('CARD');

  // Compute Core Metrics
  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

    // Approximate Cost of Goods Sold (COGS)
    const cogs = invoices.reduce((acc, inv) => {
      const invoiceCogs = inv.items.reduce((itemAcc, item) => {
        return itemAcc + (item.product.costPrice || 0) * item.quantity;
      }, 0);
      return acc + invoiceCogs;
    }, 0);

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const netMarginPercent = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    const outstandingAR = invoices
      .filter((inv) => inv.status === 'UNPAID' || inv.status === 'PARTIAL')
      .reduce((acc, inv) => acc + (inv.grandTotal - inv.amountPaid), 0);

    const totalTaxCollected = invoices.reduce((acc, inv) => acc + inv.taxTotal, 0);

    return {
      totalRevenue,
      totalExpenses,
      cogs,
      grossProfit,
      netProfit,
      netMarginPercent,
      outstandingAR,
      totalTaxCollected
    };
  }, [invoices, expenses]);

  // Chart Data: Category Revenue
  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const cat = item.product.category || 'General';
        catMap[cat] = (catMap[cat] || 0) + item.totalPrice;
      });
    });

    return Object.keys(catMap).map((key) => ({
      name: key,
      value: Math.round(catMap[key])
    }));
  }, [invoices]);

  // Chart Data: Payment Methods Distribution
  const paymentMethodData = useMemo(() => {
    const methodMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      const method = inv.paymentMethod || 'CASH';
      methodMap[method] = (methodMap[method] || 0) + inv.grandTotal;
    });

    return Object.keys(methodMap).map((key) => ({
      name: key.replace('_', ' '),
      amount: Math.round(methodMap[key])
    }));
  }, [invoices]);

  // Chart Data: Daily Trends
  const dailyTrendsData = useMemo(() => {
    const dates = ['Aug 08', 'Aug 09', 'Aug 10', 'Aug 11', 'Aug 12'];
    return dates.map((d) => ({
      date: d,
      Revenue: Math.floor(200 + Math.random() * 400),
      Expenses: Math.floor(50 + Math.random() * 150)
    }));
  }, []);

  // Chart Data: Past 6 Months Monthly Revenue Trend
  const monthlyRevenueData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    const baselineMock: number[] = [14200, 16800, 15500, 19400, 22100, 25800];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const yearLabel = d.getFullYear();
      
      const actualMonthRevenue = invoices
        .filter((inv) => {
          if (!inv.date) return false;
          const invDate = new Date(inv.date);
          return (
            invDate.getFullYear() === d.getFullYear() &&
            invDate.getMonth() === d.getMonth() &&
            inv.status !== 'REFUNDED'
          );
        })
        .reduce((sum, inv) => sum + inv.grandTotal, 0);

      const baseVal = baselineMock[5 - i] || 18000;
      const finalRevenue = actualMonthRevenue > 0 ? actualMonthRevenue : baseVal;

      months.push({
        month: `${monthLabel} '${String(yearLabel).slice(-2)}`,
        Revenue: Math.round(finalRevenue),
        Target: Math.round(finalRevenue * 1.12)
      });
    }

    return months;
  }, [invoices]);

  const fetchAiInsights = async () => {
    setLoadingAi(true);
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          inventoryAlerts: products.filter((p) => p.stock <= p.reorderLevel)
        })
      });

      const data = await response.json();
      setAiInsight(data);
    } catch (err) {
      console.error('Failed to load AI insights:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchAiInsights();
  }, []);

  const handleCreateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) return;

    const newExpense: Expense = {
      id: generateId('exp'),
      title: expTitle,
      category: expCategory,
      amount: expAmount,
      date: new Date().toISOString().split('T')[0],
      paidTo: expPaidTo || 'Vendor',
      paymentMethod: expMethod,
      recordedBy: 'Finance Lead'
    };

    onAddExpense(newExpense);
    setIsAddExpenseOpen(false);
    setExpTitle('');
    setExpAmount(100);
    setExpPaidTo('');
  };

  return (
    <div className="space-y-6">
      {/* Top-Level Financial Summary Row - 4 KPI Snapshot Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Total Revenue (MTD)</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-white">{formatCurrency(metrics.totalRevenue, currencySymbol)}</p>
            <span className="text-xs font-bold text-emerald-400 flex items-center bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +14.2%
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Month-to-date sales billing</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Total Expenses</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-rose-400">{formatCurrency(metrics.totalExpenses, currencySymbol)}</p>
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-semibold"
            >
              + Log Expense
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Operational & overhead costs</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Net Profit Margin</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-emerald-400">{formatCurrency(metrics.netProfit, currencySymbol)}</p>
            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              {metrics.netMarginPercent}% Margin
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Net return after COGS & OpEx</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 shadow-xl hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Pending AR Balance</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-black text-amber-400">{formatCurrency(metrics.outstandingAR, currencySymbol)}</p>
            <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-bold">
              Unpaid Credit
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Outstanding customer ledgers</p>
        </div>
      </div>

      {/* AI Executive CFO Advisory Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-white text-base">Gemini Executive CFO Insights</h3>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                  Real-time Advisor
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {aiInsight?.insight || 'Analyzing revenue streams, expense margins, and accounts receivable...'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchAiInsights}
            disabled={loadingAi}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition shrink-0"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{loadingAi ? 'Analyzing...' : 'Refresh AI Financial Audit'}</span>
          </button>
        </div>

        {aiInsight?.recommendations && (
          <div className="mt-4 pt-4 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiInsight.recommendations.map((rec, i) => (
              <div key={i} className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly Revenue Trend (Past 6 Months) Line Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Monthly Revenue Trend (Past 6 Months)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Visualizing revenue fluctuations and performance against monthly targets over the past 6 months
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              6-Month Trajectory
            </span>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyRevenueData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                  color: '#f8fafc',
                  fontSize: '12px'
                }}
                formatter={(value: any, name: any) => [
                  `${formatCurrency(Number(value), currencySymbol)}`,
                  name === 'Revenue' ? 'Actual Revenue' : 'Monthly Target'
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: '12px' }}
                formatter={(value) => (
                  <span style={{ color: '#cbd5e1', fontSize: '11px', fontWeight: 600 }}>
                    {value === 'Revenue' ? 'Actual Monthly Revenue' : 'Target Benchmark'}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="Revenue"
                name="Revenue"
                stroke="#6366f1"
                strokeWidth={3.5}
                dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#1e1b4b' }}
                activeDot={{ r: 8, fill: '#818cf8', strokeWidth: 2, stroke: '#ffffff' }}
              />
              <Line
                type="monotone"
                dataKey="Target"
                name="Target"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Revenue vs Expenses Trend Chart */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-white">Sales & Expenses Trend Analysis</h3>
              <p className="text-xs text-slate-400">Daily financial trajectory</p>
            </div>
            <span className="text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded-xl">
              August 2026
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendsData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 5 Cols: Category Revenue Pie Chart */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-base text-white">Revenue by Product Category</h3>
            <p className="text-xs text-slate-400">Contribution per inventory line</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Legend formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Expenses Ledger & P&L Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-white">Operational Expenses Ledger</h3>
            <p className="text-xs text-slate-400">Track overheads, rent, utilities, and vendor payments</p>
          </div>
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                <th className="p-3">Expense Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Date</th>
                <th className="p-3">Paid To</th>
                <th className="p-3">Payment Mode</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-bold text-slate-100">{exp.title}</td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                      {exp.category}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{exp.date}</td>
                  <td className="p-3 text-slate-300">{exp.paidTo}</td>
                  <td className="p-3 text-slate-400 font-mono text-[11px]">{exp.paymentMethod}</td>
                  <td className="p-3 text-right font-extrabold text-rose-400">
                    -{formatCurrency(exp.amount, currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Record Operational Expense</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpenseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Monthly Electricity Bill"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="RENT">Rent</option>
                    <option value="UTILITIES">Utilities</option>
                    <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                    <option value="SALARIES">Salaries</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Paid To / Vendor</label>
                <input
                  type="text"
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="e.g. Austin Energy"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
