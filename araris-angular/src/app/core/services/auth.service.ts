import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSession, LoginCredentials, MeResponse, TokenPair } from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'araris_admin_access';
const REFRESH_TOKEN_KEY = 'araris_admin_refresh';
const SESSION_KEY = 'araris_admin_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionState = signal<AuthSession | null>(this.restoreSession());

  readonly session = this.sessionState.asReadonly();
  readonly userName = computed(() => this.sessionState()?.user.name ?? 'Usuário');
  readonly organizationName = computed(() => {
    const organization = this.sessionState()?.organization;
    return organization?.business_name || organization?.trade_name || 'Empresa';
  });

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get organizationId(): string | null {
    return this.sessionState()?.organization.id ?? null;
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken);
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.http.post<TokenPair>(`${environment.apiUrl}/accounts/login/`, credentials).pipe(
      tap((tokens) => this.saveTokens(tokens)),
      switchMap(() => this.http.get<MeResponse>(`${environment.apiUrl}/accounts/me/`)),
      map((profile) => this.createSession(profile)),
      tap((session) => this.saveSession(session)),
      catchError((error) => {
        this.clearStorage();
        return throwError(() => error);
      }),
    );
  }

  logout(redirect = true): void {
    this.clearStorage();
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  private createSession(profile: MeResponse): AuthSession {
    const membership =
      profile.memberships.find((item) => item.status === 'active') ?? profile.memberships[0];
    if (!membership) {
      throw new Error('O usuário autenticado não possui uma empresa vinculada.');
    }

    return {
      user: profile.user,
      organization: membership.organization,
      role: membership.role,
    };
  }

  private saveTokens(tokens: TokenPair): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }

  private saveSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionState.set(session);
  }

  private restoreSession(): AuthSession | null {
    const serializedSession = localStorage.getItem(SESSION_KEY);
    if (!serializedSession || !localStorage.getItem(ACCESS_TOKEN_KEY)) {
      return null;
    }

    try {
      return JSON.parse(serializedSession) as AuthSession;
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    this.sessionState.set(null);
  }
}
