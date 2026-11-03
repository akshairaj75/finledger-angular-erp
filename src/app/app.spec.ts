import { describe, expect, it } from 'vitest';
import { NotificationService } from './core/services/notification.service';

describe('FinLedger App Core', () => {
  it('should initialize NotificationService with empty notifications', () => {
    const notificationService = new NotificationService();
    expect(notificationService.messages()).toEqual([]);
  });

  it('should add success and error notifications and allow dismiss', () => {
    const notificationService = new NotificationService();
    notificationService.success('Customer created');
    notificationService.error('Failed to post');

    expect(notificationService.messages().length).toBe(2);
    expect(notificationService.messages()[0].message).toBe('Customer created');
    expect(notificationService.messages()[1].message).toBe('Failed to post');

    const firstId = notificationService.messages()[0].id;
    notificationService.remove(firstId);
    expect(notificationService.messages().length).toBe(1);
    expect(notificationService.messages()[0].message).toBe('Failed to post');
  });
});
