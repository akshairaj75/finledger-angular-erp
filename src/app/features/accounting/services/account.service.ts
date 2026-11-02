import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Account, AccountNode } from '../../../core/models/account.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/accounts`;

  getAccounts(page: number = 0, size: number = 100): Observable<Page<Account>> {
    return this.http.get<Page<Account>>(`${this.base}?page=${page}&size=${size}`);
  }

  getAccountsTree(): Observable<AccountNode[]> {
    return this.http.get<AccountNode[]>(`${this.base}/tree`);
  }

  getAccountById(id: number): Observable<Account> {
    return this.http.get<Account>(`${this.base}/${id}`);
  }
}

