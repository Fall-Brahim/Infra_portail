import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartDataset, ChartOptions, ChartData } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { baseOptions } from './chart-theme';

/**
 * Graphique en courbes réutilisable.
 *
 * ```html
 * <app-line-chart [series]="series()" [labels]="labels()" unit="%" />
 * ```
 */
@Component({
  selector: 'app-line-chart',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideCharts(withDefaultRegisterables())],
  template: `
    <div class="chart" [style.height.px]="height()">
      @if (hasData()) {
        <canvas
          baseChart
          type="line"
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
export class LineChart {
  /** Séries à tracer (une entrée par courbe). */
  readonly series = input<ChartDataset<'line'>[]>([]);
  /** Étiquettes de l'axe des abscisses. */
  readonly labels = input<string[]>([]);
  /** Unité affichée dans les infobulles (%, Mo, …). */
  readonly unit = input<string>('');
  /** Hauteur du graphique en pixels. */
  readonly height = input<number>(220);
  /** Message affiché quand il n'y a pas de données. */
  readonly emptyMessage = input<string>('Aucune donnée disponible.');

  /** Vrai si au moins une série contient des valeurs. */
  readonly hasData = computed(() =>
    this.series().some((serie) => (serie.data?.length ?? 0) > 0),
  );

  /** Données transmises à chart.js. */
  readonly chartData = computed<ChartData<'line'>>(() => ({
    labels: this.labels(),
    datasets: this.series().map((serie) => ({
      ...serie,
      spanGaps: false,
      tension: 0.25,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
    })),
  }));

  /** Options du graphique (thème sombre). */
  readonly chartOptions = computed<ChartOptions<'line'>>(
    () => baseOptions(this.unit()) as ChartOptions<'line'>,
  );
}
