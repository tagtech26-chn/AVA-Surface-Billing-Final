import React, { useEffect, useMemo, useState } from 'react';
import { authHeaders, formatCurrency, formatDateTime } from '../lib/utils';
import { UserProfile } from '../types';

interface Props { activeUser: UserProfile; currencySymbol: string; }
type Tab = 'cancellation' | 'users' | 'inventory' | 'categories' | 'pricing' | 'reports';

const roles = ['ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'CASHIER', 'BILLING_USER', 'ACCOUNTANT', 'WAREHOUSE'];
const input = 'w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500';

export const EnterpriseManagementView: React.FC<Props> = ({ activeUser, currencySymbol }) => {
  const isAdmin = activeUser.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'users' : 'cancellation');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [salesReport, setSalesReport] = useState<any>(null);
  const [purchaseReport, setPurchaseReport] = useState<any>(null);
  const [salespersonReport, setSalespersonReport] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newCategory, setNewCategory] = useState({ code: '', name: '' });
  const [newUser, setNewUser] = useState({ userName: '', displayName: '', role: 'BILLING_USER', password: '' });
  const [pricing, setPricing] = useState({ customerId: '', productId: '', fixedPrice: '', discountPercent: '' });
  const [cancel, setCancel] = useState({ invoiceId: '', reason: '', restock: false, refund: '' });

  const loadCore = async () => {
    setLoading(true); setMessage('');
    try {
      const [p, c, i] = await Promise.all([
        fetch('/api/products?page=1&pageSize=100', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/customers', { headers: authHeaders() }).then(r => r.json()),
        fetch('/api/invoices/history', { headers: authHeaders() }).then(r => r.json())
      ]);
      setProducts(Array.isArray(p) ? p : (p.items || []));
      setCustomers(Array.isArray(c) ? c : (c.items || []));
      setInvoices(Array.isArray(i) ? i : (i.items || []));
      if (isAdmin) {
        const u = await fetch('/api/enterprise/users', { headers: authHeaders() });
        if (u.ok) setUsers(await u.json());
      }
      const cat = await fetch('/api/enterprise/customer-categories', { headers: authHeaders() });
      if (cat.ok) setCategories(await cat.json());
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load enterprise data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadCore(); }, []);

  const cancelableInvoices = useMemo(() => invoices.filter(x => x.Status !== 'CANCELLED' && x.status !== 'CANCELLED' && x.WorkflowStatus !== 'CANCELLED' && x.workflowStatus !== 'CANCELLED'), [invoices]);

  const saveUser = async () => {
    const response = await fetch('/api/enterprise/users', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(newUser) });
    if (!response.ok) return setMessage(await response.text());
    setNewUser({ userName: '', displayName: '', role: 'BILLING_USER', password: '' }); await loadCore(); setMessage('User created successfully.');
  };

  const deactivateUser = async (id: string) => {
    const target = users.find(x => x.id === id); if (!target) return;
    const response = await fetch(`/api/enterprise/users/${id}`, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ displayName: target.displayName, role: target.role, isActive: false, password: null }) });
    if (!response.ok) return setMessage(await response.text()); await loadCore();
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    const response = await fetch(`/api/enterprise/products/${editingProduct.id}`, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ sku: editingProduct.sku, name: editingProduct.name, hsnCode: editingProduct.hsnCode, unit: editingProduct.unit, costPrice: Number(editingProduct.costPrice), sellingPrice: Number(editingProduct.sellingPrice), gstRate: Number(editingProduct.gstRate), reorderLevel: Number(editingProduct.reorderLevel), isActive: editingProduct.isActive !== false }) });
    if (!response.ok) return setMessage(await response.text()); setEditingProduct(null); await loadCore(); setMessage('Product updated.');
  };

  const deactivateProduct = async (id: string) => {
    const response = await fetch(`/api/enterprise/products/${id}/deactivate`, { method: 'POST', headers: authHeaders(true) });
    if (!response.ok) return setMessage(await response.text()); await loadCore();
  };

  const createCategory = async () => {
    const response = await fetch('/api/enterprise/customer-categories', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(newCategory) });
    if (!response.ok) return setMessage(await response.text()); setNewCategory({ code: '', name: '' }); await loadCore();
  };

  const saveCustomerPrice = async () => {
    const response = await fetch('/api/enterprise/customer-prices', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ customerId: pricing.customerId, productId: pricing.productId, fixedPrice: pricing.fixedPrice ? Number(pricing.fixedPrice) : null, discountPercent: pricing.discountPercent ? Number(pricing.discountPercent) : null, validFrom: new Date().toISOString(), validTo: new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString() }) });
    if (!response.ok) return setMessage(await response.text()); setMessage('Customer-specific pricing saved.');
  };

  const cancelInvoice = async () => {
    if (!cancel.invoiceId || !cancel.reason.trim()) return setMessage('Select an invoice and enter a cancellation reason.');
    const response = await fetch(`/api/enterprise/invoices/${cancel.invoiceId}/cancel`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ reason: cancel.reason.trim(), restockItems: cancel.restock, refundAmount: Number(cancel.refund || 0) }) });
    if (!response.ok) return setMessage(await response.text());
    setCancel({ invoiceId: '', reason: '', restock: false, refund: '' }); await loadCore(); setMessage('Invoice cancelled and audit trail recorded.');
  };

  const loadReports = async () => {
    const [s, p, sp, d] = await Promise.all([
      fetch('/api/enterprise/reports/sales', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/enterprise/reports/purchase', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/enterprise/reports/salespersons', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/enterprise/reports/management-dashboard', { headers: authHeaders() }).then(r => r.json())
    ]); setSalesReport(s); setPurchaseReport(p); setSalespersonReport(sp); setDashboard(d);
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">
      {(isAdmin || activeUser.role === 'MANAGER' || activeUser.role === 'BRANCH_MANAGER') && <button onClick={() => setTab('cancellation')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'cancellation' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Invoice Cancellation</button>}
      {isAdmin && <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Users / Roles</button>}
      {(isAdmin || activeUser.role === 'MANAGER' || activeUser.role === 'BRANCH_MANAGER') && <button onClick={() => setTab('inventory')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'inventory' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Inventory Master</button>}
      {isAdmin && <button onClick={() => setTab('categories')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'categories' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Customer Categories</button>}
      {(isAdmin || activeUser.role === 'MANAGER' || activeUser.role === 'BRANCH_MANAGER') && <button onClick={() => setTab('pricing')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'pricing' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Pricing Engine</button>}
      <button onClick={() => { setTab('reports'); void loadReports(); }} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'reports' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Reports / Dashboard</button>
    </div>
    {message && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-xs">{message}</div>}

    {tab === 'cancellation' && <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"><h2 className="text-xl font-black">Cancel Invoice</h2><p className="text-xs text-slate-400">Cancellation is non-destructive, audited, and keeps the original document in history.</p><select className={input} value={cancel.invoiceId} onChange={e => setCancel(v => ({ ...v, invoiceId: e.target.value }))}><option value="">Select invoice</option>{cancelableInvoices.map(x => <option key={x.id} value={x.id}>{x.invoiceNumber || x.quotationNumber} — {formatCurrency(Number(x.grandTotal || 0), currencySymbol)}</option>)}</select><textarea className={input} placeholder="Cancellation reason" value={cancel.reason} onChange={e => setCancel(v => ({ ...v, reason: e.target.value }))}/><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input className={input} type="number" min="0" placeholder="Refund amount" value={cancel.refund} onChange={e => setCancel(v => ({ ...v, refund: e.target.value }))}/><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={cancel.restock} onChange={e => setCancel(v => ({ ...v, restock: e.target.checked }))}/> Restock cancelled invoice items</label></div><button onClick={() => void cancelInvoice()} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black">Cancel Invoice</button></section>}

    {tab === 'users' && <section className="space-y-4"><div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h2 className="text-xl font-black mb-4">User / Role Management</h2><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><input className={input} placeholder="Username" value={newUser.userName} onChange={e => setNewUser(v => ({ ...v, userName: e.target.value }))}/><input className={input} placeholder="Display name" value={newUser.displayName} onChange={e => setNewUser(v => ({ ...v, displayName: e.target.value }))}/><select className={input} value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}>{roles.map(r => <option key={r}>{r}</option>)}</select><input className={input} type="password" placeholder="Initial password" value={newUser.password} onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}/></div><button onClick={() => void saveUser()} className="mt-3 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black">Add User</button></div><div className="grid gap-3">{users.map(u => <div key={u.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"><div><div className="font-black text-white">{u.displayName}</div><div className="text-xs text-slate-400">{u.userName} · {u.role}</div></div>{u.isActive && <button onClick={() => void deactivateUser(u.id)} className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 text-[10px] font-black">Deactivate</button>}</div>)}</div></section>}

    {tab === 'inventory' && <section className="space-y-3"><div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h2 className="text-xl font-black">Inventory Edit / Deactivate</h2></div>{products.map(p => <div key={p.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"><div className="min-w-0"><div className="font-black text-white truncate">{p.name}</div><div className="text-xs text-slate-400">{p.sku} · {formatCurrency(Number(p.sellingPrice || 0), currencySymbol)} · Stock {p.stock}</div></div><div className="flex gap-2"><button onClick={() => setEditingProduct({ ...p })} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black">Edit</button><button onClick={() => void deactivateProduct(p.id)} className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 text-[10px] font-black">Deactivate</button></div></div>)}{editingProduct && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-700 space-y-3"><h3 className="text-lg font-black">Edit Product</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{['sku','name','hsnCode','unit','costPrice','sellingPrice','gstRate','reorderLevel'].map(k => <input key={k} className={input} value={editingProduct[k] ?? ''} placeholder={k} onChange={e => setEditingProduct((v:any) => ({ ...v, [k]: e.target.value }))}/>)}</div><div className="flex gap-2 justify-end"><button onClick={() => setEditingProduct(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-black">Cancel</button><button onClick={() => void saveProduct()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">Save</button></div></div></div>}</section>}

    {tab === 'categories' && <section className="space-y-4"><div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h2 className="text-xl font-black">Customer Categories</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4"><input className={input} placeholder="Code e.g. WHOLESALE" value={newCategory.code} onChange={e => setNewCategory(v => ({ ...v, code: e.target.value }))}/><input className={input} placeholder="Name e.g. Wholesale" value={newCategory.name} onChange={e => setNewCategory(v => ({ ...v, name: e.target.value }))}/><button onClick={() => void createCategory()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">Create Category</button></div></div><div className="grid gap-3">{categories.map(c => <div key={c.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="font-black">{c.name}</div><div className="text-xs text-slate-500">{c.code}</div></div>)}</div></section>}

    {tab === 'pricing' && <section className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"><h2 className="text-xl font-black">Customer-specific Pricing</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select className={input} value={pricing.customerId} onChange={e => setPricing(v => ({ ...v, customerId: e.target.value }))}><option value="">Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className={input} value={pricing.productId} onChange={e => setPricing(v => ({ ...v, productId: e.target.value }))}><option value="">Product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select><input className={input} type="number" placeholder="Fixed price" value={pricing.fixedPrice} onChange={e => setPricing(v => ({ ...v, fixedPrice: e.target.value }))}/><input className={input} type="number" placeholder="Discount %" value={pricing.discountPercent} onChange={e => setPricing(v => ({ ...v, discountPercent: e.target.value }))}/></div><button onClick={() => void saveCustomerPrice()} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black">Save Customer Price</button><p className="text-xs text-slate-400">Pricing precedence is customer-specific first, then customer-category, then standard product price.</p></section>}

    {tab === 'reports' && <section className="space-y-4"><div className="flex gap-2"><button onClick={() => void loadReports()} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black">Refresh Reports</button></div>{dashboard && <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[['Today Sales',dashboard.todaySales],['Month Sales',dashboard.monthSales],['Month Invoices',dashboard.monthInvoices],['Cancelled',dashboard.monthCancelled],['Conversion %',dashboard.quotationConversionPercent]].map(([label,value]) => <div key={String(label)} className="p-4 rounded-xl bg-slate-900 border border-slate-800"><div className="text-[10px] text-slate-500">{label}</div><div className="text-lg font-black text-white mt-1">{typeof value === 'number' && String(label).includes('Sales') ? formatCurrency(value, currencySymbol) : value}</div></div>)}</div>}{salesReport && <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h3 className="font-black">Sales Report</h3><div className="text-sm text-emerald-300 mt-2">{formatCurrency(salesReport.totalSales, currencySymbol)} · {salesReport.totalInvoices} invoices</div></div>}{purchaseReport && <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h3 className="font-black">Purchase Report</h3><div className="text-sm text-amber-300 mt-2">{formatCurrency(purchaseReport.totalPurchase, currencySymbol)} · {purchaseReport.totalDocuments} documents</div></div>}{salespersonReport && <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800"><h3 className="font-black">Salesperson Report</h3><div className="mt-3 space-y-2">{salespersonReport.summary?.map((r:any) => <div key={r.salesperson} className="flex justify-between text-xs border-b border-slate-800 pb-2"><span>{r.salesperson || 'Unassigned'}</span><span className="font-black text-white">{formatCurrency(r.sales, currencySymbol)}</span></div>)}</div></div>}</section>}
  </div>;
};
