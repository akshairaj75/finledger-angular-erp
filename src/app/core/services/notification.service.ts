import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private messagesSignal = signal<ToastMessage[]>([]);
  public messages = this.messagesSignal.asReadonly();
  private counter = 0;

  show(type: 'success' | 'error' | 'warning' | 'info', message: string, durationMs: number = 5000): void {
    const id = ++this.counter;
    const msg: ToastMessage = { id, type, message };
    this.messagesSignal.update(msgs => [...msgs, msg]);

    setTimeout(() => {
      this.remove(id);
    }, durationMs);
  }

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  remove(id: number): void {
    this.messagesSignal.update(msgs => msgs.filter(m => m.id !== id));
  }
}

