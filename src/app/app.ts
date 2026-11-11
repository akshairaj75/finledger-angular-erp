import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { HasPermissionDirective } from './core/directives/has-permission.directive';
import { LoadingService } from './core/services/loading.service';
import { NotificationService } from './core/services/notification.service';
import { ChangePasswordModalComponent } from './features/auth/change-password/change-password-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, HasPermissionDirective, ChangePasswordModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  public authService = inject(AuthService);
  public loadingService = inject(LoadingService);
  public notificationService = inject(NotificationService);

  public showUserMenu = signal(false);
  public showChangePasswordModal = signal(false);

  public userInitials = computed(() => {
    const name = this.authService.currentUser()?.fullName || 'U';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  });

  toggleUserMenu(): void {
    this.showUserMenu.update(open => !open);
  }

  openChangePassword(): void {
    this.showUserMenu.set(false);
    this.showChangePasswordModal.set(true);
  }

  logout(): void {
    this.showUserMenu.set(false);
    this.authService.logout(true);
  }
}
