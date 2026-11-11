import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';
import {
  CrmPipelineStage,
  LeadImportResult,
  Opportunity,
  OpportunityBoard,
  OpportunityRequest,
  OpportunityStageColumn
} from '../../../core/models/crm.model';
import { Customer } from '../../../core/models/customer.model';
import { NotificationService } from '../../../core/services/notification.service';
import { CustomerService } from '../../sales/services/customer.service';
import { LeadService } from '../services/lead.service';
import { OpportunityService } from '../services/opportunity.service';

export interface PendingDragMove {
  previousData: Opportunity[];
  targetData: Opportunity[];
  previousIndex: number;
  targetIndex: number;
  targetColumn: OpportunityStageColumn;
  opportunity: Opportunity;
  originalStageId: number;
  originalStageName?: string;
}

@Component({
  selector: 'app-pipeline-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder
  ],
  templateUrl: './pipeline-board.component.html',
  styleUrls: ['./pipeline-board.component.css']
})
export class PipelineBoardComponent implements OnInit {
  private opportunityService = inject(OpportunityService);
  private leadService = inject(LeadService);
  private customerService = inject(CustomerService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  // Board Data
  board = signal<OpportunityBoard>({
    columns: [],
    grandTotalValue: 0,
    totalOpportunities: 0
  });
  stages = signal<CrmPipelineStage[]>([]);
  customers = signal<Customer[]>([]);
  loading = signal<boolean>(false);

  // View state: 'kanban' or 'list'
  viewMode = signal<'kanban' | 'list'>('kanban');
  searchQuery = signal<string>('');
  selectedStageFilter = signal<number | null>(null);

  // KPI Metrics (computed from board signal)
  private readonly boardKpis = computed(() => {
    let openTotal = 0;
    let weightedTotal = 0;
    let wonTotal = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const col of this.board().columns) {
      if (col.stageType === 'OPEN') {
        openTotal += Number(col.totalValue || 0);
        for (const opp of col.opportunities) {
          const val = Number(opp.expectedValue || 0);
          const prob = Number(opp.probabilityPct || col.probabilityPct || 0);
          weightedTotal += (val * prob) / 100;
        }
      } else if (col.stageType === 'WON') {
        wonTotal += Number(col.totalValue || 0);
        wonCount += col.count;
      } else if (col.stageType === 'LOST') {
        lostCount += col.count;
      }
    }

    const totalClosed = wonCount + lostCount;
    return {
      openPipelineValue: openTotal,
      weightedForecastValue: Math.round(weightedTotal * 100) / 100,
      wonThisQuarterValue: wonTotal,
      winRatePct: totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0
    };
  });

  openPipelineValue = computed<number>(() => this.boardKpis().openPipelineValue);
  weightedForecastValue = computed<number>(() => this.boardKpis().weightedForecastValue);
  wonThisQuarterValue = computed<number>(() => this.boardKpis().wonThisQuarterValue);
  winRatePct = computed<number>(() => this.boardKpis().winRatePct);

  // Confirmation Modals for Drag & Drop
  showWonConfirmModal = signal<boolean>(false);
  showLostConfirmModal = signal<boolean>(false);
  lostReasonInput = signal<string>('');
  pendingMove = signal<PendingDragMove | null>(null);

  // Lead Import Modal
  showImportModal = signal<boolean>(false);
  importFile = signal<File | null>(null);
  importing = signal<boolean>(false);
  importResult = signal<LeadImportResult | null>(null);

  // New Deal Modal
  showNewDealModal = signal<boolean>(false);
  newDealForm!: FormGroup;
  savingDeal = signal<boolean>(false);

  ngOnInit(): void {
    this.initForm();
    this.loadBoard();
    this.loadCustomers();
  }

