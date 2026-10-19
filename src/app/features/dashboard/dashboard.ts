import { Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, interval, of, startWith, switchMap, tap } from 'rxjs';

import { ClusterService } from '../../core/cluster.service';
import { ClusterNode, ClusterSummary, HistoryPoint, Timeframe } from '../../core/models';
import { formatBytes, formatPercent, formatUptime } from '../../core/format';
import {
  CHART_COLORS,
  formatDateTimeShort,
  formatHour,
  thresholdColor,
} from '../../shared/chart-theme';
import { BarChart } from '../../shared/bar-chart';
import { DonutChart } from '../../shared/donut-chart';
import { LineChart } from '../../shared/line-chart';

/** Tableau de bord : santé du cluster, nœuds et graphiques d'historique. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LineChart, BarChart, DonutChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnDestroy {
  private readonly cluster = inject(ClusterService);
  private readonly refresh$ = new Subject<void>();
  private readonly historyRefresh$ = new Subject<void>();
  private readonly subscription: Subscription;
  private readonly historySubscription: Subscription;
  private timer: Subscription | null = null;
  private historyTimer: Subscription | null = null;

  /** Synthèse du cluster. */
  readonly summary = signal<ClusterSummary | null>(null);
  /** Nœuds du cluster. */
  readonly nodes = signal<ClusterNode[]>([]);
  /** Message d'erreur (cluster injoignable). */
  readonly error = signal<string | null>(null);
  /** Vrai pendant le chargement initial. */
  readonly loading = signal(true);
  /** Rafraîchissement automatique activé. */
  readonly autoRefresh = signal(true);

  /** Historique RRD du cluster. */
  readonly history = signal<HistoryPoint[]>([]);
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
  readonly colors = CHART_COLORS;

  constructor() {
    this.subscription = this.refresh$
      .pipe(
        startWith(undefined),
        switchMap(() => this.load()),
      )
      .subscribe();

    // L'historique est rafraîchi toutes les 60 s (données RRD volumineuses).
    this.historySubscription = this.historyRefresh$
      .pipe(
        startWith(undefined),
        switchMap(() => this.loadHistory()),
      )
      .subscribe();

    effect(() => {
      const enabled = this.autoRefresh();
      untracked(() => this.setAutoRefresh(enabled));
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.historySubscription.unsubscribe();
    this.timer?.unsubscribe();
    this.historyTimer?.unsubscribe();
  }

  /** Recharge manuellement les données. */
  refresh(): void {
    this.refresh$.next();
    this.historyRefresh$.next();
  }

  /** Bascule le rafraîchissement automatique. */
  toggleAutoRefresh(): void {
    this.autoRefresh.update((value) => !value);
  }

  /** Change la fenêtre d'historique et recharge les courbes. */
  setTimeframe(timeframe: Timeframe): void {
    this.timeframe.set(timeframe);
    this.historyRefresh$.next();
  }

  /** Vrai si au moins un nœud est hors ligne. */
  readonly hasOfflineNodes = () => this.nodes().some((node) => node.status === 'offline');

  /** Nœuds hors ligne. */
  readonly offlineNodes = () => this.nodes().filter((node) => node.status === 'offline');

  /** Étiquettes de l'axe des abscisses (heure ou date courte). */
  readonly historyLabels = () =>
    this.history().map((point) =>
      this.timeframe() === 'hour' ? formatHour(point.time) : formatDateTimeShort(point.time),
    );

  /** Série CPU du cluster (%). */
  readonly cpuSeries = () => [
    {
      label: 'CPU',
      data: this.history().map((point) => point.cpu_pct),
      borderColor: CHART_COLORS.accent,
      backgroundColor: 'rgba(76, 141, 255, 0.15)',
    },
  ];

  /** Série RAM du cluster (Go utilisés). */
  readonly memorySeries = () => [
    {
      label: 'RAM utilisée',
      data: this.history().map((point) => point.mem_used / 1024 ** 3),
      borderColor: CHART_COLORS.info,
      backgroundColor: 'rgba(57, 197, 207, 0.15)',
    },
  ];

  /** Séries réseau du cluster (Ko/s). */
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

  /** Étiquettes des nœuds (barres). */
  readonly nodeLabels = () => this.nodes().map((node) => node.name);

  /** Barres CPU par nœud (couleur selon le seuil). */
  readonly nodeCpuSeries = () => [
    {
      label: 'CPU',
      data: this.nodes().map((node) => node.cpu_pct ?? 0),
      backgroundColor: this.nodes().map((node) => thresholdColor(node.cpu_pct)),
    },
  ];

  /** Barres RAM par nœud (%). */
  readonly nodeMemorySeries = () => [
    {
      label: 'RAM',
      data: this.nodes().map((node) =>
        node.memory.total ? (node.memory.used! / node.memory.total) * 100 : 0,
      ),
      backgroundColor: this.nodes().map((node) =>
        thresholdColor(
          node.memory.total ? (node.memory.used! / node.memory.total) * 100 : null,
        ),
      ),
    },
  ];

  /** Parts du donut des VMs. */
  readonly vmDonutLabels = () => ['En marche', 'Arrêtées', 'Templates'];
  readonly vmDonutSeries = () => {
    const data = this.summary();
    return [
      {
        label: 'VMs',
        data: [data?.vms.running ?? 0, data?.vms.stopped ?? 0, data?.vms.templates ?? 0],
        backgroundColor: [
          CHART_COLORS.success,
          CHART_COLORS.warning,
          CHART_COLORS.text,
        ],
      },
    ];
  };

  /** Active ou désactive la rotation périodique. */
  private setAutoRefresh(enabled: boolean): void {
    this.timer?.unsubscribe();
    this.historyTimer?.unsubscribe();
    if (!enabled) {
      this.timer = null;
      this.historyTimer = null;
      return;
    }
    this.timer = interval(15000).subscribe(() => this.refresh$.next());
    this.historyTimer = interval(60000).subscribe(() => this.historyRefresh$.next());
  }

  /** Charge la synthèse et les nœuds. */
  private load() {
    return this.cluster.summary().pipe(
      switchMap((summary) => {
        this.summary.set(summary);
        this.error.set(null);
        return this.cluster.nodes().pipe(
          tap((nodes) => {
            this.nodes.set(nodes);
            this.loading.set(false);
          }),
        );
      }),
      catchError((error: unknown) => {
        this.loading.set(false);
        this.error.set(readError(error));
        return of(null);
      }),
    );
  }

  /** Charge l'historique RRD du cluster. */
  private loadHistory() {
    this.historyLoading.set(true);
    return this.cluster.history(this.timeframe()).pipe(
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
    const detail = (error.error as { detail?: string } | null)?.detail;
    if (detail) {
      return detail;
    }
    if (error.status === 0) {
      return "L'API est injoignable. Vérifiez que le backend Django est démarré.";
    }
  }
  return 'Impossible de charger les données du cluster.';
}
