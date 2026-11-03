import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BankAccount } from '../../../core/models/bank-account.model';
import { CostCenter } from '../../../core/models/cost-center.model';
import { Customer } from '../../../core/models/customer.model';
import {
  Attachment,
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  ExpenseLineRequest,
  PaidBy
} from '../../../core/models/expense.model';
import { TaxRate } from '../../../core/models/tax-rate.model';
import { User } from '../../../core/models/user.model';
import { NotificationService } from '../../../core/services/notification.service';
import { UserService } from '../../../core/services/user.service';
import { CostCenterService } from '../../accounting/services/cost-center.service';
import { BankAccountService } from '../../sales/services/bank-account.service';
import { CustomerService } from '../../sales/services/customer.service';
import { TaxRateService } from '../../sales/services/tax-rate.service';
import { ExpenseService } from '../services/expense.service';

export interface PendingFile {
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  type: string;
}

export interface PolicyWarning {
  type: 'RECEIPT' | 'LIMIT';
  lineIndex?: number;
  categoryName?: string;
  message: string;
}

export interface JournalPreviewLine {
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.css']
})
export class ExpenseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  private bankAccountService = inject(BankAccountService);
  private taxRateService = inject(TaxRateService);
  private costCenterService = inject(CostCenterService);
  private customerService = inject(CustomerService);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  expenseForm!: FormGroup;
  expenseId: number | null = null;
  existingExpense: Expense | null = null;

  // Master Data
  categories: ExpenseCategory[] = [];
  bankAccounts: BankAccount[] = [];
  taxRates: TaxRate[] = [];
  costCenters: CostCenter[] = [];
  customers: Customer[] = [];
  employees: User[] = [];

  // File Upload State
  pendingFiles: PendingFile[] = [];
  existingAttachments: Attachment[] = [];
  isDragging = false;
  uploading = false;
  submitting = false;
  savingDraft = false;

  // Real-time Policy Warnings
  policyWarnings: PolicyWarning[] = [];

  // Computed Totals
  subtotal = 0;
  taxTotal = 0;
  grandTotal = 0;

  // Stepper Threshold (FinLedger v2.0 Section 4.11 & ApprovalPolicy threshold)
  readonly financeThreshold = 2000.0;

  ngOnInit(): void {
    this.initForm();
    this.loadDependencies();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'new') {
      this.expenseId = Number(idParam);
      this.loadExistingExpense(this.expenseId);
    }
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.expenseForm = this.fb.group({
      paidBy: ['EMPLOYEE' as PaidBy, [Validators.required]],
      employeeUserId: [null],
      bankAccountId: [null],
      payeeName: [''],
      expenseDate: [today, [Validators.required]],
      currencyCode: ['AED', [Validators.required]],
      exchangeRate: [1.0, [Validators.required, Validators.min(0.000001)]],
      lines: this.fb.array([])
    });

    // Add initial line
    this.addLine();

    // Listen to form value changes for policy checks and totals
    this.expenseForm.valueChanges.subscribe(() => {
      this.calculateTotals();
      this.evaluatePolicyChecks();
    });

    // Adjust validators when paidBy changes
    this.expenseForm.get('paidBy')?.valueChanges.subscribe((val: PaidBy) => {
      const bankControl = this.expenseForm.get('bankAccountId');
      const employeeControl = this.expenseForm.get('employeeUserId');

      if (val === 'COMPANY') {
        bankControl?.setValidators([Validators.required]);
        employeeControl?.clearValidators();
        if (!bankControl?.value && this.bankAccounts.length > 0) {
          bankControl?.setValue(this.bankAccounts[0].id);
        }
      } else {
        employeeControl?.setValidators([Validators.required]);
        bankControl?.clearValidators();
        bankControl?.setValue(null);
        if (!employeeControl?.value && this.employees.length > 0) {
          employeeControl?.setValue(this.employees[0].id);
        }
      }
      bankControl?.updateValueAndValidity();
      employeeControl?.updateValueAndValidity();
    });
  }

  get lines(): FormArray {
    return this.expenseForm.get('lines') as FormArray;
  }

  createLineGroup(): FormGroup {
    const defaultTaxRateId = this.taxRates.length > 0 ? this.taxRates[0].id : null;
    return this.fb.group({
      categoryId: [null, [Validators.required]],
      description: ['', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      taxRateId: [defaultTaxRateId],
      costCenterId: [null],
      customerId: [null],
      isBillable: [false]
    });
  }

  addLine(): void {
    const group = this.createLineGroup();
    // Default to first category if available
    if (this.categories.length > 0) {
      group.get('categoryId')?.setValue(this.categories[0].id);
      if (this.categories[0].defaultTaxRateId) {
        group.get('taxRateId')?.setValue(this.categories[0].defaultTaxRateId);
      }
    }
    this.lines.push(group);
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    } else {
      this.notificationService.warning('An expense must contain at least one line item.');
    }
  }

  onCategoryChange(index: number): void {
    const line = this.lines.at(index);
    const catId = line.get('categoryId')?.value;
    const cat = this.categories.find(c => c.id === catId);
    if (cat && cat.defaultTaxRateId) {
      line.get('taxRateId')?.setValue(cat.defaultTaxRateId);
    }
    this.evaluatePolicyChecks();
  }

  setPaidBy(type: PaidBy): void {
    this.expenseForm.patchValue({ paidBy: type });
  }

  private loadDependencies(): void {
    // Categories
    this.expenseService.getAllActiveCategories().subscribe({
      next: cats => {
        this.categories = cats;
        // If first line exists and categoryId not set, set it
        if (this.lines.length > 0 && !this.lines.at(0).get('categoryId')?.value && cats.length > 0) {
          this.lines.at(0).get('categoryId')?.setValue(cats[0].id);
        }
        this.evaluatePolicyChecks();
      }
    });

    // Bank Accounts
    this.bankAccountService.getBankAccounts().subscribe({
      next: accounts => {
        this.bankAccounts = accounts;
        if (this.expenseForm.get('paidBy')?.value === 'COMPANY' && !this.expenseForm.get('bankAccountId')?.value) {
          if (accounts.length > 0) {
            this.expenseForm.patchValue({ bankAccountId: accounts[0].id });
          }
        }
      }
    });

    // Tax Rates
    this.taxRateService.getTaxRates().subscribe({
      next: rates => {
        this.taxRates = rates;
        // set default on lines without tax rate
        this.lines.controls.forEach(control => {
          if (!control.get('taxRateId')?.value && rates.length > 0) {
            control.get('taxRateId')?.setValue(rates[0].id);
          }
        });
        this.calculateTotals();
      }
    });

    // Cost Centers
    this.costCenterService.getCostCenters().subscribe({
      next: ccs => (this.costCenters = ccs),
      error: () => (this.costCenters = [])
    });

    // Customers
    this.customerService.getCustomers({ isActive: true }).subscribe({
      next: page => (this.customers = page.content || []),
      error: () => (this.customers = [])
    });

    // Employees / Users
    this.userService.getUsers().subscribe({
      next: users => {
        this.employees = users;
        if (this.expenseForm.get('paidBy')?.value === 'EMPLOYEE' && !this.expenseForm.get('employeeUserId')?.value) {
          if (users.length > 0) {
            this.expenseForm.patchValue({ employeeUserId: users[0].id });
          }
        }
      }
    });
  }

  private loadExistingExpense(id: number): void {
    this.expenseService.getExpenseById(id).subscribe({
      next: exp => {
        this.existingExpense = exp;
        this.existingAttachments = exp.attachments || [];

        this.expenseForm.patchValue({
          paidBy: exp.paidBy,
          employeeUserId: exp.employeeUserId,
          bankAccountId: exp.bankAccountId,
          payeeName: exp.payeeName,
          expenseDate: exp.expenseDate,
          currencyCode: exp.currencyCode,
          exchangeRate: exp.exchangeRate
        });

        // Populate lines
        this.lines.clear();
        if (exp.lines && exp.lines.length > 0) {
          exp.lines.forEach(line => {
            const group = this.createLineGroup();
            group.patchValue({
              categoryId: line.categoryId,
              description: line.description,
              amount: line.amount,
              taxRateId: line.taxRateId,
              costCenterId: line.costCenterId,
              customerId: line.customerId,
              isBillable: line.isBillable
            });
            this.lines.push(group);
          });
        } else {
          this.addLine();
        }

        this.calculateTotals();
        this.evaluatePolicyChecks();
      },
      error: () => {
        this.notificationService.error(`Failed to load expense #${id}`);
      }
    });
  }

  // Totals Calculation
  calculateTotals(): void {
    let sub = 0;
    let tax = 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines.at(i);
      const amt = Number(line.get('amount')?.value) || 0;
      const taxRateId = line.get('taxRateId')?.value;
      const taxRate = this.taxRates.find(t => t.id === taxRateId);
      const ratePct = taxRate ? taxRate.rate : 0;
      const lineTax = amt * (ratePct / 100);

      sub += amt;
      tax += lineTax;
    }

    this.subtotal = Math.round(sub * 100) / 100;
    this.taxTotal = Math.round(tax * 100) / 100;
    this.grandTotal = Math.round((this.subtotal + this.taxTotal) * 100) / 100;
  }

  getLineTaxAmount(index: number): number {
    const line = this.lines.at(index);
    const amt = Number(line.get('amount')?.value) || 0;
    const taxRateId = line.get('taxRateId')?.value;
    const taxRate = this.taxRates.find(t => t.id === taxRateId);
    const ratePct = taxRate ? taxRate.rate : 0;
    return Math.round(amt * (ratePct / 100) * 100) / 100;
  }

  // Real-time Policy Checking (FinLedger v2.0 Section 4.11)
  evaluatePolicyChecks(): void {
    const warnings: PolicyWarning[] = [];
    const hasAttachments = this.pendingFiles.length > 0 || this.existingAttachments.length > 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines.at(i);
      const catId = line.get('categoryId')?.value;
      const amount = Number(line.get('amount')?.value) || 0;
      const category = this.categories.find(c => c.id === catId);

      if (!category) continue;

      // Policy 1: Receipt Required
      if (category.receiptRequired && !hasAttachments) {
        warnings.push({
          type: 'RECEIPT',
          lineIndex: i,
          categoryName: category.name,
          message: `Category "${category.name}" (Line #${i + 1}) requires a receipt attachment before approval.`
        });
      }

      // Policy 2: Limit Per Claim
      if (category.limitPerClaim && category.limitPerClaim > 0 && amount > category.limitPerClaim) {
        warnings.push({
          type: 'LIMIT',
          lineIndex: i,
          categoryName: category.name,
          message: `Line #${i + 1} amount (AED ${amount.toFixed(2)}) exceeds policy limit of AED ${category.limitPerClaim.toFixed(2)} for "${category.name}".`
        });
      }
    }

    this.policyWarnings = warnings;
  }

  isLineOverLimit(index: number): boolean {
    return this.policyWarnings.some(w => w.type === 'LIMIT' && w.lineIndex === index);
  }

  getLineWarning(index: number): string | null {
    const w = this.policyWarnings.find(warn => warn.lineIndex === index);
    return w ? w.message : null;
  }

  // File Upload Handlers (Drag & drop or camera capture)
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer && event.dataTransfer.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = ''; // reset so same file can be re-selected if needed
    }
  }

  private addFiles(files: File[]): void {
    for (const file of files) {
      const pending: PendingFile = {
        file,
        name: file.name,
        size: file.size,
        type: file.type
      };

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
          pending.previewUrl = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }

      this.pendingFiles.push(pending);
    }

    this.evaluatePolicyChecks();
    this.notificationService.info(`Added ${files.length} file(s) for upload.`);
  }

  removePendingFile(index: number): void {
    this.pendingFiles.splice(index, 1);
    this.evaluatePolicyChecks();
  }

  removeExistingAttachment(id: number): void {
    this.expenseService.deleteAttachment(id).subscribe({
      next: () => {
        this.existingAttachments = this.existingAttachments.filter(a => a.id !== id);
        this.evaluatePolicyChecks();
        this.notificationService.success('Attachment removed.');
      },
      error: () => {
        this.notificationService.error('Failed to remove attachment.');
      }
    });
  }

  // Journal Entry Preview (Section 4.11)
  getJournalPreviewLines(): JournalPreviewLine[] {
    const result: JournalPreviewLine[] = [];

    // Debits: Expense accounts for each line
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines.at(i);
      const catId = line.get('categoryId')?.value;
      const amt = Number(line.get('amount')?.value) || 0;
      const desc = line.get('description')?.value || 'Expense item';
      const cat = this.categories.find(c => c.id === catId);

      if (amt > 0) {
        result.push({
          accountCode: cat?.accountCode || '5300',
          accountName: cat?.name || 'General Expense',
          description: desc,
          debit: amt,
          credit: 0
        });
      }
    }

    // Debit: VAT Input Tax if applicable
    if (this.taxTotal > 0) {
      result.push({
        accountCode: '2200',
        accountName: 'Input VAT Recoverable (5%)',
        description: 'Recoverable input VAT on expenses',
        debit: this.taxTotal,
        credit: 0
      });
    }

    // Credit: Bank/Cash/Card account or Employee Reimbursements Payable
    if (this.grandTotal > 0) {
      const isCompany = this.expenseForm.get('paidBy')?.value === 'COMPANY';
      if (isCompany) {
        const bankId = this.expenseForm.get('bankAccountId')?.value;
        const bank = this.bankAccounts.find(b => b.id === bankId);
        result.push({
          accountCode: '1110',
          accountName: bank ? `${bank.name} (${bank.accountKind})` : 'Bank / Cash Account',
          description: 'Payment for company expense',
          debit: 0,
          credit: this.grandTotal
        });
      } else {
        const empId = this.expenseForm.get('employeeUserId')?.value;
        const emp = this.employees.find(u => u.id === empId);
        result.push({
          accountCode: '2150',
          accountName: 'Employee Reimbursements Payable',
          description: `Reimbursement claim: ${emp ? emp.fullName : 'Employee'}`,
          debit: 0,
          credit: this.grandTotal
        });
      }
    }

    return result;
  }

  // Save / Submit
  saveDraft(): void {
    if (!this.validateFormBasic()) return;
    this.savingDraft = true;
    this.persistExpense(false);
  }

  submitForApproval(): void {
    if (!this.validateFormBasic()) return;

    // Check policy warning for receipt
    const receiptWarning = this.policyWarnings.find(w => w.type === 'RECEIPT');
    if (receiptWarning) {
      this.notificationService.error(
        'Cannot submit claim: Corporate policy requires at least one receipt attachment for the selected categories.'
      );
      return;
    }

    this.submitting = true;
    this.persistExpense(true);
  }

  private validateFormBasic(): boolean {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      this.notificationService.error('Please complete all required fields correctly.');
      return false;
    }

    if (this.lines.length === 0) {
      this.notificationService.error('Please add at least one expense line.');
      return false;
    }

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines.at(i);
      const amt = Number(line.get('amount')?.value) || 0;
      if (amt <= 0) {
        this.notificationService.error(`Line #${i + 1} amount must be greater than zero.`);
        return false;
      }
    }

    return true;
  }

  private persistExpense(submitAfter: boolean): void {
    const fv = this.expenseForm.value;

    const lineRequests: ExpenseLineRequest[] = fv.lines.map((l: any, idx: number) => ({
      lineNo: (idx + 1) as any,
      categoryId: l.categoryId,
      description: l.description,
      amount: Number(l.amount),
      taxRateId: l.taxRateId ? Number(l.taxRateId) : null,
      costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
      customerId: l.customerId ? Number(l.customerId) : null,
      isBillable: !!l.isBillable
    }));

    const createReq: CreateExpenseRequest = {
      expenseDate: fv.expenseDate,
      paidBy: fv.paidBy,
      employeeUserId: fv.paidBy === 'EMPLOYEE' ? fv.employeeUserId : null,
      bankAccountId: fv.paidBy === 'COMPANY' ? fv.bankAccountId : null,
      payeeName: fv.payeeName || null,
      currencyCode: fv.currencyCode || 'AED',
      exchangeRate: fv.exchangeRate || 1.0,
      lines: lineRequests
    };

    const operation$ = this.expenseId
      ? this.expenseService.updateExpense(this.expenseId, createReq)
      : this.expenseService.createExpense(createReq);

    operation$.subscribe({
      next: savedExp => {
        // Upload any pending receipts
        this.uploadPendingFiles(savedExp.id, () => {
          if (submitAfter) {
            this.expenseService.submitExpense(savedExp.id).subscribe({
              next: () => {
                this.submitting = false;
                this.notificationService.success(
                  `Expense claim ${savedExp.expenseNo} submitted for approval!`
                );
                this.router.navigate(['/expenses']);
              },
              error: err => {
                this.submitting = false;
                const msg = err?.error?.message || 'Expense saved, but submission failed.';
                this.notificationService.warning(msg);
                this.router.navigate(['/expenses']);
              }
            });
          } else {
            this.savingDraft = false;
            this.notificationService.success(
              `Expense ${savedExp.expenseNo} saved as draft.`
            );
            this.router.navigate(['/expenses']);
          }
        });
      },
      error: err => {
        this.savingDraft = false;
        this.submitting = false;
        const msg = err?.error?.message || 'Failed to save expense claim.';
        this.notificationService.error(msg);
      }
    });
  }

  private uploadPendingFiles(expenseId: number, onDone: () => void): void {
    if (this.pendingFiles.length === 0) {
      onDone();
      return;
    }

    let completed = 0;
    for (const pf of this.pendingFiles) {
      this.expenseService.uploadAttachment(pf.file, 'EXPENSE', expenseId).subscribe({
        next: () => {
          completed++;
          if (completed === this.pendingFiles.length) {
            onDone();
          }
        },
        error: () => {
          // Even if an individual upload fails, complete the flow
          completed++;
          if (completed === this.pendingFiles.length) {
            onDone();
          }
        }
      });
    }
  }
}

