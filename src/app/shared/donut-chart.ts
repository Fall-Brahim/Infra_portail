import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartData, ChartDataset, ChartOptions } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { CHART_COLORS } from './chart-theme';

/** Graphique en anneau (donut) réutilisable. */
@Component({
  selector: 'app-donut-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideCharts(withDefaultRegisterables())],
  template: `
    <div class="chart" [style.height.px]="height()">
      @if (hasData()) {
        <canvas
          baseChart
          type="doughnut"
          [data]="chartData()"
          [options]="chartOptions()"
        ></canvas>
      } @else {
        <p class="chart__empty">{{ emptyMessage() }}</p>
      }
    </div>
  `,
  styles: `
    .chart {
      position: relative;
      width: 100%;

      &__empty {
        display: grid;
        place-items: center;
        height: 100%;
        margin: 0;
        color: var(--text-muted);
        font-size: 0.85rem;
        text-align: center;
      }
    }
  `,
})
export class DonutChart {
  /** Séries de l'anneau. */
  readonly series = input<ChartDataset<'doughnut'>[]>([]);
  /** Étiquettes des parts. */
  readonly labels = input<string[]>([]);
  /** Hauteur du graphique en pixels. */
  readonly height = input<number>(200);
  /** Message affiché quand il n'y a pas de données. */
  readonly emptyMessage = input<string>('Aucune donnée disponible.');

  /** Vrai si l'anneau contient des valeurs. */
  readonly hasData = computed(() =>
    this.series().some((serie) => (serie.data?.length ?? 0) > 0),
  );

  /** Données transmises à chart.js. */
  readonly chartData = computed<ChartData<'doughnut'>>(() => ({
    labels: this.labels(),
    datasets: this.series().map((serie) => ({
      ...serie,
      backgroundColor: serie.backgroundColor ?? CHART_COLORS.palette,
      borderColor: '#161b22',
      borderWidth: 2,
    })),
  }));

  /** Options du graphique (thème sombre). */
  readonly chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: CHART_COLORS.text, boxWidth: 12, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: CHART_COLORS.surface,
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#e6edf3',
      },
    },
  }));
}
