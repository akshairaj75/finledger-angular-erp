import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private requiredSignal = signal<string[]>([]);
  private hasView = false;

  @Input() set appHasPermission(value: string | string[]) {
    if (Array.isArray(value)) {
      this.requiredSignal.set(value);
    } else if (value) {
      this.requiredSignal.set([value]);
    } else {
      this.requiredSignal.set([]);
    }
  }

  constructor() {
    effect(() => {
      // Subscribe reactively to permissions signal and required permission input
      const perms = this.authService.permissions();
      const required = this.requiredSignal();
      const allowed = required.length === 0 || required.some(p => perms.has(p));

      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}

