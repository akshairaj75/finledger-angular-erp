import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
  board: OpportunityBoard = {
    columns: [],
    grandTotalValue: 0,
    totalOpportunities: 0
  };
  stages: CrmPipelineStage[] = [];
  customers: Customer[] = [];
  loading = false;

  // View state: 'kanban' or 'list'
  viewMode: 'kanban' | 'list' = 'kanban';
  searchQuery = '';
  selectedStageFilter: number | null = null;

  // KPI Metrics
  openPipelineValue = 0;
  weightedForecastValue = 0;
  wonThisQuarterValue = 0;
  winRatePct = 0;

  // Confirmation Modals for Drag & Drop
  showWonConfirmModal = false;
  showLostConfirmModal = false;
  lostReasonInput = '';
  pendingMove: PendingDragMove | null = null;

  // Lead Import Modal
  showImportModal = false;
  importFile: File | null = null;
  importing = false;
  importResult: LeadImportResult | null = null;

  // New Deal Modal
  showNewDealModal = false;
  newDealForm!: FormGroup;
  savingDeal = false;

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
    this.loading = true;
    this.opportunityService.getOpportunityBoard().subscribe({
      next: board => {
        this.board = board;
        this.computeKpis();
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Failed to load sales pipeline board');
        this.loading = false;
      }
    });

    this.opportunityService.getStages().subscribe({
      next: stages => {
        this.stages = stages.sort((a, b) => a.sortOrder - b.sortOrder);
        if (stages.length > 0 && !this.newDealForm.get('stageId')?.value) {
          this.newDealForm.patchValue({
            stageId: stages[0].id,
            probabilityPct: stages[0].probabilityPct
          });
        }
      }
    });
  }

  loadCustomers(): void {
    this.customerService.getCustomers({ page: 0, size: 100, isActive: true }).subscribe({
      next: page => {
        this.customers = page.content;
      }
    });
  }

  computeKpis(): void {
    let openTotal = 0;
    let weightedTotal = 0;
    let wonTotal = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const col of this.board.columns) {
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

    this.openPipelineValue = openTotal;
    this.weightedForecastValue = Math.round(weightedTotal * 100) / 100;
    this.wonThisQuarterValue = wonTotal;

    const totalClosed = wonCount + lostCount;
    this.winRatePct = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;
  }

  // Angular CDK Drag-and-Drop Handler
  onDrop(event: CdkDragDrop<Opportunity[]>, targetColumn: OpportunityStageColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
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
      this.pendingMove = moveContext;
      this.showWonConfirmModal = true;
      return;
    }

    // If moving to LOST stage: prompt confirmation with lost reason
    if (targetColumn.stageType === 'LOST') {
      this.pendingMove = moveContext;
      this.lostReasonInput = '';
      this.showLostConfirmModal = true;
      return;
    }

    // For normal OPEN stages: execute directly with rollback safety
    this.executeMove(moveContext, undefined);
  }

  confirmWonMove(): void {
    if (!this.pendingMove) return;
    const move = this.pendingMove;
    this.showWonConfirmModal = false;
    this.pendingMove = null;
    this.executeMove(move, undefined);
  }

  cancelWonMove(): void {
    this.showWonConfirmModal = false;
    this.pendingMove = null;
  }

  confirmLostMove(): void {
    if (!this.pendingMove) return;
    const move = this.pendingMove;
    const reason = this.lostReasonInput.trim();
    this.showLostConfirmModal = false;
    this.pendingMove = null;
    this.executeMove(move, reason || 'Deal Lost');
  }

  cancelLostMove(): void {
    this.showLostConfirmModal = false;
    this.pendingMove = null;
    this.lostReasonInput = '';
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
    this.computeKpis();

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
          this.computeKpis();
          const msg = err.error?.message || 'Failed to update deal stage. Card rolled back.';
          this.notificationService.error(msg);
        }
      });
  }

  private recalculateColumnTotals(): void {
    for (const col of this.board.columns) {
      col.count = col.opportunities.length;
      col.totalValue = col.opportunities.reduce(
        (sum, o) => sum + Number(o.expectedValue || 0),
        0
      );
    }
  }

  // Filtered Opportunities for List View
  get allOpportunities(): Opportunity[] {
    const list: Opportunity[] = [];
    for (const col of this.board.columns) {
      list.push(...col.opportunities);
    }
    return list.filter(opp => {
      const matchStage =
        !this.selectedStageFilter || opp.stageId === this.selectedStageFilter;
      const matchSearch =
        !this.searchQuery.trim() ||
        opp.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        opp.opportunityNo.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (opp.customerName &&
          opp.customerName.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchStage && matchSearch;
    });
  }

  // Lead Import Methods
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.importFile = input.files[0];
    }
  }

  uploadCsv(): void {
    if (!this.importFile) return;
    this.importing = true;
    this.importResult = null;

    this.leadService.importLeadsFromCsv(this.importFile).subscribe({
      next: res => {
        this.importResult = res;
        this.importing = false;
        this.notificationService.success(
          `Successfully imported ${res.importedCount} leads!`
        );
      },
      error: err => {
        this.importing = false;
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
    this.showNewDealModal = true;
  }

  onStageSelectChange(stageId: number): void {
    const stage = this.stages.find(s => s.id === stageId);
    if (stage) {
      this.newDealForm.patchValue({ probabilityPct: stage.probabilityPct });
    }
  }

  saveNewDeal(): void {
    if (this.newDealForm.invalid) {
      this.newDealForm.markAllAsTouched();
      return;
    }

    this.savingDeal = true;
    const req: OpportunityRequest = this.newDealForm.value;

    this.opportunityService.createOpportunity(req).subscribe({
      next: opp => {
        this.savingDeal = false;
        this.showNewDealModal = false;
        this.notificationService.success(`Deal "${opp.title}" created successfully!`);
        this.loadBoard();
      },
      error: err => {
        this.savingDeal = false;
        const msg = err.error?.message || 'Failed to create opportunity';
        this.notificationService.error(msg);
      }
    });
  }
}
