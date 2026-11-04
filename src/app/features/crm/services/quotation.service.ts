import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ConvertToInvoiceResponse,
  Quotation,
  QuotationRequest,
  QuotationStatus
} from '../../../core/models/crm.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class QuotationService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/quotations`;

  getQuotations(
    customerId?: number,
    opportunityId?: number,
    status?: QuotationStatus,
    fromDate?: string,
    toDate?: string,
    search?: string,
    page: number = 0,
    size: number = 20
  ): Observable<Page<Quotation>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (customerId !== undefined && customerId !== null) params = params.set('customerId', customerId.toString());
    if (opportunityId !== undefined && opportunityId !== null) params = params.set('opportunityId', opportunityId.toString());
    if (status) params = params.set('status', status);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (search && search.trim()) params = params.set('search', search.trim());

    return this.http.get<Page<Quotation>>(this.base, { params });
  }

  getQuotationById(id: number): Observable<Quotation> {
    return this.http.get<Quotation>(`${this.base}/${id}`);
  }

  createQuotation(request: QuotationRequest): Observable<Quotation> {
    return this.http.post<Quotation>(this.base, request);
  }

  updateQuotation(id: number, request: QuotationRequest): Observable<Quotation> {
    return this.http.put<Quotation>(`${this.base}/${id}`, request);
  }

  sendQuotation(id: number): Observable<Quotation> {
    return this.http.post<Quotation>(`${this.base}/${id}/send`, {});
  }

  acceptQuotation(id: number): Observable<Quotation> {
    return this.http.post<Quotation>(`${this.base}/${id}/accept`, {});
  }

  convertToInvoice(id: number): Observable<ConvertToInvoiceResponse> {
    return this.http.post<ConvertToInvoiceResponse>(`${this.base}/${id}/convert-to-invoice`, {});
  }

  getQuotationPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }
}

