import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription, TimeoutError, catchError, interval, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { VmService } from '../../core/vm.service';
import { TaskService } from '../../core/task.service';
import { Timeframe, VmAction, VmDetail, VmHistoryPoint, VncTicket } from '../../core/models';
import {
  ACTION_DONE_LABELS,
  ACTION_PENDING_LABELS,
  formatBytes,
  formatPercent,
  formatUptime,
  statusLabel,
} from '../../core/format';
import { CHART_COLORS, formatDateTimeShort, formatHour } from '../../shared/chart-theme';
import { BarChart } from '../../shared/bar-chart';
import { LineChart } from '../../shared/line-chart';

/** Détail d'une VM : configuration, statut, actions, console et graphiques. */
@Component({
  selector: 'app-vm-detail',
  imports: [RouterLink, LineChart, BarChart],
  templateUrl: './vm-detail.html',
  styleUrl: './vm-detail.scss',
})
export class VmDetailPage implements OnInit, OnDestroy {
  private readonly vmService = inject(VmService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly historyRefresh$ = new Subject<void>();
  private readonly historySubscription: Subscription;
  private historyTimer: Subscription | null = null;

  /** Nœud de la VM. */
  readonly node = signal('');
  /** Identifiant de la VM. */
  readonly vmid = signal(0);
  /** Détail de la VM. */
  readonly vm = signal<VmDetail | null>(null);
  /** Vrai pendant le chargement. */
  readonly loading = signal(true);
  /** Message d'erreur. */
  readonly error = signal<string | null>(null);
  /** Message de retour après une action. */
  readonly notice = signal<string | null>(null);
  /** Action en cours d'exécution (aucune si null). */
  readonly pending = signal<VmAction | null>(null);
  /** Ticket de console noVNC. */
  readonly ticket = signal<VncTicket | null>(null);
  /** Historique RRD de la VM. */
  readonly history = signal<VmHistoryPoint[]>([]);
  /** Vrai pendant le chargement de l'historique. */
  readonly historyLoading = signal(true);
  /** Message d'erreur de l'historique. */
  readonly historyError = signal<string | null>(null);
  /** Fenêtre d'historique sélectionnée. */
  readonly timeframe = signal<Timeframe>('hour');

  /** Sélecteur de période. */
  readonly timeframes: { value: Timeframe; label: string }[] = [
    { value: 'hour', label: '1 h' },
    { value: 'day', label: '24 h' },
    { value: 'week', label: '7 j' },
  ];

  /** Formateurs d'affichage. */
  readonly formatBytes = formatBytes;
  readonly formatPercent = formatPercent;
  readonly formatUptime = formatUptime;
  readonly statusLabel = statusLabel;
  readonly pendingLabels = ACTION_PENDING_LABELS;
  readonly colors = CHART_COLORS;

  constructor() {
    // L'historique est rafraîchi toutes les 60 s.
    this.historySubscription = this.historyRefresh$
      .pipe(
        startWith(undefined),
        switchMap(() => this.loadHistory()),
      )
      .subscribe();
    this.historyTimer = interval(60000).subscribe(() => this.historyRefresh$.next());
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.node.set(params.get('node') ?? '');
      this.vmid.set(Number(params.get('vmid')));
      this.load();
      this.historyRefresh$.next();
    });
  }

  ngOnDestroy(): void {
    this.historySubscription.unsubscribe();
    this.historyTimer?.unsubscribe();
  }

  /** Change la fenêtre d'historique et recharge les courbes. */
  setTimeframe(timeframe: Timeframe): void {
    this.timeframe.set(timeframe);
    this.historyRefresh$.next();
  }

  /** Étiquettes de l'axe des abscisses. */
  readonly historyLabels = () =>
    this.history().map((point) =>
      this.timeframe() === 'hour' ? formatHour(point.time) : formatDateTimeShort(point.time),
    );

  /** Série CPU (%). */
  readonly cpuSeries = () => [
    {
      label: 'CPU',
      data: this.history().map((point) => point.cpu_pct),
      borderColor: CHART_COLORS.accent,
      backgroundColor: 'rgba(76, 141, 255, 0.15)',
    },
  ];

  /** Série RAM utilisée (Go). */
  readonly memorySeries = () => [
    {
      label: 'RAM',
      data: this.history().map((point) => point.mem_used / 1024 ** 3),
      borderColor: CHART_COLORS.info,
      backgroundColor: 'rgba(57, 197, 207, 0.15)',
    },
  ];

  /** Séries réseau (Ko/s). */
  readonly networkSeries = () => [
    {
      label: 'Entrant',
      data: this.history().map((point) => point.netin / 1024),
      borderColor: CHART_COLORS.success,
      backgroundColor: 'rgba(63, 185, 80, 0.15)',
    },
    {
      label: 'Sortant',
      data: this.history().map((point) => point.netout / 1024),
      borderColor: CHART_COLORS.warning,
      backgroundColor: 'rgba(210, 153, 34, 0.15)',
    },
  ];

  /** Séries E/S disque (Ko/s). */
  readonly diskSeries = () => [
    {
      label: 'Lecture',
      data: this.history().map((point) => point.disk_read / 1024),
      backgroundColor: CHART_COLORS.accent,
    },
    {
      label: 'Écriture',
      data: this.history().map((point) => point.disk_write / 1024),
      backgroundColor: CHART_COLORS.palette[5],
    },
  ];

  /** Recharge le détail de la VM. */
  load(): void {
    this.loading.set(true);

    this.vmService.detail(this.node(), this.vmid()).subscribe({
      next: (vm) => {
        this.vm.set(vm);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(readError(error));
      },
    });
  }

  /** Exécute une action sur la VM puis suit la tâche jusqu'à sa fin. */
  runAction(action: VmAction): void {
    const vm = this.vm();
    if (!vm) {
      return;
    }
    this.pending.set(action);
    this.error.set(null);
    this.notice.set(null);

    this.vmService.action(this.node(), this.vmid(), action).subscribe({
      next: (result) => {
        this.taskService
          .watch(this.node(), result.task_id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (status) => {
              if (status.finished) {
                this.completeAction(action, status.ok, status.message);
              }
            },
            error: (error: unknown) => {
              this.pending.set(null);
              this.error.set(
                error instanceof TimeoutError
                  ? `L'action n'a pas abouti dans le délai imparti.`
                  : readError(error),
              );
              this.load();
            },
          });
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(null);
        this.error.set(readError(error));
        this.load();
      },
    });
  }

  /** Tâche terminée : succès ou échec. */
  private completeAction(action: VmAction, ok: boolean, message: string): void {
    this.pending.set(null);
    if (ok) {
      this.load();
      const name = this.vm()?.name ?? `VM ${this.vmid()}`;
      this.notice.set(`${name} ${ACTION_DONE_LABELS[action] ?? action}`.trim());
    } else {
      this.error.set(
        message && message !== 'Tâche terminée.'
          ? `Échec de l'action : ${message}`
          : "L'action a échoué.",
      );
      this.load();
    }
  }

  /** Demande un ticket de console noVNC. */
  openConsole(): void {
    this.error.set(null);
    this.vmService.vnc(this.node(), this.vmid()).subscribe({
      next: (ticket) => this.ticket.set(ticket),
      error: (error: HttpErrorResponse) => this.error.set(readError(error)),
    });
  }

  /** Charge l'historique RRD de la VM. */
  private loadHistory() {
    this.historyLoading.set(true);
    return this.vmService.history(this.node(), this.vmid(), this.timeframe()).pipe(
      tap((points) => {
        this.history.set(points);
        this.historyLoading.set(false);
        this.historyError.set(null);
      }),
      catchError((error: unknown) => {
        this.historyLoading.set(false);
        this.historyError.set(readError(error));
        return of(null);
      }),
    );
  }
}

/** Extrait un message lisible d'une erreur HTTP. */
function readError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { detail?: string } | null;
    if (body?.detail) {
      return body.detail;
    }
    if (error.status === 404) {
      return 'VM introuvable sur ce nœud.';
    }
    if (error.status === 0) {
      return "L'API est injoignable.";
    }
    return `Erreur ${error.status}.`;
  }
  return "Une erreur est survenue lors du chargement de l'historique.";
}
