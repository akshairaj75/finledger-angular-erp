import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  public notificationService = inject(NotificationService);
}
