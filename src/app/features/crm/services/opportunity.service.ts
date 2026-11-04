import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CrmPipelineStage,
  Opportunity,
  OpportunityBoard,
  OpportunityRequest,
  OpportunityStageRequest
} from '../../../core/models/crm.model';
import { Page } from '../../../core/models/page.model';

@Injectable({
  providedIn: 'root'
})
export class OpportunityService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/opportunities`;
  private stageBase = `${environment.apiBaseUrl}/crm/stages`;

  getOpportunityBoard(): Observable<OpportunityBoard> {
    return this.http.get<OpportunityBoard>(`${this.base}/board`);
  }

  getOpportunities(
    stageId?: number,
    customerId?: number,
    ownerUserId?: number,
    q?: string,
    page: number = 0,
    size: number = 20
  ): Observable<Page<Opportunity>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (stageId !== undefined && stageId !== null) params = params.set('stageId', stageId.toString());
    if (customerId !== undefined && customerId !== null) params = params.set('customerId', customerId.toString());
    if (ownerUserId !== undefined && ownerUserId !== null) params = params.set('ownerUserId', ownerUserId.toString());
    if (q && q.trim()) params = params.set('q', q.trim());

    return this.http.get<Page<Opportunity>>(this.base, { params });
  }

  getOpportunityById(id: number): Observable<Opportunity> {
    return this.http.get<Opportunity>(`${this.base}/${id}`);
  }

  createOpportunity(request: OpportunityRequest): Observable<Opportunity> {
    return this.http.post<Opportunity>(this.base, request);
  }

  updateOpportunity(id: number, request: OpportunityRequest): Observable<Opportunity> {
    return this.http.put<Opportunity>(`${this.base}/${id}`, request);
  }

  updateOpportunityStage(id: number, request: OpportunityStageRequest): Observable<Opportunity> {
    return this.http.patch<Opportunity>(`${this.base}/${id}/stage`, request);
  }

  getStages(): Observable<CrmPipelineStage[]> {
    return this.http.get<CrmPipelineStage[]>(this.stageBase);
  }
}

