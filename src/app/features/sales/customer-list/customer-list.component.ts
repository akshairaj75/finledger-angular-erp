import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { Customer, CustomerQuery, CustomerRequest } from '../../../core/models/customer.model';
import { OpenInvoice } from '../../../core/models/invoice.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ParsedApiError,
  applyServerFieldErrors,
  getServerFieldError
} from '../../../core/utils/api-error.util';
import { AccountService } from '../../accounting/services/account.service';
import { CustomerService } from '../services/customer.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.css']
})
export class CustomerListComponent implements OnInit {
  private customerService = inject(CustomerService);
  private accountService = inject(AccountService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  customersPage = signal<Page<Customer>>({
    content: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0
  });

  accounts = signal<Account[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  currentPage = signal(0);
  pageSize = 10;

  // Modals state
  showCustomerModal = signal(false);
  isEditMode = signal(false);
  selectedCustomerId = signal<number | null>(null);
  customerForm!: FormGroup;

  // Open invoices modal
  showOpenInvoicesModal = signal(false);
  selectedCustomerForInvoices = signal<Customer | null>(null);
  openInvoices = signal<OpenInvoice[]>([]);
  loadingOpenInvoices = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadAccounts();
    this.loadCustomers();
  }

  modalError = signal<ParsedApiError | null>(null);

  getServerError(field: string): string | null {
    return getServerFieldError(this.customerForm, field);
  }

  private initForm(): void {
    this.customerForm = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/\S/)]],
      name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
      trn: ['', [Validators.pattern('^[0-9]{15}$')]],
      email: ['', [Validators.email]],
      phone: [''],
      billingAddress: [''],
      countryCode: ['AE', [Validators.required, Validators.maxLength(2)]],
      currencyCode: ['AED', [Validators.required, Validators.maxLength(3)]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      creditLimit: [50000, [Validators.min(0)]],
      arAccountId: [null, [Validators.required]],
      isActive: [true]
    });
  }

  loadAccounts(): void {
    this.accountService.getAccounts(0, 200).subscribe({
      next: page => {
        this.accounts.set(page.content);
        // Pre-select 1200 Accounts Receivable if present
        const arAcc = page.content.find(a => a.code === '1200' || a.name.toLowerCase().includes('receivable'));
        if (arAcc && !this.customerForm.get('arAccountId')?.value) {
          this.customerForm.patchValue({ arAccountId: arAcc.id });
        }
      },
      error: () => {
        // Fallback or ignore
      }
    });
  }

  loadCustomers(): void {
    this.loading.set(true);
    const query: CustomerQuery = {
      page: this.currentPage(),
      size: this.pageSize,
      search: this.searchQuery().trim() || undefined
    };

    this.customerService.getCustomers(query).subscribe({
      next: page => {
        this.customersPage.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load customers');
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(0);
    this.loadCustomers();
  }

  resetSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(0);
    this.loadCustomers();
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.selectedCustomerId.set(null);
    this.modalError.set(null);
    const arAcc = this.accounts().find(a => a.code === '1200' || a.name.toLowerCase().includes('receivable'));
    this.customerForm.reset({
      code: '',
      name: '',
      trn: '',
      email: '',
      phone: '',
      billingAddress: '',
      countryCode: 'AE',
      currencyCode: 'AED',
      paymentTermsDays: 30,
      creditLimit: 50000,
      arAccountId: arAcc ? arAcc.id : null,
      isActive: true
    });
    this.showCustomerModal.set(true);
  }

  openEditModal(customer: Customer): void {
    this.isEditMode.set(true);
    this.selectedCustomerId.set(customer.id);
    this.modalError.set(null);
    this.customerForm.patchValue({
      code: customer.code,
      name: customer.name,
      trn: customer.trn || '',
      email: customer.email || '',
      phone: customer.phone || '',
      billingAddress: customer.billingAddress || '',
      countryCode: customer.countryCode || 'AE',
      currencyCode: customer.currencyCode || 'AED',
      paymentTermsDays: customer.paymentTermsDays ?? 30,
      creditLimit: customer.creditLimit ?? 0,
      arAccountId: customer.arAccountId,
      isActive: customer.isActive
    });
    this.showCustomerModal.set(true);
  }

  closeCustomerModal(): void {
    this.showCustomerModal.set(false);
    this.selectedCustomerId.set(null);
    this.modalError.set(null);
  }

  saveCustomer(): void {
    this.modalError.set(null);
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    const raw = this.customerForm.value;
    const payload: CustomerRequest = {
      ...raw,
      code: String(raw.code || '').toUpperCase().trim(),
      name: String(raw.name || '').trim()
    };

    const editId = this.selectedCustomerId();
    if (this.isEditMode() && editId) {
      this.customerService.updateCustomer(editId, payload).subscribe({
        next: () => {
          this.notificationService.success('Customer updated successfully');
          this.closeCustomerModal();
          this.loadCustomers();
        },
        error: err => {
          this.modalError.set(applyServerFieldErrors(this.customerForm, err, 'Failed to update customer'));
        }
      });
    } else {
      this.customerService.createCustomer(payload).subscribe({
        next: () => {
          this.notificationService.success('Customer created successfully');
          this.closeCustomerModal();
          this.loadCustomers();
        },
        error: err => {
          this.modalError.set(applyServerFieldErrors(this.customerForm, err, 'Failed to create customer'));
        }
      });
    }
  }

  viewOpenInvoices(customer: Customer): void {
    this.selectedCustomerForInvoices.set(customer);
    this.showOpenInvoicesModal.set(true);
    this.loadingOpenInvoices.set(true);
    this.customerService.getOpenInvoices(customer.id).subscribe({
      next: invoices => {
        this.openInvoices.set(invoices);
        this.loadingOpenInvoices.set(false);
      },
      error: err => {
        this.loadingOpenInvoices.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load open invoices');
      }
    });
  }

  closeOpenInvoicesModal(): void {
    this.showOpenInvoicesModal.set(false);
    this.selectedCustomerForInvoices.set(null);
    this.openInvoices.set([]);
  }

  goToPage(p: number): void {
    if (p >= 0 && p < this.customersPage().totalPages) {
      this.currentPage.set(p);
      this.loadCustomers();
    }
  }

  getAccountLabel(accId: number): string {
    const acc = this.accounts().find(a => a.id === accId);
    return acc ? `${acc.code} - ${acc.name}` : `ID: ${accId}`;
  }
}

