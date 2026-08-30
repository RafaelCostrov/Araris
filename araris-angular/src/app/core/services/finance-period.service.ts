import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FinancePeriodService {
  private readonly selectedMonthState = signal(this.currentMonth());

  readonly selectedMonth = this.selectedMonthState.asReadonly();

  selectMonth(month: string): void {
    this.selectedMonthState.set(month);
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
