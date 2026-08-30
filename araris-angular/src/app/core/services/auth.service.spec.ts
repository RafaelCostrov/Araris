import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession, MeResponse, TokenPair } from '../models/auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
    localStorage.clear();
  });

  it('authenticates, loads the profile and stores the active organization', () => {
    let receivedSession: AuthSession | undefined;
    service.login({ email: 'gestor@araris.local', password: 'Senha@123' }).subscribe((session) => {
      receivedSession = session;
    });

    const loginRequest = httpController.expectOne('http://localhost:8080/api/accounts/login/');
    expect(loginRequest.request.method).toBe('POST');
    loginRequest.flush({ access: 'access-token', refresh: 'refresh-token' } satisfies TokenPair);

    const meRequest = httpController.expectOne('http://localhost:8080/api/accounts/me/');
    expect(meRequest.request.method).toBe('GET');
    meRequest.flush({
      user: {
        id: 'user-id',
        name: 'Gestora Araris',
        email: 'gestor@araris.local',
        phone: null,
        auth_provider: 'email',
      },
      memberships: [
        {
          id: 'membership-id',
          organization: {
            id: 'organization-id',
            business_name: 'Araris Serviços LTDA',
            trade_name: 'Araris Serviços',
            cnpj: '12345678000199',
            initial_balance: 100,
          },
          role: 'owner',
          status: 'active',
        },
      ],
    } satisfies MeResponse);

    expect(receivedSession?.organization.id).toBe('organization-id');
    expect(service.organizationId).toBe('organization-id');
    expect(service.organizationName()).toBe('Araris Serviços LTDA');
    expect(service.isAuthenticated()).toBe(true);
  });
});
