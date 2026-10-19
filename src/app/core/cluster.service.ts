import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { ClusterNode, ClusterSummary, HistoryPoint, Timeframe } from './models';

/** Service d'accès aux données du cluster. */
@Injectable({ providedIn: 'root' })
export class ClusterService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Synthèse globale du cluster (santé, quorum, agrégats). */
  summary(): Observable<ClusterSummary> {
    return this.http.get<ClusterSummary>(`${this.apiBase}/cluster/summary/`);
  }

  /** Liste des nœuds (hors ligne compris). */
  nodes(): Observable<ClusterNode[]> {
    return this.http.get<ClusterNode[]>(`${this.apiBase}/cluster/nodes/`);
  }

  /** Historique RRD agrégé des nœuds en ligne. */
  history(timeframe: Timeframe = 'hour'): Observable<HistoryPoint[]> {
    return this.http.get<HistoryPoint[]>(`${this.apiBase}/cluster/history/`, {
      params: new HttpParams().set('timeframe', timeframe),
    });
  }
}
