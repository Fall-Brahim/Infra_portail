/**
 * Contrats de l'API Selam Infra (Django REST Framework).
 * Les noms de champs correspondent à la charge utile JSON renvoyée par le backend.
 */

/** Profil utilisateur renvoyé par /api/auth/me/ et par la connexion. */
export interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  role: Role | null;
  is_staff: boolean;
}

/** Rôle de l'utilisateur (groupe Django). */
export type Role = 'admin' | 'technicien';

/** Couple de jetons JWT renvoyé par la connexion. */
export interface TokenPair {
  access: string;
  refresh: string;
  user: UserProfile;
}

/** Réponse du rafraîchissement de jeton. */
export interface TokenRefresh {
  access: string;
  refresh?: string;
}

/** État de santé globale du cluster. */
export type ClusterHealth = 'ok' | 'degraded' | 'critical';

/** Synthèse du cluster. */
export interface ClusterSummary {
  health: ClusterHealth;
  quorate: boolean | null;
  nodes_online: number;
  nodes_offline: number;
  cpu: CpuUsage;
  memory: Usage;
  storage: Usage;
  vms: VmCounters;
  lxc: VmCounters;
}

/** Consommation CPU du cluster. */
export interface CpuUsage {
  used_pct: number;
  cores: number;
}

/** Consommation mémoire / stockage. */
export interface Usage {
  used: number;
  total: number;
  used_pct: number;
}

/** Compteurs de machines virtuelles. */
export interface VmCounters {
  running: number;
  stopped: number;
  templates?: number;
}

/** Nœud du cluster. */
export interface ClusterNode {
  name: string;
  status: 'online' | 'offline';
  cpu_pct: number | null;
  memory: NodeUsage;
  disk: NodeUsage;
  uptime: number | null;
  vms: number;
}

/** Consommation mémoire / disque d'un nœud (nulle si hors ligne). */
export interface NodeUsage {
  used: number | null;
  total: number | null;
}

/** Type de guest Proxmox. */
export type VmType = 'qemu' | 'lxc';

/** VM ou conteneur LXC (vue liste). */
export interface Vm {
  vmid: number;
  name: string;
  type: VmType;
  node: string;
  status: string;
  cpu_pct: number;
  mem_used: number;
  mem_total: number;
  disk: number;
  uptime: number;
  tags: string[];
  pool: string;
  template: boolean;
}

/** Disque d'une VM. */
export interface VmDisk {
  key: string;
  storage: string;
  size: string;
  format: string;
  file: string;
  raw: string;
}

/** Interface réseau d'une VM. */
export interface VmNetwork {
  key: string;
  model: string;
  mac: string;
  bridge: string;
  tag: string;
  raw: string;
}

/** Configuration d'une VM. */
export interface VmConfig {
  cores: number;
  memory: number;
  ostype: string;
  disks: VmDisk[];
  network: VmNetwork[];
}

/** Statut courant d'une VM. */
export interface VmRuntime {
  status: string;
  uptime: number;
  cpu_pct: number;
  mem_used: number;
  mem_total: number;
  qmpstatus: string;
}

/** Détail d'une VM. */
export interface VmDetail extends Vm {
  config: VmConfig;
  runtime: VmRuntime;
  ip: string | null;
}

/** Actions possibles sur une VM. */
export type VmAction = 'start' | 'stop' | 'shutdown' | 'reboot';

/** État d'une tâche Proxmox. */
export interface TaskStatus {
  finished: boolean;
  ok: boolean;
  message: string;
}

/** Résultat d'une action (identifiant de tâche Proxmox). */
export interface VmActionResult {
  task_id: string;
  message: string;
}

/** Ticket de console noVNC. */
export interface VncTicket {
  ticket: string;
  port: string | null;
  node: string;
  vmid: number;
  host: string;
}

/** Point d'historique RRD (nœud ou VM). */
export interface HistoryPoint {
  time: number;
  cpu_pct: number;
  mem_used: number;
  mem_total: number;
  netin: number;
  netout: number;
}

/** Point d'historique d'une VM (avec les débits disque). */
export interface VmHistoryPoint extends HistoryPoint {
  disk_read: number;
  disk_write: number;
}

/** Fenêtre d'historique demandée à l'API. */
export type Timeframe = 'hour' | 'day' | 'week';

/** Statistiques journalières du journal d'audit. */
export interface LogStat {
  date: string;
  success: number;
  failed: number;
}

/** Entrée du journal d'audit. */
export interface ActionLog {
  id: number;
  user: number | null;
  username: string;
  action: string;
  node: string;
  vmid: number | null;
  vm_name: string;
  status: 'success' | 'failed';
  message: string;
  task_id: string;
  ip_address: string | null;
  created_at: string;
}

/** Page de résultats (pagination DRF). */
export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Corps d'erreur renvoyé par l'API. */
export interface ApiError {
  detail?: string;
  code?: string;
  [key: string]: string | string[] | undefined;
}
