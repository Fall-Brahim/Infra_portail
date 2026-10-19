import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { TokenPair, TokenRefresh, UserProfile } from './models';

/** Clé de stockage local des jetons. */
const STORAGE_KEY = 'selam-infra.auth';

/** Ce qui est conservé dans le navigateur. */
interface StoredSession {
  access: string;
  refresh: string;
  user: UserProfile;
}

/**
 * Service d'authentification.
 *
 * - `access` est conservé en mémoire (et restauré depuis le navigateur).
 * - `refresh` est conservé dans le localStorage pour survivre à un rechargement.
 * - L'état est exposé sous forme de signaux pour être lu dans les templates.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<UserProfile | null>(null);
  private readonly _ready = signal(false);
  private refreshToken: string | null = null;
  private pendingRefresh: Observable<TokenRefresh> | null = null;

  /** Jeton d'accès courant (null si non connecté). */
  readonly accessToken = this._accessToken.asReadonly();
  /** Profil de l'utilisateur connecté. */
  readonly user = this._user.asReadonly();
  /** Vrai lorsque la session a été restaurée (évite les redirections au démarrage). */
  readonly ready = this._ready.asReadonly();
  /** Vrai si un jeton d'accès est disponible. */
  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  /** Rôle de l'utilisateur connecté. */
  readonly role = computed(() => this._user()?.role ?? null);
  /** Vrai pour un administrateur. */
  readonly isAdmin = computed(() => this.role() === 'admin');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restore();
    }
    this._ready.set(true);
  }

  /** Restaure la session depuis le localStorage (navigateur uniquement). */
  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const session = JSON.parse(raw) as StoredSession;
      this._accessToken.set(session.access);
      this._user.set(session.user);
      this.refreshToken = session.refresh;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /** Enregistre la session dans le localStorage (navigateur uniquement). */
  private persist(session: StoredSession): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* stockage indisponible : la session reste en mémoire */
    }
  }

  /** Connecte l'utilisateur et stocke les jetons. */
  login(login: string, password: string): Observable<UserProfile> {
    return this.http
      .post<TokenPair>(`${this.apiBase}/auth/login/`, { login, password })
      .pipe(
        tap((tokens) => {
          this._accessToken.set(tokens.access);
          this._user.set(tokens.user);
          this.refreshToken = tokens.refresh;
          this.persist({ access: tokens.access, refresh: tokens.refresh, user: tokens.user });
        }),
        map((tokens) => tokens.user),
      );
  }

  /**
   * Renouvelle le jeton d'accès.
   * Les appels concurrents partagent la même requête de rafraîchissement.
   */
  refresh(): Observable<TokenRefresh> {
    if (!this.refreshToken) {
      return throwError(() => new Error('Aucun jeton de rafraîchissement disponible.'));
    }
    if (!this.pendingRefresh) {
      this.pendingRefresh = this.http
        .post<TokenRefresh>(`${this.apiBase}/auth/token/refresh/`, {
          refresh: this.refreshToken,
        })
        .pipe(
          tap((tokens) => {
            this._accessToken.set(tokens.access);
            if (tokens.refresh) {
              this.refreshToken = tokens.refresh;
            }
            const user = this._user();
            if (user) {
              this.persist({
                access: tokens.access,
                refresh: this.refreshToken ?? '',
                user,
              });
            }
          }),
          catchError((error) => {
            this.logout(false);
            return throwError(() => error);
          }),
          finalize(() => (this.pendingRefresh = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.pendingRefresh;
  }

  /** Déconnecte l'utilisateur et redirige vers la page de connexion. */
  logout(redirect = true): void {
    this._accessToken.set(null);
    this._user.set(null);
    this.refreshToken = null;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  /** Vérifie que le jeton d'accès n'est pas expiré (sans appel réseau). */
  isAccessTokenExpired(): boolean {
    const token = this._accessToken();
    if (!token) {
      return true;
    }
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return false;
    }
    const exp = payload['exp'];
    if (typeof exp !== 'number') {
      return false;
    }
    return exp * 1000 <= Date.now();
  }

  /** Profil courant hors signal (pratique pour les services). */
  currentUser(): UserProfile | null {
    return this._user();
  }
}

/** Décode la charge utile d'un JWT (sans vérification de signature). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
