import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';
import {
  Paged,
  TaskStatus,
  Timeframe,
  Vm,
  VmAction,
  VmActionResult,
  VmDetail,
  VmHistoryPoint,
  VncTicket,
} from './models';

/** Filtres acceptés par la liste des VMs. */
export interface VmFilters {
  search?: string;
  status?: string;
  node?: string;
  type?: string;
  pool?: string;
  include_templates?: boolean;
  page?: number;
  page_size?: number;
}

/** Service d'accès aux VMs et conteneurs LXC. */
@Injectable({ providedIn: 'root' })
export class VmService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  /** Liste paginée et filtrée des VMs / conteneurs. */
  list(filters: VmFilters = {}): Observable<Paged<Vm>> {
    return this.http.get<Paged<Vm>>(`${this.apiBase}/vms/`, {
      params: toParams(filters),
    });
  }

  /** Détail d'une VM (configuration, statut, IP). */
  detail(node: string, vmid: number): Observable<VmDetail> {
    return this.http.get<VmDetail>(`${this.apiBase}/vms/${node}/${vmid}/`);
  }

  /** Exécute une action (start, stop, shutdown, reboot) sur une VM. */
  action(node: string, vmid: number, action: VmAction): Observable<VmActionResult> {
    return this.http.post<VmActionResult>(`${this.apiBase}/vms/${node}/${vmid}/action/`, {
      action,
    });
  }

  /** Demande un ticket de console noVNC. */
  vnc(node: string, vmid: number): Observable<VncTicket> {
    return this.http.post<VncTicket>(`${this.apiBase}/vms/${node}/${vmid}/vnc/`, {});
  }

  /** Historique RRD d'une VM (CPU, RAM, réseau, E/S disque). */
  history(node: string, vmid: number, timeframe: Timeframe = 'hour'): Observable<VmHistoryPoint[]> {
    return this.http.get<VmHistoryPoint[]>(`${this.apiBase}/vms/${node}/${vmid}/history/`, {
      params: new HttpParams().set('timeframe', timeframe),
    });
  }

  /** État d'une tâche Proxmox (à partir de son UPID). */
  taskStatus(node: string, upid: string): Observable<TaskStatus> {
    return this.http.get<TaskStatus>(
      `${this.apiBase}/tasks/${encodeURIComponent(node)}/${encodeURIComponent(upid)}/`,
    );
  }
}

/** Transforme un objet de filtres en HttpParams (les valeurs vides sont ignorées). */
function toParams(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '' || value === false) {
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
