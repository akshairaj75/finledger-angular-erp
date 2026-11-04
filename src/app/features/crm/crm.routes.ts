import { Routes } from '@angular/router';
import { LeadListComponent } from './lead-list/lead-list.component';
import { OpportunityDetailComponent } from './opportunity-detail/opportunity-detail.component';
import { PipelineBoardComponent } from './pipeline-board/pipeline-board.component';
import { QuotationFormComponent } from './quotation-form/quotation-form.component';

export const CRM_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'pipeline',
    pathMatch: 'full'
  },
  {
    path: 'pipeline',
    component: PipelineBoardComponent,
    title: 'FinLedger - Sales Pipeline'
  },
  {
    path: 'opportunities/:id',
    component: OpportunityDetailComponent,
    title: 'FinLedger - Opportunity Detail'
  },
  {
    path: 'leads',
    component: LeadListComponent,
    title: 'FinLedger - Leads Management'
  },
  {
    path: 'quotations',
    component: QuotationFormComponent,
    title: 'FinLedger - Quotations'
  },
  {
    path: 'quotations/new',
    component: QuotationFormComponent,
    title: 'FinLedger - New Quotation'
  },
  {
    path: 'quotations/:id',
    component: QuotationFormComponent,
    title: 'FinLedger - Quotation Detail'
  }
];

