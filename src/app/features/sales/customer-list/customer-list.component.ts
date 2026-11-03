import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { Customer, CustomerQuery, CustomerRequest } from '../../../core/models/customer.model';
import { OpenInvoice } from '../../../core/models/invoice.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
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

  customersPage: Page<Customer> = {
    content: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0
  };

  accounts: Account[] = [];
  loading = false;
  searchQuery = '';
  currentPage = 0;
  pageSize = 10;

  // Modals state
  showCustomerModal = false;
  isEditMode = false;
  selectedCustomerId: number | null = null;
  customerForm!: FormGroup;

  // Open invoices modal
  showOpenInvoicesModal = false;
  selectedCustomerForInvoices: Customer | null = null;
  openInvoices: OpenInvoice[] = [];
  loadingOpenInvoices = false;

  ngOnInit(): void {
    this.initForm();
    this.loadAccounts();
    this.loadCustomers();
  }

  private initForm(): void {
    this.customerForm = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(50)]],
      name: ['', [Validators.required, Validators.maxLength(255)]],
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
        this.accounts = page.content;
        // Pre-select 1200 Accounts Receivable if present
        const arAcc = this.accounts.find(a => a.code === '1200' || a.name.toLowerCase().includes('receivable'));
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
    this.loading = true;
    const query: CustomerQuery = {
      page: this.currentPage,
      size: this.pageSize,
      search: this.searchQuery.trim() || undefined
    };

    this.customerService.getCustomers(query).subscribe({
      next: page => {
        this.customersPage = page;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Failed to load customers');
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadCustomers();
  }

  resetSearch(): void {
    this.searchQuery = '';
    this.currentPage = 0;
    this.loadCustomers();
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedCustomerId = null;
    const arAcc = this.accounts.find(a => a.code === '1200' || a.name.toLowerCase().includes('receivable'));
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
    this.showCustomerModal = true;
  }

  openEditModal(customer: Customer): void {
    this.isEditMode = true;
    this.selectedCustomerId = customer.id;
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
    this.showCustomerModal = true;
  }

  closeCustomerModal(): void {
    this.showCustomerModal = false;
    this.selectedCustomerId = null;
  }

  saveCustomer(): void {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    const payload: CustomerRequest = {
      ...this.customerForm.value,
      code: this.customerForm.value.code.toUpperCase().trim()
    };

    if (this.isEditMode && this.selectedCustomerId) {
      this.customerService.updateCustomer(this.selectedCustomerId, payload).subscribe({
        next: () => {
          this.notificationService.success('Customer updated successfully');
          this.closeCustomerModal();
          this.loadCustomers();
        },
        error: err => {
          this.notificationService.error(err?.error?.message || 'Failed to update customer');
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
          this.notificationService.error(err?.error?.message || 'Failed to create customer');
        }
      });
    }
  }

  viewOpenInvoices(customer: Customer): void {
    this.selectedCustomerForInvoices = customer;
    this.showOpenInvoicesModal = true;
    this.loadingOpenInvoices = true;
    this.customerService.getOpenInvoices(customer.id).subscribe({
      next: invoices => {
        this.openInvoices = invoices;
        this.loadingOpenInvoices = false;
      },
      error: err => {
        this.loadingOpenInvoices = false;
        this.notificationService.error(err?.error?.message || 'Failed to load open invoices');
      }
    });
  }

  closeOpenInvoicesModal(): void {
    this.showOpenInvoicesModal = false;
    this.selectedCustomerForInvoices = null;
    this.openInvoices = [];
  }

  goToPage(p: number): void {
    if (p >= 0 && p < this.customersPage.totalPages) {
      this.currentPage = p;
      this.loadCustomers();
    }
  }

  getAccountLabel(accId: number): string {
    const acc = this.accounts.find(a => a.id === accId);
    return acc ? `${acc.code} - ${acc.name}` : `ID: ${accId}`;
  }
}

