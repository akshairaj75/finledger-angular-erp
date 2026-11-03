import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Invoice, InvoiceQuery, InvoiceRequest } from '../../../core/models/invoice.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/invoices`;

  getInvoices(query?: InvoiceQuery): Observable<Page<Invoice>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.from) params = params.set('from', query.from);
      if (query.to) params = params.set('to', query.to);
      if (query.status) params = params.set('status', query.status);
      if (query.docType) params = params.set('docType', query.docType);
      if (query.customerId) params = params.set('customerId', query.customerId.toString());
    }
    return this.http.get<Page<Invoice>>(this.base, { params });
  }

  getInvoiceById(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/${id}`);
  }

  createInvoice(request: InvoiceRequest): Observable<Invoice> {
    return this.http.post<Invoice>(this.base, request);
  }

  sendInvoice(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/send`, {});
  }

  voidInvoice(id: number, reason?: string): Observable<Invoice> {
    const params = new HttpParams().set('reason', reason || 'Voided by user');
    return this.http.post<Invoice>(`${this.base}/${id}/void`, {}, { params });
  }

  getInvoicePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }
}
