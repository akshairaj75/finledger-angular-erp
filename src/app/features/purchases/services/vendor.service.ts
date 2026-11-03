import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OpenBill } from '../../../core/models/bill.model';
import { Page } from '../../../core/models/page.model';
import { Vendor, VendorQuery, VendorRequest } from '../../../core/models/vendor.model';

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/vendors`;

  getVendors(query?: VendorQuery): Observable<Page<Vendor>> {
    let params = new HttpParams();
    if (query) {
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.size !== undefined) params = params.set('size', query.size.toString());
      if (query.search) params = params.set('search', query.search);
      if (query.isActive !== undefined) params = params.set('isActive', query.isActive.toString());
    }
    return this.http.get<Page<Vendor>>(this.base, { params });
  }

  getVendorById(id: number): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.base}/${id}`);
  }

  createVendor(request: VendorRequest): Observable<Vendor> {
    return this.http.post<Vendor>(this.base, request);
  }

  updateVendor(id: number, request: VendorRequest): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.base}/${id}`, request);
  }

  getOpenBills(vendorId: number): Observable<OpenBill[]> {
    return this.http.get<OpenBill[]>(`${this.base}/${vendorId}/open-bills`);
  }
}

