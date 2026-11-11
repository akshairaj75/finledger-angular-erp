import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeCount = signal<number>(0);
  public readonly isLoading = computed(() => this.activeCount() > 0);

  start(): void {
    this.activeCount.update(c => c + 1);
  }

  stop(): void {
    this.activeCount.update(c => Math.max(0, c - 1));
  }
}

