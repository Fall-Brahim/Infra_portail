import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Dashboard } from './dashboard';
import { ClusterNode, ClusterSummary } from '../../core/models';

const SUMMARY: ClusterSummary = {
  health: 'degraded',
  quorate: true,
  nodes_online: 1,
  nodes_offline: 1,
  cpu: { used_pct: 25, cores: 8 },
  memory: { used: 4, total: 16, used_pct: 25 },
  storage: { used: 50, total: 100, used_pct: 50 },
  vms: { running: 1, stopped: 0, templates: 1 },
  lxc: { running: 0, stopped: 1 },
};

const NODES: ClusterNode[] = [
  {
    name: 'pve1',
    status: 'online',
    cpu_pct: 25,
    memory: { used: 4, total: 16 },
    disk: { used: 10, total: 100 },
    uptime: 86400,
    vms: 2,
  },
  {
    name: 'pve2',
    status: 'offline',
    cpu_pct: null,
    memory: { used: null, total: null },
    disk: { used: null, total: null },
    uptime: null,
    vms: 0,
  },
];

describe('Dashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('affiche la synthèse et les nœuds hors ligne', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne('/api/cluster/summary/').flush(SUMMARY);
    httpMock.expectOne('/api/cluster/nodes/').flush(NODES);
    // Historique vide : le message « aucune donnée » doit s'afficher
    httpMock.expectOne('/api/cluster/history/?timeframe=hour').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Dégradé');
    expect(text).toContain('Hors ligne');
    expect(text).toContain('pve2');
    // Bandeau d'alerte pour les nœuds hors ligne
    expect(text).toContain('nœud(s) hors ligne');
    // Sélecteur de période
    expect(text).toContain('1 h');
    expect(text).toContain('24 h');
    expect(text).toContain('7 j');
    // Message « aucune donnée » (pas de canvas sans données)
    expect(text).toContain('Aucune donnée disponible');

    httpMock.verify();
  });

  it('change la période de l\'historique', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne('/api/cluster/summary/').flush(SUMMARY);
    httpMock.expectOne('/api/cluster/nodes/').flush(NODES);
    httpMock.expectOne('/api/cluster/history/?timeframe=hour').flush([]);

    fixture.componentInstance.setTimeframe('week');
    httpMock.expectOne('/api/cluster/history/?timeframe=week').flush([]);

    await fixture.whenStable();
    httpMock.verify();
  });
});
