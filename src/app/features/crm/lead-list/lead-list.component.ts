import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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

  leadsPage: Page<Lead> = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0
  };

  loading = false;
  searchQuery = '';
  selectedStatus: LeadStatus | '' = '';
  selectedSource: LeadSource | '' = '';
  currentPage = 0;
  pageSize = 15;

  // Selected Lead for Detail Layout (Section 4.4)
  selectedLead: Lead | null = null;
  leadActivities: CrmActivity[] = [];
  loadingActivities = false;

  // New Lead Modal
  showNewLeadModal = false;
  leadForm!: FormGroup;
  savingLead = false;

  // Lead Import Modal
  showImportModal = false;
  importFile: File | null = null;
  importing = false;
  importResult: LeadImportResult | null = null;

  // Convert to Customer Modal
  showConvertModal = false;
  convertForm!: FormGroup;
  convertingCustomer = false;

  // Quick Activity Log Modal
  showActivityModal = false;
  activeLogType: ActivityType = 'NOTE';
  activityForm!: FormGroup;
  savingActivity = false;

  // Qualifying state
  qualifying = false;

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
    this.loading = true;
    this.leadService
      .getLeads(
        this.selectedStatus || undefined,
        this.selectedSource || undefined,
        undefined,
        this.searchQuery.trim() || undefined,
        this.currentPage,
        this.pageSize
      )
      .subscribe({
        next: page => {
          this.leadsPage = page;
          this.loading = false;
          // If no lead selected yet and list has items, select the first one for the layout
          if (!this.selectedLead && page.content.length > 0) {
            this.selectLead(page.content[0]);
          } else if (this.selectedLead) {
            // refresh selected lead reference
            const found = page.content.find(l => l.id === this.selectedLead!.id);
            if (found) this.selectedLead = found;
          }
        },
        error: () => {
          this.notificationService.error('Failed to load leads');
          this.loading = false;
        }
      });
  }

  selectLead(lead: Lead): void {
    this.selectedLead = lead;
    this.convertForm.patchValue({
      customerCode: 'CUST-' + Math.floor(1000 + Math.random() * 9000),
      customerName: lead.companyName || lead.contactName,
      trn: ''
    });
    this.loadLeadActivities(lead.id);
  }

  loadLeadActivities(leadId: number): void {
    this.loadingActivities = true;
    this.activityService.getActivities('LEAD', leadId).subscribe({
      next: acts => {
        this.leadActivities = acts.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        this.loadingActivities = false;
      },
      error: () => {
        this.loadingActivities = false;
      }
    });
  }

  // Qualify Lead Action (Section 4.4)
  qualifyLead(): void {
    if (!this.selectedLead) return;
    this.qualifying = true;

    this.leadService.qualifyLead(this.selectedLead.id).subscribe({
      next: opp => {
        this.qualifying = false;
        this.notificationService.success(
          `Lead qualified! Opportunity "${opp.title}" (${opp.opportunityNo}) created.`
        );
        // Navigate to the newly created opportunity detail page
        this.router.navigate(['/crm/opportunities', opp.id]);
      },
      error: err => {
        this.qualifying = false;
        const msg = err.error?.message || 'Failed to qualify lead';
        this.notificationService.error(msg);
      }
    });
  }

  // Convert to Customer
  openConvertModal(): void {
    if (!this.selectedLead) return;
    this.showConvertModal = true;
  }

  confirmConvertToCustomer(): void {
    if (!this.selectedLead || this.convertForm.invalid) {
      this.convertForm.markAllAsTouched();
      return;
    }

    this.convertingCustomer = true;
    const req: LeadConvertRequest = this.convertForm.value;

    this.leadService.convertLead(this.selectedLead.id, req).subscribe({
      next: res => {
        this.convertingCustomer = false;
        this.showConvertModal = false;
        this.notificationService.success(
          `Converted to customer "${res.customerName}" (${res.customerCode})!`
        );
        this.loadLeads();
      },
      error: err => {
        this.convertingCustomer = false;
        const msg = err.error?.message || 'Failed to convert lead to customer';
        this.notificationService.error(msg);
      }
    });
  }

  // Update Status
  updateStatus(newStatus: LeadStatus): void {
    if (!this.selectedLead || this.selectedLead.status === newStatus) return;

    const req: LeadRequest = {
      companyName: this.selectedLead.companyName,
      contactName: this.selectedLead.contactName,
      email: this.selectedLead.email,
      phone: this.selectedLead.phone,
      source: this.selectedLead.source,
      industry: this.selectedLead.industry,
      city: this.selectedLead.city,
      countryCode: this.selectedLead.countryCode,
      notes: this.selectedLead.notes
    };

    this.leadService.updateLead(this.selectedLead.id, req).subscribe({
      next: updated => {
        this.selectedLead!.status = newStatus;
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
    this.activeLogType = type;
    this.activityForm.reset({
      subject: '',
      details: '',
      dueAt: ''
    });
    this.showActivityModal = true;
  }

  saveActivity(): void {
    if (!this.selectedLead || this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }

    this.savingActivity = true;
    const formVal = this.activityForm.value;
    const req: CrmActivityRequest = {
      activityType: this.activeLogType,
      subject: formVal.subject,
      details: formVal.details || undefined,
      relatedType: 'LEAD',
      relatedId: this.selectedLead.id,
      dueAt: formVal.dueAt ? new Date(formVal.dueAt).toISOString() : undefined
    };

    this.activityService.createActivity(req).subscribe({
      next: () => {
        this.savingActivity = false;
        this.showActivityModal = false;
        this.notificationService.success(`Logged ${this.activeLogType.toLowerCase()} successfully!`);
        this.loadLeadActivities(this.selectedLead!.id);
      },
      error: err => {
        this.savingActivity = false;
        const msg = err.error?.message || 'Failed to log activity';
        this.notificationService.error(msg);
      }
    });
  }

  // Tasks
  get openTasks(): CrmActivity[] {
    return this.leadActivities.filter(a => a.activityType === 'TASK' && !a.completedAt);
  }

  get timelineActivities(): CrmActivity[] {
    return this.leadActivities.filter(a => a.activityType !== 'TASK');
  }

  completeTask(task: CrmActivity): void {
    this.activityService.completeActivity(task.id).subscribe({
      next: updated => {
        task.completedAt = updated.completedAt || new Date().toISOString();
        this.notificationService.success(`Task "${task.subject}" marked complete!`);
      }
    });
  }

  // Create Lead
  openNewLeadModal(): void {
    this.initForms();
    this.showNewLeadModal = true;
  }

  saveNewLead(): void {
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }

    this.savingLead = true;
    this.leadService.createLead(this.leadForm.value).subscribe({
      next: lead => {
        this.savingLead = false;
        this.showNewLeadModal = false;
        this.notificationService.success(`Lead "${lead.contactName}" created successfully!`);
        this.loadLeads();
      },
      error: err => {
        this.savingLead = false;
        const msg = err.error?.message || 'Failed to create lead';
        this.notificationService.error(msg);
      }
    });
  }

  // Import Leads
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
        this.notificationService.success(`Imported ${res.importedCount} leads!`);
        this.loadLeads();
      },
      error: err => {
        this.importing = false;
        const msg = err.error?.message || 'Failed to import CSV';
        this.notificationService.error(msg);
      }
    });
  }
}

