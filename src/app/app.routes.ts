import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';
import { Login } from './features/login/login';
import { Shell } from './features/layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
    title: 'Connexion — Selam Infra',
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'cluster' },
      {
        path: 'cluster',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Cluster — Selam Infra',
      },
      {
        path: 'vms',
        loadComponent: () => import('./features/vms/vm-list').then((m) => m.VmList),
        title: 'VMs — Selam Infra',
      },
      {
        path: 'vms/:node/:vmid',
        loadComponent: () =>
          import('./features/vms/vm-detail').then((m) => m.VmDetailPage),
        title: 'Détail VM — Selam Infra',
      },
      {
        path: 'logs',
        loadComponent: () => import('./features/logs/log-list').then((m) => m.LogList),
        title: 'Journal — Selam Infra',
      },
    ],
  },
  { path: '**', redirectTo: 'cluster' },
];
