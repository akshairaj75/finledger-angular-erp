export interface Role {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  permissions: string[];
}

export interface RoleRequest {
  name: string;
  description?: string;
  permissionCodes: string[];
}

export interface PermissionItem {
  id: number;
  code: string;
  module: string;
  description?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  roleIds: number[];
}

export interface UpdateUserRequest {
  fullName: string;
  status?: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  roleIds?: number[];
}

export interface CompanyUpdateRequest {
  legalName: string;
  trn?: string;
  countryCode: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  address?: string;
  email?: string;
  phone?: string;
  logoPath?: string;
  allowNegativeStock?: boolean;
  isActive?: boolean;
}

export interface FiscalPeriod {
  id: number;
  fiscalYearId: number;
  periodNo: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
}

export interface FiscalYear {
  id: number;
  companyId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  periods: FiscalPeriod[];
}

export interface CreateFiscalYearRequest {
  name: string;
  startDate: string;
  endDate: string;
  autoGeneratePeriods: boolean;
}

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface ExchangeRateItem {
  id: number;
  companyId: number;
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
}

export interface ExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
}

export interface CrmStageItem {
  id: number;
  name: string;
  sortOrder: number;
  probabilityPct: number;
  stageType: 'OPEN' | 'WON' | 'LOST';
}

export interface CrmStageRequest {
  name: string;
  sortOrder: number;
  probabilityPct: number;
  stageType: 'OPEN' | 'WON' | 'LOST';
}

export interface NumberSeriesItem {
  id: number;
  docType: string;
  prefix: string;
  nextNumber: number;
  padding: number;
}

export interface AuditLogItem {
  id: number;
  userId?: number;
  userName: string;
  entityName: string;
  entityId: number;
  action: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  createdAt: string;
}


