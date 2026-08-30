import { TestBed } from '@angular/core/testing';
import { FinancePeriodService } from './finance-period.service';

describe('FinancePeriodService', () => {
  it('shares the selected month between consumers', () => {
    const service = TestBed.inject(FinancePeriodService);

    service.selectMonth('2026-07');

    expect(service.selectedMonth()).toBe('2026-07');
    expect(TestBed.inject(FinancePeriodService).selectedMonth()).toBe('2026-07');
  });
});
