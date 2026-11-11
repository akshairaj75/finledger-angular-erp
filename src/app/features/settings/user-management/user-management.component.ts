import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { User } from '../../../core/models/user.model';
import { NotificationService } from '../../../core/services/notification.service';
import { Role } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h2>User Directory & Access Control</h2>
          <p class="subtitle">Manage staff accounts, assign RBAC roles, and unlock locked accounts</p>
        </div>
        <button
          *appHasPermission="['USER_CREATE', 'SETTINGS_EDIT']"
          class="btn-primary"
          (click)="openCreateModal()"
        >
          + Add User
        </button>
      </div>

      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email Address</th>
              <th>Assigned Roles</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td class="font-medium">{{ u.fullName }}</td>
              <td>{{ u.email }}</td>
              <td>
                <span class="role-badge" *ngFor="let r of (u.roles || [])">{{ r }}</span>
                <span class="text-muted" *ngIf="!u.roles?.length">No roles</span>
              </td>
              <td>
                <span
                  class="status-pill"
                  [class.status-active]="u.status === 'ACTIVE'"
                  [class.status-locked]="u.status === 'LOCKED'"
                  [class.status-disabled]="u.status === 'DISABLED'"
                >
                  {{ u.status || 'ACTIVE' }}
                </span>
              </td>
              <td class="text-right">
                <div class="action-group" *appHasPermission="['USER_EDIT', 'SETTINGS_EDIT']">
                  <button
                    *ngIf="u.status === 'LOCKED' || u.status === 'DISABLED'"
                    class="btn-sm btn-unlock"
                    (click)="unlockUser(u)"
                  >
                    🔓 Unlock
                  </button>
                  <button class="btn-sm btn-outline" (click)="openEditModal(u)">Edit</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Create / Edit User Modal -->
      <div class="modal-backdrop" *ngIf="showModal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>{{ editingUser ? 'Edit User: ' + editingUser.fullName : 'Create New User' }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>
          <form [formGroup]="userForm" (ngSubmit)="submitUser()" class="modal-body">
            <div class="form-group">
              <label>Full Name *</label>
              <input type="text" formControlName="fullName" />
            </div>

            <div class="form-group" *ngIf="!editingUser">
              <label>Work Email *</label>
              <input type="email" formControlName="email" />
            </div>

            <div class="form-group" *ngIf="!editingUser">
              <label>Temporary Password * (min 6 chars)</label>
              <input type="password" formControlName="password" />
            </div>

            <div class="form-group" *ngIf="editingUser">
              <label>Account Status</label>
              <select formControlName="status">
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            <div class="form-group">
              <label>Assigned Roles</label>
              <div class="role-checkboxes">
                <label class="checkbox-item" *ngFor="let role of roles">
                  <input
                    type="checkbox"
                    [checked]="selectedRoleIds.has(role.id)"
                    (change)="toggleRole(role.id)"
                  />
                  <div>
                    <strong>{{ role.name }}</strong>
                    <small>{{ role.description }}</small>
                  </div>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-outline" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="saving">
                {{ saving ? 'Saving...' : 'Save User' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .page-header h2 { margin: 0; font-size: 1.45rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.875rem; }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      background: #f8fafc;
      padding: 0.85rem 1rem;
      text-align: left;
      font-size: 0.78rem;
      text-transform: uppercase;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.9rem;
      color: #1e293b;
    }
    .font-medium { font-weight: 600; }
    .text-right { text-align: right; }
    .role-badge {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      margin-right: 0.35rem;
    }
    .status-pill {
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-active { background: #dcfce7; color: #166534; }
    .status-locked { background: #fef3c7; color: #92400e; }
    .status-disabled { background: #fee2e2; color: #991b1b; }
    .action-group { display: inline-flex; gap: 0.5rem; }
    .btn-primary {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0.6rem 1.15rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
    .btn-unlock { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 35px rgba(0, 0, 0, 0.2);
    }
    .modal-header {
      padding: 1.15rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input, .form-group select {
      padding: 0.55rem 0.8rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .role-checkboxes {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .checkbox-item {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      cursor: pointer;
    }
    .checkbox-item strong { display: block; font-size: 0.85rem; }
    .checkbox-item small { color: #64748b; font-size: 0.75rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
  `]
})
export class UserManagementComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  users: User[] = [];
  roles: Role[] = [];
  showModal = false;
  saving = false;
  editingUser: User | null = null;
  selectedRoleIds = new Set<number>();

  userForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.email]],
    password: [''],
    status: ['ACTIVE' as 'ACTIVE' | 'LOCKED' | 'DISABLED']
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.settingsService.getUsers().subscribe(res => (this.users = res.content || []));
    this.settingsService.getRoles().subscribe(res => (this.roles = res || []));
  }

  openCreateModal(): void {
    this.editingUser = null;
    this.selectedRoleIds.clear();
    this.userForm.reset({ fullName: '', email: '', password: '', status: 'ACTIVE' });
    this.showModal = true;
  }

  openEditModal(user: User): void {
    this.editingUser = user;
    this.selectedRoleIds.clear();
    const roleNames = new Set(user.roles || []);
    this.roles.forEach(r => {
      if (roleNames.has(r.name)) {
        this.selectedRoleIds.add(r.id);
      }
    });
    this.userForm.patchValue({
      fullName: user.fullName,
      email: user.email,
      password: '',
      status: (user.status as 'ACTIVE' | 'LOCKED' | 'DISABLED') || 'ACTIVE'
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  toggleRole(roleId: number): void {
    if (this.selectedRoleIds.has(roleId)) {
      this.selectedRoleIds.delete(roleId);
    } else {
      this.selectedRoleIds.add(roleId);
    }
  }

  unlockUser(user: User): void {
    const roleIds = this.roles
      .filter(r => (user.roles || []).includes(r.name))
      .map(r => r.id);

    this.settingsService
      .updateUser(user.id, { fullName: user.fullName, status: 'ACTIVE', roleIds })
      .subscribe(() => {
        this.notification.success(`${user.fullName} unlocked and set to ACTIVE`);
        this.loadAll();
      });
  }

  submitUser(): void {
    const val = this.userForm.getRawValue();
    if (!val.fullName.trim()) return;

    this.saving = true;
    const roleIds = Array.from(this.selectedRoleIds);

    if (this.editingUser) {
      this.settingsService
        .updateUser(this.editingUser.id, {
          fullName: val.fullName.trim(),
          status: val.status,
          roleIds
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.showModal = false;
            this.notification.success('User updated successfully');
            this.loadAll();
          },
          error: () => (this.saving = false)
        });
    } else {
      if (!val.email || !val.password || val.password.length < 6) {
        this.saving = false;
        this.notification.error('Email and password (min 6 characters) are required');
        return;
      }
      this.settingsService
        .createUser({
          fullName: val.fullName.trim(),
          email: val.email.trim(),
          password: val.password,
          roleIds
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.showModal = false;
            this.notification.success('User created successfully');
            this.loadAll();
          },
          error: () => (this.saving = false)
        });
    }
  }
}

