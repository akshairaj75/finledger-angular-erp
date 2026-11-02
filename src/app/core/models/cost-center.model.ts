export interface CostCenter {
  id: number;
  companyId: number;
  code: string;
  name: string;
  parentId?: number;
  isActive: boolean;
}

