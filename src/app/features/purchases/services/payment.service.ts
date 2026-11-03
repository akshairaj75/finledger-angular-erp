import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models/page.model';
import { Payment, PaymentQuery, PaymentRequest } from '../../../core/models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/payments`;

  getPayments(query?: PaymentQuery): Observable<Page<Payment>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.vendorId !== undefined) params = params.set('vendorId', query.vendorId.toString());
    }
    return this.http.get<Page<Payment>>(this.base, { params });
  }

  getPaymentById(id: number): Observable<Payment> {
    return this.http.get<Payment>(`${this.base}/${id}`);
  }

  createPayment(request: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(this.base, request);
  }

  voidPayment(id: number, reason?: string): Observable<Payment> {
    const params = new HttpParams().set('reason', reason || 'Voided by user');
    return this.http.post<Payment>(`${this.base}/${id}/void`, {}, { params });
  }
}

