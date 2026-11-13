import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Bill, BillQuery, BillRequest } from '../../../core/models/bill.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class BillService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/bills`;

  getBills(query?: BillQuery): Observable<Page<Bill>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.vendorId !== undefined) params = params.set('vendorId', query.vendorId.toString());
      if (query.status) params = params.set('status', query.status);
      if (query.from) params = params.set('from', query.from);
      if (query.to) params = params.set('to', query.to);
      if (query.q && query.q.trim()) params = params.set('q', query.q.trim());
    }
    return this.http.get<Page<Bill>>(this.base, { params });
  }

  getBillById(id: number): Observable<Bill> {
    return this.http.get<Bill>(`${this.base}/${id}`);
  }

  createBill(request: BillRequest): Observable<Bill> {
    return this.http.post<Bill>(this.base, request);
  }

  updateBill(id: number, request: BillRequest): Observable<Bill> {
    return this.http.put<Bill>(`${this.base}/${id}`, request);
  }

  approveBill(id: number): Observable<Bill> {
    return this.http.post<Bill>(`${this.base}/${id}/approve`, {});
  }

  voidBill(id: number, reason?: string): Observable<Bill> {
    const params = new HttpParams().set('reason', reason || 'Voided by user');
    return this.http.post<Bill>(`${this.base}/${id}/void`, {}, { params });
  }
}

