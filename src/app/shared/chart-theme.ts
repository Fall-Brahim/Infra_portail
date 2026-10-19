/** Thème sombre des graphiques (chart.js) et helpers associés. */

import { Chart, ChartConfiguration, TooltipItem } from 'chart.js';

/** Couleurs du thème (alignées sur styles.scss). */
export const CHART_COLORS = {
  accent: '#4c8dff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
  info: '#39c5cf',
  grid: 'rgba(139, 152, 169, 0.12)',
  text: '#8b98a9',
  surface: '#1d242e',
  border: '#2a323d',
  palette: ['#4c8dff', '#3fb950', '#d29922', '#f85149', '#39c5cf', '#a371f7', '#db6d28'],
} as const;

/** Options communes aux graphiques (grille discrète, tooltips lisibles). */
export function baseOptions(unit = ''): ChartConfiguration['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: CHART_COLORS.text, boxWidth: 12, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: CHART_COLORS.surface,
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#e6edf3',
        padding: 10,
        displayColors: true,
        callbacks: unit
          ? {
              label: (context: TooltipItem<'line' | 'bar'>) => {
                const label = context.dataset.label ?? '';
                const value = typeof context.parsed.y === 'number' ? context.parsed.y : 0;
                return `${label} : ${formatValue(value)} ${unit}`;
              },
            }
          : undefined,
      },
    },
    scales: {
      x: {
        grid: { color: CHART_COLORS.grid, drawTicks: false },
        ticks: { color: CHART_COLORS.text, maxRotation: 0, autoSkip: true },
        border: { color: CHART_COLORS.border },
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid, drawTicks: false },
        ticks: { color: CHART_COLORS.text },
        border: { color: CHART_COLORS.border },
      },
    },
  };
}

/** Formate une valeur pour les infobulles. */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (Math.abs(value) >= 1024 ** 3) {
    return `${(value / 1024 ** 3).toFixed(1)} Go`;
  }
  if (Math.abs(value) >= 1024 ** 2) {
    return `${(value / 1024 ** 2).toFixed(1)} Mo`;
  }
  if (Math.abs(value) >= 1024) {
    return `${(value / 1024).toFixed(1)} Ko`;
  }
  return `${Math.round(value * 100) / 100}`;
}

/** Couleur d'une barre selon un seuil : rouge > 90 %, orange > 75 %, sinon accent. */
export function thresholdColor(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return CHART_COLORS.text;
  }
  if (value > 90) {
    return CHART_COLORS.danger;
  }
  if (value > 75) {
    return CHART_COLORS.warning;
  }
  return CHART_COLORS.accent;
}

/** Formate un horodatage Unix en heure locale (HH:mm). */
export function formatHour(time: number): string {
  return new Date(time * 1000).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formate un horodatage Unix en date et heure courte (jj/MM HH:mm). */
export function formatDateTimeShort(time: number): string {
  return new Date(time * 1000).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Enregistre les composants chart.js nécessaires (belt-and-suspenders). */
export function registerChartDefaults(): void {
  Chart.defaults.color = CHART_COLORS.text;
  Chart.defaults.font.family =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
}
