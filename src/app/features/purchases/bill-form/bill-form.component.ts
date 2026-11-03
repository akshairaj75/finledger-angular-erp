import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { BillDocType, BillLineRequest, BillRequest } from '../../../core/models/bill.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { Vendor } from '../../../core/models/vendor.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../../accounting/services/account.service';
import { TaxRateService } from '../../sales/services/tax-rate.service';
import { InvoiceCalculationSummary, LineCalculationResult, LineTotalsCalculator } from '../../sales/validators/line-totals.calculator';
import { BillService } from '../services/bill.service';
import { VendorService } from '../services/vendor.service';

@Component({
  selector: 'app-bill-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './bill-form.component.html',
  styleUrls: ['./bill-form.component.css']
})
export class BillFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private vendorService = inject(VendorService);
  private billService = inject(BillService);
  private taxRateService = inject(TaxRateService);
  private accountService = inject(AccountService);
  private notificationService = inject(NotificationService);

  billForm!: FormGroup;

  vendors: Vendor[] = [];
  selectedVendor: Vendor | null = null;
  taxRates: TaxRate[] = [];
  accounts: Account[] = [];

  loadingData = true;
  saving = false;

  totals: InvoiceCalculationSummary = {
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0
  };

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    const defaultDueDate = this.calculateDueDateFromDate(today, 30);

    this.billForm = this.fb.group({
      docType: ['BILL' as BillDocType, [Validators.required]],
      vendorId: [null, [Validators.required]],
      vendorInvoiceNo: ['', [Validators.required]],
      billDate: [today, [Validators.required]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      dueDate: [defaultDueDate, [Validators.required]],
      currencyCode: ['AED', [Validators.required]],
      exchangeRate: [1.0, [Validators.required, Validators.min(0.000001)]],
      notes: ['Supplier bill received and verified for payment.'],
      lines: this.fb.array([])
    });

    // Add first line by default
    this.addLine();

    // Recalculate totals on value change
    this.billForm.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });
  }

  get linesArray(): FormArray {
    return this.billForm.get('lines') as FormArray;
  }

  private loadDependencies(): void {
    this.loadingData = true;

    // Load vendors
    this.vendorService.getVendors({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.vendors = page.content;
      }
    });

    // Load tax rates
    this.taxRateService.getTaxRates().subscribe({
      next: rates => {
        this.taxRates = rates;
      }
    });

    // Load expense accounts
    this.accountService.getAccounts(0, 200).subscribe({
      next: page => {
        this.accounts = page.content;
        this.loadingData = false;
      },
      error: () => {
        this.loadingData = false;
      }
    });
  }

  createLineGroup(): FormGroup {
    // Look for default expense account (code 5000 or type EXPENSE)
    const expAcc = this.accounts.find(a => a.code?.startsWith('5') || a.accountType === 'EXPENSE');
    // Look for standard 5% tax rate
    const standardTax = this.taxRates.find(t => t.rate === 5.0 || t.code.includes('STANDARD'));

    return this.fb.group({
      description: ['', [Validators.required]],
      accountId: [expAcc ? expAcc.id : (this.accounts.length > 0 ? this.accounts[0].id : null), [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      taxRateId: [standardTax ? standardTax.id : null]
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLineGroup());
    this.recalculateAllTotals();
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
      this.recalculateAllTotals();
    } else {
      this.notificationService.warning('A bill must contain at least one line item.');
    }
  }

  onVendorSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const vendorId = Number(target.value);
    const vendor = this.vendors.find(v => v.id === vendorId) || null;
    this.selectedVendor = vendor;

    if (vendor) {
      const terms = vendor.paymentTermsDays ?? 30;
      const billDate = this.billForm.get('billDate')?.value || new Date().toISOString().substring(0, 10);
      const computedDueDate = this.calculateDueDateFromDate(billDate, terms);

      this.billForm.patchValue({
        paymentTermsDays: terms,
        dueDate: computedDueDate,
        currencyCode: vendor.currencyCode || 'AED'
      });
    }
  }

  onBillDateOrTermsChange(): void {
    const billDate = this.billForm.get('billDate')?.value;
    const terms = Number(this.billForm.get('paymentTermsDays')?.value) || 0;
    if (billDate) {
      const computedDueDate = this.calculateDueDateFromDate(billDate, terms);
      this.billForm.patchValue({ dueDate: computedDueDate }, { emitEvent: false });
    }
  }

  private calculateDueDateFromDate(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  }

  getLineCalculatedValues(index: number): LineCalculationResult {
    const group = this.linesArray.at(index);
    if (!group) {
      return { grossAmount: 0, discountAmount: 0, netAmount: 0, taxAmount: 0, lineTotal: 0 };
    }
    const qty = group.get('quantity')?.value || 0;
    const price = group.get('unitPrice')?.value || 0;
    const taxRateId = group.get('taxRateId')?.value;

    let taxPct = 0;
    if (taxRateId) {
      const rate = this.taxRates.find(r => r.id === Number(taxRateId));
      if (rate) taxPct = rate.rate;
    }

    return LineTotalsCalculator.calculateLine(qty, price, 0, taxPct);
  }

  private recalculateAllTotals(): void {
    const linesData = this.linesArray.controls.map(control => {
      const taxRateId = control.get('taxRateId')?.value;
      let taxRatePct = 0;
      if (taxRateId) {
        const rate = this.taxRates.find(r => r.id === Number(taxRateId));
        if (rate) taxRatePct = rate.rate;
      }
      return {
        quantity: Number(control.get('quantity')?.value) || 0,
        unitPrice: Number(control.get('unitPrice')?.value) || 0,
        discountPct: 0,
        taxRatePct
      };
    });

    this.totals = LineTotalsCalculator.calculateInvoiceTotals(linesData);
  }

  private preparePayload(): BillRequest | null {
    if (this.billForm.invalid) {
      this.billForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields and correct invalid line entries.');
      return null;
    }

    const formVal = this.billForm.value;
    const lines: BillLineRequest[] = formVal.lines.map((l: any, idx: number) => ({
      lineNo: idx + 1,
      description: l.description.trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      taxRateId: l.taxRateId ? Number(l.taxRateId) : undefined,
      accountId: Number(l.accountId)
    }));

    return {
      docType: formVal.docType,
      vendorInvoiceNo: formVal.vendorInvoiceNo?.trim() || undefined,
      vendorId: Number(formVal.vendorId),
      billDate: formVal.billDate,
      dueDate: formVal.dueDate,
      currencyCode: formVal.currencyCode,
      exchangeRate: Number(formVal.exchangeRate) || 1.0,
      notes: formVal.notes?.trim() || undefined,
      lines
    };
  }

  saveDraft(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.saving = true;
    this.billService.createBill(payload).subscribe({
      next: created => {
        this.saving = false;
        this.notificationService.success(`Draft Bill ${created.billNo || '#' + created.id} saved successfully!`);
        this.router.navigate(['/purchases/bills']);
      },
      error: err => {
        this.saving = false;
        this.notificationService.error(err?.error?.message || 'Failed to save draft bill');
      }
    });
  }

  approveBill(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.saving = true;
    this.billService.createBill(payload).subscribe({
      next: created => {
        // Approve bill to post to General Ledger
        this.billService.approveBill(created.id).subscribe({
          next: approved => {
            this.saving = false;
            this.notificationService.success(`Bill ${approved.billNo} approved and successfully posted to General Ledger!`);
            this.router.navigate(['/purchases/bills']);
          },
          error: err => {
            this.saving = false;
            this.notificationService.warning(`Bill saved as Draft (#${created.id}), but approval failed: ` + (err?.error?.message || 'Unknown error'));
            this.router.navigate(['/purchases/bills']);
          }
        });
      },
      error: err => {
        this.saving = false;
        this.notificationService.error(err?.error?.message || 'Failed to create bill');
      }
    });
  }
}

