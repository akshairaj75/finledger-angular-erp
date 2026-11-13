import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { Customer } from '../../../core/models/customer.model';
import { Item, Warehouse } from '../../../core/models/inventory.model';
import { InvoiceDocType, InvoiceLineRequest, InvoiceRequest } from '../../../core/models/invoice.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { NotificationService } from '../../../core/services/notification.service';
import { applyServerFieldErrors, clearServerFieldErrors } from '../../../core/utils/api-error.util';
import { AccountService } from '../../accounting/services/account.service';
import { InventoryService } from '../../inventory/services/inventory.service';
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
  private inventoryService = inject(InventoryService);
  private notificationService = inject(NotificationService);

  invoiceForm!: FormGroup;

  customers = signal<Customer[]>([]);
  selectedCustomer = signal<Customer | null>(null);
  taxRates = signal<TaxRate[]>([]);
  accounts = signal<Account[]>([]);
  warehouses = signal<Warehouse[]>([]);
  catalogItems = signal<Item[]>([]);
  stockBalances = signal<Map<string, number>>(new Map());

  loadingData = signal(true);
  saving = signal(false);
  previewingPdf = signal(false);

  totals = signal<InvoiceCalculationSummary>({
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0
  });

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
      warehouseId: [null],
      invoiceDate: [today, [Validators.required]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      dueDate: [defaultDueDate, [Validators.required]],
      currencyCode: ['AED', [Validators.required]],
      exchangeRate: [1.0, [Validators.required, Validators.min(0.000001)]],
      notes: ['Thank you for your business. Payment is due within agreed terms.'],
      lines: this.fb.array([])
    });

    this.invoiceForm.get('warehouseId')?.valueChanges.subscribe(() => {
      this.refreshAllLineStock();
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
    this.loadingData.set(true);

    // Load customers
    this.customerService.getCustomers({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.customers.set(page.content);
      }
    });

    // Load tax rates
    this.taxRateService.getTaxRates().subscribe({
      next: rates => {
        this.taxRates.set(rates);
        this.recalculateAllTotals();
      }
    });

    // Load revenue accounts
    this.accountService.getAccounts(0, 200).subscribe({
      next: page => {
        this.accounts.set(page.content);
      }
    });

    // Load warehouses
    this.inventoryService.getWarehouses().subscribe({
      next: whs => {
        this.warehouses.set(whs);
        const defaultWh = whs.find(w => w.isDefault) || (whs.length > 0 ? whs[0] : null);
        if (defaultWh) {
          this.invoiceForm.patchValue({ warehouseId: defaultWh.id });
        }
      }
    });

    // Load inventory catalog items
    this.inventoryService.getItems({ active: true, size: 500 }).subscribe({
      next: page => {
        this.catalogItems.set(page.content);
        this.loadingData.set(false);
      },
      error: () => {
        this.loadingData.set(false);
      }
    });
  }

  createLineGroup(): FormGroup {
    const accList = this.accounts();
    const rateList = this.taxRates();
    // Look for default revenue account (code 4000 or type INCOME)
    const revAcc = accList.find(a => a.code === '4000' || a.accountType === 'INCOME');
    // Look for standard 5% tax rate
    const standardTax = rateList.find(t => t.rate === 5.0 || t.code.includes('STANDARD'));

    return this.fb.group({
      itemId: [null],
      description: ['', [Validators.required]],
      accountId: [revAcc ? revAcc.id : (accList.length > 0 ? accList[0].id : null), [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discountPct: [0, [Validators.min(0), Validators.max(100)]],
      taxRateId: [standardTax ? standardTax.id : null]
    });
  }

  onItemSelect(index: number, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const itemId = Number(target.value);
    const item = this.catalogItems().find(i => i.id === itemId);
    const lineGroup = this.linesArray.at(index) as FormGroup;

    if (item) {
      lineGroup.patchValue({
        description: item.name,
        unitPrice: item.salesPrice || 0,
        taxRateId: item.taxRateId ?? lineGroup.get('taxRateId')?.value,
        accountId: item.incomeAccountId ?? lineGroup.get('accountId')?.value
      });

      this.fetchItemStock(item.id);
    }
  }

  private fetchItemStock(itemId: number): void {
    const whId = this.invoiceForm.get('warehouseId')?.value;
    if (whId) {
      this.inventoryService.getStockBalance(itemId, whId).subscribe({
        next: bal => {
          this.stockBalances.update(prev => {
            const next = new Map(prev);
            next.set(`${itemId}_${whId}`, bal.qtyOnHand);
            return next;
          });
        },
        error: () => {
          this.stockBalances.update(prev => {
            const next = new Map(prev);
            next.set(`${itemId}_${whId}`, 0);
            return next;
          });
        }
      });
    }
  }

  private refreshAllLineStock(): void {
    for (let i = 0; i < this.linesArray.length; i++) {
      const itemId = this.linesArray.at(i).get('itemId')?.value;
      if (itemId) {
        this.fetchItemStock(itemId);
      }
    }
  }

  getLineStockInfo(index: number): string | null {
    const line = this.linesArray.at(index);
    const itemId = line.get('itemId')?.value;
    if (!itemId) return null;

    const item = this.catalogItems().find(i => i.id === itemId);
    if (!item || item.itemType !== 'INVENTORY') return null;

    const whId = this.invoiceForm.get('warehouseId')?.value;
    const wh = this.warehouses().find(w => w.id === whId);
    const key = `${itemId}_${whId}`;
    const avail = this.stockBalances().get(key) ?? 0;

    return `Available: ${avail} ${item.unit} in ${wh ? wh.code : 'Warehouse'}`;
  }

  getLineStockWarning(index: number): string | null {
    const line = this.linesArray.at(index);
    const itemId = line.get('itemId')?.value;
    if (!itemId) return null;

    const item = this.catalogItems().find(i => i.id === itemId);
    if (!item || item.itemType !== 'INVENTORY') return null;

    const whId = this.invoiceForm.get('warehouseId')?.value;
    const key = `${itemId}_${whId}`;
    const avail = this.stockBalances().get(key) ?? 0;
    const requested = Number(line.get('quantity')?.value || 0);

    if (requested > avail) {
      return `⚠️ Insufficient stock (Available: ${avail}, Requested: ${requested})`;
    }
    return null;
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
    const customer = this.customers().find(c => c.id === custId) || null;
    this.selectedCustomer.set(customer);

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
      const rate = this.taxRates().find(r => r.id === Number(taxRateId));
      if (rate) taxPct = rate.rate;
    }

    return LineTotalsCalculator.calculateLine(qty, price, disc, taxPct);
  }

  private recalculateAllTotals(): void {
    const rates = this.taxRates();
    const linesData = this.linesArray.controls.map(control => {
      const taxRateId = control.get('taxRateId')?.value;
      let taxRatePct = 0;
      if (taxRateId) {
        const rate = rates.find(r => r.id === Number(taxRateId));
        if (rate) taxRatePct = rate.rate;
      }
      return {
        quantity: Number(control.get('quantity')?.value) || 0,
        unitPrice: Number(control.get('unitPrice')?.value) || 0,
        discountPct: Number(control.get('discountPct')?.value) || 0,
        taxRatePct
      };
    });

    this.totals.set(LineTotalsCalculator.calculateInvoiceTotals(linesData));
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
      itemId: l.itemId ? Number(l.itemId) : undefined,
      warehouseId: formVal.warehouseId ? Number(formVal.warehouseId) : undefined,
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

    this.saving.set(true);
    clearServerFieldErrors(this.invoiceForm);
    this.invoiceService.createInvoice(payload).subscribe({
      next: created => {
        this.saving.set(false);
        this.notificationService.success(`Draft Invoice ${created.invoiceNo || '#' + created.id} saved successfully!`);
        this.router.navigate(['/sales/invoices']);
      },
      error: err => {
        this.saving.set(false);
        applyServerFieldErrors(this.invoiceForm, err);
      }
    });
  }

  saveAndSend(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.saving.set(true);
    clearServerFieldErrors(this.invoiceForm);
    this.invoiceService.createInvoice({ ...payload, send: true }).subscribe({
      next: sent => {
        this.saving.set(false);
        this.notificationService.success(`Invoice ${sent.invoiceNo || '#' + sent.id} successfully generated, posted to GL, and marked SENT!`);
        this.router.navigate(['/sales/invoices']);
      },
      error: err => {
        this.saving.set(false);
        applyServerFieldErrors(this.invoiceForm, err);
      }
    });
  }

  previewPdf(): void {
    const payload = this.preparePayload();
    if (!payload) return;

    this.previewingPdf.set(true);
    clearServerFieldErrors(this.invoiceForm);
    // Save as draft first, then fetch PDF
    this.invoiceService.createInvoice(payload).subscribe({
      next: created => {
        this.invoiceService.getInvoicePdf(created.id).subscribe({
          next: blob => {
            this.previewingPdf.set(false);
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
            this.notificationService.success(`Invoice PDF generated successfully!`);
          },
          error: () => {
            this.previewingPdf.set(false);
          }
        });
      },
      error: err => {
        this.previewingPdf.set(false);
        applyServerFieldErrors(this.invoiceForm, err);
      }
    });
  }
}
