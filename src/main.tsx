import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LoginView } from './components/LoginView';
import { Storage, hydrateProductsFromServer, setCustomersFromServer, setPromosFromServer } from './lib/storage';
import { hydrateInvoicesFromServer } from './lib/invoiceHydration';
import { UserProfile, Customer, PromoRule } from './types';
import './index.css';
import './modern-pos.css';

const AUTH_TOKEN_KEY = 'avasurface_auth_token';
const AUTH_USER_KEY = 'avasurface_auth_user';

function clearAuth() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

function installAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isLoginRequest = url.includes('/api/auth/login');
    if (!token || isLoginRequest) return originalFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    const response = await originalFetch(input, { ...init, headers });
    if (response.status === 401) { clearAuth(); window.location.reload(); }
    return response;
  };
}

async function hydrateCustomersFromServer(): Promise<Customer[]> {
  const response = await fetch('/api/customers');
  if (!response.ok) throw new Error(`Customer API HTTP ${response.status}`);
  const rows = await response.json() as Array<{ id:string; name:string; phone?:string|null; email?:string|null; gstin?:string|null; address?:string|null; billingAddress?:string|null; shippingAddress?:string|null; city?:string|null; state?:string|null; stateCode?:string|null; customerType?:string; isActive?:boolean }>;
  const result: Customer[] = rows.filter(r=>r.isActive!==false).map(r=>({id:r.id,name:r.name,phone:r.phone||'',email:r.email||undefined,customerType:r.customerType?.toUpperCase()==='B2B'?'LEDGER':'NORMAL',gstNumber:r.gstin||undefined,address:r.address||undefined,billingAddress:r.billingAddress||undefined,shippingAddress:r.shippingAddress||undefined,city:r.city||undefined,state:r.state||undefined,stateCode:r.stateCode||undefined,loyaltyPoints:0,totalSpent:0,outstandingBalance:0}));
  setCustomersFromServer(result);
  return result;
}

async function hydratePromosFromServer(): Promise<void> {
  const response = await fetch('/api/promotions');
  if (!response.ok) throw new Error(`Promotion API HTTP ${response.status}`);
  const rows = await response.json() as Array<{
    id:string; code:string; name:string; discountPercent:number; maxDiscountPercent?:number|null;
    productCategory?:string|null; customerType?:string|null; isCombinable:boolean; isActive:boolean;
    validFrom:string; validTo:string; priority:number; remarks?:string|null;
  }>;
  const promos: PromoRule[] = rows.filter(r=>r.isActive!==false).map(r=>({
    id:r.id, code:r.code, title:r.name, description:r.remarks || '', discountType:'PERCENTAGE',
    discountValue:Number(r.discountPercent||0), minOrderValue:0,
    maxDiscountAmount:r.maxDiscountPercent == null ? undefined : Number(r.maxDiscountPercent),
    validFrom:r.validFrom, validUntil:r.validTo, isActive:true, autoApply:false, usageCount:0,
    targetCategory:r.productCategory || undefined
  }));
  setPromosFromServer(promos);
}

installAuthenticatedFetch();

function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try { const token=sessionStorage.getItem(AUTH_TOKEN_KEY); const raw=sessionStorage.getItem(AUTH_USER_KEY); return token&&raw?JSON.parse(raw) as UserProfile:null; }
    catch { clearAuth(); return null; }
  });
  const [hydrating, setHydrating] = useState(() => Boolean(user));
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    if (!user) { setHydrating(false); return; }
    let active=true;
    (async()=>{
      try {
        setStartupError('');
        await Promise.all([hydrateProductsFromServer(), hydrateInvoicesFromServer(), hydrateCustomersFromServer(), hydratePromosFromServer()]);
      }
      catch(error) { console.error('Authoritative DB hydration failed:', error); if(active) setStartupError(error instanceof Error ? error.message : 'Unable to load business data from the database.'); }
      finally { if(active) setHydrating(false); }
    })();
    return()=>{active=false;};
  },[user]);

  if (!user) return <LoginView onLogin={(profile) => { Storage.saveUsers([profile]); Storage.saveActiveUserId(profile.id); setHydrating(true); setUser(profile); }} />;
  if (hydrating) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading SQL Server data...</div>;
  if (startupError) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-slate-900 p-6"><h1 className="text-lg font-black text-red-300">Database data could not be loaded</h1><p className="text-sm text-slate-300 mt-3">{startupError}</p><button onClick={()=>window.location.reload()} className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">Retry</button></div></div>;

  Storage.saveUsers([user]);
  Storage.saveActiveUserId(user.id);

  return <App activeUser={user} onLogout={()=>{clearAuth();setUser(null);setHydrating(false);}} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthenticatedApp /></StrictMode>);
