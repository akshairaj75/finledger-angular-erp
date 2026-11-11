import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    service = new LoadingService();
  });

  it('should defer start and stop updates to microtasks to avoid NG0100 during ngOnInit', async () => {
    expect(service.isLoading()).toBe(false);

    service.start();
    // Synchronous value stays unchanged during the active change-detection pass
    expect(service.isLoading()).toBe(false);

    await Promise.resolve();
    expect(service.isLoading()).toBe(true);

    service.stop();
    await Promise.resolve();
    expect(service.isLoading()).toBe(false);
  });

  it('should track overlapping requests accurately without dropping below zero', async () => {
    service.start();
    service.start();
    await Promise.resolve();
    expect(service.isLoading()).toBe(true);

    service.stop();
    await Promise.resolve();
    expect(service.isLoading()).toBe(true);

    service.stop();
    service.stop();
    await Promise.resolve();
    expect(service.isLoading()).toBe(false);
  });
});

