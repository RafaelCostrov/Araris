export type MovementType = 'revenue' | 'expense';

export interface MovementResponse {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  occurred_on: string;
  category: string;
  category_label: string;
  customer_id: string | null;
  customer_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  payment_method: string;
  payment_method_label: string;
  notes: string | null;
  is_recurring?: boolean;
  recurrence_label?: string;
  created_at: string;
  updated_at: string;
}

export interface Movement extends MovementResponse {
  type: MovementType;
}

export interface MovementDetails {
  id: string;
  type: MovementType;
  description: string;
  amount: number;
  occurred_on: string;
  category: string;
  category_label: string;
  customer_name?: string | null;
  supplier_name?: string | null;
  payment_method_label?: string;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_label?: string;
}

export interface MovementRequest {
  organization_id?: string;
  description: string;
  amount: number;
  occurred_on: string;
  category: string;
  payment_method: string;
  notes: string;
}

export interface FinanceSummary {
  period: string;
  totals: {
    revenue: number;
    expense: number;
    monthly_balance: number;
    opening_balance: number;
    closing_balance: number;
    balance: number;
    payables_due_in_period: number;
    receivables_due_in_period: number;
    overdue_payables: number;
    overdue_receivables: number;
    due_today_payables: number;
    due_today_receivables: number;
  };
  counts: {
    pending_payables: number;
    pending_receivables: number;
    overdue_payables: number;
    overdue_receivables: number;
    due_today_payables: number;
    due_today_receivables: number;
  };
  recent_activity: Array<{
    id: string;
    type: MovementType;
    description: string;
    amount: number;
    date: string;
    category: string;
    category_label: string;
    customer_name?: string | null;
    supplier_name?: string | null;
    payment_method_label?: string;
    notes?: string | null;
    is_recurring?: boolean;
    recurrence_label?: string;
  }>;
}

export interface SelectOption {
  value: string;
  label: string;
}
