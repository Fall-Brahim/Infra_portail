import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth.service';

/** Charpente de l'application : en-tête, navigation et contenu. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  /** Service d'authentification (profil et rôle). */
  readonly auth = inject(AuthService);

  /** Déconnecte l'utilisateur. */
  logout(): void {
    this.auth.logout();
  }
}
