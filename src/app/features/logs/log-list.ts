import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subject, Subscription, catchError, interval, of, startWith, switchMap, tap } from 'rxjs';

import { LogService } from '../../core/log.service';
import { ActionLog, LogStat, Paged } from '../../core/models';
import { actionLabel, formatDateTime } from '../../core/format';
import { CHART_COLORS } from '../../shared/chart-theme';
import { BarChart } from '../../shared/bar-chart';

/** Journal d'audit (lecture seule) et statistiques journalières. */
@Component({
  selector: 'app-log-list',
  imports: [ReactiveFormsModule, BarChart],
  templateUrl: './log-list.html',
  styleUrl: './log-list.scss',
})
export class LogList implements OnInit, OnDestroy {
  private readonly logService = inject(LogService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly statsRefresh$ = new Subject<void>();
  private readonly statsSubscription: Subscription;
  private statsTimer: Subscription | null = null;

  /** Page de résultats courante. */
  readonly page = signal<Paged<ActionLog>>({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  /** Vrai pendant le chargement. */
  readonly loading = signal(true);
  /** Message d'erreur. */
  readonly error = signal<string | null>(null);
  /** Numéro de page courant. */
  readonly currentPage = signal(1);
  /** Taille de page. */
  readonly pageSize = signal(25);
  /** Statistiques journalières (succès / échecs). */
  readonly stats = signal<LogStat[]>([]);
  /** Vrai pendant le chargement des statistiques. */
  readonly statsLoading = signal(true);
  /** Message d'erreur des statistiques. */
  readonly statsError = signal<string | null>(null);
  /** Nombre de jours agrégés. */
  readonly statsDays = signal(7);

  /** Filtres du journal. */
  readonly filters = this.formBuilder.nonNullable.group({
    user: [''],
    action: [''],
    vmid: [''],
    status: [''],
    date_from: [''],
    date_to: [''],
  });

  /** Formateurs d'affichage. */
  readonly actionLabel = actionLabel;
  readonly formatDateTime = formatDateTime;
  readonly colors = CHART_COLORS;

  constructor() {
    this.statsSubscription = this.statsRefresh$
      .pipe(
        startWith(undefined),
        switchMap(() => this.loadStats()),
      )
      .subscribe();
    this.statsTimer = interval(60000).subscribe(() => this.statsRefresh$.next());
  }

  ngOnInit(): void {
    this.load(1);
  }

  ngOnDestroy(): void {
    this.statsSubscription.unsubscribe();
    this.statsTimer?.unsubscribe();
  }

  /** Change le nombre de jours agrégés. */
  setStatsDays(days: number): void {
    this.statsDays.set(days);
    this.statsRefresh$.next();
  }

  /** Étiquettes du graphique (dates jj/MM). */
  readonly statsLabels = () =>
    this.stats().map((stat) =>
      new Date(stat.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    );

  /** Séries du graphique (succès / échecs). */
  readonly statsSeries = () => [
    {
      label: 'Succès',
      data: this.stats().map((stat) => stat.success),
      backgroundColor: CHART_COLORS.success,
    },
    {
      label: 'Échecs',
      data: this.stats().map((stat) => stat.failed),
      backgroundColor: CHART_COLORS.danger,
    },
  ];

  /** Charge une page de résultats. */
  load(page: number): void {
    this.currentPage.set(page);
    this.loading.set(true);
    this.error.set(null);

    const value = this.filters.getRawValue();
    this.logService
      .list({
        user: value.user || undefined,
        action: value.action || undefined,
        vmid: value.vmid || undefined,
        status: value.status || undefined,
        date_from: value.date_from || undefined,
        date_to: value.date_to || undefined,
        page,
        page_size: this.pageSize(),
      })
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readError(error));
        },
      });
  }

  /** Applique les filtres (remise à la première page). */
  applyFilters(): void {
    this.load(1);
  }

  /** Réinitialise les filtres. */
  resetFilters(): void {
    this.filters.reset({
      user: '',
      action: '',
      vmid: '',
      status: '',
      date_from: '',
      date_to: '',
    });
    this.load(1);
  }

  /** Nombre total de pages. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.page().count / this.pageSize()));
  }

  /** Charge les statistiques journalières. */
  private loadStats() {
    this.statsLoading.set(true);
    return this.logService.stats(this.statsDays()).pipe(
      tap((stats) => {
        this.stats.set(stats);
        this.statsLoading.set(false);
        this.statsError.set(null);
      }),
      catchError((error: unknown) => {
        this.statsLoading.set(false);
        this.statsError.set(readError(error));
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
    if (error.status === 0) {
      return "L'API est injoignable.";
    }
    return `Erreur ${error.status}.`;
  }
  return "Une erreur est survenue lors du chargement des statistiques.";
}
