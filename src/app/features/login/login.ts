import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/models';

/** Page de connexion. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Formulaire de connexion. */
  readonly form = this.formBuilder.nonNullable.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  /** Message d'erreur affiché sous le formulaire. */
  readonly error = signal<string | null>(null);
  /** Vrai pendant l'envoi du formulaire. */
  readonly loading = signal(false);

  /** Soumet le formulaire de connexion. */
  submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { login, password } = this.form.getRawValue();
    this.auth.login(login, password).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/cluster';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(readApiError(error));
      },
    });
  }
}

/** Extrait un message lisible d'une erreur HTTP. */
function readApiError(error: HttpErrorResponse): string {
  const body = error.error as ApiError | undefined;
  if (body && typeof body.detail === 'string') {
    return body.detail;
  }
  if (error.status === 0) {
    return "Le serveur est injoignable. Vérifiez que l'API est démarrée.";
  }
  if (error.status === 401) {
    return 'Identifiants invalides.';
  }
  return `Erreur ${error.status} : la connexion a échoué.`;
}
