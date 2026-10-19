import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, takeWhile, timer, timeout } from 'rxjs';

import { TaskStatus } from './models';
import { VmService } from './vm.service';

/** Délai avant le premier appel de suivi (ms). */
const FIRST_POLL_DELAY = 1000;
/** Intervalle entre deux appels de suivi (ms). */
const POLL_INTERVAL = 2000;
/** Durée maximale de suivi d'une tâche (ms). */
const POLL_TIMEOUT = 60000;

/**
 * Suivi des tâches Proxmox.
 *
 * `watch()` émet l'état de la tâche toutes les 2 secondes (premier appel
 * après 1 s) et se termine dès que la tâche est finie. En cas de dépassement
 * du délai maximal, une erreur `TimeoutError` est émise.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly vmService = inject(VmService);

  /** Suit une tâche jusqu'à sa fin. */
  watch(node: string, upid: string): Observable<TaskStatus> {
    return timer(FIRST_POLL_DELAY, POLL_INTERVAL).pipe(
      timeout({ first: POLL_TIMEOUT }),
      switchMap(() => this.vmService.taskStatus(node, upid)),
      // `inclusive` : la dernière émission (tâche finie) est transmise
      // avant la fin du flux.
      takeWhile((status) => !status.finished, true),
    );
  }
}
