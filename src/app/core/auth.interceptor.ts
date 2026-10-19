import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Routes d'authentification à ne pas authentifier ni rejouer. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/token/refresh'];

/**
 * Intercepteur qui ajoute le jeton JWT et gère l'expiration de session.
 *
 * - Ajoute `Authorization: Bearer <access>` sur les requêtes authentifiées.
 * - Sur un 401, tente un rafraîchissement puis rejoue la requête une seule fois.
 * - Si le rafraîchissement échoue, l'utilisateur est déconnecté.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isAuthCall = AUTH_ENDPOINTS.some((endpoint) => request.url.includes(endpoint));

  const authorized = auth.accessToken() && !isAuthCall
    ? request.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken()}` } })
    : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthCall) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        switchMap((tokens) =>
          next(
            authorized.clone({ setHeaders: { Authorization: `Bearer ${tokens.access}` } }),
          ),
        ),
        catchError((refreshError: unknown) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
