export type StageType = 'OPEN' | 'WON' | 'LOST';

export type LeadSource =
  | 'WEBSITE'
  | 'REFERRAL'
  | 'EXHIBITION'
  | 'SOCIAL'
  | 'COLD_CALL'
  | 'IMPORT'
  | 'OTHER';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONVERTED';

export type ActivityType =
  | 'CALL'
  | 'MEETING'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'NOTE'
  | 'TASK';

export type ActivityRelatedType = 'LEAD' | 'OPPORTUNITY' | 'CUSTOMER';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'INVOICED';

export interface CrmPipelineStage {
  id: number;
  companyId?: number;
  name: string;
  sortOrder: number;
  probabilityPct: number;
  stageType: StageType;
}

export interface Opportunity {
  id: number;
  companyId?: number;
  opportunityNo: string;
  title: string;
  leadId?: number;
  customerId?: number;
  customerName?: string;
  contactId?: number;
  contactName?: string;
  stageId: number;
  stageName?: string;
  expectedValue: number;
  currencyCode: string;
  probabilityPct: number;
  expectedCloseDate?: string;
  ownerUserId?: number;
  ownerUserName?: string;
  lostReason?: string;
  closedAt?: string;
  createdAt?: string;
}

export interface OpportunityStageColumn {
  stageId: number;
  stageName: string;
  sortOrder: number;
  probabilityPct: number;
  stageType: StageType;
  totalValue: number;
  count: number;
  opportunities: Opportunity[];
}

export interface OpportunityBoard {
  columns: OpportunityStageColumn[];
  grandTotalValue: number;
  totalOpportunities: number;
}

export interface OpportunityStageRequest {
  stageId: number;
  lostReason?: string;
}

export interface OpportunityRequest {
  title: string;
  leadId?: number;
  customerId?: number;
  contactId?: number;
  stageId: number;
  expectedValue?: number;
  currencyCode?: string;
  probabilityPct?: number;
  expectedCloseDate?: string;
  ownerUserId?: number;
}

export interface Lead {
  id: number;
  companyId?: number;
  leadNo: string;
  companyName?: string;
  contactName: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  industry?: string;
  city?: string;
  countryCode?: string;
  status: LeadStatus;
  ownerUserId?: number;
  ownerUserName?: string;
  convertedCustomerId?: number;
  convertedCustomerName?: string;
  convertedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface LeadRequest {
  companyName?: string;
  contactName: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  industry?: string;
  city?: string;
  countryCode?: string;
  ownerUserId?: number;
  notes?: string;
}

export interface LeadConvertRequest {
  customerCode?: string;
  customerName?: string;
  trn?: string;
  arAccountId?: number;
  matchExistingCustomerId?: number;
  forceCreate?: boolean;
}

export interface LeadConvertResponse {
  customerId: number;
  customerCode: string;
  customerName: string;
  contactId?: number;
  arAccountId?: number;
  matchedExisting?: boolean;
}

export interface LeadImportResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface Contact {
  id: number;
  companyId?: number;
  customerId?: number;
  leadId?: number;
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface ContactRequest {
  customerId?: number;
  leadId?: number;
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface CrmActivity {
  id: number;
  companyId?: number;
  activityType: ActivityType;
  subject: string;
  details?: string;
  relatedType: ActivityRelatedType;
  relatedId: number;
  dueAt?: string;
  completedAt?: string;
  assignedUserId?: number;
  assignedUserName?: string;
  createdAt?: string;
}

export interface CrmActivityRequest {
  activityType: ActivityType;
  subject: string;
  details?: string;
  relatedType: ActivityRelatedType;
  relatedId: number;
  dueAt?: string;
  assignedUserId?: number;
}

export interface QuotationLine {
  id?: number;
  quotationId?: number;
  lineNo: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRateId?: number;
  lineTotal: number;
}

export interface Quotation {
  id: number;
  companyId?: number;
  quotationNo: string;
  opportunityId?: number;
  opportunityTitle?: string;
  customerId?: number;
  customerName?: string;
  leadId?: number;
  leadNo?: string;
  quoteDate: string;
  validUntil: string;
  currencyCode: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: QuotationStatus;
  invoiceId?: number;
  invoiceNo?: string;
  lines: QuotationLine[];
  createdAt?: string;
}

export interface QuotationLineRequest {
  lineNo: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRateId?: number;
}

export interface QuotationRequest {
  opportunityId?: number;
  customerId?: number;
  leadId?: number;
  quoteDate: string;
  validUntil: string;
  currencyCode?: string;
  lines: QuotationLineRequest[];
}

export interface ConvertToInvoiceResponse {
  quotationId: number;
  invoiceId: number;
  invoiceNo: string;
}

