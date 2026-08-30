import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FinanceSummary, MovementDetails } from '../../core/models/finance.models';
import { getApiErrorMessage } from '../../core/services/api-error';
import { AuthService } from '../../core/services/auth.service';
import { FinancePeriodService } from '../../core/services/finance-period.service';
import { FinanceService } from '../../core/services/finance.service';
import { CategoryIconComponent } from '../../shared/category-icon/category-icon';
import { MovementDetailModalComponent } from '../../shared/movement-detail-modal/movement-detail-modal';

@Component({
  selector: 'app-home-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CategoryIconComponent,
    MovementDetailModalComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage implements OnInit {
  private static readonly shortMonths = [
    'Jan.',
    'Fev.',
    'Mar.',
    'Abr.',
    'Mai.',
    'Jun.',
    'Jul.',
    'Ago.',
    'Set.',
    'Out.',
    'Nov.',
    'Dez.',
  ];

  protected readonly authService = inject(AuthService);
  private readonly financeService = inject(FinanceService);
  private readonly financePeriodService = inject(FinancePeriodService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly months = HomePage.shortMonths;
  protected selectedMonth = this.financePeriodService.selectedMonth();
  protected visibleYear = this.parseMonth(this.selectedMonth).getFullYear();
  protected isMonthPickerOpen = false;
  protected summary: FinanceSummary | null = null;
  protected loading = true;
  protected errorMessage = '';
  protected selectedMovement: MovementDetails | null = null;
  protected readonly skeletonCards = [1, 2, 3, 4];

  @HostListener('document:click', ['$event'])
  protected closeMonthPickerOnOutsideClick(event: MouseEvent): void {
    if (!this.isMonthPickerOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(target)) {
      this.isMonthPickerOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadSummary();
  }

  protected loadSummary(): void {
    const organizationId = this.authService.organizationId;
    if (!organizationId) {
      this.errorMessage = 'Não foi possível identificar a empresa desta sessão.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.financeService
      .getSummary(organizationId, this.selectedMonth)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (summary) => (this.summary = summary),
        error: (error) => {
          this.errorMessage = getApiErrorMessage(
            error,
            'Não foi possível carregar o resumo financeiro.',
          );
        },
      });
  }

  protected shortMonthLabel(): string {
    const selectedDate = this.parseMonth(this.selectedMonth);
    return `${this.months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }

  protected toggleMonthPicker(): void {
    if (this.loading) {
      return;
    }

    this.visibleYear = this.parseMonth(this.selectedMonth).getFullYear();
    this.isMonthPickerOpen = !this.isMonthPickerOpen;
  }

  protected changeVisibleYear(step: number): void {
    this.visibleYear += step;
  }

  protected isMonthSelected(monthIndex: number): boolean {
    const selectedDate = this.parseMonth(this.selectedMonth);
    return (
      selectedDate.getFullYear() === this.visibleYear && selectedDate.getMonth() === monthIndex
    );
  }

  protected selectMonth(monthIndex: number): void {
    this.selectedMonth = this.formatMonth(new Date(this.visibleYear, monthIndex, 1));
    this.financePeriodService.selectMonth(this.selectedMonth);
    this.isMonthPickerOpen = false;
    this.loadSummary();
  }

  protected selectCurrentMonth(): void {
    this.selectedMonth = this.currentMonth();
    this.financePeriodService.selectMonth(this.selectedMonth);
    this.visibleYear = this.parseMonth(this.selectedMonth).getFullYear();
    this.isMonthPickerOpen = false;
    this.loadSummary();
  }

  protected openMovementDetails(item: FinanceSummary['recent_activity'][number]): void {
    this.selectedMovement = {
      ...item,
      occurred_on: item.date,
    };
  }

  private currentMonth(): string {
    const now = new Date();
    return this.formatMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private parseMonth(value: string): Date {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  private formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
