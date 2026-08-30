import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FinanceSummary,
  Movement,
  MovementRequest,
  MovementResponse,
  MovementType,
} from '../models/finance.models';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);

  getSummary(organizationId: string, month: string): Observable<FinanceSummary> {
    const params = this.params(organizationId, month);
    return this.http.get<FinanceSummary>(`${environment.apiUrl}/finance/summary/`, { params });
  }

  listMovements(organizationId: string, month: string): Observable<Movement[]> {
    const params = this.params(organizationId, month);
    return forkJoin({
      revenues: this.http.get<MovementResponse[]>(`${environment.apiUrl}/finance/revenues/`, {
        params,
      }),
      expenses: this.http.get<MovementResponse[]>(`${environment.apiUrl}/finance/expenses/`, {
        params,
      }),
    }).pipe(
      map(({ revenues, expenses }) =>
        [
          ...revenues.map((movement) => ({ ...movement, type: 'revenue' as const })),
          ...expenses.map((movement) => ({ ...movement, type: 'expense' as const })),
        ].sort((left, right) => right.occurred_on.localeCompare(left.occurred_on)),
      ),
    );
  }

  createMovement(type: MovementType, request: MovementRequest): Observable<MovementResponse> {
    return this.http.post<MovementResponse>(this.collectionUrl(type), request);
  }

  updateMovement(
    type: MovementType,
    movementId: string,
    request: MovementRequest,
  ): Observable<MovementResponse> {
    const updateRequest = { ...request };
    delete updateRequest.organization_id;
    return this.http.patch<MovementResponse>(
      `${this.collectionUrl(type)}${movementId}/`,
      updateRequest,
    );
  }

  deleteMovement(type: MovementType, movementId: string): Observable<void> {
    return this.http.delete<void>(`${this.collectionUrl(type)}${movementId}/`);
  }

  private collectionUrl(type: MovementType): string {
    const resource = type === 'revenue' ? 'revenues' : 'expenses';
    return `${environment.apiUrl}/finance/${resource}/`;
  }

  private params(organizationId: string, month: string): HttpParams {
    return new HttpParams().set('organization_id', organizationId).set('month', month);
  }
}
