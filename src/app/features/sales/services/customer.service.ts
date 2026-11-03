import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Customer, CustomerQuery, CustomerRequest } from '../../../core/models/customer.model';
import { OpenInvoice } from '../../../core/models/invoice.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/customers`;

  getCustomers(query?: CustomerQuery): Observable<Page<Customer>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.search) params = params.set('search', query.search);
      if (query.customerType) params = params.set('customerType', query.customerType);
      if (query.isActive !== undefined) params = params.set('isActive', query.isActive.toString());
    }
    return this.http.get<Page<Customer>>(this.base, { params });
  }

  getCustomerById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.base}/${id}`);
  }

  createCustomer(request: CustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.base, request);
  }

  updateCustomer(id: number, request: CustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(`${this.base}/${id}`, request);
  }

  getOpenInvoices(customerId: number): Observable<OpenInvoice[]> {
    return this.http.get<OpenInvoice[]>(`${this.base}/${customerId}/open-invoices`);
  }
}

