import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../models/page.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/users`;

  getUsers(): Observable<User[]> {
    return this.http.get<Page<User>>(this.base).pipe(
      map(res => res.content || []),
      catchError(() => {
        // Fallback default mock users if users endpoint is empty or offline
        return of([
          { id: 1, email: 'admin@finledger.com', fullName: 'System Administrator' },
          { id: 2, email: 'sara.m@finledger.com', fullName: 'Sara Mathew' },
          { id: 3, email: 'raj.k@finledger.com', fullName: 'Raj Kumar' },
          { id: 4, email: 'tariq.a@finledger.com', fullName: 'Tariq Al-Mansoor' }
        ]);
      })
    );
  }
}
