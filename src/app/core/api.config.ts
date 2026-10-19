import { InjectionToken } from '@angular/core';

/**
 * URL de base de l'API Django.
 *
 * Par défaut, l'application appelle `/api` sur son propre origine : en
 * développement, le proxy Angular (proxy.conf.json) transmet les requêtes
 * au backend Django, ce qui évite toute configuration CORS.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
