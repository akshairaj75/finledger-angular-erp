import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BankAccount } from '../../../core/models/bank-account.model';

@Injectable({
  providedIn: 'root'
})
export class BankAccountService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/bank-accounts`;

  getBankAccounts(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(this.base);
  }
}

