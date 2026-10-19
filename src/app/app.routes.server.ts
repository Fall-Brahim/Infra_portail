import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * L'application est un portail d'administration protégé par JWT :
 * le rendu est entièrement côté client (le token vit dans le navigateur).
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
