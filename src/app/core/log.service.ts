import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { ActionLog, LogStat, Paged } from './models';

/** Filtres du journal d'audit. */
export interface LogFilters {
  user?: string;
  action?: string;
  vmid?: number | string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

/** Service de consultation du journal d'audit. */
@Injectable({ providedIn: 'root' })
export class LogService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Journal paginé, du plus récent au plus ancien. */
  list(filters: LogFilters = {}): Observable<Paged<ActionLog>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      params = params.set(key, String(value));
    }
    return this.http.get<Paged<ActionLog>>(`${this.apiBase}/logs/actions/`, { params });
  }

  /** Statistiques journalières des actions (succès / échecs). */
  stats(days = 7): Observable<LogStat[]> {
    return this.http.get<LogStat[]>(`${this.apiBase}/logs/stats/`, {
      params: new HttpParams().set('days', days),
    });
  }
}
