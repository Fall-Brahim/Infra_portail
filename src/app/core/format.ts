/** Utilitaires d'affichage (octets, durées, dates). */

/** Formate un nombre d'octets en unités lisibles. */
export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return '—';
  }
  if (bytes === 0) {
    return '0 o';
  }
  const units = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
  const exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : digits)} ${units[exponent]}`;
}

/** Formate une durée en secondes (uptime). */
export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) {
    return '—';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days} j ${hours} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
}

/** Formate un pourcentage. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} %`;
}

/** Formate une date ISO en date et heure locales. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

/** Libellé lisible d'une action d'audit. */
export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    start: 'Démarrage',
    stop: 'Arrêt',
    shutdown: 'Arrêt orderly',
    reboot: 'Redémarrage',
    vnc: 'Console',
  };
  return labels[action] ?? action;
}

/** Libellé lisible d'un état Proxmox. */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    running: 'En marche',
    stopped: 'Arrêtée',
    paused: 'En pause',
    suspended: 'Suspendue',
    unknown: 'Inconnue',
  };
  return labels[status] ?? status;
}

/** Libellé affiché pendant l'exécution d'une action. */
export const ACTION_PENDING_LABELS: Record<string, string> = {
  start: 'Démarrage…',
  shutdown: 'Arrêt…',
  reboot: 'Redémarrage…',
  stop: 'Arrêt forcé…',
};

/** Libellé du résultat une fois l'action terminée. */
export const ACTION_DONE_LABELS: Record<string, string> = {
  start: 'démarrée',
  shutdown: 'arrêtée',
  reboot: 'redémarrée',
  stop: 'arrêtée (forçage)',
};
