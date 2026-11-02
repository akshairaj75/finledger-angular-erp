import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Account } from '../../../core/models/account.model';
import { CostCenter } from '../../../core/models/cost-center.model';
import { CreateJournalEntryRequest, JournalLineRequest, JournalSourceType } from '../../../core/models/journal.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AccountService } from '../services/account.service';
import { CostCenterService } from '../services/cost-center.service';
import { JournalService } from '../services/journal.service';
import { balancedLinesValidator } from '../validators/balanced-lines.validator';

@Component({
  selector: 'app-journal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './journal-form.component.html',
  styleUrls: ['./journal-form.component.css']
})
export class JournalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private journalService = inject(JournalService);
  private accountService = inject(AccountService);
  private costCenterService = inject(CostCenterService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  journalForm!: FormGroup;
  accounts: Account[] = [];
  costCenters: CostCenter[] = [];
  submitting = false;
  backendFieldErrors: Record<string, string> = {};

  readonly currencies = ['AED', 'SAR', 'USD', 'EUR', 'GBP'];

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();
  }

  private initForm(): void {
    const today = new Date().toISOString().substring(0, 10);

    this.journalForm = this.fb.group(
      {
        entryDate: [today, [Validators.required]],
        reference: [''],
        currencyCode: ['AED', [Validators.required]],
        exchangeRate: [1.0, [Validators.required, Validators.min(0.000001)]],
        narration: [''],
        lines: this.fb.array([])
      },
      { validators: [balancedLinesValidator] }
    );

    // Initialize with two blank lines
    this.addLine();
    this.addLine();
  }

  get lines(): FormArray {
    return this.journalForm.get('lines') as FormArray;
  }

  createLineGroup(): FormGroup {
    return this.fb.group({
      accountId: [null, [Validators.required]],
      costCenterId: [null],
      description: [''],
      debit: [0, [Validators.min(0)]],
      credit: [0, [Validators.min(0)]]
    });
  }

  addLine(): void {
    this.lines.push(this.createLineGroup());
  }

  removeLine(index: number): void {
    if (this.lines.length > 2) {
      this.lines.removeAt(index);
    } else {
      this.notificationService.warning('A journal entry must contain at least two lines.');
    }
  }

  onDebitChange(index: number): void {
    const line = this.lines.at(index);
    const debitVal = Number(line.get('debit')?.value) || 0;
    if (debitVal > 0) {
      line.patchValue({ credit: 0 }, { emitEvent: false });
    }
    this.journalForm.updateValueAndValidity();
  }

  onCreditChange(index: number): void {
    const line = this.lines.at(index);
    const creditVal = Number(line.get('credit')?.value) || 0;
    if (creditVal > 0) {
      line.patchValue({ debit: 0 }, { emitEvent: false });
    }
    this.journalForm.updateValueAndValidity();
  }

  loadDropdownData(): void {
    // Load non-group posting accounts
    this.accountService.getAccounts(0, 500).subscribe({
      next: (page) => {
        this.accounts = page.content.filter(a => !a.isGroup && a.isActive);
      }
    });

    // Load active cost centers
    this.costCenterService.getCostCenters(true).subscribe({
      next: (list) => {
        this.costCenters = list;
      }
    });
  }

  // Running totals calculations for display
  get totalDebit(): number {
    let total = 0;
    for (let i = 0; i < this.lines.length; i++) {
      total += Number(this.lines.at(i).get('debit')?.value) || 0;
    }
    return Math.round(total * 100) / 100;
  }

  get totalCredit(): number {
    let total = 0;
    for (let i = 0; i < this.lines.length; i++) {
      total += Number(this.lines.at(i).get('credit')?.value) || 0;
    }
    return Math.round(total * 100) / 100;
  }

  get difference(): number {
    return Math.abs(Math.round((this.totalDebit - this.totalCredit) * 100) / 100);
  }

  get isBalanced(): boolean {
    return this.difference < 0.005 && this.totalDebit > 0 && this.lines.length >= 2;
  }

  get canSubmit(): boolean {
    return this.journalForm.valid && this.isBalanced && !this.submitting;
  }

  submit(postImmediately: boolean): void {
    if (!this.canSubmit) {
      this.journalForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.backendFieldErrors = {};

    const formVal = this.journalForm.value;
    const lineRequests: JournalLineRequest[] = formVal.lines.map((l: any) => ({
      accountId: Number(l.accountId),
      costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
      description: l.description || null,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0
    }));

    const req: CreateJournalEntryRequest = {
      entryDate: formVal.entryDate,
      reference: formVal.reference || null,
      narration: formVal.narration || null,
      sourceType: 'MANUAL',
      currencyCode: formVal.currencyCode,
      exchangeRate: Number(formVal.exchangeRate) || 1.0,
      lines: lineRequests,
      postImmediately
    };

    this.journalService.createJournalEntry(req).subscribe({
      next: (created) => {
        this.submitting = false;
        const actionVerb = postImmediately ? 'posted' : 'saved as draft';
        this.notificationService.success(`Journal entry ${created.entryNo} successfully ${actionVerb}.`);
        this.router.navigate(['/accounting/journals']);
      },
      error: (err) => {
        this.submitting = false;
        if (err.error?.fieldErrors) {
          err.error.fieldErrors.forEach((fe: any) => {
            this.backendFieldErrors[fe.field] = fe.message;
          });
        }
      }
    });
  }
}

