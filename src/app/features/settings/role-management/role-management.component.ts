import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionItem, Role } from '../models/settings.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HasPermissionDirective],
  template: `
    <div class="roles-page">
      <div class="page-header">
        <div>
          <h2>Roles & Permission Matrix</h2>
          <p class="subtitle">Define granular module authorities and enforce least-privilege access</p>
        </div>
        <button
          *appHasPermission="['ROLE_EDIT', 'SETTINGS_EDIT']"
          class="btn-primary"
          (click)="openNewRole()"
        >
          + New Role
        </button>
      </div>

      <div class="roles-grid">
        <div class="role-card" *ngFor="let role of roles">
          <div class="role-card-header">
            <div>
              <h3>{{ role.name }}</h3>
              <p>{{ role.description || 'Custom RBAC role' }}</p>
            </div>
            <button
              *appHasPermission="['ROLE_EDIT', 'SETTINGS_EDIT']"
              class="btn-outline"
              (click)="openEditRole(role)"
            >
              Configure
            </button>
          </div>
          <div class="perm-count">
            {{ role.permissions.length || 0 }} granted permissions
          </div>
          <div class="perm-tags">
            <span class="perm-tag" *ngFor="let p of role.permissions.slice(0, 8)">{{ p }}</span>
            <span class="perm-more" *ngIf="role.permissions.length > 8">
              +{{ role.permissions.length - 8 }} more
            </span>
          </div>
        </div>
      </div>

      <!-- Role Matrix Modal -->
      <div class="modal-backdrop" *ngIf="showModal">
        <div class="modal-card modal-lg">
          <div class="modal-header">
            <h3>{{ editingRole ? 'Edit Role: ' + editingRole.name : 'Create RBAC Role' }}</h3>
            <button class="close-btn" (click)="showModal = false">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="saveRole()" class="modal-body">
            <div class="row-2">
              <div class="form-group">
                <label>Role Code / Name *</label>
                <input type="text" formControlName="name" placeholder="e.g., FINANCE_ANALYST" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <input type="text" formControlName="description" placeholder="Role responsibilities" />
              </div>
            </div>

            <div class="matrix-section">
              <h4>Permissions by Module ({{ selectedPermissions.size }} selected)</h4>
              <div class="modules-grid">
                <div class="module-box" *ngFor="let mod of moduleGroups">
                  <div class="module-title">{{ mod.module }}</div>
                  <label class="perm-check" *ngFor="let p of mod.items">
                    <input
                      type="checkbox"
                      [checked]="selectedPermissions.has(p.code)"
                      (change)="togglePerm(p.code)"
                    />
                    <div>
                      <span class="perm-code">{{ p.code }}</span>
                      <small>{{ p.description }}</small>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-outline" (click)="showModal = false">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="saving || form.invalid">
                {{ saving ? 'Saving...' : 'Save Role & Permissions' }}
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
    .roles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .role-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .role-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
    .role-card-header h3 { margin: 0; font-size: 1.05rem; color: #0f172a; }
    .role-card-header p { margin: 0.2rem 0 0; font-size: 0.8rem; color: #64748b; }
    .perm-count { font-size: 0.8rem; font-weight: 600; color: #2563eb; }
    .perm-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .perm-tag {
      background: #f1f5f9;
      color: #334155;
      font-size: 0.7rem;
      font-family: monospace;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }
    .perm-more { font-size: 0.72rem; color: #64748b; align-self: center; }
    .btn-primary {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0.6rem 1.15rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-outline {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #334155;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
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
      width: 95%;
      max-width: 900px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      padding: 1.15rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 { margin: 0; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .form-group input { padding: 0.55rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; }
    .matrix-section h4 { margin: 0 0 0.75rem; font-size: 0.92rem; color: #1e293b; }
    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 0.85rem;
    }
    .module-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem;
      background: #f8fafc;
    }
    .module-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #1d4ed8;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
    }
    .perm-check {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.45rem;
      cursor: pointer;
    }
    .perm-code { display: block; font-size: 0.75rem; font-weight: 600; color: #0f172a; }
    .perm-check small { display: block; font-size: 0.7rem; color: #64748b; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
  `]
})
export class RoleManagementComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  roles: Role[] = [];
  allPermissions: PermissionItem[] = [];
  moduleGroups: { module: string; items: PermissionItem[] }[] = [];
  selectedPermissions = new Set<string>();
  showModal = false;
  saving = false;
  editingRole: Role | null = null;

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['']
  });

  ngOnInit(): void {
    this.loadRoles();
    this.settingsService.getAllPermissions().subscribe(perms => {
      this.allPermissions = perms;
      const byMod = new Map<string, PermissionItem[]>();
      perms.forEach(p => {
        const list = byMod.get(p.module) || [];
        list.push(p);
        byMod.set(p.module, list);
      });
      this.moduleGroups = Array.from(byMod.entries()).map(([module, items]) => ({ module, items }));
    });
  }

  loadRoles(): void {
    this.settingsService.getRoles().subscribe(res => (this.roles = res || []));
  }

  openNewRole(): void {
    this.editingRole = null;
    this.selectedPermissions.clear();
    this.form.reset({ name: '', description: '' });
    this.showModal = true;
  }

  openEditRole(role: Role): void {
    this.editingRole = role;
    this.selectedPermissions = new Set(role.permissions || []);
    this.form.patchValue({ name: role.name, description: role.description || '' });
    this.showModal = true;
  }

  togglePerm(code: string): void {
    if (this.selectedPermissions.has(code)) {
      this.selectedPermissions.delete(code);
    } else {
      this.selectedPermissions.add(code);
    }
  }

  saveRole(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const val = this.form.getRawValue();
    const req = {
      name: val.name.trim(),
      description: val.description,
      permissionCodes: Array.from(this.selectedPermissions)
    };

    const obs = this.editingRole
      ? this.settingsService.updateRole(this.editingRole.id, req)
      : this.settingsService.createRole(req);

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.showModal = false;
        this.notification.success('Role updated successfully');
        this.loadRoles();
      },
      error: () => (this.saving = false)
    });
  }
}

