import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TaxRate } from '../../../core/models/tax-rate.model';

@Injectable({
  providedIn: 'root'
})
export class TaxRateService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/tax-rates`;

  getTaxRates(): Observable<TaxRate[]> {
    return this.http.get<TaxRate[]>(this.base);
  }
}

