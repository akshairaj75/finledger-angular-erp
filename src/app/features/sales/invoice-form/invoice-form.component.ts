import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { Customer } from '../../../core/models/customer.model';
import { InvoiceDocType, InvoiceLineRequest, InvoiceRequest } from '../../../core/models/invoice.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../../accounting/services/account.service';
import { CustomerService } from '../services/customer.service';
import { InvoiceService } from '../services/invoice.service';
import { TaxRateService } from '../services/tax-rate.service';
import { InvoiceCalculationSummary, LineCalculationResult, LineTotalsCalculator } from '../validators/line-totals.calculator';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css']
})
export class InvoiceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private invoiceService = inject(InvoiceService);
  private taxRateService = inject(TaxRateService);
  private accountService = inject(AccountService);
  private notificationService = inject(NotificationService);

  invoiceForm!: FormGroup;

  customers: Customer[] = [];
  selectedCustomer: Customer | null = null;
  taxRates: TaxRate[] = [];
  accounts: Account[] = [];

  loadingData = true;
  saving = false;
  previewingPdf = false;

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

    this.invoiceForm = this.fb.group({
      docType: ['INVOICE' as InvoiceDocType, [Validators.required]],
      customerId: [null, [Validators.required]],
      invoiceDate: [today, [Validators.required]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      dueDate: [defaultDueDate, [Validators.required]],
      currencyCode: ['AED', [Validators.required]],
      exchangeRate: [1.0, [Validators.required, Validators.min(0.000001)]],
      notes: ['Thank you for your business. Payment is due within agreed terms.'],
      lines: this.fb.array([])
    });

    // Add first line by default
    this.addLine();

    // Listen to form changes for live total recalculation
    this.invoiceForm.valueChanges.subscribe(() => {
      this.recalculateAllTotals();
    });
  }

  get linesArray(): FormArray {
    return this.invoiceForm.get('lines') as FormArray;
  }

  private loadDependencies(): void {
    this.loadingData = true;

    // Load customers
    this.customerService.getCustomers({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.customers = page.content;
      }
    });

    // Load tax rates
    this.taxRateService.getTaxRates().subscribe({
      next: rates => {
        this.taxRates = rates;
      }
    });

    // Load revenue accounts
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
    // Look for default revenue account (code 4000 or type INCOME)
    const revAcc = this.accounts.find(a => a.code === '4000' || a.accountType === 'INCOME');
    // Look for standard 5% tax rate
    const standardTax = this.taxRates.find(t => t.rate === 5.0 || t.code.includes('STANDARD'));

    return this.fb.group({
      description: ['', [Validators.required]],
      accountId: [revAcc ? revAcc.id : (this.accounts.length > 0 ? this.accounts[0].id : null), [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discountPct: [0, [Validators.min(0), Validators.max(100)]],
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
      this.notificationService.warning('An invoice must contain at least one line item.');
    }
  }

  onCustomerSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const custId = Number(target.value);
    const customer = this.customers.find(c => c.id === custId) || null;
    this.selectedCustomer = customer;

    if (customer) {
      const terms = customer.paymentTermsDays ?? 30;
      const invDate = this.invoiceForm.get('invoiceDate')?.value || new Date().toISOString().substring(0, 10);
      const computedDueDate = this.calculateDueDateFromDate(invDate, terms);

      this.invoiceForm.patchValue({
        paymentTermsDays: terms,
        dueDate: computedDueDate,
        currencyCode: customer.currencyCode || 'AED'
      });
    }
  }

  onInvoiceDateOrTermsChange(): void {
    const invDate = this.invoiceForm.get('invoiceDate')?.value;
    const terms = Number(this.invoiceForm.get('paymentTermsDays')?.value) || 0;
    if (invDate) {
      const computedDueDate = this.calculateDueDateFromDate(invDate, terms);
      this.invoiceForm.patchValue({ dueDate: computedDueDate }, { emitEvent: false });
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
    const disc = group.get('discountPct')?.value || 0;
    const taxRateId = group.get('taxRateId')?.value;

    let taxPct = 0;
    if (taxRateId) {
      const rate = this.taxRates.find(r => r.id === Number(taxRateId));
      if (rate) taxPct = rate.rate;
    }

    return LineTotalsCalculator.calculateLine(qty, price, disc, taxPct);
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
        discountPct: Number(control.get('discountPct')?.value) || 0,
        taxRatePct
      };
    });

    this.totals = LineTotalsCalculator.calculateInvoiceTotals(linesData);
  }

  private preparePayload(): InvoiceRequest | null {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields and correct invalid line entries.');
      return null;
    }

    const formVal = this.invoiceForm.value;
    const lines: InvoiceLineRequest[] = formVal.lines.map((l: any, idx: number) => ({
      lineNo: idx + 1,
      description: l.description.trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountPct: Number(l.discountPct) || 0,
      taxRateId: l.taxRateId ? Number(l.taxRateId) : undefined,
      accountId: Number(l.accountId)
    }));

    return {
      docType: formVal.docType,
      customerId: Number(formVal.customerId),
      invoiceDate: formVal.invoiceDate,
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
    this.invoiceService.createInvoice(payload).subscribe({
      next: created => {
        this.saving = false;
        this.notificationService.success(`Draft Invoice ${created.invoiceNo || '#' + created.id} saved successfully!`);
        this.router.navigate(['/sales/invoices']);
      },
      error: err => {
        this.saving = false;
        this.notificationService.error(err?.error?.message || 'Failed to save draft invoice');
      }
    });
  }

  saveAndSend(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.saving = true;
    this.invoiceService.createInvoice(payload).subscribe({
      next: created => {
        // Send invoice to trigger GL posting and formal number generation
        this.invoiceService.sendInvoice(created.id).subscribe({
          next: sent => {
            this.saving = false;
            this.notificationService.success(`Invoice ${sent.invoiceNo} successfully generated, posted to GL, and marked SENT!`);
            this.router.navigate(['/sales/invoices']);
          },
          error: err => {
            this.saving = false;
            this.notificationService.warning(`Invoice saved as Draft (#${created.id}), but failed to post to GL: ` + (err?.error?.message || 'Unknown error'));
            this.router.navigate(['/sales/invoices']);
          }
        });
      },
      error: err => {
        this.saving = false;
        this.notificationService.error(err?.error?.message || 'Failed to create invoice');
      }
    });
  }

  previewPdf(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.previewingPdf = true;
    // Save as draft first, then fetch PDF
    this.invoiceService.createInvoice(payload).subscribe({
      next: created => {
        this.invoiceService.getInvoicePdf(created.id).subscribe({
          next: blob => {
            this.previewingPdf = false;
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
            this.notificationService.success(`Invoice PDF generated successfully!`);
          },
          error: err => {
            this.previewingPdf = false;
            this.notificationService.error(err?.error?.message || 'Failed to render PDF preview');
          }
        });
      },
      error: err => {
        this.previewingPdf = false;
        this.notificationService.error(err?.error?.message || 'Failed to prepare invoice for PDF preview');
      }
    });
  }
}
