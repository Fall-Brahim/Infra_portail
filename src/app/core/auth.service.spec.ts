import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { UserProfile } from './models';

const USER: UserProfile = {
  id: 1,
  username: 'tech',
  email: 'tech@selam.local',
  role: 'technicien',
  is_staff: false,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stocke les jetons et le profil après connexion', () => {
    service.login('tech', 'secret').subscribe();

    const request = httpMock.expectOne('/api/auth/login/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ login: 'tech', password: 'secret' });

    request.flush({ access: 'access-token', refresh: 'refresh-token', user: USER });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.username).toBe('tech');
    expect(service.role()).toBe('technicien');
    expect(service.isAdmin()).toBe(false);
    expect(JSON.parse(localStorage.getItem('selam-infra.auth') ?? '{}').access).toBe(
      'access-token',
    );
  });

  it('efface la session lors de la déconnexion', () => {
    service.login('tech', 'secret').subscribe();
    httpMock.expectOne('/api/auth/login/').flush({
      access: 'access-token',
      refresh: 'refresh-token',
      user: USER,
    });

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(localStorage.getItem('selam-infra.auth')).toBeNull();
  });

  it('restaure la session depuis le localStorage', () => {
    localStorage.setItem(
      'selam-infra.auth',
      JSON.stringify({ access: 'a', refresh: 'r', user: USER }),
    );
    const restored = createService();
    expect(restored.isAuthenticated()).toBe(true);
    expect(restored.user()?.username).toBe('tech');
  });

  it('détecte un jeton expiré', () => {
    const expired = buildToken(Math.floor(Date.now() / 1000) - 60);
    const valid = buildToken(Math.floor(Date.now() / 1000) + 3600);

    localStorage.setItem(
      'selam-infra.auth',
      JSON.stringify({ access: expired, refresh: 'r', user: USER }),
    );
    expect(createService().isAccessTokenExpired()).toBe(true);

    localStorage.setItem(
      'selam-infra.auth',
      JSON.stringify({ access: valid, refresh: 'r', user: USER }),
    );
    expect(createService().isAccessTokenExpired()).toBe(false);
  });

  it('renouvelle le jeton d\'accès', () => {
    localStorage.setItem(
      'selam-infra.auth',
      JSON.stringify({ access: 'old', refresh: 'refresh-token', user: USER }),
    );
    const restored = createService();

    restored.refresh().subscribe();
    const request = httpMock.expectOne('/api/auth/token/refresh/');
    expect(request.request.body).toEqual({ refresh: 'refresh-token' });
    request.flush({ access: 'new-access' });

    expect(restored.accessToken()).toBe('new-access');
  });
});

/** Crée une nouvelle instance du service (relecture du localStorage). */
function createService(): AuthService {
  return TestBed.runInInjectionContext(() => new AuthService());
}

/** Construit un faux JWT signé containing the given expiration. */
function buildToken(exp: number): string {
  const payload = btoa(JSON.stringify({ exp })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}
