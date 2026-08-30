import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.accessToken;
  const authenticatedRequest = accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error) => {
      const isLoginRequest = request.url.endsWith('/accounts/login/');
      if (error.status === 401 && !isLoginRequest) {
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
