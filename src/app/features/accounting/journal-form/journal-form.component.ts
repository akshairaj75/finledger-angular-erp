import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';
import { Account } from '../../../core/models/account.model';
import { CostCenter } from '../../../core/models/cost-center.model';
import { CreateJournalEntryRequest, JournalLineRequest, JournalSourceType } from '../../../core/models/journal.model';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { applyServerFieldErrors, clearServerFieldErrors } from '../../../core/utils/api-error.util';
import { AccountService } from '../services/account.service';
import { CostCenterService } from '../services/cost-center.service';
import { JournalService } from '../services/journal.service';
import { balancedLinesValidator } from '../validators/balanced-lines.validator';

@Component({
  selector: 'app-journal-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './journal-form.component.html',
  styleUrls: ['./journal-form.component.css']
})
export class JournalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private journalService = inject(JournalService);
  private accountService = inject(AccountService);
  private costCenterService = inject(CostCenterService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  journalForm!: FormGroup;
  accounts = signal<Account[]>([]);
  costCenters = signal<CostCenter[]>([]);
  submitting = signal(false);
  loading = signal(false);
  isEditMode = signal(false);
  journalId = signal<number | null>(null);
  entryNumber = signal<string | null>(null);
  backendFieldErrors = signal<Record<string, string>>({});
  private formRevision = signal(0);

  readonly currencies = ['AED', 'SAR', 'USD', 'EUR', 'GBP'];

  ngOnInit(): void {
    this.initForm();
    this.loadDropdownData();

    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId && paramId !== 'new') {
      const id = Number(paramId);
      if (!isNaN(id)) {
        this.isEditMode.set(true);
        this.journalId.set(id);
        this.loadJournal(id);
      }
    }
  }

  loadJournal(id: number): void {
    this.loading.set(true);
    this.journalService.getJournalEntryById(id).subscribe({
      next: j => {
        this.loading.set(false);
        if (j.status !== 'DRAFT') {
          this.notificationService.warning(`Only DRAFT journal entries can be edited. Current status: ${j.status}`);
          this.router.navigate(['/accounting/journals']);
          return;
        }

        this.entryNumber.set(j.entryNo);
        this.journalForm.patchValue({
          entryDate: j.entryDate,
          reference: j.reference || '',
          currencyCode: j.currencyCode || 'AED',
          exchangeRate: j.exchangeRate || 1.0,
          narration: j.narration || ''
        });

        this.lines.clear();
        for (const l of j.lines) {
          this.lines.push(
            this.fb.group({
              accountId: [l.accountId, [Validators.required]],
              costCenterId: [l.costCenterId || null],
              description: [l.description || ''],
              debit: [l.debit || 0, [Validators.min(0)]],
              credit: [l.credit || 0, [Validators.min(0)]]
            })
          );
        }
        this.formRevision.update(v => v + 1);
      },
      error: () => {
        this.loading.set(false);
        this.notificationService.error('Failed to load journal entry for editing.');
        this.router.navigate(['/accounting/journals']);
      }
    });
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
    this.journalForm.valueChanges.subscribe(() => this.formRevision.update(v => v + 1));
    this.journalForm.statusChanges.subscribe(() => this.formRevision.update(v => v + 1));
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
    this.formRevision.update(v => v + 1);
  }

  removeLine(index: number): void {
    if (this.lines.length > 2) {
      this.lines.removeAt(index);
      this.formRevision.update(v => v + 1);
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
        this.accounts.set(page.content.filter(a => !a.isGroup && a.isActive));
      }
    });

    // Load active cost centers
    this.costCenterService.getCostCenters(true).subscribe({
      next: (list) => {
        this.costCenters.set(list);
      }
    });
  }

  // Running totals calculations for display
  readonly totalDebit = computed(() => {
    this.formRevision();
    if (!this.journalForm) return 0;
    let total = 0;
    for (let i = 0; i < this.lines.length; i++) {
      total += Number(this.lines.at(i).get('debit')?.value) || 0;
    }
    return Math.round(total * 100) / 100;
  });

  readonly totalCredit = computed(() => {
    this.formRevision();
    if (!this.journalForm) return 0;
    let total = 0;
    for (let i = 0; i < this.lines.length; i++) {
      total += Number(this.lines.at(i).get('credit')?.value) || 0;
    }
    return Math.round(total * 100) / 100;
  });

  readonly difference = computed(() => {
    return Math.abs(Math.round((this.totalDebit() - this.totalCredit()) * 100) / 100);
  });

  readonly isBalanced = computed(() => {
    this.formRevision();
    return this.difference() < 0.005 && this.totalDebit() > 0 && !!this.journalForm && this.lines.length >= 2;
  });

  readonly canSubmit = computed(() => {
    this.formRevision();
    return !!this.journalForm && this.journalForm.valid && this.isBalanced() && !this.submitting();
  });

  submit(postImmediately: boolean): void {
    if (!this.canSubmit()) {
      this.journalForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.backendFieldErrors.set({});
    clearServerFieldErrors(this.journalForm);

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

    const action$ = this.isEditMode() && this.journalId()
      ? (postImmediately
          ? this.journalService.update(this.journalId()!, req).pipe(switchMap(upd => this.journalService.postJournalEntry(upd.id)))
          : this.journalService.update(this.journalId()!, req))
      : this.journalService.createJournalEntry(req);

    action$.subscribe({
      next: (result) => {
        this.submitting.set(false);
        const actionVerb = postImmediately ? 'posted' : (this.isEditMode() ? 'updated' : 'saved as draft');
        this.notificationService.success(`Journal entry ${result.entryNo} successfully ${actionVerb}.`);
        this.router.navigate(['/accounting/journals']);
      },
      error: (err) => {
        this.submitting.set(false);
        const parsed = applyServerFieldErrors(this.journalForm, err);
        if (parsed.fieldErrors.length > 0) {
          const map: Record<string, string> = {};
          parsed.fieldErrors.forEach(fe => {
            map[fe.field] = fe.message;
          });
          this.backendFieldErrors.set(map);
        } else {
          this.notificationService.error(err?.error?.message || 'Failed to save journal entry.');
        }
      }
    });
  }
}

