import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BankAccount } from '../../../core/models/bank-account.model';
import { OpenBill } from '../../../core/models/bill.model';
import { PaymentAllocationRequest, PaymentRequest } from '../../../core/models/payment.model';
import { PaymentMethod } from '../../../core/models/receipt.model';
import { Vendor } from '../../../core/models/vendor.model';
import { NotificationService } from '../../../core/services/notification.service';
import { BankAccountService } from '../../sales/services/bank-account.service';
import { PaymentService } from '../services/payment.service';
import { VendorService } from '../services/vendor.service';

interface EditableOpenBill extends OpenBill {
  allocatedAmount: number;
}

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.css']
})
export class PaymentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private vendorService = inject(VendorService);
  private paymentService = inject(PaymentService);
  private bankAccountService = inject(BankAccountService);
  private notificationService = inject(NotificationService);

  paymentForm!: FormGroup;

  vendors = signal<Vendor[]>([]);
  selectedVendor = signal<Vendor | null>(null);
  bankAccounts = signal<BankAccount[]>([]);
  selectedBankAccount = signal<BankAccount | null>(null);

  openBills = signal<EditableOpenBill[]>([]);
  loadingBills = signal(false);
  submitting = signal(false);
  private formAmount = signal(0);

  readonly paymentMethods: PaymentMethod[] = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD'];

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.paymentForm = this.fb.group({
      vendorId: [null, [Validators.required]],
      paymentDate: [today, [Validators.required]],
      bankAccountId: [null, [Validators.required]],
      paymentMethod: ['BANK_TRANSFER' as PaymentMethod, [Validators.required]],
      reference: [''],
      currencyCode: ['AED', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]]
    });

    // Re-run auto allocation on amount change
    this.paymentForm.get('amount')?.valueChanges.subscribe(val => {
      const numeric = Number(val) || 0;
      this.formAmount.set(numeric);
      if (this.openBills().length > 0) {
        this.autoAllocateOldestFirst(numeric);
      }
    });

    this.paymentForm.get('bankAccountId')?.valueChanges.subscribe(accId => {
      this.selectedBankAccount.set(this.bankAccounts().find(b => b.id === Number(accId)) || null);
    });
  }

  private loadDependencies(): void {
    this.vendorService.getVendors({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.vendors.set(page.content);
      }
    });

    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        const active = accounts.filter(a => a.isActive);
        this.bankAccounts.set(active);
        if (active.length > 0) {
          this.paymentForm.patchValue({ bankAccountId: active[0].id });
          this.selectedBankAccount.set(active[0]);
        }
      }
    });
  }

  onVendorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const vendorId = Number(target.value);
    const vendor = this.vendors().find(v => v.id === vendorId) || null;
    this.selectedVendor.set(vendor);
    this.openBills.set([]);

    if (vendor) {
      this.paymentForm.patchValue({ currencyCode: vendor.currencyCode || 'AED' });
      this.loadOpenBills(vendor.id);
    }
  }

  private loadOpenBills(vendorId: number): void {
    this.loadingBills.set(true);
    this.vendorService.getOpenBills(vendorId).subscribe({
      next: bills => {
        // Sort oldest due date first (FinLedger v2.0 Section 4.7 & 5.3)
        const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        this.openBills.set(sorted.map(bill => ({
          ...bill,
          allocatedAmount: 0
        })));
        this.loadingBills.set(false);

        const currentAmt = Number(this.paymentForm.get('amount')?.value) || 0;
        if (currentAmt > 0) {
          this.autoAllocateOldestFirst(currentAmt);
        }
      },
      error: err => {
        this.loadingBills.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load open vendor bills');
      }
    });
  }

  autoAllocateOldestFirst(totalToAllocate?: number): void {
    const available = totalToAllocate !== undefined ? totalToAllocate : (Number(this.paymentForm.get('amount')?.value) || 0);
    let remaining = available;

    this.openBills.update(list =>
      list.map(bill => {
        if (remaining <= 0) {
          return { ...bill, allocatedAmount: 0 };
        }
        const canPay = Math.min(bill.balanceDue, remaining);
        const allocatedAmount = Math.round(canPay * 100) / 100;
        remaining = Math.round((remaining - allocatedAmount) * 100) / 100;
        return { ...bill, allocatedAmount };
      })
    );
  }

  clearAllocations(): void {
    this.openBills.update(list => list.map(bill => ({ ...bill, allocatedAmount: 0 })));
  }

  togglePayFull(bill: EditableOpenBill): void {
    const targetVal = bill.allocatedAmount === bill.balanceDue ? 0 : bill.balanceDue;
    this.openBills.update(list =>
      list.map(item => (item.id === bill.id ? { ...item, allocatedAmount: targetVal } : item))
    );
  }

  onManualAllocationChange(bill: EditableOpenBill, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = Number(input.value) || 0;
    if (val < 0) val = 0;
    if (val > bill.balanceDue) {
      val = bill.balanceDue;
      input.value = val.toString();
      this.notificationService.warning(`Cannot allocate more than bill balance due (${bill.balanceDue} AED)`);
    }
    const rounded = Math.round(val * 100) / 100;
    this.openBills.update(list =>
      list.map(item => (item.id === bill.id ? { ...item, allocatedAmount: rounded } : item))
    );
  }

  readonly totalAllocated = computed(() =>
    Math.round(this.openBills().reduce((sum, bill) => sum + (bill.allocatedAmount || 0), 0) * 100) / 100
  );

  readonly paymentAmount = computed(() => this.formAmount());

  readonly unappliedAmount = computed(() => {
    const diff = this.paymentAmount() - this.totalAllocated();
    return diff > 0 ? Math.round(diff * 100) / 100 : 0;
  });

  readonly isOverAllocated = computed(() => this.totalAllocated() > this.paymentAmount());

  submitPayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.notificationService.error('Please select the vendor, bank account, and enter a valid disbursement amount.');
      return;
    }

    if (this.isOverAllocated()) {
      this.notificationService.error(
        `Total allocated (${this.totalAllocated()} AED) cannot exceed the total payment amount (${this.paymentAmount()} AED).`
      );
      return;
    }

    const formVal = this.paymentForm.value;
    const allocations: PaymentAllocationRequest[] = this.openBills()
      .filter(b => b.allocatedAmount > 0)
      .map(b => ({
        billId: b.id,
        amount: b.allocatedAmount
      }));

    const payload: PaymentRequest = {
      vendorId: Number(formVal.vendorId),
      paymentDate: formVal.paymentDate,
      bankAccountId: Number(formVal.bankAccountId),
      paymentMethod: formVal.paymentMethod,
      reference: formVal.reference?.trim() || undefined,
      currencyCode: formVal.currencyCode,
      amount: Number(formVal.amount),
      allocations
    };

    this.submitting.set(true);
    this.paymentService.createPayment(payload).subscribe({
      next: payment => {
        this.submitting.set(false);
        this.notificationService.success(
          `Vendor Payment ${payment.paymentNo} posted successfully! GL voucher created.`
        );
        this.router.navigate(['/purchases/bills']);
      },
      error: err => {
        this.submitting.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to record and post vendor payment');
      }
    });
  }
}

