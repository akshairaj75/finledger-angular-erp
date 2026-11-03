import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models/page.model';
import { Receipt, ReceiptQuery, ReceiptRequest } from '../../../core/models/receipt.model';

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/receipts`;

  getReceipts(query?: ReceiptQuery): Observable<Page<Receipt>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.from) params = params.set('from', query.from);
      if (query.to) params = params.set('to', query.to);
      if (query.status) params = params.set('status', query.status);
      if (query.customerId) params = params.set('customerId', query.customerId.toString());
    }
    return this.http.get<Page<Receipt>>(this.base, { params });
  }

  getReceiptById(id: number): Observable<Receipt> {
    return this.http.get<Receipt>(`${this.base}/${id}`);
  }

  createReceipt(request: ReceiptRequest): Observable<Receipt> {
    return this.http.post<Receipt>(this.base, request);
  }

  voidReceipt(id: number, reason?: string): Observable<Receipt> {
    return this.http.post<Receipt>(`${this.base}/${id}/void`, { reason: reason || 'Voided by user' });
  }
}

