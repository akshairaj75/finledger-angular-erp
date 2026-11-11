import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guard';

export const SETTINGS_ROUTES: Routes = [
  { path: '', redirectTo: 'company', pathMatch: 'full' },
  {
    path: 'company',
    canActivate: [permissionGuard],
    data: { permissions: ['COMPANY_VIEW', 'SETTINGS_VIEW', 'SETTINGS_EDIT'] },
    loadComponent: () =>
      import('./company-settings/company-settings.component').then(m => m.CompanySettingsComponent)
  },
  {
    path: 'users',
    canActivate: [permissionGuard],
    data: { permissions: ['USER_VIEW', 'SETTINGS_EDIT'] },
    loadComponent: () =>
      import('./user-management/user-management.component').then(m => m.UserManagementComponent)
  },
  {
    path: 'roles',
    canActivate: [permissionGuard],
    data: { permissions: ['ROLE_VIEW', 'SETTINGS_EDIT'] },
    loadComponent: () =>
      import('./role-management/role-management.component').then(m => m.RoleManagementComponent)
  },
  {
    path: 'fiscal-years',
    canActivate: [permissionGuard],
    data: { permissions: ['SETTINGS_VIEW', 'SETTINGS_EDIT', 'ACCOUNT_VIEW'] },
    loadComponent: () =>
      import('./fiscal-years/fiscal-years.component').then(m => m.FiscalYearsComponent)
  },
  {
    path: 'accounts',
    canActivate: [permissionGuard],
    data: { permissions: ['ACCOUNT_VIEW', 'SETTINGS_EDIT'] },
    loadComponent: () =>
      import('./chart-of-accounts/chart-of-accounts.component').then(m => m.ChartOfAccountsComponent)
  },
  {
    path: 'setup',
    canActivate: [permissionGuard],
    data: { permissions: ['SETTINGS_EDIT', 'COMPANY_VIEW'] },
    loadComponent: () =>
      import('./master-setup/master-setup.component').then(m => m.MasterSetupComponent)
  }
];

