import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BankAccount } from '../../../core/models/bank-account.model';
import { Customer } from '../../../core/models/customer.model';
import { OpenInvoice } from '../../../core/models/invoice.model';
import { PaymentMethod, ReceiptAllocationRequest, ReceiptRequest } from '../../../core/models/receipt.model';
import { NotificationService } from '../../../core/services/notification.service';
import { BankAccountService } from '../services/bank-account.service';
import { CustomerService } from '../services/customer.service';
import { ReceiptService } from '../services/receipt.service';

interface EditableOpenInvoice extends OpenInvoice {
  allocatedAmount: number;
}

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './receipt-form.component.html',
  styleUrls: ['./receipt-form.component.css']
})
export class ReceiptFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private receiptService = inject(ReceiptService);
  private bankAccountService = inject(BankAccountService);
  private notificationService = inject(NotificationService);

  receiptForm!: FormGroup;

  customers: Customer[] = [];
  selectedCustomer: Customer | null = null;
  bankAccounts: BankAccount[] = [];
  selectedBankAccount: BankAccount | null = null;

  openInvoices: EditableOpenInvoice[] = [];
  loadingInvoices = false;
  submitting = false;

  readonly paymentMethods: PaymentMethod[] = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD'];

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.receiptForm = this.fb.group({
      customerId: [null, [Validators.required]],
      receiptDate: [today, [Validators.required]],
      bankAccountId: [null, [Validators.required]],
      paymentMethod: ['BANK_TRANSFER' as PaymentMethod, [Validators.required]],
      reference: [''],
      currencyCode: ['AED', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]]
    });

    // Re-run auto allocation on amount change
    this.receiptForm.get('amount')?.valueChanges.subscribe(val => {
      if (this.openInvoices.length > 0) {
        this.autoAllocateOldestFirst(Number(val) || 0);
      }
    });

    this.receiptForm.get('bankAccountId')?.valueChanges.subscribe(accId => {
      this.selectedBankAccount = this.bankAccounts.find(b => b.id === Number(accId)) || null;
    });
  }

  private loadDependencies(): void {
    this.customerService.getCustomers({ page: 0, size: 200, isActive: true }).subscribe({
      next: page => {
        this.customers = page.content;
      }
    });

    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        this.bankAccounts = accounts.filter(a => a.isActive);
        if (this.bankAccounts.length > 0) {
          this.receiptForm.patchValue({ bankAccountId: this.bankAccounts[0].id });
          this.selectedBankAccount = this.bankAccounts[0];
        }
      }
    });
  }

  onCustomerChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const custId = Number(target.value);
    const customer = this.customers.find(c => c.id === custId) || null;
    this.selectedCustomer = customer;
    this.openInvoices = [];

    if (customer) {
      this.receiptForm.patchValue({ currencyCode: customer.currencyCode || 'AED' });
      this.loadOpenInvoices(customer.id);
    }
  }

  private loadOpenInvoices(customerId: number): void {
    this.loadingInvoices = true;
    this.customerService.getOpenInvoices(customerId).subscribe({
      next: invoices => {
        // Sort oldest due date first (Section 4.7 FinLedger v2.0)
        const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        this.openInvoices = sorted.map(inv => ({
          ...inv,
          allocatedAmount: 0
        }));
        this.loadingInvoices = false;

        const currentAmt = Number(this.receiptForm.get('amount')?.value) || 0;
        if (currentAmt > 0) {
          this.autoAllocateOldestFirst(currentAmt);
        }
      },
      error: err => {
        this.loadingInvoices = false;
        this.notificationService.error(err?.error?.message || 'Failed to load open invoices');
      }
    });
  }

  autoAllocateOldestFirst(totalToAllocate?: number): void {
    const available = totalToAllocate !== undefined ? totalToAllocate : (Number(this.receiptForm.get('amount')?.value) || 0);
    let remaining = available;

    for (const inv of this.openInvoices) {
      if (remaining <= 0) {
        inv.allocatedAmount = 0;
      } else {
        const canPay = Math.min(inv.balanceDue, remaining);
        inv.allocatedAmount = Math.round(canPay * 100) / 100;
        remaining = Math.round((remaining - inv.allocatedAmount) * 100) / 100;
      }
    }
  }

  clearAllocations(): void {
    for (const inv of this.openInvoices) {
      inv.allocatedAmount = 0;
    }
  }

  togglePayFull(inv: EditableOpenInvoice): void {
    if (inv.allocatedAmount === inv.balanceDue) {
      inv.allocatedAmount = 0;
    } else {
      inv.allocatedAmount = inv.balanceDue;
    }
  }

  onManualAllocationChange(inv: EditableOpenInvoice, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = Number(input.value) || 0;
    if (val < 0) val = 0;
    if (val > inv.balanceDue) {
      val = inv.balanceDue;
      input.value = val.toString();
      this.notificationService.warning(`Cannot allocate more than invoice balance due (${inv.balanceDue} AED)`);
    }
    inv.allocatedAmount = Math.round(val * 100) / 100;
  }

  get totalAllocated(): number {
    return Math.round(this.openInvoices.reduce((sum, inv) => sum + (inv.allocatedAmount || 0), 0) * 100) / 100;
  }

  get receivedAmount(): number {
    return Number(this.receiptForm.get('amount')?.value) || 0;
  }

  get unappliedAmount(): number {
    const diff = this.receivedAmount - this.totalAllocated;
    return diff > 0 ? Math.round(diff * 100) / 100 : 0;
  }

  get isOverAllocated(): boolean {
    return this.totalAllocated > this.receivedAmount;
  }

  submitReceipt(): void {
    if (this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      this.notificationService.error('Please enter the customer, bank account, and received amount.');
      return;
    }

    if (this.isOverAllocated) {
      this.notificationService.error(
        `Total allocated (${this.totalAllocated} AED) cannot exceed the received amount (${this.receivedAmount} AED).`
      );
      return;
    }

    const formVal = this.receiptForm.value;
    const allocations: ReceiptAllocationRequest[] = this.openInvoices
      .filter(inv => inv.allocatedAmount > 0)
      .map(inv => ({
        invoiceId: inv.id,
        amount: inv.allocatedAmount
      }));

    const payload: ReceiptRequest = {
      customerId: Number(formVal.customerId),
      receiptDate: formVal.receiptDate,
      bankAccountId: Number(formVal.bankAccountId),
      paymentMethod: formVal.paymentMethod,
      reference: formVal.reference?.trim() || undefined,
      currencyCode: formVal.currencyCode,
      amount: Number(formVal.amount),
      allocations
    };

    this.submitting = true;
    this.receiptService.createReceipt(payload).subscribe({
      next: receipt => {
        this.submitting = false;
        this.notificationService.success(
          `Customer Receipt ${receipt.receiptNo} posted successfully! GL voucher created.`
        );
        this.router.navigate(['/sales/invoices']);
      },
      error: err => {
        this.submitting = false;
        this.notificationService.error(err?.error?.message || 'Failed to record and post receipt');
      }
    });
  }
}

