import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeoutError } from 'rxjs';

import { VmService } from '../../core/vm.service';
import { TaskService } from '../../core/task.service';
import { Paged, Vm, VmAction, VmDetail } from '../../core/models';
import {
  ACTION_DONE_LABELS,
  ACTION_PENDING_LABELS,
  formatBytes,
  formatPercent,
  formatUptime,
  statusLabel,
} from '../../core/format';

/** Action en cours sur une VM. */
interface PendingAction {
  action: VmAction;
  label: string;
}

/** Liste unifiée des VMs et conteneurs LXC. */
@Component({
  selector: 'app-vm-list',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './vm-list.html',
  styleUrl: './vm-list.scss',
})
export class VmList implements OnInit {
  private readonly vmService = inject(VmService);
  private readonly taskService = inject(TaskService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Page de résultats courante. */
  readonly page = signal<Paged<Vm>>({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  /** Vrai pendant le chargement. */
  readonly loading = signal(true);
  /** Message d'erreur. */
  readonly error = signal<string | null>(null);
  /** Messages de retour après une action (plusieurs actions simultanées possibles). */
  readonly notices = signal<string[]>([]);
  /** Actions en cours, indexées par « nœud:vmid ». */
  readonly pending = signal<Record<string, PendingAction>>({});
  /** Numéro de page courant (1 par défaut). */
  readonly currentPage = signal(1);
  /** Taille de page. */
  readonly pageSize = signal(25);

  /** Filtres de la liste. */
  readonly filters = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    node: [''],
    type: [''],
    pool: [''],
    include_templates: [false],
  });

  /** Formateurs d'affichage. */
  readonly formatBytes = formatBytes;
  readonly formatPercent = formatPercent;
  readonly formatUptime = formatUptime;
  readonly statusLabel = statusLabel;
  readonly pendingLabels = ACTION_PENDING_LABELS;

  ngOnInit(): void {
    // Un nœud peut être pré-sélectionné depuis le tableau de bord.
    this.route.queryParamMap.subscribe((params) => {
      this.filters.controls.node.setValue(params.get('node') ?? '');
      this.load(1);
    });
  }

  /** Charge une page de résultats. */
  load(page: number): void {
    this.currentPage.set(page);
    this.loading.set(true);

    const value = this.filters.getRawValue();
    this.vmService
      .list({
        search: value.search || undefined,
        status: value.status || undefined,
        node: value.node || undefined,
        type: value.type || undefined,
        pool: value.pool || undefined,
        include_templates: value.include_templates,
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
    this.error.set(null);
    this.load(1);
  }

  /** Réinitialise les filtres. */
  resetFilters(): void {
    this.error.set(null);
    this.filters.reset({ search: '', status: '', node: '', type: '', pool: '', include_templates: false });
    this.load(1);
  }

  /** Change la taille de page. */
  changePageSize(size: string | number): void {
    this.pageSize.set(Number(size));
    this.load(1);
  }

  /** Action en cours pour une VM (undefined si aucune). */
  pendingFor(vm: Vm): PendingAction | undefined {
    return this.pending()[this.key(vm)];
  }

  /** Exécute une action sur une VM puis suit la tâche jusqu'à sa fin. */
  runAction(vm: Vm, action: VmAction): void {
    const key = this.key(vm);
    this.setPending(key, { action, label: ACTION_PENDING_LABELS[action] ?? action });
    this.error.set(null);
    this.notices.set([]);

    this.vmService.action(vm.node, vm.vmid, action).subscribe({
      next: (result) => {
        this.taskService
          .watch(vm.node, result.task_id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (status) => {
              if (status.finished) {
                this.completeAction(vm, action, key, status.ok, status.message);
              }
            },
            error: (error: unknown) => {
              this.failAction(
                vm,
                key,
                error instanceof TimeoutError
                  ? `L'action sur « ${vm.name} » n'a pas abouti dans le délai imparti.`
                  : readError(error),
              );
            },
          });
      },
      error: (error: HttpErrorResponse) => {
        this.clearPending(key);
        this.error.set(readError(error));
        this.load(this.currentPage());
      },
    });
  }

  /** Tâche terminée : succès ou échec. */
  private completeAction(
    vm: Vm,
    action: VmAction,
    key: string,
    ok: boolean,
    message: string,
  ): void {
    this.clearPending(key);
    if (ok) {
      // On ne recharge que la VM concernée.
      this.reloadVm(vm);
      this.addNotice(`${vm.name} ${ACTION_DONE_LABELS[action] ?? action}`.trim());
    } else {
      this.error.set(
        message && message !== 'Tâche terminée.'
          ? `Échec de l'action sur « ${vm.name} » : ${message}`
          : `L'action sur « ${vm.name} » a échoué.`,
      );
      this.load(this.currentPage());
    }
  }

  /** Tâche en erreur ou dépassement du délai. */
  private failAction(vm: Vm, key: string, message: string): void {
    this.clearPending(key);
    this.error.set(message);
    this.load(this.currentPage());
  }

  /** Recharge une seule VM et met à jour sa ligne. */
  private reloadVm(vm: Vm): void {
    this.vmService
      .detail(vm.node, vm.vmid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => this.updateRow(detail),
        error: () => this.load(this.currentPage()),
      });
  }

  /** Met à jour la ligne d'une VM sans recharger toute la liste. */
  private updateRow(detail: VmDetail): void {
    this.page.update((page) => ({
      ...page,
      results: page.results.map((vm) =>
        vm.vmid === detail.vmid && vm.node === detail.node ? toRow(detail) : vm,
      ),
    }));
  }

  /** Clé unique d'une VM dans la page. */
  private key(vm: Vm): string {
    return `${vm.node}:${vm.vmid}`;
  }

  /** Ajoute un message de retour (les 5 derniers sont conservés). */
  private addNotice(message: string): void {
    this.notices.update((notices) => [...notices, message].slice(-5));
  }

  /** Marque une action comme en cours. */
  private setPending(key: string, action: PendingAction): void {
    this.pending.update((pending) => ({ ...pending, [key]: action }));
  }

  /** Retire une action en cours. */
  private clearPending(key: string): void {
    this.pending.update((pending) => {
      if (!(key in pending)) {
        return pending;
      }
      const next = { ...pending };
      delete next[key];
      return next;
    });
  }

  /** Nombre total de pages. */
  get totalPages(): number {
    const count = this.page().count;
    return Math.max(1, Math.ceil(count / this.pageSize()));
  }
}

/** Extrait les champs de la liste à partir du détail d'une VM. */
function toRow(detail: VmDetail): Vm {
  return {
    vmid: detail.vmid,
    name: detail.name,
    type: detail.type,
    node: detail.node,
    status: detail.status,
    cpu_pct: detail.runtime.cpu_pct,
    mem_used: detail.runtime.mem_used,
    mem_total: detail.runtime.mem_total,
    disk: detail.disk,
    uptime: detail.runtime.uptime,
    tags: detail.tags,
    pool: detail.pool,
    template: detail.template,
  };
}

/** Extrait un message lisible d'une erreur HTTP. */
function readError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { detail?: string; code?: string } | null;
    if (body?.detail) {
      return body.detail;
    }
    if (error.status === 0) {
      return "L'API est injoignable.";
    }
    return `Erreur ${error.status}.`;
  }
  return "Une erreur est survenue.";
}
