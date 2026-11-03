export interface User {
  id: number;
  companyId?: number;
  email: string;
  fullName: string;
  status?: string;
  roles?: string[];
}

