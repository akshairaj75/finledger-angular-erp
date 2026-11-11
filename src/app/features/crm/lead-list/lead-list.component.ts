import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  ActivityType,
  CrmActivity,
  CrmActivityRequest,
  Lead,
  LeadConvertRequest,
  LeadImportResult,
  LeadRequest,
  LeadSource,
  LeadStatus
} from '../../../core/models/crm.model';
import { Page } from '../../../core/models/page.model';
import { NotificationService } from '../../../core/services/notification.service';
import { CrmActivityService } from '../services/crm-activity.service';
import { LeadService } from '../services/lead.service';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './lead-list.component.html',
  styleUrls: ['./lead-list.component.css']
})
export class LeadListComponent implements OnInit {
  private leadService = inject(LeadService);
  private activityService = inject(CrmActivityService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  leadsPage = signal<Page<Lead>>({
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  });

  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedStatus = signal<LeadStatus | ''>('');
  selectedSource = signal<LeadSource | ''>('');
  currentPage = signal<number>(0);
  pageSize = signal<number>(15);

  // Selected Lead for Detail Layout (Section 4.4)
  selectedLead = signal<Lead | null>(null);
  leadActivities = signal<CrmActivity[]>([]);
  loadingActivities = signal<boolean>(false);

  // New Lead Modal
  showNewLeadModal = signal<boolean>(false);
  leadForm!: FormGroup;
  savingLead = signal<boolean>(false);

  // Lead Import Modal
  showImportModal = signal<boolean>(false);
  importFile = signal<File | null>(null);
  importing = signal<boolean>(false);
  importResult = signal<LeadImportResult | null>(null);

  // Convert to Customer Modal
  showConvertModal = signal<boolean>(false);
  convertForm!: FormGroup;
  convertingCustomer = signal<boolean>(false);

  // Quick Activity Log Modal
  showActivityModal = signal<boolean>(false);
  activeLogType = signal<ActivityType>('NOTE');
  activityForm!: FormGroup;
  savingActivity = signal<boolean>(false);

  // Qualifying state
  qualifying = signal<boolean>(false);

  // Tasks
  openTasks = computed<CrmActivity[]>(() =>
    this.leadActivities().filter(a => a.activityType === 'TASK' && !a.completedAt)
  );

  timelineActivities = computed<CrmActivity[]>(() =>
    this.leadActivities().filter(a => a.activityType !== 'TASK')
  );

  ngOnInit(): void {
    this.initForms();
    this.loadLeads();
  }

  private initForms(): void {
    this.leadForm = this.fb.group({
      companyName: ['', [Validators.maxLength(200)]],
      contactName: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.email]],
      phone: [''],
      source: ['WEBSITE', [Validators.required]],
      industry: [''],
      city: ['Dubai'],
      countryCode: ['AE'],
      notes: ['']
    });

    this.convertForm = this.fb.group({
      customerCode: ['', [Validators.required]],
      customerName: ['', [Validators.required]],
      trn: [''],
      arAccountId: [1200]
    });

