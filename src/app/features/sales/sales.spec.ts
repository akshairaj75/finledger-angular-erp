import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvoiceService } from './services/invoice.service';
import { LineTotalsCalculator } from './validators/line-totals.calculator';

describe('Sales Module - LineTotalsCalculator', () => {
  it('should calculate standard single line correctly with 5% VAT', () => {
    // 10 units @ 100 AED, 10% discount, 5% VAT
    // Gross: 1000
    // Discount: 100 (10%)
    // Net: 900
    // VAT: 45 (5% of 900)
    // Line Total: 945
    const res = LineTotalsCalculator.calculateLine(10, 100, 10, 5);

    expect(res.grossAmount).toBe(1000);
    expect(res.discountAmount).toBe(100);
    expect(res.netAmount).toBe(900);
    expect(res.taxAmount).toBe(45);
    expect(res.lineTotal).toBe(945);
  });

  it('should handle zero tax and zero discount', () => {
    const res = LineTotalsCalculator.calculateLine(5, 50, 0, 0);

    expect(res.grossAmount).toBe(250);
    expect(res.discountAmount).toBe(0);
    expect(res.netAmount).toBe(250);
    expect(res.taxAmount).toBe(0);
    expect(res.lineTotal).toBe(250);
  });

  it('should compute full invoice multi-line totals properly', () => {
    const lines = [
      { quantity: 2, unitPrice: 500, discountPct: 0, taxRatePct: 5 }, // 1000 net, 50 vat = 1050
      { quantity: 1, unitPrice: 200, discountPct: 10, taxRatePct: 5 }, // 180 net, 9 vat = 189
      { quantity: 4, unitPrice: 25, discountPct: 0, taxRatePct: 0 }    // 100 net, 0 vat = 100
    ];

    const summary = LineTotalsCalculator.calculateInvoiceTotals(lines);

    expect(summary.subtotal).toBe(1280);
    expect(summary.discountTotal).toBe(20);
    expect(summary.taxTotal).toBe(59);
    expect(summary.total).toBe(1339);
  });
});

describe('Sales Module - Oldest-First Receipt Auto-Allocation', () => {
  interface MockOpenInvoice {
    id: number;
    invoiceNo: string;
    dueDate: string;
    balanceDue: number;
    allocatedAmount: number;
  }

  function autoAllocateOldestFirst(invoices: MockOpenInvoice[], amountReceived: number): {
    totalAllocated: number;
    unappliedAmount: number;
  } {
    // Sort oldest first
    const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    let remaining = amountReceived;

    for (const inv of sorted) {
      if (remaining <= 0) {
        inv.allocatedAmount = 0;
      } else {
        const canPay = Math.min(inv.balanceDue, remaining);
        inv.allocatedAmount = Math.round(canPay * 100) / 100;
        remaining = Math.round((remaining - inv.allocatedAmount) * 100) / 100;
      }
    }

    const totalAllocated = Math.round(sorted.reduce((sum, i) => sum + i.allocatedAmount, 0) * 100) / 100;
    const unappliedAmount = remaining > 0 ? Math.round(remaining * 100) / 100 : 0;

    return { totalAllocated, unappliedAmount };
  }

  it('should allocate oldest due date first and leave remainder for newer invoices', () => {
    const invoices: MockOpenInvoice[] = [
      { id: 2, invoiceNo: 'INV-2026-0002', dueDate: '2026-02-15', balanceDue: 600, allocatedAmount: 0 },
      { id: 1, invoiceNo: 'INV-2026-0001', dueDate: '2026-01-10', balanceDue: 400, allocatedAmount: 0 },
      { id: 3, invoiceNo: 'INV-2026-0003', dueDate: '2026-03-01', balanceDue: 500, allocatedAmount: 0 }
    ];

    // Total balance: 1500. Received: 750.
    // Oldest (INV-0001 due Jan 10) takes 400.
    // Next oldest (INV-0002 due Feb 15) takes remaining 350.
    // INV-0003 gets 0.
    const res = autoAllocateOldestFirst(invoices, 750);

    expect(res.totalAllocated).toBe(750);
    expect(res.unappliedAmount).toBe(0);

    const inv1 = invoices.find(i => i.id === 1)!;
    const inv2 = invoices.find(i => i.id === 2)!;
    const inv3 = invoices.find(i => i.id === 3)!;

    expect(inv1.allocatedAmount).toBe(400);
    expect(inv2.allocatedAmount).toBe(350);
    expect(inv3.allocatedAmount).toBe(0);
  });

  it('should track unapplied advance when receipt amount exceeds total open balance', () => {
    const invoices: MockOpenInvoice[] = [
      { id: 1, invoiceNo: 'INV-2026-0001', dueDate: '2026-01-10', balanceDue: 300, allocatedAmount: 0 }
    ];

    const res = autoAllocateOldestFirst(invoices, 500);

    expect(res.totalAllocated).toBe(300);
    expect(res.unappliedAmount).toBe(200);
    expect(invoices[0].allocatedAmount).toBe(300);
  });
});

describe('Sales Module - InvoiceService HTTP Contract', () => {
  let service: InvoiceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), InvoiceService]
    });
    service = TestBed.inject(InvoiceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should forward status, docType, from, to, and q query params on getInvoices', () => {
    service.getInvoices({
      status: 'SENT',
      docType: 'INVOICE',
      from: '2026-01-01',
      to: '2026-01-31',
      q: 'ACME',
      page: 1,
      size: 20
    }).subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/invoices'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('SENT');
    expect(req.request.params.get('docType')).toBe('INVOICE');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    expect(req.request.params.get('q')).toBe('ACME');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 20, number: 1 });
  });

  it('should include atomic send flag in createInvoice request payload', () => {
    service.createInvoice({
      docType: 'INVOICE',
      customerId: 10,
      invoiceDate: '2026-02-01',
      dueDate: '2026-03-03',
      currencyCode: 'AED',
      exchangeRate: 1,
      send: true,
      lines: [{ lineNo: 1, description: 'Services', quantity: 1, unitPrice: 100, discountPct: 0, accountId: 5 }]
    }).subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/invoices'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.send).toBe(true);
    req.flush({ id: 99, invoiceNo: 'INV-2026-0099', status: 'SENT' });
  });
});

