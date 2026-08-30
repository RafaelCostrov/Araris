import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  Movement,
  MovementRequest,
  MovementType,
  SelectOption,
} from '../../core/models/finance.models';
import { getApiErrorMessage } from '../../core/services/api-error';
import { AuthService } from '../../core/services/auth.service';
import { FinancePeriodService } from '../../core/services/finance-period.service';
import { FinanceService } from '../../core/services/finance.service';
import { CategoryIconComponent } from '../../shared/category-icon/category-icon';
import { MovementDetailModalComponent } from '../../shared/movement-detail-modal/movement-detail-modal';

interface MovementFormModel {
  type: MovementType;
  description: string;
  amount: number | null;
  occurred_on: string;
  category: string;
  payment_method: string;
  notes: string;
}

@Component({
  selector: 'app-movements-page',
  imports: [CommonModule, FormsModule, CategoryIconComponent, MovementDetailModalComponent],
  templateUrl: './movements.html',
  styleUrl: './movements.scss',
})
export class MovementsPage implements OnInit {
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

  private readonly authService = inject(AuthService);
  private readonly financeService = inject(FinanceService);
  private readonly financePeriodService = inject(FinancePeriodService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected movements: Movement[] = [];
  protected selectedMonth = this.financePeriodService.selectedMonth();
  protected readonly months = MovementsPage.shortMonths;
  protected visibleYear = this.parseMonth(this.selectedMonth).getFullYear();
  protected isMonthPickerOpen = false;
  protected typeFilter: 'all' | MovementType = 'all';
  protected readonly typeFilterOptions: Array<{
    value: 'all' | MovementType;
    label: string;
  }> = [
    { value: 'all', label: 'Todos' },
    { value: 'revenue', label: 'Entradas' },
    { value: 'expense', label: 'Saídas' },
  ];
  protected openFilterDropdown: 'type' | 'category' | null = null;
  protected readonly selectedCategories = new Set<string>();
  protected minimumAmount: number | null = null;
  protected maximumAmount: number | null = null;
  protected searchTerm = '';
  protected loading = true;
  protected saving = false;
  protected deletingId: string | null = null;
  protected errorMessage = '';
  protected successMessage = '';
  protected formOpen = false;
  protected editingMovement: Movement | null = null;
  protected selectedMovement: Movement | null = null;
  protected formModel = this.emptyForm('revenue');

  protected readonly paymentMethods: SelectOption[] = [
    { value: 'pix', label: 'Pix' },
    { value: 'cash', label: 'Dinheiro' },
    { value: 'debit_card', label: 'Cartão de débito' },
    { value: 'credit_card', label: 'Cartão de crédito' },
    { value: 'bank_transfer', label: 'Transferência bancária' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'other', label: 'Outro' },
  ];

  @HostListener('document:click', ['$event'])
  protected closeFloatingControlsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const root = this.elementRef.nativeElement;
    if (this.isMonthPickerOpen && !root.querySelector('.month-picker')?.contains(target)) {
      this.isMonthPickerOpen = false;
    }

    if (
      this.openFilterDropdown &&
      !root.querySelector(`.custom-filter--${this.openFilterDropdown}`)?.contains(target)
    ) {
      this.openFilterDropdown = null;
    }
  }

  private readonly revenueCategories: SelectOption[] = [
    { value: 'sales', label: 'Vendas' },
    { value: 'services', label: 'Serviços' },
    { value: 'refund', label: 'Reembolso' },
    { value: 'investment', label: 'Investimento' },
    { value: 'other', label: 'Outros' },
  ];

  private readonly expenseCategories: SelectOption[] = [
    { value: 'supplies', label: 'Materiais e insumos' },
    { value: 'rent', label: 'Aluguel' },
    { value: 'utilities', label: 'Água, luz e internet' },
    { value: 'transportation', label: 'Transporte' },
    { value: 'taxes', label: 'Impostos e taxas' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'salaries', label: 'Pessoal' },
    { value: 'bank_fees', label: 'Tarifas bancárias' },
    { value: 'other', label: 'Outros' },
  ];

  ngOnInit(): void {
    this.loadMovements();
  }

  protected get categories(): SelectOption[] {
    return this.formModel.type === 'revenue' ? this.revenueCategories : this.expenseCategories;
  }

  protected get filterCategories(): SelectOption[] {
    return [...this.revenueCategories, ...this.expenseCategories].filter(
      (option, index, options) =>
        options.findIndex((candidate) => candidate.value === option.value) === index,
    );
  }

  protected get typeFilterLabel(): string {
    return (
      this.typeFilterOptions.find((option) => option.value === this.typeFilter)?.label ?? 'Todos'
    );
  }

  protected get categoryFilterLabel(): string {
    if (this.selectedCategories.size === 0) {
      return 'Todas as categorias';
    }
    if (this.selectedCategories.size === 1) {
      const selected = this.filterCategories.find((item) =>
        this.selectedCategories.has(item.value),
      );
      return selected?.label ?? '1 categoria';
    }
    return `${this.selectedCategories.size} categorias`;
  }

  protected get filteredMovements(): Movement[] {
    const normalizedSearch = this.searchTerm.trim().toLocaleLowerCase('pt-BR');
    return this.movements.filter((movement) => {
      const matchesType = this.typeFilter === 'all' || movement.type === this.typeFilter;
      const amount = Number(movement.amount);
      const matchesSearch =
        !normalizedSearch ||
        movement.description.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      const matchesCategory =
        this.selectedCategories.size === 0 || this.selectedCategories.has(movement.category);
      const matchesMinimum = this.minimumAmount === null || amount >= this.minimumAmount;
      const matchesMaximum = this.maximumAmount === null || amount <= this.maximumAmount;
      return matchesType && matchesSearch && matchesCategory && matchesMinimum && matchesMaximum;
    });
  }

