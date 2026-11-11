import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import {
  Opportunity,
  Quotation,
  QuotationLineRequest,
  QuotationRequest,
  QuotationStatus
} from '../../../core/models/crm.model';
import { Customer } from '../../../core/models/customer.model';
import { Item } from '../../../core/models/inventory.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { NotificationService } from '../../../core/services/notification.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { CustomerService } from '../../sales/services/customer.service';
import { TaxRateService } from '../../sales/services/tax-rate.service';
import { OpportunityService } from '../services/opportunity.service';
import { QuotationService } from '../services/quotation.service';

@Component({
  selector: 'app-quotation-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './quotation-form.component.html',
  styleUrls: ['./quotation-form.component.css']
})
export class QuotationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quotationService = inject(QuotationService);
  private customerService = inject(CustomerService);
  private opportunityService = inject(OpportunityService);
  private inventoryService = inject(InventoryService);
  private taxRateService = inject(TaxRateService);
  private notificationService = inject(NotificationService);

  quoteId = signal<number | null>(null);
  currentQuotation = signal<Quotation | null>(null);
  quotationForm!: FormGroup;
  private formRevision = signal<number>(0);

  customers = signal<Customer[]>([]);
  opportunities = signal<Opportunity[]>([]);
  items = signal<Item[]>([]);
  taxRates = signal<TaxRate[]>([]);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  actionInProgress = signal<boolean>(false);

  // Recent Quotes List view toggle
  recentQuotations = signal<Quotation[]>([]);
  showRecentQuotes = signal<boolean>(false);

  // Real-time Calculations
  subtotal = computed<number>(() => {
    this.formRevision();
    return this.linesArray.controls.reduce((sum, ctrl) => {
      const qty = Number(ctrl.get('quantity')?.value || 0);
      const price = Number(ctrl.get('unitPrice')?.value || 0);
      const disc = Number(ctrl.get('discountPct')?.value || 0);
      const net = qty * price * (1 - disc / 100);
      return sum + net;
    }, 0);
  });

  taxTotal = computed<number>(() => {
    // 5% standard VAT
    return Math.round(this.subtotal() * 0.05 * 100) / 100;
  });

  grandTotal = computed<number>(() => {
    return Math.round((this.subtotal() + this.taxTotal()) * 100) / 100;
  });

  ngOnInit(): void {
    this.initForm();
    this.loadLookups();

    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam && idParam !== 'new') {
        const parsedId = Number(idParam);
        this.quoteId.set(parsedId);
        this.loadQuotation(parsedId);
      } else {
        this.quoteId.set(null);
        this.checkQueryParams();
      }
    });

    this.loadRecentQuotes();
  }

  private initForm(): void {
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    const validUntilStr = expiry.toISOString().split('T')[0];

    this.quotationForm = this.fb.group({
      quoteDate: [today, [Validators.required]],
      validUntil: [validUntilStr, [Validators.required]],
      customerId: [null],
      opportunityId: [null],
      leadId: [null],
      currencyCode: ['AED', [Validators.required]],
      lines: this.fb.array([])
    });

    this.quotationForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formRevision.update(v => v + 1));

    // Add at least one default line
    this.addLine();
  }

  get linesArray(): FormArray {
    return this.quotationForm.get('lines') as FormArray;
  }

  createLineGroup(): FormGroup {
    return this.fb.group({
      lineNo: [this.linesArray ? this.linesArray.length + 1 : 1],
      itemId: [null],
      description: ['', [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      discountPct: [0, [Validators.min(0), Validators.max(100)]],
      taxRateId: [null]
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLineGroup());
    this.formRevision.update(v => v + 1);
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
      // Re-index lines
      this.linesArray.controls.forEach((ctrl, i) => {
        ctrl.patchValue({ lineNo: i + 1 }, { emitEvent: false });
      });
      this.formRevision.update(v => v + 1);
    } else {
      this.notificationService.warning('Quotation must contain at least one line item');
    }
  }

  onItemSelect(index: number, itemId: number): void {
    const item = this.items().find(it => it.id === itemId);
    if (item) {
      const currentRates = this.taxRates();
      const lineCtrl = this.linesArray.at(index);
      lineCtrl.patchValue({
        description: item.name,
        unitPrice: item.salesPrice || 0,
        taxRateId: item.taxRateId || (currentRates.length > 0 ? currentRates[0].id : null)
      });
    }
  }

  private loadLookups(): void {
    this.customerService.getCustomers({ page: 0, size: 200, isActive: true }).subscribe({
      next: p => this.customers.set(p.content)
    });

    this.opportunityService.getOpportunities(undefined, undefined, undefined, undefined, 0, 100).subscribe({
      next: p => this.opportunities.set(p.content)
    });

    this.inventoryService.getItems({ page: 0, size: 200, active: true }).subscribe({
      next: p => this.items.set(p.content)
    });

    this.taxRateService.getTaxRates().subscribe({
      next: rates => {
        this.taxRates.set(rates);
        // Apply default tax rate to lines if null
        const defaultRate = rates.find(r => r.code === 'STANDARD' || r.rate === 5) || rates[0];
        if (defaultRate) {
          this.linesArray.controls.forEach(ctrl => {
            if (!ctrl.get('taxRateId')?.value) {
              ctrl.patchValue({ taxRateId: defaultRate.id });
            }
          });
        }
      }
    });
  }

  private checkQueryParams(): void {
    this.route.queryParamMap.subscribe(params => {
      const oppId = params.get('opportunityId');
      const custId = params.get('customerId');
      const leadId = params.get('leadId');

      if (oppId) this.quotationForm.patchValue({ opportunityId: Number(oppId) });
      if (custId && custId !== 'null') this.quotationForm.patchValue({ customerId: Number(custId) });
      if (leadId && leadId !== 'null') this.quotationForm.patchValue({ leadId: Number(leadId) });
    });
  }

  loadQuotation(id: number): void {
    this.loading.set(true);
    this.quotationService.getQuotationById(id).subscribe({
      next: q => {
        this.currentQuotation.set(q);
        this.quotationForm.patchValue({
          quoteDate: q.quoteDate,
          validUntil: q.validUntil,
          customerId: q.customerId,
          opportunityId: q.opportunityId,
          leadId: q.leadId,
          currencyCode: q.currencyCode || 'AED'
        });

        // Populate lines
        this.linesArray.clear();
        if (q.lines && q.lines.length > 0) {
          q.lines.forEach(l => {
            this.linesArray.push(
              this.fb.group({
                lineNo: [l.lineNo],
                itemId: [l.itemId],
                description: [l.description, [Validators.required]],
                quantity: [l.quantity, [Validators.required, Validators.min(0.0001)]],
                unitPrice: [l.unitPrice, [Validators.required, Validators.min(0)]],
                discountPct: [l.discountPct || 0],
                taxRateId: [l.taxRateId]
              })
            );
          });
        } else {
          this.addLine();
        }
        this.formRevision.update(v => v + 1);
        this.loading.set(false);
      },
      error: () => {
        this.notificationService.error('Failed to load quotation');
        this.loading.set(false);
      }
    });
  }

  loadRecentQuotes(): void {
    this.quotationService.getQuotations(undefined, undefined, undefined, undefined, undefined, undefined, 0, 10).subscribe({
      next: p => this.recentQuotations.set(p.content)
    });
  }

  calculateLineNet(lineCtrl: any): number {
    const qty = Number(lineCtrl.get('quantity')?.value || 0);
    const price = Number(lineCtrl.get('unitPrice')?.value || 0);
    const disc = Number(lineCtrl.get('discountPct')?.value || 0);
    return Math.round(qty * price * (1 - disc / 100) * 100) / 100;
  }

  // Save / Update
  saveQuotation(): void {
    if (this.quotationForm.invalid) {
      this.quotationForm.markAllAsTouched();
      this.notificationService.error('Please fix validation errors on the quotation lines');
      return;
    }

    this.saving.set(true);
    const formVal = this.quotationForm.value;

    const lines: QuotationLineRequest[] = formVal.lines.map((l: any, i: number) => ({
      lineNo: i + 1,
      itemId: l.itemId ? Number(l.itemId) : undefined,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountPct: Number(l.discountPct || 0),
      taxRateId: l.taxRateId ? Number(l.taxRateId) : undefined
    }));

    const req: QuotationRequest = {
      opportunityId: formVal.opportunityId ? Number(formVal.opportunityId) : undefined,
      customerId: formVal.customerId ? Number(formVal.customerId) : undefined,
      leadId: formVal.leadId ? Number(formVal.leadId) : undefined,
      quoteDate: formVal.quoteDate,
      validUntil: formVal.validUntil,
      currencyCode: formVal.currencyCode || 'AED',
      lines
    };

    const currentId = this.quoteId();
    if (currentId) {
      this.quotationService.updateQuotation(currentId, req).subscribe({
        next: q => {
          this.saving.set(false);
          this.currentQuotation.set(q);
          this.notificationService.success(`Quotation ${q.quotationNo} updated successfully!`);
          this.loadRecentQuotes();
        },
        error: err => {
          this.saving.set(false);
          const msg = err.error?.message || 'Failed to update quotation';
          this.notificationService.error(msg);
        }
      });
    } else {
      this.quotationService.createQuotation(req).subscribe({
        next: q => {
          this.saving.set(false);
          this.currentQuotation.set(q);
          this.quoteId.set(q.id);
          this.notificationService.success(`Quotation ${q.quotationNo} created successfully!`);
          this.router.navigate(['/crm/quotations', q.id]);
          this.loadRecentQuotes();
        },
        error: err => {
          this.saving.set(false);
          const msg = err.error?.message || 'Failed to create quotation';
          this.notificationService.error(msg);
        }
      });
    }
  }

  // Lifecycle & Conversion Actions (Section 3.2, 4.3, 4.4)
  sendQuotation(): void {
    const id = this.quoteId();
    if (!id) return;
    this.actionInProgress.set(true);

    this.quotationService.sendQuotation(id).subscribe({
      next: q => {
        this.actionInProgress.set(false);
        this.currentQuotation.set(q);
        this.notificationService.success(`Quotation ${q.quotationNo} marked as SENT!`);
      },
      error: () => {
        this.actionInProgress.set(false);
        this.notificationService.error('Failed to send quotation');
      }
    });
  }

  acceptQuotation(): void {
    const id = this.quoteId();
    if (!id) return;
    this.actionInProgress.set(true);

    this.quotationService.acceptQuotation(id).subscribe({
      next: q => {
        this.actionInProgress.set(false);
        this.currentQuotation.set(q);
        this.notificationService.success(
          `Quotation ${q.quotationNo} ACCEPTED! Inventory reservation applied.`
        );
      },
      error: () => {
        this.actionInProgress.set(false);
        this.notificationService.error('Failed to accept quotation');
      }
    });
  }

  convertToInvoice(): void {
    const id = this.quoteId();
    if (!id) return;
    this.actionInProgress.set(true);

    this.quotationService.convertToInvoice(id).subscribe({
      next: res => {
        this.actionInProgress.set(false);
        this.notificationService.success(
          `Quotation successfully converted to Sales Invoice ${res.invoiceNo}!`
        );
        this.loadQuotation(id);
      },
      error: err => {
        this.actionInProgress.set(false);
        const msg = err.error?.message || 'Failed to convert quotation to invoice';
        this.notificationService.error(msg);
      }
    });
  }

  downloadPdf(): void {
    const id = this.quoteId();
    const quote = this.currentQuotation();
    if (!id || !quote) return;

    this.quotationService.getQuotationPdf(id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quotation-${quote.quotationNo || id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.notificationService.error('Failed to download quotation PDF');
      }
    });
  }
}
