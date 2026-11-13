import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  permissions: string[];
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface CompanyProfile {
  id: number;
  code: string;
  legalName: string;
  trn?: string;
  countryCode: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  address?: string;
  email?: string;
  phone?: string;
  logoPath?: string;
  isActive: boolean;
  allowNegativeStock?: boolean;
}

export interface MeResponse {
  user: User;
  company: CompanyProfile;
  permissions: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

