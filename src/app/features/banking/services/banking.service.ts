import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BankAccount } from '../../../core/models/bank-account.model';
import {
  BankReconciliation,
  StartReconciliationRequest,
  ReconciliationMatchRequest,
  BankChargeRequest,
  AutoMatchResult
} from '../../../core/models/banking.model';

@Injectable({
  providedIn: 'root'
})
export class BankingService {
  private http = inject(HttpClient);
  private baseAccounts = `${environment.apiBaseUrl}/bank-accounts`;
  private baseStatements = `${environment.apiBaseUrl}/bank-statements`;
  private baseRecon = `${environment.apiBaseUrl}/bank-reconciliations`;

  getBankAccounts(activeOnly: boolean = true): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(this.baseAccounts, {
      params: new HttpParams().set('activeOnly', activeOnly.toString())
    });
  }

  createBankAccount(req: Partial<BankAccount>): Observable<BankAccount> {
    return this.http.post<BankAccount>(this.baseAccounts, req);
  }

  importStatement(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.baseStatements}/import`, formData);
  }

  startReconciliation(request: StartReconciliationRequest): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(this.baseRecon, request);
  }

  getReconciliation(id: number): Observable<BankReconciliation> {
    return this.http.get<BankReconciliation>(`${this.baseRecon}/${id}`);
  }

  getReconciliationsByAccount(bankAccountId: number): Observable<BankReconciliation[]> {
    return this.http.get<BankReconciliation[]>(this.baseRecon, {
      params: new HttpParams().set('bankAccountId', bankAccountId.toString())
    });
  }

  match(reconciliationId: number, req: ReconciliationMatchRequest): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.baseRecon}/${reconciliationId}/match`, req);
  }

  unmatch(reconciliationId: number, statementLineId: number): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.baseRecon}/${reconciliationId}/unmatch/${statementLineId}`, {});
  }

  autoMatch(reconciliationId: number): Observable<AutoMatchResult> {
    return this.http.post<AutoMatchResult>(`${this.baseRecon}/${reconciliationId}/auto-match`, {});
  }

  createBankCharge(reconciliationId: number, req: BankChargeRequest): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.baseRecon}/${reconciliationId}/bank-charge`, req);
  }

  completeReconciliation(reconciliationId: number): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.baseRecon}/${reconciliationId}/complete`, {});
  }
}

