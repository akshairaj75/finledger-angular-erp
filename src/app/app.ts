import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { HasPermissionDirective } from './core/directives/has-permission.directive';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { GlobalSearchService, SearchGroup, SearchResultItem } from './core/services/global-search.service';
import { LoadingService } from './core/services/loading.service';
import { LocaleService } from './core/services/locale.service';
import { NotificationService } from './core/services/notification.service';
import { ChangePasswordModalComponent } from './features/auth/change-password/change-password-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterModule,
    HasPermissionDirective,
    ChangePasswordModalComponent,
    TranslatePipe
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public loadingService = inject(LoadingService);
  public notificationService = inject(NotificationService);
  public localeService = inject(LocaleService);
  public globalSearchService = inject(GlobalSearchService);
  private router = inject(Router);

  public showUserMenu = signal(false);
  public showChangePasswordModal = signal(false);
  public showCompanyMenu = signal(false);

  // Global Search State
  public searchQuery = signal('');
  public searchLoading = signal(false);
  public showSearchResults = signal(false);
  public searchGroups = signal<SearchGroup[]>([]);
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  public userInitials = computed(() => {
    const name = this.authService.currentUser()?.fullName || 'U';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  });

  ngOnInit(): void {
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term || term.trim().length < 2) {
            this.searchLoading.set(false);
            this.searchGroups.set([]);
            return [];
          }
          this.searchLoading.set(true);
          return this.globalSearchService.search(term);
        })
      )
      .subscribe({
        next: groups => {
          this.searchGroups.set(groups);
          this.searchLoading.set(false);
        },
        error: () => {
          this.searchLoading.set(false);
          this.searchGroups.set([]);
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.showSearchResults.set(true);
    this.searchSubject.next(query);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchGroups.set([]);
    this.showSearchResults.set(false);
  }

  selectSearchResult(item: SearchResultItem): void {
    this.clearSearch();
    this.router.navigate(item.route);
  }

  closeOverlays(): void {
    this.showUserMenu.set(false);
    this.showCompanyMenu.set(false);
    this.showSearchResults.set(false);
  }

  toggleCompanyMenu(): void {
    this.showCompanyMenu.update(open => !open);
    this.showUserMenu.set(false);
  }

  toggleUserMenu(): void {
    this.showUserMenu.update(open => !open);
    this.showCompanyMenu.set(false);
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
