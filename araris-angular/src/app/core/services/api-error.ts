import { HttpErrorResponse } from '@angular/common/http';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const payload = error.error;
  if (typeof payload?.detail === 'string') {
    return payload.detail;
  }

  if (payload?.errors && typeof payload.errors === 'object') {
    const firstMessage = Object.values(payload.errors).find((value) => typeof value === 'string');
    if (typeof firstMessage === 'string') {
      return firstMessage;
    }
  }

  if (error.status === 0) {
    return 'Não foi possível acessar a API Spring. Confirme se ela está executando na porta 8080.';
  }

  return fallback;
}
