import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Movement, MovementResponse } from '../models/finance.models';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  let service: FinanceService;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinanceService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('combines revenues and expenses ordered from newest to oldest', () => {
    let receivedMovements: Movement[] = [];
    service.listMovements('organization-id', '2026-08').subscribe((movements) => {
      receivedMovements = movements;
    });

    const revenueRequest = httpController.expectOne((request) =>
      request.url.endsWith('/finance/revenues/'),
    );
    const expenseRequest = httpController.expectOne((request) =>
      request.url.endsWith('/finance/expenses/'),
    );
    expect(revenueRequest.request.params.get('organization_id')).toBe('organization-id');
    expect(revenueRequest.request.params.get('month')).toBe('2026-08');

    revenueRequest.flush([movement('revenue-id', 'Receita', '2026-08-10')]);
    expenseRequest.flush([movement('expense-id', 'Despesa', '2026-08-20')]);

    expect(receivedMovements.map((item) => item.type)).toEqual(['expense', 'revenue']);
    expect(receivedMovements.map((item) => item.description)).toEqual(['Despesa', 'Receita']);
  });

  function movement(id: string, description: string, occurredOn: string): MovementResponse {
    return {
      id,
      organization_id: 'organization-id',
      description,
      amount: 100,
      occurred_on: occurredOn,
      category: 'other',
      category_label: 'Outros',
      customer_id: null,
      customer_name: null,
      supplier_id: null,
      supplier_name: null,
      payment_method: 'pix',
      payment_method_label: 'Pix',
      notes: null,
      created_at: `${occurredOn}T12:00:00Z`,
      updated_at: `${occurredOn}T12:00:00Z`,
    };
  }
});
