import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((module) => module.LoginPage),
    title: 'Entrar | Araris Admin',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/admin-layout').then((module) => module.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home').then((module) => module.HomePage),
        title: 'Visão geral | Araris Admin',
      },
      {
        path: 'admin/movimentacoes',
        loadComponent: () =>
          import('./pages/movements/movements').then((module) => module.MovementsPage),
        title: 'Movimentações | Araris Admin',
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