    this.activityForm = this.fb.group({
      subject: ['', [Validators.required]],
      details: [''],
      dueAt: ['']
    });
  }

  loadLeads(): void {
    this.loading.set(true);
    this.leadService
      .getLeads(
        this.selectedStatus() || undefined,
        this.selectedSource() || undefined,
        undefined,
        this.searchQuery().trim() || undefined,
        this.currentPage(),
        this.pageSize()
      )
      .subscribe({
        next: page => {
          this.leadsPage.set(page);
          this.loading.set(false);
          const currentSelected = this.selectedLead();
          // If no lead selected yet and list has items, select the first one for the layout
          if (!currentSelected && page.content.length > 0) {
            this.selectLead(page.content[0]);
          } else if (currentSelected) {
            // refresh selected lead reference
            const found = page.content.find(l => l.id === currentSelected.id);
            if (found) this.selectedLead.set(found);
          }
        },
        error: () => {
          this.notificationService.error('Failed to load leads');
          this.loading.set(false);
        }
      });
  }

  selectLead(lead: Lead): void {
    this.selectedLead.set(lead);
    this.convertForm.patchValue({
      customerCode: 'CUST-' + Math.floor(1000 + Math.random() * 9000),
      customerName: lead.companyName || lead.contactName,
      trn: ''
    });
    this.loadLeadActivities(lead.id);
  }

  loadLeadActivities(leadId: number): void {
    this.loadingActivities.set(true);
    this.activityService.getActivities('LEAD', leadId).subscribe({
      next: acts => {
        this.leadActivities.set(
          [...acts].sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
        );
        this.loadingActivities.set(false);
      },
      error: () => {
        this.loadingActivities.set(false);
      }
    });
  }

  // Qualify Lead Action (Section 4.4)
  qualifyLead(): void {
    const lead = this.selectedLead();
    if (!lead) return;
    this.qualifying.set(true);

    this.leadService.qualifyLead(lead.id).subscribe({
      next: opp => {
        this.qualifying.set(false);
        this.notificationService.success(
          `Lead qualified! Opportunity "${opp.title}" (${opp.opportunityNo}) created.`
        );
        // Navigate to the newly created opportunity detail page
        this.router.navigate(['/crm/opportunities', opp.id]);
      },
      error: err => {
        this.qualifying.set(false);
        const msg = err.error?.message || 'Failed to qualify lead';
        this.notificationService.error(msg);
      }
    });
  }

  // Convert to Customer
  openConvertModal(): void {
    if (!this.selectedLead()) return;
    this.showConvertModal.set(true);
  }

  confirmConvertToCustomer(): void {
    const lead = this.selectedLead();
    if (!lead || this.convertForm.invalid) {
      this.convertForm.markAllAsTouched();
      return;
    }

    this.convertingCustomer.set(true);
    const req: LeadConvertRequest = this.convertForm.value;

    this.leadService.convertLead(lead.id, req).subscribe({
      next: res => {
        this.convertingCustomer.set(false);
        this.showConvertModal.set(false);
        this.notificationService.success(
          `Converted to customer "${res.customerName}" (${res.customerCode})!`
        );
        this.loadLeads();
      },
      error: err => {
        this.convertingCustomer.set(false);
        const msg = err.error?.message || 'Failed to convert lead to customer';
        this.notificationService.error(msg);
      }
    });
  }

  // Update Status
  updateStatus(newStatus: LeadStatus): void {
    const lead = this.selectedLead();
    if (!lead || lead.status === newStatus) return;

    const req: LeadRequest = {
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      industry: lead.industry,
      city: lead.city,
      countryCode: lead.countryCode,
      notes: lead.notes
    };

    this.leadService.updateLead(lead.id, req).subscribe({
      next: updated => {
        this.selectedLead.update(curr => curr ? { ...curr, status: newStatus } : null);
        this.notificationService.success(`Lead status updated to ${newStatus}`);
        this.loadLeads();
      },
      error: () => {
        this.notificationService.error('Failed to update lead status');
      }
    });
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
    const lead = this.selectedLead();
    if (!lead || this.activityForm.invalid) {
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
      relatedType: 'LEAD',
      relatedId: lead.id,
      dueAt: formVal.dueAt ? new Date(formVal.dueAt).toISOString() : undefined
    };

    this.activityService.createActivity(req).subscribe({
      next: () => {
        this.savingActivity.set(false);
        this.showActivityModal.set(false);
        this.notificationService.success(`Logged ${logType.toLowerCase()} successfully!`);
        this.loadLeadActivities(lead.id);
      },
      error: err => {
        this.savingActivity.set(false);
        const msg = err.error?.message || 'Failed to log activity';
        this.notificationService.error(msg);
      }
    });
  }

  completeTask(task: CrmActivity): void {
    this.activityService.completeActivity(task.id).subscribe({
      next: updated => {
        const completedAt = updated.completedAt || new Date().toISOString();
        this.leadActivities.update(list =>
          list.map(a => a.id === task.id ? { ...a, completedAt } : a)
        );
        this.notificationService.success(`Task "${task.subject}" marked complete!`);
      }
    });
  }

  // Create Lead
  openNewLeadModal(): void {
    this.initForms();
    this.showNewLeadModal.set(true);
  }

  saveNewLead(): void {
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }

    this.savingLead.set(true);
    this.leadService.createLead(this.leadForm.value).subscribe({
      next: lead => {
        this.savingLead.set(false);
        this.showNewLeadModal.set(false);
        this.notificationService.success(`Lead "${lead.contactName}" created successfully!`);
        this.loadLeads();
      },
      error: err => {
        this.savingLead.set(false);
        const msg = err.error?.message || 'Failed to create lead';
        this.notificationService.error(msg);
      }
    });
  }

  // Import Leads
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
        this.notificationService.success(`Imported ${res.importedCount} leads!`);
        this.loadLeads();
      },
      error: err => {
        this.importing.set(false);
        const msg = err.error?.message || 'Failed to import CSV';
        this.notificationService.error(msg);
      }
    });
  }
}

