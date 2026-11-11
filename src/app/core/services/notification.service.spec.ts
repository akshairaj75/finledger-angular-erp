import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    vi.useFakeTimers();
  });

  it('should push success notifications to signal', () => {
    service.success('Invoice created successfully');
    const msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].type).toBe('success');
    expect(msgs[0].message).toBe('Invoice created successfully');
  });

  it('should push error notifications to signal', () => {
    service.error('Failed to post journal');
    const msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].type).toBe('error');
    expect(msgs[0].message).toBe('Failed to post journal');
  });

  it('should manually remove notification by id', () => {
    service.info('Notification 1');
    service.warning('Notification 2');
    let msgs = service.messages();
    expect(msgs.length).toBe(2);

    const firstId = msgs[0].id;
    service.remove(firstId);

    msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].message).toBe('Notification 2');
  });

  it('should automatically dismiss notification after durationMs', () => {
    service.show('info', 'Temporary message', 3000);
    expect(service.messages().length).toBe(1);

    vi.advanceTimersByTime(3001);
    expect(service.messages().length).toBe(0);
  });
});

