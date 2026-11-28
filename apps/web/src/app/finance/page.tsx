'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { api } from '@/lib/client/api-client';
import { Payment, Customer } from '@crm/shared-types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { APP_CARD_PALETTES } from '@/lib/data/theme-palettes';
import {
  DollarSign,
  Plus,
  CreditCard,
  FileText,
  Printer,
  CheckCircle,
  TrendingUp,
  Receipt,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Edit3,
  Download,
  Share2,
  Sparkles,
} from 'lucide-react';
import { WordFadeIn } from '@/components/ui/WordFadeIn';
import { InvoiceDocumentGenerator } from '@/components/features/invoices/InvoiceDocumentGenerator';
import {
  DealershipBrandHeader,
  DealershipDocumentFooter,
  DocumentWatermark,
  getInvoiceColorSystem,
  numberToWordsINR,
} from '@/components/features/invoices/invoice-utils';
import {
  CompanyProfile,
  DEFAULT_COMPANY_PROFILE,
  fetchCompanyProfile,
  getCompanyProfile,
} from '@/lib/client/stores/company-store';
import { getActiveTenantId } from '@/lib/client/tenant-context';
import { supabase, isSupabaseConfigured } from '@/lib/client/supabase';

export default function FinancePage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'payments' | 'invoices' | 'expenses'>('payments');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [receiptAutoDownloading, setReceiptAutoDownloading] = useState(false);
  const autoDownloadTimerRef = useRef<number | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const triggerDocumentDownload = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const clearPendingReceiptDownload = () => {
    if (autoDownloadTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(autoDownloadTimerRef.current);
      autoDownloadTimerRef.current = null;
    }
    setReceiptAutoDownloading(false);
  };

  const openReceiptPreview = (payment: Payment) => {
    clearPendingReceiptDownload();
    setSelectedReceipt(payment);
    setReceiptAutoDownloading(true);
    if (typeof window !== 'undefined') {
      autoDownloadTimerRef.current = window.setTimeout(() => {
        autoDownloadTimerRef.current = null;
        setReceiptAutoDownloading(false);
        window.print();
      }, 450);
    }
  };

  const closeReceiptPreview = () => {
    clearPendingReceiptDownload();
    setSelectedReceipt(null);
  };

  useEffect(() => {
    setPayments([...api.getPayments()]);
    setCustomers([...api.getCustomers()]);
    setInvoices([...api.getInvoices()]);
    setCompany(getCompanyProfile());

    fetchCompanyProfile().then((profile) => {
      if (profile && (profile.isOnboarded || profile.logoUrl || profile.tradeName || profile.legalName)) {
        setCompany(profile);
      }
    });

    api.fetchPayments().then((p) => {
      if (Array.isArray(p)) setPayments([...p]);
    });
    api.fetchCustomers().then((c) => {
      if (Array.isArray(c)) setCustomers([...c]);
    });
    api.fetchInvoices().then((i) => {
      if (Array.isArray(i)) setInvoices([...i]);
    });

    const handleDataChanged = () => {
      setPayments([...api.getPayments()]);
      setCustomers([...api.getCustomers()]);
      setInvoices([...api.getInvoices()]);
    };

    const handleCompanyChanged = () => {
      setCompany(getCompanyProfile());
    };

    window.addEventListener('crm-data-changed', handleDataChanged);
    window.addEventListener('crm-company-profile-changed', handleCompanyChanged);
    return () => {
      clearPendingReceiptDownload();
      window.removeEventListener('crm-data-changed', handleDataChanged);
      window.removeEventListener('crm-company-profile-changed', handleCompanyChanged);
    };
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveInvoice = async (inv: any) => {
    const tenantId = getActiveTenantId();
    
    // Resolve dynamic branch from authoritative store or fallback to valid tenant primary branch
    const availableBranches = api.getBranches();
    const branchId = availableBranches.length > 0 ? availableBranches[0].id : `b_${tenantId.slice(0, 8)}_01`;

    // Dynamically resolve or create authoritative customer record (VULN-08 Fix)
    let customerId = inv.customerId;
    if (!customerId) {
      const existing = customers.find(
        (c) => `${c.firstName} ${c.lastName || ''}`.trim().toLowerCase() === (inv.customerName || '').toLowerCase()
      );
      if (existing) {
        customerId = existing.id;
      } else {
        customerId = 'cust-' + Date.now();
        if (isSupabaseConfigured()) {
          try {
            const parts = (inv.customerName || 'Valued Customer').split(' ');
            await supabase.from('customers').upsert({
              id: customerId,
              tenant_id: tenantId,
              first_name: parts[0] || 'Valued',
              last_name: parts.slice(1).join(' ') || 'Customer',
              email: inv.customerEmail || `customer_${Date.now()}@dealership.com`,
              phone: inv.customerPhone || '9800000000',
              status: 'active',
              created_at: new Date().toISOString(),
            }, { onConflict: 'id' });
          } catch {}
        }
      }
    }

    const newPayment: Payment = {
      id: 'pay-' + Date.now(),
      tenantId: tenantId,
      branchId: branchId,
      currency: 'INR',
      paymentNumber: inv.invoiceNumber,
      customerId: customerId,
      customerName: inv.customerName || 'Valued Customer',
      amount: inv.grandTotal,
      method: (inv.paymentMethod || 'upi') as any,
      referenceNumber: inv.utrReference || 'CASH-REC',
      notes: inv.notes,
      status: 'settled',
      settledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const newInvoice = {
      id: inv.id || 'inv-' + Date.now(),
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName || 'Valued Customer',
      vehicleDetails: inv.items?.[0]?.description || 'Vehicle Delivery & Services',
      amount: inv.grandTotal,
      dueDate: inv.dueDate,
      status: 'settled',
      method: inv.paymentMethod || 'upi',
      referenceNumber: inv.utrReference || 'CASH-REC',
      date: inv.invoiceDate,
      rawInvoice: inv,
    };

    // Persist newInvoice and newPayment to Supabase before updating state
    if (isSupabaseConfigured()) {
      try {
        const { error: invErr } = await supabase.from('invoices').upsert({
          id: newInvoice.id,
          tenant_id: tenantId,
          branch_id: branchId,
          customer_id: customerId,
          invoice_number: newInvoice.invoiceNumber,
          status: 'paid',
          subtotal: inv.subtotal || inv.grandTotal,
          tax_total: inv.taxTotal || 0,
          grand_total: inv.grandTotal,
          paid_amount: inv.grandTotal,
          balance_due: 0,
          currency: 'INR',
          issued_at: new Date().toISOString(),
          due_date: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (invErr) {
          console.error('[Finance] Invoice persistence error:', invErr.message);
          showToast(`Invoice persistence failed: ${invErr.message}`, 'error');
          return;
        }

        const { error: payErr } = await supabase.from('payments').upsert({
          id: newPayment.id,
          tenant_id: tenantId,
          branch_id: branchId,
          customer_id: customerId,
          invoice_id: newInvoice.id,
          payment_number: newPayment.paymentNumber,
          method: newPayment.method || 'upi',
          status: 'settled',
          amount: newPayment.amount,
          currency: 'INR',
          reference_number: newPayment.referenceNumber,
          notes: newPayment.notes,
          settled_at: newPayment.settledAt,
          created_at: newPayment.createdAt,
        }, { onConflict: 'id' });

        if (payErr) {
          console.error('[Finance] Payment persistence error:', payErr.message);
          showToast(`Payment voucher persistence failed: ${payErr.message}`, 'error');
          return;
        }
      } catch (err: any) {
        console.error('[Finance] Unexpected persistence error:', err);
        showToast(`Failed to persist: ${err.message}`, 'error');
        return;
      }
    }

    api.addInvoice(newInvoice);
    api.recordPayment(newPayment);

    // If deal exists for this customer or invoice, update deal
    const matchedDeal = api.getDeals().find((d) => d.customerId === customerId || (inv.dealId && d.id === inv.dealId));
    if (matchedDeal) {
      api.updateDeal(matchedDeal.id, {
        amountPaid: (matchedDeal.amountPaid || 0) + newPayment.amount,
        balanceDue: Math.max(0, matchedDeal.grandTotal - ((matchedDeal.amountPaid || 0) + newPayment.amount)),
      });
    }

    setPayments([...api.getPayments()]);
    setInvoices([...api.getInvoices()]);
    setIsPaymentModalOpen(false);
    showToast(`Invoice ${newInvoice.invoiceNumber} and payment voucher successfully persisted!`, 'success');
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return payments;
    return payments.filter((p) =>
      p.paymentNumber.toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.referenceNumber || '').toLowerCase().includes(q) ||
      p.method.toLowerCase().includes(q)
    );
  }, [payments, searchQuery]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <WordFadeIn text="Finance, Bookings & Cash Flow" />
          </h1>
          <p className="page-desc">
            <WordFadeIn
              text="Customer token deposits, receipts, GST invoice management, accounts receivable, and dealership expenses."
              mobileText="Bookings, GST & receipts"
              baseDelay={0.22}
              staggerDelay={0.035}
            />
          </p>
        </div>
        <button
          onClick={() => {
            setIsPaymentModalOpen(true);
          }}
          className="btn btn-primary btn-sm"
          style={{
            borderRadius: '999px',
            padding: '0.45rem 1.25rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={16} /> Create Document / Invoice
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            fontSize: '0.86rem',
            fontWeight: 600,
            backgroundColor: toastType === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: toastType === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${toastType === 'success' ? '#A7F3D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <StatCard
          title="Total Collections This Month"
          value={`₹${(totalCollected / 100000).toFixed(2)} Lakh`}
          sub="Bank reconciled payments"
          icon={<DollarSign size={18} />}
          accentColor="green"
        />
        <StatCard
          title="Accounts Receivable (Pending)"
          value="₹0.00 Lakh"
          sub="No pending loans or receipts"
          icon={<Receipt size={18} />}
          accentColor="orange"
        />
        <StatCard
          title="Reconditioning Expenses"
          value="₹0"
          sub="Fleet touch-up and mechanical prep"
          icon={<CreditCard size={18} />}
          accentColor="indigo"
        />
      </div>

      {/* Unique Search Bar & Filters */}
      <div className="unique-search-wrapper">
        <div className="unique-search-bar">
          <div className="search-lens-pod">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="search-input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payments by receipt #, customer name, transaction reference, or method..."
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Tab Pills */}
        <div className="search-controls-row">
          <div className="search-filter-pills">
            <button
              type="button"
              className={`search-filter-pill ${activeTab === 'payments' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              <span>Payments Received</span>
              <span className="pill-count">{payments.length}</span>
            </button>
            <button
              type="button"
              className={`search-filter-pill ${activeTab === 'invoices' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              <span>Invoices & Receivables</span>
              <span className="pill-count">{invoices.length}</span>
            </button>
            <button
              type="button"
              className={`search-filter-pill ${activeTab === 'expenses' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <span>Dealership Expenses</span>
              <span className="pill-count">{expenses.length}</span>
            </button>
          </div>

          <div className="search-results-counter">
            Showing <strong>{activeTab === 'payments' ? filteredPayments.length : activeTab === 'invoices' ? invoices.length : expenses.length}</strong> records
          </div>
        </div>
      </div>

      {/* Tab 1: Payments */}
      {activeTab === 'payments' && (
        <div>
          <div
            className="app-table-header"
            style={{ ['--grid-cols' as any]: '2fr 1.3fr 1.6fr 1.8fr 1.4fr 1.1fr 130px' }}
          >
            <div>Receipt & Customer</div>
            <div>Method</div>
            <div>Amount</div>
            <div>UTR Reference</div>
            <div>Settled Date</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          <div className="app-cards-list">
            {filteredPayments.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px dashed #CBD5E1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>No Payments or Receipts Recorded</div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '400px' }}>
                  Customer booking advances, tokens, and bank settlements will be listed here.
                </div>
              </div>
            ) : (
              filteredPayments.map((p, index) => {
                const palette = APP_CARD_PALETTES[index % APP_CARD_PALETTES.length];

                return (
                  <div
                    key={p.id}
                    className="app-row-card"
                    style={{
                      ['--grid-cols' as any]: '2fr 1.3fr 1.6fr 1.8fr 1.4fr 1.1fr 130px',
                      ['--theme-accent' as any]: palette.accent,
                      ['--theme-border' as any]: palette.border,
                      ['--theme-glow' as any]: palette.glow,
                      ['--theme-badge-bg' as any]: palette.badgeBg,
                      ['--theme-badge-text' as any]: palette.badgeText,
                    }}
                  >
                    <div className="app-row-cell-main">
                      <div className="app-row-avatar">
                        <Receipt size={18} />
                      </div>
                      <div className="app-row-title-wrap">
                        <span className="app-row-title" style={{ color: palette.accent }}>{p.paymentNumber}</span>
                        <span className="app-row-subtitle">{p.customerName}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#334155' }}>
                        {p.method}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#16A34A' }}>
                      ₹{p.amount.toLocaleString()}
                    </div>

                    <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#475569' }}>
                      {p.referenceNumber || 'CASH-SHOWROOM'}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                      {new Date(p.settledAt || p.createdAt).toLocaleDateString()}
                    </div>

                    <div>
                      <StatusBadge status={p.status} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="app-action-btn"
                        onClick={() => openReceiptPreview(p)}
                        title="Preview and download watermarked receipt"
                      >
                        <span>Receipt</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Invoices */}
      {activeTab === 'invoices' && (
        <div>
          <div
            className="app-table-header"
            style={{ ['--grid-cols' as any]: '1.8fr 2fr 2fr 1.6fr 1.4fr 1fr 120px' }}
          >
            <div>Invoice #</div>
            <div>Customer</div>
            <div>Vehicle Details</div>
            <div>Invoice Amount</div>
            <div>Due Date</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          <div className="app-cards-list">
            {invoices.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px dashed #CBD5E1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>No GST Invoices Created</div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '400px' }}>
                  Generate vehicle delivery tax invoices and accounts receivable documents using &ldquo;Create Document / Invoice&rdquo;.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                  style={{ marginTop: '6px' }}
                >
                  <Plus size={14} /> Create First Invoice
                </button>
              </div>
            ) : (
              invoices.map((inv, index) => {
                const palette = APP_CARD_PALETTES[index % APP_CARD_PALETTES.length];

                return (
                  <div
                    key={inv.id}
                    className="app-row-card"
                    style={{
                      ['--grid-cols' as any]: '1.8fr 2fr 2fr 1.6fr 1.4fr 1fr 120px',
                      ['--theme-accent' as any]: palette.accent,
                      ['--theme-border' as any]: palette.border,
                      ['--theme-glow' as any]: palette.glow,
                      ['--theme-badge-bg' as any]: palette.badgeBg,
                      ['--theme-badge-text' as any]: palette.badgeText,
                    }}
                  >
                    <div className="app-row-cell-main">
                      <div className="app-row-avatar">
                        <FileText size={18} />
                      </div>
                      <div className="app-row-title-wrap">
                        <span className="app-row-title" style={{ color: palette.accent }}>{inv.invoiceNumber}</span>
                        <span className="app-row-subtitle">Tax Invoice</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{inv.customerName}</div>
                    <div style={{ fontSize: '0.84rem', color: '#475569' }}>{inv.vehicleDetails}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>₹{inv.amount.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748B' }}>{inv.dueDate}</div>
                    <div>
                      <StatusBadge status={inv.status as any} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="app-action-btn"
                        onClick={() => setSelectedInvoice(inv)}
                        title="Inspect watermarked invoice"
                      >
                        <span>Invoice</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Expenses */}
      {activeTab === 'expenses' && (
        <div>
          <div
            className="app-table-header"
            style={{ ['--grid-cols' as any]: '2.2fr 2.4fr 1.6fr 1.8fr 1fr' }}
          >
            <div>Vendor & Expense</div>
            <div>Description</div>
            <div>Amount</div>
            <div>Allocated Vehicle</div>
            <div style={{ textAlign: 'right' }}>Status</div>
          </div>

          <div className="app-cards-list">
            {expenses.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px dashed #CBD5E1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>No Dealership Expenses Recorded</div>
                <div style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '400px' }}>
                  Detailing, transportation, and workshop vendor invoices will appear here.
                </div>
              </div>
            ) : (
              expenses.map((exp: any, index: number) => {
                const palette = APP_CARD_PALETTES[index % APP_CARD_PALETTES.length];
                return (
                  <div
                    key={exp.id || index}
                    className="app-row-card"
                    style={{
                      ['--grid-cols' as any]: '2.2fr 2.4fr 1.6fr 1.8fr 1fr',
                      ['--theme-accent' as any]: palette.accent,
                      ['--theme-border' as any]: palette.border,
                      ['--theme-glow' as any]: palette.glow,
                      ['--theme-badge-bg' as any]: palette.badgeBg,
                      ['--theme-badge-text' as any]: palette.badgeText,
                    }}
                  >
                    <div className="app-row-cell-main">
                      <div className="app-row-avatar">
                        <CreditCard size={18} />
                      </div>
                      <div className="app-row-title-wrap">
                        <span className="app-row-title">{exp.vendor}</span>
                        <span className="app-row-subtitle">{exp.category}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#334155' }}>{exp.description}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>₹{exp.amount?.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748B' }}>{exp.vehicleDetails}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StatusBadge status={exp.status || 'settled'} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Create Document / Invoice Modal */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          headerContent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#6253F8',
                  background: '#E6F4EF',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                }}
              >
                New Invoice
              </span>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#0F172A' }}>
                Create Document / Invoice
              </h3>
            </div>
          }
          maxWidth="840px"
        >
          <InvoiceDocumentGenerator
            onClose={() => setIsPaymentModalOpen(false)}
            onSave={handleSaveInvoice}
            isModal={true}
          />
        </Modal>
      )}

      {/* Inspect Watermarked Invoice Modal */}
      {selectedInvoice && (() => {
        const comp =
          company.legalName || company.tradeName || company.logoUrl
            ? company
            : getCompanyProfile();
        const dealershipBrandName = comp.tradeName || comp.legalName || 'Dealership';
        const { textAccent } = getInvoiceColorSystem(comp.brandColor);

        return (
          <Modal
            isOpen={!!selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            title={`Official Invoice: ${selectedInvoice.invoiceNumber}`}
            maxWidth="780px"
            headerActions={
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="modal-header-btn-edit"
                  onClick={triggerDocumentDownload}
                  title="Print or Save as PDF"
                >
                  <Printer size={14} />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  className="modal-header-btn-close"
                  onClick={() => setSelectedInvoice(null)}
                  title="Close"
                >
                  <X size={14} />
                  <span>Close</span>
                </button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Share bar */}
              <div
                className="no-print"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                  Official Certified Dealership Document
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `*${dealershipBrandName.toUpperCase()} — OFFICIAL INVOICE*\nInvoice: ${selectedInvoice.invoiceNumber}\nCustomer: ${selectedInvoice.customerName}\nAmount: ₹${selectedInvoice.amount.toLocaleString('en-IN')}\nStatus: Settled`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>💬 WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerDocumentDownload}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Watermarked A4 Sheet Matching Reference Template */}
              <div
                className="print-invoice-sheet"
                style={{
                  position: 'relative',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #CBD5E1',
                  padding: '24px 28px',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                  minHeight: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                <DocumentWatermark
                  logoUrl={comp.logoUrl}
                  dealershipName={dealershipBrandName}
                  textAccent={textAccent}
                  enabled={comp.watermarkEnabled !== false}
                  opacity={comp.watermarkOpacity}
                />

                <div className="print-invoice-body" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          fontSize: '2.1rem',
                          fontWeight: 900,
                          color: '#0F172A',
                          margin: 0,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        INVOICE
                      </h1>
                      <div style={{ fontSize: '0.86rem', color: '#334155', marginTop: '6px', fontWeight: 600 }}>
                        Invoice no : <span style={{ fontWeight: 800, color: '#0F172A' }}>{selectedInvoice.invoiceNumber}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                        Due Date : {selectedInvoice.dueDate}
                      </div>
                    </div>

                    <DealershipBrandHeader
                      company={comp}
                      dealershipBrandName={dealershipBrandName}
                      textAccent={textAccent}
                    />
                  </div>

                  {/* Billed To */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: textAccent, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Invoice to:
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                      {selectedInvoice.customerName}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                      Showroom Delivery • Valid KYC Completed
                    </div>
                  </div>

                  {/* Table */}
                  <div className="print-invoice-items-wrap" style={{ marginBottom: '16px', flex: 1, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 800, color: '#0F172A', width: '45px' }}>No.</th>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>Product Description</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0F172A', width: '100px' }}>Price</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#0F172A', width: '60px' }}>QTY</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0F172A', width: '110px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 6px', color: '#64748B', fontWeight: 600 }}>01</td>
                          <td style={{ padding: '8px 6px', fontWeight: 600, color: '#0F172A' }}>{selectedInvoice.vehicleDetails}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#0F172A', fontWeight: 600 }}>
                            ₹{selectedInvoice.amount.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>01</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            ₹{selectedInvoice.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Method & Total */}
                  <div className="print-invoice-summary-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px', marginBottom: '16px', marginTop: 'auto' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: '3px' }}>
                        Payment Method
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5, fontWeight: 600 }}>
                        <div>Method: <span style={{ color: '#0F172A', fontWeight: 700 }}>{selectedInvoice.method || 'Bank Transfer'}</span></div>
                        <div>Reference / UTR: <span style={{ color: textAccent, fontWeight: 800 }}>{selectedInvoice.referenceNumber || 'SETTLED & VERIFIED'}</span></div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569', fontWeight: 600 }}>
                        <span>Sub Total</span>
                        <span style={{ color: '#0F172A', fontWeight: 700 }}>₹{selectedInvoice.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderTop: '2px solid #0F172A',
                          marginTop: '6px',
                          fontSize: '1.2rem',
                          fontWeight: 900,
                          color: '#0F172A',
                        }}
                      >
                        <span>Total</span>
                        <span>₹{selectedInvoice.amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <DealershipDocumentFooter company={comp} textAccent={textAccent} />
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Watermarked Receipt Preview Modal (auto-downloads & preserves exact Invoice Download design/format) */}
      {selectedReceipt && (() => {
        const comp =
          company.legalName || company.tradeName || company.logoUrl
            ? company
            : getCompanyProfile();
        const dealershipBrandName = comp.tradeName || comp.legalName || 'Dealership';
        const { textAccent } = getInvoiceColorSystem(comp.brandColor);
        const settledDateStr = new Date(selectedReceipt.settledAt || selectedReceipt.createdAt).toLocaleDateString('en-IN');

        return (
          <Modal
            isOpen={!!selectedReceipt}
            onClose={closeReceiptPreview}
            title={`Official Receipt: ${selectedReceipt.paymentNumber}`}
            maxWidth="780px"
            headerActions={
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="modal-header-btn-edit"
                  onClick={triggerDocumentDownload}
                  title="Download / Print Receipt"
                >
                  <Printer size={14} />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  className="modal-header-btn-close"
                  onClick={closeReceiptPreview}
                  title="Close receipt"
                >
                  <X size={14} />
                  <span>Close</span>
                </button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Top Receipt Preview & Download Action Bar (matches Official Invoice download bar) */}
              <div
                className="no-print"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    Receipt Preview — Official Watermarked Document
                  </span>
                  {receiptAutoDownloading && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#1D4ED8',
                        backgroundColor: '#DBEAFE',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      Auto-downloading...
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `*${dealershipBrandName.toUpperCase()} — OFFICIAL PAYMENT RECEIPT*\nReceipt: ${selectedReceipt.paymentNumber}\nCustomer: ${selectedReceipt.customerName}\nAmount Received: ₹${selectedReceipt.amount.toLocaleString('en-IN')}\nMethod: ${selectedReceipt.method.toUpperCase()}\nReference: ${selectedReceipt.referenceNumber || 'CASH'}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>💬 WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerDocumentDownload}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Watermarked A4 Receipt Preview Sheet (exact same format & design as Invoice Download) */}
              <div
                className="print-invoice-sheet"
                style={{
                  position: 'relative',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #CBD5E1',
                  padding: '24px 28px',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                  minHeight: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                <DocumentWatermark
                  logoUrl={comp.logoUrl}
                  dealershipName={dealershipBrandName}
                  textAccent={textAccent}
                  enabled={comp.watermarkEnabled !== false}
                  opacity={comp.watermarkOpacity}
                />

                <div className="print-invoice-body" style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          fontSize: '2.1rem',
                          fontWeight: 900,
                          color: '#0F172A',
                          margin: 0,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        RECEIPT
                      </h1>
                      <div style={{ fontSize: '0.86rem', color: '#334155', marginTop: '6px', fontWeight: 600 }}>
                        Receipt no : <span style={{ fontWeight: 800, color: '#0F172A' }}>{selectedReceipt.paymentNumber}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                        Settled Date : {settledDateStr}
                      </div>
                    </div>

                    <DealershipBrandHeader
                      company={comp}
                      dealershipBrandName={dealershipBrandName}
                      textAccent={textAccent}
                    />
                  </div>

                  {/* Received From */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#16A34A', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {dealershipBrandName} Official Money Receipt • Received From:
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                      {selectedReceipt.customerName}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                      Payment Verified & Settled • Official Dealership Settlement Voucher
                    </div>
                  </div>

                  {/* Receipt Itemized Table (transparent rows keep watermark visible) */}
                  <div className="print-invoice-items-wrap" style={{ marginBottom: '16px', flex: 1, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 800, color: '#0F172A', width: '45px' }}>No.</th>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 800, color: '#0F172A' }}>Receipt Description</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: '#0F172A', width: '90px' }}>Mode</th>
                          <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 800, color: '#0F172A', width: '130px' }}>Bank UTR / Ref</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: '#0F172A', width: '115px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 6px', color: '#64748B', fontWeight: 600 }}>01</td>
                          <td style={{ padding: '10px 6px', fontWeight: 600, color: '#0F172A' }}>
                            Payment Settlement — {selectedReceipt.paymentNumber}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', color: '#334155', fontWeight: 700, textTransform: 'uppercase' }}>
                            {selectedReceipt.method}
                          </td>
                          <td style={{ padding: '10px 6px', fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>
                            {selectedReceipt.referenceNumber || 'CASH-REC'}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            ₹{selectedReceipt.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Summary & Total */}
                  <div className="print-invoice-summary-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px', marginBottom: '16px', marginTop: 'auto' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: '3px' }}>
                        Payment Method & Verification
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5, fontWeight: 600 }}>
                        <div>Mode: <span style={{ color: '#0F172A', fontWeight: 700, textTransform: 'uppercase' }}>{selectedReceipt.method}</span></div>
                        <div>Bank UTR / Ref: <span style={{ color: textAccent, fontWeight: 800 }}>{selectedReceipt.referenceNumber || 'CASH-REC'}</span></div>
                        <div>In Words: <span style={{ color: '#0F172A', fontWeight: 600 }}>{numberToWordsINR(selectedReceipt.amount)}</span></div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569', fontWeight: 600 }}>
                        <span>Status</span>
                        <span style={{ color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' }}>Settled</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderTop: '2px solid #0F172A',
                          marginTop: '6px',
                          fontSize: '1.2rem',
                          fontWeight: 900,
                          color: '#15803D',
                        }}
                      >
                        <span>Net Received</span>
                        <span>₹{selectedReceipt.amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <DealershipDocumentFooter company={comp} textAccent={textAccent} />
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
