import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface SearchResultItem {
  id: number;
  title: string;
  subtitle: string;
  badge?: string;
  badgeClass?: string;
  route: (string | number)[];
}

export interface SearchGroup {
  category: string;
  icon: string;
  items: SearchResultItem[];
}

@Injectable({
  providedIn: 'root'
})
export class GlobalSearchService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private api = environment.apiBaseUrl;

  search(term: string): Observable<SearchGroup[]> {
    const q = term.trim();
    if (!q || q.length < 2) {
      return of([]);
    }

    const requests: Record<string, Observable<SearchResultItem[]>> = {};

    // 1. Invoices Search
    if (this.authService.hasPermission('INVOICE_VIEW')) {
      const params = new HttpParams().set('q', q).set('size', '4');
      requests['invoices'] = this.http.get<any>(`${this.api}/invoices`, { params }).pipe(
        map(res => {
          const list = res.content || [];
          const baseCurrency = this.authService.currentCompany()?.baseCurrency || 'AED';
          return list.map((inv: any) => ({
            id: inv.id,
            title: inv.invoiceNo,
            subtitle: inv.customerName || 'Customer Invoice',
            badge: `${inv.total ?? 0} ${inv.currencyCode || baseCurrency}`,
            badgeClass: 'badge-blue',
            route: ['/sales/invoices']
          }));
        }),
        catchError(() => of([]))
      );
    }

    // 2. Customers Search
    if (this.authService.hasPermission('CUSTOMER_VIEW')) {
      const params = new HttpParams().set('search', q).set('size', '4');
      requests['customers'] = this.http.get<any>(`${this.api}/customers`, { params }).pipe(
        map(res => {
          const list = res.content || [];
          return list.map((c: any) => ({
            id: c.id,
            title: c.name,
            subtitle: `${c.code}${c.phone ? ' • ' + c.phone : ''}`,
            badge: c.currencyCode || 'Customer',
            badgeClass: 'badge-green',
            route: ['/sales/customers']
          }));
        }),
        catchError(() => of([]))
      );
    }

    // 3. Inventory Items Search
    if (this.authService.hasPermission('ITEM_VIEW')) {
      const params = new HttpParams().set('search', q).set('size', '4');
      requests['items'] = this.http.get<any>(`${this.api}/items`, { params }).pipe(
        map(res => {
          const list = res.content || [];
          const baseCurrency = this.authService.currentCompany()?.baseCurrency || 'AED';
          return list.map((item: any) => ({
            id: item.id,
            title: item.name,
            subtitle: `SKU: ${item.sku} • On Hand: ${item.totalOnHand ?? 0} ${item.unit || 'PCS'}`,
            badge: `${item.salesPrice || 0} ${baseCurrency}`,
            badgeClass: 'badge-purple',
            route: ['/inventory/items', item.id]
          }));
        }),
        catchError(() => of([]))
      );
    }

    // 4. CRM Leads Search
    if (this.authService.hasPermission('LEAD_VIEW') || this.authService.hasPermission('CRM_VIEW_ALL')) {
      const params = new HttpParams().set('q', q).set('size', '4');
      requests['leads'] = this.http.get<any>(`${this.api}/leads`, { params }).pipe(
        map(res => {
          const list = res.content || [];
          return list.map((lead: any) => ({
            id: lead.id,
            title: lead.contactName,
            subtitle: lead.companyName || lead.email || 'Lead',
            badge: lead.status || 'NEW',
            badgeClass: 'badge-orange',
            route: ['/crm/leads']
          }));
        }),
        catchError(() => of([]))
      );
    }

    if (Object.keys(requests).length === 0) {
      return of([]);
    }

    return forkJoin(requests).pipe(
      map(results => {
        const groups: SearchGroup[] = [];

        if (results['invoices'] && results['invoices'].length > 0) {
          groups.push({ category: 'Tax Invoices', icon: '🧾', items: results['invoices'] });
        }
        if (results['customers'] && results['customers'].length > 0) {
          groups.push({ category: 'Customers', icon: '👥', items: results['customers'] });
        }
        if (results['items'] && results['items'].length > 0) {
          groups.push({ category: 'Inventory Items', icon: '📦', items: results['items'] });
        }
        if (results['leads'] && results['leads'].length > 0) {
          groups.push({ category: 'CRM Leads', icon: '🎯', items: results['leads'] });
        }

        return groups;
      })
    );
  }
}
