import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BillService } from './services/bill.service';
import { LineTotalsCalculator } from '../sales/validators/line-totals.calculator';

describe('Purchases Module - Bill Line Totals & Input VAT Calculation', () => {
  it('should calculate bill line subtotal and 5% input VAT properly', () => {
    // 20 software licenses @ 150 AED, 0% discount, 5% standard VAT
    // Net: 3000 AED
    // Input VAT: 150 AED
    // Total: 3150 AED
    const line = LineTotalsCalculator.calculateLine(20, 150, 0, 5);

    expect(line.netAmount).toBe(3000);
    expect(line.taxAmount).toBe(150);
    expect(line.lineTotal).toBe(3150);
  });

  it('should handle zero-rated or exempt supplier bill lines correctly', () => {
    // 5 consulting hours @ 400 AED, 0% VAT
    const line = LineTotalsCalculator.calculateLine(5, 400, 0, 0);

    expect(line.netAmount).toBe(2000);
    expect(line.taxAmount).toBe(0);
    expect(line.lineTotal).toBe(2000);
  });

  it('should calculate overall bill summary across mixed tax rate lines', () => {
    const lines = [
      { quantity: 10, unitPrice: 100, taxRatePct: 5 }, // 1000 + 50 = 1050
      { quantity: 2, unitPrice: 500, taxRatePct: 0 }   // 1000 + 0 = 1000
    ];

    const summary = LineTotalsCalculator.calculateInvoiceTotals(lines);

    expect(summary.subtotal).toBe(2000);
    expect(summary.taxTotal).toBe(50);
    expect(summary.total).toBe(2050);
  });
});

describe('Purchases Module - Oldest-First Payment Auto-Allocation', () => {
  interface MockOpenBill {
    id: number;
    billNo: string;
    dueDate: string;
    balanceDue: number;
    allocatedAmount: number;
  }

  function autoAllocateOldestFirst(bills: MockOpenBill[], amountPaid: number): {
    totalAllocated: number;
    unappliedAmount: number;
  } {
    const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    let remaining = amountPaid;

    for (const bill of sorted) {
      if (remaining <= 0) {
        bill.allocatedAmount = 0;
      } else {
        const canPay = Math.min(bill.balanceDue, remaining);
        bill.allocatedAmount = Math.round(canPay * 100) / 100;
        remaining = Math.round((remaining - bill.allocatedAmount) * 100) / 100;
      }
    }

    const totalAllocated = Math.round(sorted.reduce((sum, b) => sum + b.allocatedAmount, 0) * 100) / 100;
    const unappliedAmount = remaining > 0 ? Math.round(remaining * 100) / 100 : 0;

    return { totalAllocated, unappliedAmount };
  }

  it('should allocate oldest due date bill first and allocate remaining to subsequent bills', () => {
    const bills: MockOpenBill[] = [
      { id: 2, billNo: 'BILL-2026-0002', dueDate: '2026-02-28', balanceDue: 800, allocatedAmount: 0 },
      { id: 1, billNo: 'BILL-2026-0001', dueDate: '2026-01-15', balanceDue: 500, allocatedAmount: 0 },
      { id: 3, billNo: 'BILL-2026-0003', dueDate: '2026-03-31', balanceDue: 1200, allocatedAmount: 0 }
    ];

    // Total open payables: 2500 AED. Paid: 1000 AED.
    // BILL-0001 (Jan 15) takes 500 AED (fully settled).
    // BILL-0002 (Feb 28) takes 500 AED (partially settled).
    // BILL-0003 (Mar 31) gets 0.
    const res = autoAllocateOldestFirst(bills, 1000);

    expect(res.totalAllocated).toBe(1000);
    expect(res.unappliedAmount).toBe(0);

    const b1 = bills.find(b => b.id === 1)!;
    const b2 = bills.find(b => b.id === 2)!;
    const b3 = bills.find(b => b.id === 3)!;

    expect(b1.allocatedAmount).toBe(500);
    expect(b2.allocatedAmount).toBe(500);
    expect(b3.allocatedAmount).toBe(0);
  });

  it('should record unapplied advance when supplier payment exceeds total open bills', () => {
    const bills: MockOpenBill[] = [
      { id: 1, billNo: 'BILL-2026-0001', dueDate: '2026-01-20', balanceDue: 750, allocatedAmount: 0 }
    ];

    // Paying 1000 AED to vendor with 750 AED balance
    const res = autoAllocateOldestFirst(bills, 1000);

    expect(res.totalAllocated).toBe(750);
    expect(res.unappliedAmount).toBe(250);
    expect(bills[0].allocatedAmount).toBe(750);
  });
});

describe('Purchases Module - BillService HTTP Contract', () => {
  let service: BillService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BillService]
    });
    service = TestBed.inject(BillService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should forward status, from, to, and q query params on getBills', () => {
    service.getBills({
      status: 'APPROVED',
      from: '2026-01-01',
      to: '2026-01-31',
      q: 'SUP',
      page: 0,
      size: 20
    }).subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/bills'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('APPROVED');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    expect(req.request.params.get('q')).toBe('SUP');
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 });
  });
});

