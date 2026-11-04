import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Lead,
  LeadConvertRequest,
  LeadConvertResponse,
  LeadImportResult,
  LeadRequest,
  LeadSource,
  LeadStatus,
  Opportunity
} from '../../../core/models/crm.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/leads`;

  getLeads(
    status?: LeadStatus,
    source?: LeadSource,
    ownerUserId?: number,
    q?: string,
    page: number = 0,
    size: number = 20
  ): Observable<Page<Lead>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) params = params.set('status', status);
    if (source) params = params.set('source', source);
    if (ownerUserId !== undefined && ownerUserId !== null) params = params.set('ownerUserId', ownerUserId.toString());
    if (q && q.trim()) params = params.set('q', q.trim());

    return this.http.get<Page<Lead>>(this.base, { params });
  }

  getLeadById(id: number): Observable<Lead> {
    return this.http.get<Lead>(`${this.base}/${id}`);
  }

  createLead(request: LeadRequest): Observable<Lead> {
    return this.http.post<Lead>(this.base, request);
  }

  updateLead(id: number, request: LeadRequest): Observable<Lead> {
    return this.http.put<Lead>(`${this.base}/${id}`, request);
  }

  importLeadsFromCsv(file: File): Observable<LeadImportResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<LeadImportResult>(`${this.base}/import`, formData);
  }

  qualifyLead(id: number): Observable<Opportunity> {
    return this.http.post<Opportunity>(`${this.base}/${id}/qualify`, {});
  }

  convertLead(id: number, request?: LeadConvertRequest): Observable<LeadConvertResponse> {
    return this.http.post<LeadConvertResponse>(`${this.base}/${id}/convert`, request || {});
  }
}

