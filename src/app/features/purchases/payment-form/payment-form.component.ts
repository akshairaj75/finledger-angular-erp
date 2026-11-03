import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

  vendors: Vendor[] = [];
  selectedVendor: Vendor | null = null;
  bankAccounts: BankAccount[] = [];
  selectedBankAccount: BankAccount | null = null;

  openBills: EditableOpenBill[] = [];
  loadingBills = false;
  submitting = false;

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
      if (this.openBills.length > 0) {
        this.autoAllocateOldestFirst(Number(val) || 0);
      }
    });

    this.paymentForm.get('bankAccountId')?.valueChanges.subscribe(accId => {
      this.selectedBankAccount = this.bankAccounts.find(b => b.id === Number(accId)) || null;
    });
  }

  private loadDependencies(): void {
    this.vendorService.getVendors({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.vendors = page.content;
      }
    });

    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        this.bankAccounts = accounts.filter(a => a.isActive);
        if (this.bankAccounts.length > 0) {
          this.paymentForm.patchValue({ bankAccountId: this.bankAccounts[0].id });
          this.selectedBankAccount = this.bankAccounts[0];
        }
      }
    });
  }

  onVendorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const vendorId = Number(target.value);
    const vendor = this.vendors.find(v => v.id === vendorId) || null;
    this.selectedVendor = vendor;
    this.openBills = [];

    if (vendor) {
      this.paymentForm.patchValue({ currencyCode: vendor.currencyCode || 'AED' });
      this.loadOpenBills(vendor.id);
    }
  }

  private loadOpenBills(vendorId: number): void {
    this.loadingBills = true;
    this.vendorService.getOpenBills(vendorId).subscribe({
      next: bills => {
        // Sort oldest due date first (FinLedger v2.0 Section 4.7 & 5.3)
        const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        this.openBills = sorted.map(bill => ({
          ...bill,
          allocatedAmount: 0
        }));
        this.loadingBills = false;

        const currentAmt = Number(this.paymentForm.get('amount')?.value) || 0;
        if (currentAmt > 0) {
          this.autoAllocateOldestFirst(currentAmt);
        }
      },
      error: err => {
        this.loadingBills = false;
        this.notificationService.error(err?.error?.message || 'Failed to load open vendor bills');
      }
    });
  }

  autoAllocateOldestFirst(totalToAllocate?: number): void {
    const available = totalToAllocate !== undefined ? totalToAllocate : (Number(this.paymentForm.get('amount')?.value) || 0);
    let remaining = available;

    for (const bill of this.openBills) {
      if (remaining <= 0) {
        bill.allocatedAmount = 0;
      } else {
        const canPay = Math.min(bill.balanceDue, remaining);
        bill.allocatedAmount = Math.round(canPay * 100) / 100;
        remaining = Math.round((remaining - bill.allocatedAmount) * 100) / 100;
      }
    }
  }

  clearAllocations(): void {
    for (const bill of this.openBills) {
      bill.allocatedAmount = 0;
    }
  }

  togglePayFull(bill: EditableOpenBill): void {
    if (bill.allocatedAmount === bill.balanceDue) {
      bill.allocatedAmount = 0;
    } else {
      bill.allocatedAmount = bill.balanceDue;
    }
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
    bill.allocatedAmount = Math.round(val * 100) / 100;
  }

  get totalAllocated(): number {
    return Math.round(this.openBills.reduce((sum, bill) => sum + (bill.allocatedAmount || 0), 0) * 100) / 100;
  }

  get paymentAmount(): number {
    return Number(this.paymentForm.get('amount')?.value) || 0;
  }

  get unappliedAmount(): number {
    const diff = this.paymentAmount - this.totalAllocated;
    return diff > 0 ? Math.round(diff * 100) / 100 : 0;
  }

  get isOverAllocated(): boolean {
    return this.totalAllocated > this.paymentAmount;
  }

  submitPayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.notificationService.error('Please select the vendor, bank account, and enter a valid disbursement amount.');
      return;
    }

    if (this.isOverAllocated) {
      this.notificationService.error(
        `Total allocated (${this.totalAllocated} AED) cannot exceed the total payment amount (${this.paymentAmount} AED).`
      );
      return;
    }

    const formVal = this.paymentForm.value;
    const allocations: PaymentAllocationRequest[] = this.openBills
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

    this.submitting = true;
    this.paymentService.createPayment(payload).subscribe({
      next: payment => {
        this.submitting = false;
        this.notificationService.success(
          `Vendor Payment ${payment.paymentNo} posted successfully! GL voucher created.`
        );
        this.router.navigate(['/purchases/bills']);
      },
      error: err => {
        this.submitting = false;
        this.notificationService.error(err?.error?.message || 'Failed to record and post vendor payment');
      }
    });
  }
}

