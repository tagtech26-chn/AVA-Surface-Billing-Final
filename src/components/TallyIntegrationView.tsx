import React, { useState, useMemo } from 'react';
import { Invoice, Expense, Product, Customer, TallyLedgerMapping } from '../types';
import {
  generateTallySalesXml,
  generateTallyExpenseXml,
  generateTallyJsonExport,
  downloadFile,
  DEFAULT_TALLY_MAPPING
} from '../lib/tallyExporter';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Settings,
  Calendar,
  Layers,
  FileCode,
  Building2,
  CheckCircle2,
  Info,
  ArrowRight,
  Code2
} from 'lucide-react';

interface TallyIntegrationViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
}

export const TallyIntegrationView: React.FC<TallyIntegrationViewProps> = ({
  invoices,
  expenses,
  products,
  customers
}) => {
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');
  const [exportType, setExportType] = useState<'SALES_XML' | 'EXPENSE_XML' | 'FULL_JSON' | 'STOCK_XML'>('SALES_XML');
  const [mapping, setMapping] = useState<TallyLedgerMapping>(DEFAULT_TALLY_MAPPING);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Filtered dataset by date
  const filteredInvoices = useMemo(() => {
    if (dateRange === 'ALL') return invoices;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (dateRange === 'TODAY') {
      return invoices.filter((inv) => inv.date.startsWith(todayStr));
    }
    if (dateRange === 'MONTH') {
      const currentYearMonth = todayStr.substring(0, 7);
      return invoices.filter((inv) => inv.date.startsWith(currentYearMonth));
    }
    return invoices;
  }, [invoices, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (dateRange === 'ALL') return expenses;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (dateRange === 'TODAY') {
      return expenses.filter((exp) => exp.date.startsWith(todayStr));
    }
    if (dateRange === 'MONTH') {
      const currentYearMonth = todayStr.substring(0, 7);
      return expenses.filter((exp) => exp.date.startsWith(currentYearMonth));
    }
    return expenses;
  }, [expenses, dateRange]);

  // Output Content Generator
  const previewContent = useMemo(() => {
    if (exportType === 'SALES_XML') {
      return generateTallySalesXml(filteredInvoices, mapping);
    }
    if (exportType === 'EXPENSE_XML') {
      return generateTallyExpenseXml(filteredExpenses, mapping);
    }
    if (exportType === 'FULL_JSON') {
      return JSON.stringify(
        generateTallyJsonExport(filteredInvoices, filteredExpenses, products, customers, mapping),
        null,
        2
      );
    }
    if (exportType === 'STOCK_XML') {
      const stockXml = products
        .map(
          (p) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${p.name}" ACTION="Create">
            <NAME>${p.name}</NAME>
            <PARENT>${p.category}</PARENT>
            <BASEUNITS>${p.unit}</BASEUNITS>
            <OPENINGBALANCE>${p.stock} ${p.unit}</OPENINGBALANCE>
            <OPENINGVALUE>${(p.stock * p.costPrice).toFixed(2)}</OPENINGVALUE>
          </STOCKITEM>
        </TALLYMESSAGE>`
        )
        .join('');
      return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        ${stockXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    }
    return '';
  }, [exportType, filteredInvoices, filteredExpenses, products, customers, mapping]);

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (exportType === 'SALES_XML') {
      const filename = `Tally_Sales_Vouchers_${timeStamp}.xml`;
      downloadFile(previewContent, filename, 'application/xml');
      setDownloadSuccess(`Exported ${filteredInvoices.length} Sales Vouchers to ${filename}`);
    } else if (exportType === 'EXPENSE_XML') {
      const filename = `Tally_Expense_Vouchers_${timeStamp}.xml`;
      downloadFile(previewContent, filename, 'application/xml');
      setDownloadSuccess(`Exported ${filteredExpenses.length} Payment Vouchers to ${filename}`);
    } else if (exportType === 'FULL_JSON') {
      const filename = `TallyPrime_Complete_Daybook_${timeStamp}.json`;
      downloadFile(previewContent, filename, 'application/json');
      setDownloadSuccess(`Exported full TallyPrime Daybook JSON to ${filename}`);
    } else if (exportType === 'STOCK_XML') {
      const filename = `Tally_Stock_Items_Master_${timeStamp}.xml`;
      downloadFile(previewContent, filename, 'application/xml');
      setDownloadSuccess(`Exported ${products.length} Stock Masters to ${filename}`);
    }
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold tracking-wide">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Accounting ERP Bridge</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Tally ERP 9 & TallyPrime Connector
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Export sales vouchers, expense entries, customer ledger accounts, and stock item masters into native Tally XML or structured JSON for seamless accounting import.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
              <span>Configure Ledger Mapping</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download Tally File</span>
            </button>
          </div>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
          <button onClick={() => setDownloadSuccess(null)} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Control Panel Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Date Filter */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Accounting Period</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            {(['ALL', 'TODAY', 'MONTH'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  dateRange === r
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {r === 'ALL' ? 'All Time' : r === 'TODAY' ? 'Today' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Export Type Selector */}
        <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Format & Voucher Target</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'SALES_XML', label: 'Sales Vouchers (XML)', count: `${filteredInvoices.length} Bills` },
              { id: 'EXPENSE_XML', label: 'Payment Vouchers (XML)', count: `${filteredExpenses.length} Entries` },
              { id: 'FULL_JSON', label: 'TallyPrime JSON Daybook', count: 'Full Sync' },
              { id: 'STOCK_XML', label: 'Stock Items (XML)', count: `${products.length} Items` }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setExportType(type.id as any)}
                className={`p-2.5 rounded-xl border text-left transition ${
                  exportType === type.id
                    ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-200 truncate">{type.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{type.count}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Code Previewer & Instructions Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tally Import Guide */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>How to Import into Tally</span>
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex space-x-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Download XML or JSON</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Click "Download Tally File" above to save the structured XML/JSON to your device.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Open Tally ERP 9 / TallyPrime</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Navigate to <code className="text-amber-300 font-mono">Gateway of Tally &gt; Import Data &gt; Vouchers</code>.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Paste File Path</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Provide the downloaded XML path. Ensure your Tally Chart of Accounts matches the configured ledger names.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-[11px] space-y-1">
                <p className="font-semibold text-slate-200">Active Ledger Mapping:</p>
                <div className="text-slate-400 space-y-0.5 font-mono text-[10px]">
                  <div>Sales: <span className="text-indigo-300">{mapping.salesLedger}</span></div>
                  <div>Tax: <span className="text-indigo-300">{mapping.cgstLedger}</span></div>
                  <div>Cash: <span className="text-indigo-300">{mapping.cashLedger}</span></div>
                  <div>Bank: <span className="text-indigo-300">{mapping.bankLedger}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Live Syntax-Highlighted Preview Box */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[520px]">
          <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white tracking-wide font-mono">
                {exportType.includes('XML') ? 'TALLY_REQUEST_PAYLOAD.xml' : 'TALLY_PRIME_DAYBOOK.json'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 overflow-auto flex-1 text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre select-all">
            {previewContent}
          </div>
        </div>
      </div>

      {/* Ledger Mapping Configuration Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-fade-in text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Tally Ledger Account Mapping</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Match BizFlow accounts with the exact ledger names defined in your Tally Chart of Accounts.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Company Name in Tally</label>
                <input
                  type="text"
                  value={mapping.companyName}
                  onChange={(e) => setMapping({ ...mapping, companyName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Sales Ledger Name</label>
                  <input
                    type="text"
                    value={mapping.salesLedger}
                    onChange={(e) => setMapping({ ...mapping, salesLedger: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tax Ledger Name</label>
                  <input
                    type="text"
                    value={mapping.cgstLedger}
                    onChange={(e) => setMapping({ ...mapping, cgstLedger: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cash Account Ledger</label>
                  <input
                    type="text"
                    value={mapping.cashLedger}
                    onChange={(e) => setMapping({ ...mapping, cashLedger: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bank Account Ledger</label>
                  <input
                    type="text"
                    value={mapping.bankLedger}
                    onChange={(e) => setMapping({ ...mapping, bankLedger: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Sundry Debtors Parent Group</label>
                <input
                  type="text"
                  value={mapping.debtorsGroup}
                  onChange={(e) => setMapping({ ...mapping, debtorsGroup: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setMapping(DEFAULT_TALLY_MAPPING)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Reset Defaults
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Save Mappings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
