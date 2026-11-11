import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { OpenBill } from '../../../core/models/bill.model';
import { Page } from '../../../core/models/page.model';
import { Vendor, VendorQuery, VendorRequest } from '../../../core/models/vendor.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../../accounting/services/account.service';
import { VendorService } from '../services/vendor.service';

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './vendor-list.component.html',
  styleUrls: ['./vendor-list.component.css']
})
export class VendorListComponent implements OnInit {
  private vendorService = inject(VendorService);
  private accountService = inject(AccountService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  vendorsPage = signal<Page<Vendor>>({
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
  showVendorModal = signal(false);
  isEditMode = signal(false);
  selectedVendorId = signal<number | null>(null);
  vendorForm!: FormGroup;

  // Open bills modal
  showOpenBillsModal = signal(false);
  selectedVendorForBills = signal<Vendor | null>(null);
  openBills = signal<OpenBill[]>([]);
  loadingOpenBills = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadAccounts();
    this.loadVendors();
  }

  private initForm(): void {
    this.vendorForm = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(20)]],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      trn: ['', [Validators.pattern('^[0-9]{15}$')]],
      email: ['', [Validators.email]],
      phone: [''],
      address: [''],
      currencyCode: ['AED', [Validators.required, Validators.maxLength(3)]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      bankIban: ['', [Validators.maxLength(34)]],
      apAccountId: [null, [Validators.required]],
      isActive: [true]
    });
  }

  loadAccounts(): void {
    this.accountService.getAccounts(0, 200).subscribe({
      next: page => {
        this.accounts.set(page.content);
        const apAcc = page.content.find(a => a.code === '2100' || a.name.toLowerCase().includes('payable'));
        if (apAcc && !this.vendorForm.get('apAccountId')?.value) {
          this.vendorForm.patchValue({ apAccountId: apAcc.id });
        }
      },
      error: () => {}
    });
  }

  loadVendors(): void {
    this.loading.set(true);
    const query: VendorQuery = {
      page: this.currentPage(),
      size: this.pageSize,
      search: this.searchQuery().trim() || undefined
    };

    this.vendorService.getVendors(query).subscribe({
      next: page => {
        this.vendorsPage.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load vendors');
      }
    });
  }

  onSearch(): void {
    this.currentPage.set(0);
    this.loadVendors();
  }

  resetSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(0);
    this.loadVendors();
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.selectedVendorId.set(null);
    const apAcc = this.accounts().find(a => a.code === '2100' || a.name.toLowerCase().includes('payable'));
    this.vendorForm.reset({
      code: '',
      name: '',
      trn: '',
      email: '',
      phone: '',
      address: '',
      currencyCode: 'AED',
      paymentTermsDays: 30,
      bankIban: '',
      apAccountId: apAcc ? apAcc.id : null,
      isActive: true
    });
    this.showVendorModal.set(true);
  }

  openEditModal(vendor: Vendor): void {
    this.isEditMode.set(true);
    this.selectedVendorId.set(vendor.id);
    this.vendorForm.patchValue({
      code: vendor.code,
      name: vendor.name,
      trn: vendor.trn || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      currencyCode: vendor.currencyCode || 'AED',
      paymentTermsDays: vendor.paymentTermsDays ?? 30,
      bankIban: vendor.bankIban || '',
      apAccountId: vendor.apAccountId,
      isActive: vendor.isActive
    });
    this.showVendorModal.set(true);
  }

  closeVendorModal(): void {
    this.showVendorModal.set(false);
    this.selectedVendorId.set(null);
  }

  saveVendor(): void {
    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      return;
    }

    const payload: VendorRequest = {
      ...this.vendorForm.value,
      code: this.vendorForm.value.code.toUpperCase().trim()
    };

    const editId = this.selectedVendorId();
    if (this.isEditMode() && editId) {
      this.vendorService.updateVendor(editId, payload).subscribe({
        next: () => {
          this.notificationService.success('Vendor updated successfully');
          this.closeVendorModal();
          this.loadVendors();
        },
        error: err => {
          this.notificationService.error(err?.error?.message || 'Failed to update vendor');
        }
      });
    } else {
      this.vendorService.createVendor(payload).subscribe({
        next: () => {
          this.notificationService.success('Vendor created successfully');
          this.closeVendorModal();
          this.loadVendors();
        },
        error: err => {
          this.notificationService.error(err?.error?.message || 'Failed to create vendor');
        }
      });
    }
  }

  viewOpenBills(vendor: Vendor): void {
    this.selectedVendorForBills.set(vendor);
    this.showOpenBillsModal.set(true);
    this.loadingOpenBills.set(true);
    this.vendorService.getOpenBills(vendor.id).subscribe({
      next: bills => {
        this.openBills.set(bills);
        this.loadingOpenBills.set(false);
      },
      error: err => {
        this.loadingOpenBills.set(false);
        this.notificationService.error(err?.error?.message || 'Failed to load open bills');
      }
    });
  }

  closeOpenBillsModal(): void {
    this.showOpenBillsModal.set(false);
    this.selectedVendorForBills.set(null);
    this.openBills.set([]);
  }

  goToPage(p: number): void {
    if (p >= 0 && p < this.vendorsPage().totalPages) {
      this.currentPage.set(p);
      this.loadVendors();
    }
  }

  getAccountLabel(accId: number): string {
    const acc = this.accounts().find(a => a.id === accId);
    return acc ? `${acc.code} - ${acc.name}` : `ID: ${accId}`;
  }
}