  private initForm(): void {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const dateStr = nextMonth.toISOString().split('T')[0];

    this.newDealForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      customerId: [null],
      stageId: [null, [Validators.required]],
      expectedValue: [10000, [Validators.required, Validators.min(0)]],
      currencyCode: ['AED', [Validators.required]],
      probabilityPct: [20, [Validators.min(0), Validators.max(100)]],
      expectedCloseDate: [dateStr, [Validators.required]]
    });
  }

  loadBoard(): void {
    this.loading.set(true);
    this.opportunityService.getOpportunityBoard().subscribe({
      next: board => {
        this.board.set(board);
        this.loading.set(false);
      },
      error: () => {
        this.notificationService.error('Failed to load sales pipeline board');
        this.loading.set(false);
      }
    });

    this.opportunityService.getStages().subscribe({
      next: stages => {
        const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
        this.stages.set(sorted);
        if (sorted.length > 0 && !this.newDealForm.get('stageId')?.value) {
          this.newDealForm.patchValue({
            stageId: sorted[0].id,
            probabilityPct: sorted[0].probabilityPct
          });
        }
      }
    });
  }

  loadCustomers(): void {
    this.customerService.getCustomers({ page: 0, size: 100, isActive: true }).subscribe({
      next: page => {
        this.customers.set(page.content);
      }
    });
  }

  // Angular CDK Drag-and-Drop Handler
  onDrop(event: CdkDragDrop<Opportunity[]>, targetColumn: OpportunityStageColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.board.update(curr => ({ ...curr, columns: curr.columns.map(c => ({ ...c })) }));
      return;
    }

    const opportunity = event.previousContainer.data[event.previousIndex];
    if (!opportunity) return;

    const originalStageId = opportunity.stageId;
    const originalStageName = opportunity.stageName;

    const moveContext: PendingDragMove = {
      previousData: event.previousContainer.data,
      targetData: event.container.data,
      previousIndex: event.previousIndex,
      targetIndex: event.currentIndex,
      targetColumn,
      opportunity,
      originalStageId,
      originalStageName
    };

    // If moving to WON stage: prompt confirmation
    if (targetColumn.stageType === 'WON') {
      this.pendingMove.set(moveContext);
      this.showWonConfirmModal.set(true);
      return;
    }

    // If moving to LOST stage: prompt confirmation with lost reason
    if (targetColumn.stageType === 'LOST') {
      this.pendingMove.set(moveContext);
      this.lostReasonInput.set('');
      this.showLostConfirmModal.set(true);
      return;
    }

    // For normal OPEN stages: execute directly with rollback safety
    this.executeMove(moveContext, undefined);
  }

  confirmWonMove(): void {
    const move = this.pendingMove();
    if (!move) return;
    this.showWonConfirmModal.set(false);
    this.pendingMove.set(null);
    this.executeMove(move, undefined);
  }

  cancelWonMove(): void {
    this.showWonConfirmModal.set(false);
    this.pendingMove.set(null);
  }

  confirmLostMove(): void {
    const move = this.pendingMove();
    if (!move) return;
    const reason = this.lostReasonInput().trim();
    this.showLostConfirmModal.set(false);
    this.pendingMove.set(null);
    this.executeMove(move, reason || 'Deal Lost');
  }

  cancelLostMove(): void {
    this.showLostConfirmModal.set(false);
    this.pendingMove.set(null);
    this.lostReasonInput.set('');
  }

  private executeMove(move: PendingDragMove, lostReason?: string): void {
    // 1. Optimistic UI update
    transferArrayItem(
      move.previousData,
      move.targetData,
      move.previousIndex,
      move.targetIndex
    );
    move.opportunity.stageId = move.targetColumn.stageId;
    move.opportunity.stageName = move.targetColumn.stageName;
    if (lostReason) {
      move.opportunity.lostReason = lostReason;
    }
    this.recalculateColumnTotals();

    // 2. Call Backend API
    this.opportunityService
      .updateOpportunityStage(move.opportunity.id, {
        stageId: move.targetColumn.stageId,
        lostReason: lostReason || undefined
      })
      .subscribe({
        next: updated => {
          move.opportunity.stageId = updated.stageId;
          move.opportunity.stageName = updated.stageName;
          move.opportunity.closedAt = updated.closedAt;
          this.recalculateColumnTotals();
          this.notificationService.success(
            `Deal "${move.opportunity.title}" moved to ${move.targetColumn.stageName}`
          );
        },
        error: err => {
          // 3. Rollback on failure!
          console.error('Stage update failed, rolling back card position:', err);
          transferArrayItem(
            move.targetData,
            move.previousData,
            move.targetIndex,
            move.previousIndex
          );
          move.opportunity.stageId = move.originalStageId;
          move.opportunity.stageName = move.originalStageName;
          this.recalculateColumnTotals();
          const msg = err.error?.message || 'Failed to update deal stage. Card rolled back.';
          this.notificationService.error(msg);
        }
      });
  }

  private recalculateColumnTotals(): void {
    this.board.update(curr => ({
      ...curr,
      columns: curr.columns.map(col => ({
        ...col,
        count: col.opportunities.length,
        totalValue: col.opportunities.reduce(
          (sum, o) => sum + Number(o.expectedValue || 0),
          0
        )
      }))
    }));
  }

  // Filtered Opportunities for List View
  allOpportunities = computed<Opportunity[]>(() => {
    const stageFilter = this.selectedStageFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const list: Opportunity[] = [];
    for (const col of this.board().columns) {
      list.push(...col.opportunities);
    }
    return list.filter(opp => {
      const matchStage = !stageFilter || opp.stageId === stageFilter;
      const matchSearch =
        !query ||
        opp.title.toLowerCase().includes(query) ||
        opp.opportunityNo.toLowerCase().includes(query) ||
        (opp.customerName && opp.customerName.toLowerCase().includes(query));
      return matchStage && matchSearch;
    });
  });

  // Lead Import Methods
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.importFile.set(input.files[0]);
    }
  }

  uploadCsv(): void {
    const file = this.importFile();
    if (!file) return;
    this.importing.set(true);
    this.importResult.set(null);

    this.leadService.importLeadsFromCsv(file).subscribe({
      next: res => {
        this.importResult.set(res);
        this.importing.set(false);
        this.notificationService.success(
          `Successfully imported ${res.importedCount} leads!`
        );
      },
      error: err => {
        this.importing.set(false);
        const msg = err.error?.message || 'Failed to import CSV';
        this.notificationService.error(msg);
      }
    });
  }

  downloadSampleCsv(): void {
    const csvContent =
      'companyName,contactName,email,phone,source,industry,city,countryCode,notes\n' +
      '"Emirates Global Log","Rashid Al-Maktoum","rashid@eglog.ae","+971501112233","WEBSITE","Logistics","Dubai","AE","Looking for supply chain ERP"\n' +
      '"Gulf Retailers LLC","Sarah Jenkins","sarah@gulfretail.com","+971524445566","REFERRAL","Retail","Abu Dhabi","AE","Expanding POS network"';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'sample_lead_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // New Deal Creation
  openNewDealModal(): void {
    this.initForm();
    const currentStages = this.stages();
    if (currentStages.length > 0 && !this.newDealForm.get('stageId')?.value) {
      this.newDealForm.patchValue({
        stageId: currentStages[0].id,
        probabilityPct: currentStages[0].probabilityPct
      });
    }
    this.showNewDealModal.set(true);
  }

  onStageSelectChange(stageId: number): void {
    const stage = this.stages().find(s => s.id === stageId);
    if (stage) {
      this.newDealForm.patchValue({ probabilityPct: stage.probabilityPct });
    }
  }

  saveNewDeal(): void {
    if (this.newDealForm.invalid) {
      this.newDealForm.markAllAsTouched();
      return;
    }

    this.savingDeal.set(true);
    const req: OpportunityRequest = this.newDealForm.value;

    this.opportunityService.createOpportunity(req).subscribe({
      next: opp => {
        this.savingDeal.set(false);
        this.showNewDealModal.set(false);
        this.notificationService.success(`Deal "${opp.title}" created successfully!`);
        this.loadBoard();
      },
      error: err => {
        this.savingDeal.set(false);
        const msg = err.error?.message || 'Failed to create opportunity';
        this.notificationService.error(msg);
      }
    });
  }
}
