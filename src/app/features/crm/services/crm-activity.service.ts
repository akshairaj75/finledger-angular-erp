import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActivityRelatedType, CrmActivity, CrmActivityRequest } from '../../../core/models/crm.model';

@Injectable({
  providedIn: 'root'
})
export class CrmActivityService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/activities`;

  getActivities(
    relatedType?: ActivityRelatedType,
    relatedId?: number,
    assignedUserId?: number,
    openOnly?: boolean
  ): Observable<CrmActivity[]> {
    let params = new HttpParams();
    if (relatedType) params = params.set('relatedType', relatedType);
    if (relatedId !== undefined && relatedId !== null) params = params.set('relatedId', relatedId.toString());
    if (assignedUserId !== undefined && assignedUserId !== null) params = params.set('assignedUserId', assignedUserId.toString());
    if (openOnly !== undefined && openOnly !== null) params = params.set('openOnly', openOnly.toString());

    return this.http.get<CrmActivity[]>(this.base, { params });
  }

  getActivityById(id: number): Observable<CrmActivity> {
    return this.http.get<CrmActivity>(`${this.base}/${id}`);
  }

  createActivity(request: CrmActivityRequest): Observable<CrmActivity> {
    return this.http.post<CrmActivity>(this.base, request);
  }

  completeActivity(id: number): Observable<CrmActivity> {
    return this.http.patch<CrmActivity>(`${this.base}/${id}/complete`, {});
  }

  deleteActivity(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

