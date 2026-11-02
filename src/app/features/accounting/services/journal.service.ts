import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Page } from '../../../core/models/page.model';
import {
  CreateJournalEntryRequest,
  JournalEntry,
  JournalQuery
} from '../../../core/models/journal.model';

@Injectable({
  providedIn: 'root'
})
export class JournalService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/journal-entries`;

  getJournalEntries(query: JournalQuery = {}): Observable<Page<JournalEntry>> {
    let params = new HttpParams();

    if (query.page !== undefined) params = params.set('page', query.page.toString());
    if (query.size !== undefined) params = params.set('size', query.size.toString());
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.status) params = params.set('status', query.status);
    if (query.sourceType) params = params.set('sourceType', query.sourceType);

    return this.http.get<Page<JournalEntry>>(this.base, { params });
  }

  getJournalEntryById(id: number): Observable<JournalEntry> {
    return this.http.get<JournalEntry>(`${this.base}/${id}`);
  }

  createJournalEntry(request: CreateJournalEntryRequest): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(this.base, request);
  }

  postJournalEntry(id: number): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/${id}/post`, {});
  }

  reverseJournalEntry(id: number, reason?: string): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/${id}/reverse`, { reason });
  }
}

