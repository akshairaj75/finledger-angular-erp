import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CostCenter } from '../../../core/models/cost-center.model';

@Injectable({
  providedIn: 'root'
})
export class CostCenterService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/cost-centers`;

  getCostCenters(activeOnly: boolean = true): Observable<CostCenter[]> {
    return this.http.get<CostCenter[]>(`${this.base}?activeOnly=${activeOnly}`);
  }
}