  protected get totalRevenue(): number {
    return this.movements
      .filter((movement) => movement.type === 'revenue')
      .reduce((total, movement) => total + Number(movement.amount), 0);
  }

  protected get totalExpense(): number {
    return this.movements
      .filter((movement) => movement.type === 'expense')
      .reduce((total, movement) => total + Number(movement.amount), 0);
  }

  protected loadMovements(): void {
    const organizationId = this.authService.organizationId;
    if (!organizationId) {
      this.errorMessage = 'Não foi possível identificar a empresa desta sessão.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.financeService
      .listMovements(organizationId, this.selectedMonth)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (movements) => (this.movements = movements),
        error: (error) => {
          this.errorMessage = getApiErrorMessage(
            error,
            'Não foi possível listar as movimentações.',
          );
        },
      });
  }

  protected toggleFilterDropdown(filter: 'type' | 'category'): void {
    this.isMonthPickerOpen = false;
    this.openFilterDropdown = this.openFilterDropdown === filter ? null : filter;
  }

  protected selectTypeFilter(type: 'all' | MovementType): void {
    this.typeFilter = type;
    this.openFilterDropdown = null;
  }

  protected isCategorySelected(category: string): boolean {
    return this.selectedCategories.has(category);
  }

  protected toggleCategoryFilter(category: string): void {
    if (this.selectedCategories.has(category)) {
      this.selectedCategories.delete(category);
    } else {
      this.selectedCategories.add(category);
    }
  }

  protected clearCategoryFilter(): void {
    this.selectedCategories.clear();
  }

  protected openMovementDetails(movement: Movement): void {
    this.selectedMovement = movement;
  }

  protected shortMonthLabel(): string {
    const selectedDate = this.parseMonth(this.selectedMonth);
    return `${this.months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }

  protected toggleMonthPicker(): void {
    if (this.loading) {
      return;
    }

    this.openFilterDropdown = null;
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
    this.loadMovements();
  }

  protected selectCurrentMonth(): void {
    this.selectedMonth = this.currentMonth();
    this.financePeriodService.selectMonth(this.selectedMonth);
    this.visibleYear = this.parseMonth(this.selectedMonth).getFullYear();
    this.isMonthPickerOpen = false;
    this.loadMovements();
  }

  protected openCreate(type: MovementType = 'revenue'): void {
    this.editingMovement = null;
    this.formModel = this.emptyForm(type);
    this.formOpen = true;
    this.clearFeedback();
  }

  protected openEdit(movement: Movement): void {
    this.editingMovement = movement;
    this.formModel = {
      type: movement.type,
      description: movement.description,
      amount: Number(movement.amount),
      occurred_on: movement.occurred_on,
      category: movement.category,
      payment_method: movement.payment_method || 'pix',
      notes: movement.notes ?? '',
    };
    this.formOpen = true;
    this.clearFeedback();
  }

  protected closeForm(): void {
    if (!this.saving) {
      this.formOpen = false;
      this.editingMovement = null;
    }
  }

  protected onTypeChange(): void {
    this.formModel.category = '';
  }

  protected saveMovement(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (form.invalid || !this.formModel.amount || this.formModel.amount <= 0) {
      form.control.markAllAsTouched();
      return;
    }

    const organizationId = this.authService.organizationId;
    if (!organizationId) {
      this.errorMessage = 'Não foi possível identificar a empresa desta sessão.';
      return;
    }

    const request: MovementRequest = {
      organization_id: organizationId,
      description: this.formModel.description.trim(),
      amount: Number(this.formModel.amount),
      occurred_on: this.formModel.occurred_on,
      category: this.formModel.category,
      payment_method: this.formModel.payment_method,
      notes: this.formModel.notes.trim(),
    };

    const operation = this.editingMovement
      ? this.financeService.updateMovement(
          this.editingMovement.type,
          this.editingMovement.id,
          request,
        )
      : this.financeService.createMovement(this.formModel.type, request);

    this.saving = true;
    operation
      .pipe(
        finalize(() => {
          this.saving = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = this.editingMovement
            ? 'Movimentação atualizada com sucesso.'
            : 'Movimentação cadastrada com sucesso.';
          this.formOpen = false;
          this.editingMovement = null;
          this.loadMovements();
        },
        error: (error) => {
          this.errorMessage = getApiErrorMessage(error, 'Não foi possível salvar a movimentação.');
        },
      });
  }

  protected deleteMovement(movement: Movement): void {
    const confirmed = window.confirm(
      `Excluir a movimentação “${movement.description}”? Esta ação não poderá ser desfeita.`,
    );
    if (!confirmed) {
      return;
    }

    this.clearFeedback();
    this.deletingId = movement.id;
    this.financeService
      .deleteMovement(movement.type, movement.id)
      .pipe(
        finalize(() => {
          this.deletingId = null;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Movimentação excluída com sucesso.';
          this.loadMovements();
        },
        error: (error) => {
          this.errorMessage = getApiErrorMessage(error, 'Não foi possível excluir a movimentação.');
        },
      });
  }

  protected clearFeedback(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private emptyForm(type: MovementType): MovementFormModel {
    return {
      type,
      description: '',
      amount: null,
      occurred_on: this.today(),
      category: '',
      payment_method: 'pix',
      notes: '',
    };
  }

  private today(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  }

  private currentMonth(): string {
    return this.today().slice(0, 7);
  }

  private parseMonth(value: string): Date {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  private formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
