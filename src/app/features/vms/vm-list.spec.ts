import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VmList } from './vm-list';
import { Vm, VmDetail } from '../../core/models';

const UPID = 'UPID:pve1:00001234:00000000:653B1C2E:qmstart:100:root@pam:';
const UPID_2 = 'UPID:pve1:00005678:00000000:653B1C2E:qmreboot:200:root@pam:';

const RUNNING_VM: Vm = {
  vmid: 100,
  name: 'xtp-preprod',
  type: 'qemu',
  node: 'pve1',
  status: 'running',
  cpu_pct: 12,
  mem_used: 1024 ** 3,
  mem_total: 2 * 1024 ** 3,
  disk: 1024 ** 3,
  uptime: 3600,
  tags: [],
  pool: '',
  template: false,
};

const STOPPED_DETAIL: VmDetail = {
  ...RUNNING_VM,
  status: 'stopped',
  uptime: 0,
  config: { cores: 2, memory: 2048, ostype: 'l26', disks: [], network: [] },
  runtime: {
    status: 'stopped',
    uptime: 0,
    cpu_pct: 0,
    mem_used: 0,
    mem_total: 2 * 1024 ** 3,
    qmpstatus: '',
  },
  ip: null,
};

const TASK_URL = `/api/tasks/pve1/${encodeURIComponent(UPID)}/`;
const TASK_URL_2 = `/api/tasks/pve1/${encodeURIComponent(UPID_2)}/`;

describe('VmList', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [VmList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suit la tâche puis met à jour la ligne sans recharger la page', async () => {
    const fixture = TestBed.createComponent(VmList);
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url === '/api/vms/').flush({
      count: 1,
      next: null,
      previous: null,
      results: [RUNNING_VM],
    });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.runAction(RUNNING_VM, 'shutdown');

    // L'action est envoyée et renvoie un UPID
    const action = httpMock.expectOne('/api/vms/pve1/100/action/');
    expect(action.request.body).toEqual({ action: 'shutdown' });
    action.flush({ task_id: UPID, message: 'Action envoyée.' });

    // Badge intermédiaire + boutons masqués
    fixture.detectChanges();
    let text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Arrêt…');
    expect(text).not.toContain('Redémarrer');

    // Premier appel de suivi après 1 s : la tâche est encore en cours
    await vi.advanceTimersByTimeAsync(1100);
    httpMock.expectOne(TASK_URL).flush({ finished: false, ok: false, message: 'en cours' });
    fixture.detectChanges();
    text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Arrêt…');

    // Second appel après 2 s : la tâche est terminée
    await vi.advanceTimersByTimeAsync(2100);
    httpMock.expectOne(TASK_URL).flush({ finished: true, ok: true, message: 'Tâche terminée.' });

    // Seule la VM concernée est rechargée
    httpMock.expectOne('/api/vms/pve1/100/').flush(STOPPED_DETAIL);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('xtp-preprod arrêtée');
    expect(text).toContain('Arrêtée');
    // Les boutons suivent le nouveau statut
    expect(text).toContain('Démarrer');
    expect(text).not.toContain('Forcer');

    httpMock.verify();
  });

  it('affiche une erreur claire quand la tâche échoue', async () => {
    const fixture = TestBed.createComponent(VmList);
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url === '/api/vms/').flush({
      count: 1,
      next: null,
      previous: null,
      results: [RUNNING_VM],
    });
    await vi.advanceTimersByTimeAsync(0);

    const component = fixture.componentInstance;
    component.runAction(RUNNING_VM, 'shutdown');
    httpMock
      .expectOne('/api/vms/pve1/100/action/')
      .flush({ task_id: UPID, message: 'Action envoyée.' });

    await vi.advanceTimersByTimeAsync(1100);
    httpMock
      .expectOne(TASK_URL)
      .flush({ finished: true, ok: false, message: 'Tâche terminée : got timeout.' });

    // La liste est rechargée après l'échec
    httpMock.expectOne((req) => req.url === '/api/vms/').flush({
      count: 1,
      next: null,
      previous: null,
      results: [RUNNING_VM],
    });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("Échec de l'action");
    expect(text).toContain('got timeout');
    // Le badge « pending » a disparu
    expect(text).not.toContain('Arrêt…');

    httpMock.verify();
  });

  it('gère plusieurs actions simultanées sur des VMs différentes', async () => {
    const fixture = TestBed.createComponent(VmList);
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const other: Vm = { ...RUNNING_VM, vmid: 200, name: 'xtp-prod' };
    httpMock.expectOne((req) => req.url === '/api/vms/').flush({
      count: 2,
      next: null,
      previous: null,
      results: [RUNNING_VM, other],
    });
    await vi.advanceTimersByTimeAsync(0);

    const component = fixture.componentInstance;
    component.runAction(RUNNING_VM, 'shutdown');
    component.runAction(other, 'reboot');

    httpMock.expectOne('/api/vms/pve1/100/action/').flush({ task_id: UPID, message: '' });
    httpMock.expectOne('/api/vms/pve1/200/action/').flush({ task_id: UPID_2, message: '' });

    await vi.advanceTimersByTimeAsync(1100);
    httpMock.expectOne(TASK_URL).flush({ finished: true, ok: true, message: 'Tâche terminée.' });
    httpMock.expectOne(TASK_URL_2).flush({ finished: true, ok: true, message: 'Tâche terminée.' });

    httpMock.expectOne('/api/vms/pve1/100/').flush(STOPPED_DETAIL);
    httpMock.expectOne('/api/vms/pve1/200/').flush({ ...STOPPED_DETAIL, vmid: 200, name: 'xtp-prod' });

    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    // Les deux lignes sont mises à jour
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('xtp-preprod arrêtée');
    expect(text).toContain('xtp-prod redémarrée');

    httpMock.verify();
  });
});
