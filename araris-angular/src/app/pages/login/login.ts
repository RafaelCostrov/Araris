import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { getApiErrorMessage } from '../../core/services/api-error';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected credentials = { email: '', password: '' };
  protected loading = false;
  protected errorMessage = '';
  protected showPassword = false;

  protected submit(form: NgForm): void {
    this.errorMessage = '';
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.authService
      .login(this.credentials)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => void this.router.navigate(['/home']),
        error: (error) => {
          this.errorMessage = getApiErrorMessage(
            error,
            'Não foi possível entrar. Confira seu e-mail e senha.',
          );
        },
      });
  }
}
