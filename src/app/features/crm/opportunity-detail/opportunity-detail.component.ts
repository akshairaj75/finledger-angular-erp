import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import {
  ActivityType,
  CrmActivity,
  CrmActivityRequest,
  CrmPipelineStage,
  Opportunity,
  Quotation
} from '../../../core/models/crm.model';
import { NotificationService } from '../../../core/services/notification.service';
import { CrmActivityService } from '../services/crm-activity.service';
import { LeadService } from '../services/lead.service';
import { OpportunityService } from '../services/opportunity.service';
import { QuotationService } from '../services/quotation.service';

@Component({
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './opportunity-detail.component.html',
  styleUrls: ['./opportunity-detail.component.css']
})
export class OpportunityDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private opportunityService = inject(OpportunityService);
  private activityService = inject(CrmActivityService);
  private quotationService = inject(QuotationService);
  private leadService = inject(LeadService);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  opportunityId!: number;
  opportunity = signal<Opportunity | null>(null);
  stages = signal<CrmPipelineStage[]>([]);
  activities = signal<CrmActivity[]>([]);
  quotations = signal<Quotation[]>([]);
  loading = signal<boolean>(true);

  // Quick Activity Log Modal
  showActivityModal = signal<boolean>(false);
  activeLogType = signal<ActivityType>('NOTE');
  activityForm!: FormGroup;
  savingActivity = signal<boolean>(false);

  // Mark Lost Modal
  showLostModal = signal<boolean>(false);
  lostReason = signal<string>('');
  submittingLost = signal<boolean>(false);

  // Convert to Customer Modal
  showConvertModal = signal<boolean>(false);
  convertForm!: FormGroup;
  convertingCustomer = signal<boolean>(false);

  // Tasks in Right Panel
  openTasks = computed<CrmActivity[]>(() =>
    this.activities().filter(a => a.activityType === 'TASK' && !a.completedAt)
  );

  completedTasks = computed<CrmActivity[]>(() =>
    this.activities().filter(a => a.activityType === 'TASK' && !!a.completedAt)
  );

  timelineActivities = computed<CrmActivity[]>(() =>
    this.activities().filter(a => a.activityType !== 'TASK')
  );

  ngOnInit(): void {
    this.initForms();
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.opportunityId = Number(idParam);
        this.loadAllData();
      }
    });
  }

  private initForms(): void {
    this.activityForm = this.fb.group({
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      details: [''],
      dueAt: ['']
    });

    this.convertForm = this.fb.group({
      customerCode: ['CUST-' + Math.floor(1000 + Math.random() * 9000), [Validators.required]],
      customerName: ['', [Validators.required]],
      trn: [''],
      arAccountId: [1200]
    });
  }

  loadAllData(): void {
    this.loading.set(true);

    // Load Opportunity Detail
    this.opportunityService.getOpportunityById(this.opportunityId).subscribe({
      next: opp => {
        this.opportunity.set(opp);
        this.convertForm.patchValue({
          customerName: opp.customerName || opp.title
        });
        this.loading.set(false);
      },
      error: () => {
        this.notificationService.error('Failed to load opportunity details');
        this.loading.set(false);
      }
    });

    // Load Stages for progress bar
    this.opportunityService.getStages().subscribe({
      next: stages => {
        this.stages.set([...stages].sort((a, b) => a.sortOrder - b.sortOrder));
      }
    });

    // Load Activities timeline
    this.loadActivities();

    // Load Linked Quotations
    this.loadQuotations();
  }

  loadActivities(): void {
    this.activityService
      .getActivities('OPPORTUNITY', this.opportunityId)
      .subscribe({
        next: acts => {
          this.activities.set(
            [...acts].sort(
              (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            )
          );
        }
      });
  }

  loadQuotations(): void {
    this.quotationService
      .getQuotations(undefined, this.opportunityId, undefined, undefined, undefined, undefined, 0, 50)
      .subscribe({
        next: page => {
          this.quotations.set(page.content);
        }
      });
  }

  // Stage Progress Bar Navigation
  onStageClick(targetStage: CrmPipelineStage): void {
    const opp = this.opportunity();
    if (!opp || opp.stageId === targetStage.id) return;

    if (targetStage.stageType === 'LOST') {
      this.openMarkLostModal();
      return;
    }

    this.opportunityService
      .updateOpportunityStage(this.opportunityId, { stageId: targetStage.id })
      .subscribe({
        next: updated => {
          this.opportunity.set(updated);
          this.notificationService.success(`Opportunity moved to "${targetStage.name}"`);
          this.loadActivities();
        },
        error: err => {
          const msg = err.error?.message || 'Failed to update pipeline stage';
          this.notificationService.error(msg);
        }
      });
  }

  isStageCompleted(stage: CrmPipelineStage): boolean {
    const opp = this.opportunity();
    if (!opp) return false;
    const currentStage = this.stages().find(s => s.id === opp.stageId);
    if (!currentStage) return false;
    return stage.sortOrder < currentStage.sortOrder;
  }

  isStageCurrent(stage: CrmPipelineStage): boolean {
    return this.opportunity()?.stageId === stage.id;
  }

  // Quick Log Activity
  openQuickLog(type: ActivityType): void {
    this.activeLogType.set(type);
    this.activityForm.reset({
      subject: '',
      details: '',
      dueAt: ''
    });
    this.showActivityModal.set(true);
  }

  saveActivity(): void {
    if (this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }

    this.savingActivity.set(true);
    const formVal = this.activityForm.value;
    const logType = this.activeLogType();
    const req: CrmActivityRequest = {
      activityType: logType,
      subject: formVal.subject,
      details: formVal.details || undefined,
      relatedType: 'OPPORTUNITY',
      relatedId: this.opportunityId,
      dueAt: formVal.dueAt ? new Date(formVal.dueAt).toISOString() : undefined
    };

    this.activityService.createActivity(req).subscribe({
      next: () => {
        this.savingActivity.set(false);
        this.showActivityModal.set(false);
        this.notificationService.success(`Logged ${logType.toLowerCase()} successfully!`);
        this.loadActivities();
      },
      error: err => {
        this.savingActivity.set(false);
        const msg = err.error?.message || 'Failed to log activity';
        this.notificationService.error(msg);
      }
    });
  }

  toggleTaskComplete(task: CrmActivity): void {
    this.activityService.completeActivity(task.id).subscribe({
      next: updated => {
        const completedAt = updated.completedAt || new Date().toISOString();
        this.activities.update(list =>
          list.map(a => a.id === task.id ? { ...a, completedAt } : a)
        );
        this.notificationService.success(`Task "${task.subject}" marked complete!`);
      },
      error: () => {
        this.notificationService.error('Failed to complete task');
      }
    });
  }

  // Mark Lost Action
  openMarkLostModal(): void {
    this.lostReason.set('');
    this.showLostModal.set(true);
  }

  confirmMarkLost(): void {
    const reason = this.lostReason().trim();
    if (!reason) return;

    const currentStages = this.stages();
    const lostStage = currentStages.find(s => s.stageType === 'LOST') || currentStages[currentStages.length - 1];
    if (!lostStage) return;

    this.submittingLost.set(true);
    this.opportunityService
      .updateOpportunityStage(this.opportunityId, {
        stageId: lostStage.id,
        lostReason: reason
      })
      .subscribe({
        next: updated => {
          this.opportunity.set(updated);
          this.submittingLost.set(false);
          this.showLostModal.set(false);
          this.notificationService.warning(`Opportunity marked as Lost: "${reason}"`);
          this.loadActivities();
        },
        error: err => {
          this.submittingLost.set(false);
          const msg = err.error?.message || 'Failed to mark as lost';
          this.notificationService.error(msg);
        }
      });
  }

  // Convert to Customer
  openConvertModal(): void {
    this.showConvertModal.set(true);
  }

  confirmConvertToCustomer(): void {
    if (this.convertForm.invalid) {
      this.convertForm.markAllAsTouched();
      return;
    }

    this.convertingCustomer.set(true);
    const formVal = this.convertForm.value;
    const opp = this.opportunity();

    if (opp?.leadId) {
      this.leadService
        .convertLead(opp.leadId, {
          customerCode: formVal.customerCode,
          customerName: formVal.customerName,
          trn: formVal.trn || undefined,
          arAccountId: formVal.arAccountId
        })
        .subscribe({
          next: res => {
            this.convertingCustomer.set(false);
            this.showConvertModal.set(false);
            this.notificationService.success(
              `Lead converted to customer "${res.customerName}" (${res.customerCode})!`
            );
            this.loadAllData();
          },
          error: err => {
            this.convertingCustomer.set(false);
            const msg = err.error?.message || 'Failed to convert to customer';
            this.notificationService.error(msg);
          }
        });
    } else {
      // Mock / Direct linking
      this.convertingCustomer.set(false);
      this.showConvertModal.set(false);
      this.notificationService.info(
        `Customer profile "${formVal.customerName}" prepared for opportunity.`
      );
    }
  }

  // Convert Quotation to Invoice
  convertQuotationToInvoice(quote: Quotation): void {
    this.quotationService.convertToInvoice(quote.id).subscribe({
      next: res => {
        this.notificationService.success(
          `Quotation ${quote.quotationNo} converted to Draft Invoice ${res.invoiceNo}!`
        );
        this.loadQuotations();
      },
      error: err => {
        const msg = err.error?.message || 'Failed to convert quotation to invoice';
        this.notificationService.error(msg);
      }
    });
  }
}

