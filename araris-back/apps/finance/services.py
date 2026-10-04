import calendar
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.finance.models import (
    Expense,
    Payable,
    Receivable,
    RecurrenceFrequency,
    Revenue,
)


class FinanceDomainError(Exception):
    pass


def money(value):
    return f"{Decimal(value or 0):.2f}"


def _aggregate_realized_totals(queryset, *, month_start, next_month):
    """Calcula os valores anteriores e do mês em uma consulta por tabela."""
    return queryset.filter(occurred_on__lt=next_month).aggregate(
        previous=Sum("amount", filter=Q(occurred_on__lt=month_start), default=0),
        monthly=Sum("amount", filter=Q(occurred_on__gte=month_start), default=0),
    )


def _aggregate_pending_totals(queryset, *, month_start, next_month, today):
    """Soma e conta pendências; vencidos e vencimentos de hoje são globais."""
    period = Q(due_date__gte=month_start, due_date__lt=next_month)
    overdue = Q(due_date__lt=today)
    due_today = Q(due_date=today)
    return queryset.filter(status=queryset.model.Status.PENDING).aggregate(
        period_total=Sum("amount", filter=period, default=0),
        period_count=Count("id", filter=period),
        overdue_total=Sum("amount", filter=overdue, default=0),
        overdue_count=Count("id", filter=overdue),
        due_today_total=Sum("amount", filter=due_today, default=0),
        due_today_count=Count("id", filter=due_today),
    )


def _recent_financial_activity(*, revenues, expenses, month_start, next_month):
    activity = []
    for movement_type, queryset, source_field, contact_field in (
        ("revenue", revenues, "source_receivable", "customer"),
        ("expense", expenses, "source_payable", "supplier"),
    ):
        movements = (
            queryset.filter(occurred_on__gte=month_start, occurred_on__lt=next_month)
            .select_related(source_field, contact_field)
            .order_by("-occurred_on", "-created_at")[:8]
        )
        for movement in movements:
            source = getattr(movement, source_field)
            contact = getattr(movement, contact_field)
            is_recurring = bool(source and source.recurrence != RecurrenceFrequency.NONE)
            activity.append(
                {
                    "id": movement.id,
                    "type": movement_type,
                    "description": movement.description,
                    "amount": money(movement.amount),
                    "date": movement.occurred_on,
                    "category": movement.category,
                    "category_label": movement.get_category_display(),
                    f"{contact_field}_id": getattr(movement, f"{contact_field}_id"),
                    f"{contact_field}_name": contact.name if contact else None,
                    "payment_method": movement.payment_method,
                    "payment_method_label": movement.get_payment_method_display(),
                    "is_recurring": is_recurring,
                    "recurrence": source.recurrence if is_recurring else "none",
                    "recurrence_label": (
                        source.get_recurrence_display()
                        if is_recurring
                        else "Lançamento simples"
                    ),
                    "source_commitment_id": source.id if source else None,
                    "notes": movement.notes,
                    "created_at": movement.created_at,
                }
            )
    activity.sort(key=lambda item: (item["date"], item["created_at"]), reverse=True)
    return activity[:8]


def build_financial_summary(*, organization, month_start, next_month):
    """Monta o resumo com quatro consultas de indicadores e duas de atividades.

    A organização deve ter sido autorizada pelo chamador. A ampliação das
    recorrências mantém suas consultas próprias, fora da contagem acima.
    """
    today = timezone.localdate()
    for model in (Payable, Receivable):
        ensure_indefinite_commitments(
            model=model,
            organization=organization,
            through_date=next_month,
        )

    revenues = Revenue.objects.filter(organization=organization)
    expenses = Expense.objects.filter(organization=organization)
    revenue_totals = _aggregate_realized_totals(
        revenues, month_start=month_start, next_month=next_month,
    )
    expense_totals = _aggregate_realized_totals(
        expenses, month_start=month_start, next_month=next_month,
    )
    opening_balance = (
        organization.initial_balance
        + revenue_totals["previous"]
        - expense_totals["previous"]
    )
    monthly_balance = revenue_totals["monthly"] - expense_totals["monthly"]
    closing_balance = opening_balance + monthly_balance
    totals = {
        "revenue": revenue_totals["monthly"],
        "expense": expense_totals["monthly"],
        "monthly_balance": monthly_balance,
        "opening_balance": opening_balance,
        "closing_balance": closing_balance,
        # O saldo acumulado até o fim do mês é o próprio saldo de fechamento.
        "balance": closing_balance,
    }
    counts = {}
    for name, model in (("payables", Payable), ("receivables", Receivable)):
        pending = _aggregate_pending_totals(
            model.objects.filter(organization=organization),
            month_start=month_start,
            next_month=next_month,
            today=today,
        )
        totals[f"{name}_due_in_period"] = pending["period_total"]
        totals[f"overdue_{name}"] = pending["overdue_total"]
        totals[f"due_today_{name}"] = pending["due_today_total"]
        counts[f"pending_{name}"] = pending["period_count"]
        counts[f"overdue_{name}"] = pending["overdue_count"]
        counts[f"due_today_{name}"] = pending["due_today_count"]

    return {
        "period": month_start,
        "totals": {name: money(value) for name, value in totals.items()},
        "counts": counts,
        "recent_activity": _recent_financial_activity(
            revenues=revenues,
            expenses=expenses,
            month_start=month_start,
            next_month=next_month,
        ),
    }


def add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def recurrence_due_date(first_due_date, recurrence, offset):
    if recurrence == RecurrenceFrequency.WEEKLY:
        return first_due_date + timedelta(days=7 * offset)
    if recurrence == RecurrenceFrequency.FORTNIGHTLY:
        return first_due_date + timedelta(days=15 * offset)

    month_intervals = {
        RecurrenceFrequency.MONTHLY: 1,
        RecurrenceFrequency.BIMONTHLY: 2,
        RecurrenceFrequency.QUARTERLY: 3,
        RecurrenceFrequency.SEMIANNUAL: 6,
        RecurrenceFrequency.ANNUAL: 12,
    }
    return add_months(first_due_date, month_intervals[recurrence] * offset)


def recurrence_occurrences_through(first_due_date, recurrence, through_date):
    occurrences = 1

    while recurrence_due_date(first_due_date, recurrence, occurrences) <= through_date:
        occurrences += 1

    return occurrences


@transaction.atomic
def create_commitment_series(*, model, validated_data, occurrences):
    recurrence = validated_data.get("recurrence", RecurrenceFrequency.NONE)
    is_indefinite = validated_data.get("recurrence_indefinite", False)
    first_due_date = validated_data["due_date"]
    if is_indefinite:
        horizon = max(first_due_date, timezone.localdate()) + timedelta(days=366)
        number_to_create = recurrence_occurrences_through(
            first_due_date,
            recurrence,
            horizon,
        )
        total = 0
    else:
        number_to_create = occurrences if recurrence != RecurrenceFrequency.NONE else 1
        total = number_to_create
    recurrence_group = uuid4() if number_to_create > 1 or is_indefinite else None
    commitments = []

    for index in range(number_to_create):
        item_data = {
            **validated_data,
            "due_date": (
                first_due_date
                if index == 0
                else recurrence_due_date(first_due_date, recurrence, index)
            ),
            "recurrence_group": recurrence_group,
            "recurrence_sequence": index + 1,
            "recurrence_total": total,
        }
        commitments.append(model.objects.create(**item_data))

    return commitments[0]


@transaction.atomic
def ensure_indefinite_commitments(*, model, organization, through_date):
    horizon = max(through_date, timezone.localdate() + timedelta(days=366))
    groups = (
        model.objects.filter(
            organization=organization,
            recurrence_indefinite=True,
            recurrence_group__isnull=False,
        )
        .values_list("recurrence_group", flat=True)
        .distinct()
    )

    for recurrence_group in groups:
        series = model.objects.filter(
            organization=organization,
            recurrence_group=recurrence_group,
        )
        first = series.select_for_update().order_by("recurrence_sequence").first()
        last = series.order_by("-recurrence_sequence").first()
        if not first or not last:
            continue

        index = last.recurrence_sequence
        due_date = recurrence_due_date(first.due_date, first.recurrence, index)
        while due_date <= horizon:
            model.objects.create(
                organization=first.organization,
                description=first.description,
                amount=first.amount,
                due_date=due_date,
                category=first.category,
                **(
                    {"supplier": first.supplier}
                    if isinstance(first, Payable)
                    else {"customer": first.customer}
                ),
                notes=first.notes,
                recurrence=first.recurrence,
                recurrence_group=first.recurrence_group,
                recurrence_indefinite=True,
                recurrence_sequence=index + 1,
                recurrence_total=0,
                created_by=first.created_by,
            )
            index += 1
            due_date = recurrence_due_date(first.due_date, first.recurrence, index)


def validate_settlement_date(settlement_date):
    if settlement_date > timezone.localdate():
        raise FinanceDomainError("A data da baixa não pode estar no futuro.")


def sync_source_commitment_from_movement(movement):
    if isinstance(movement, Revenue):
        source = Receivable.objects.select_for_update().filter(
            generated_revenue=movement
        ).first()
        settled_date = movement.occurred_on
        settled_date_field = "received_at"
        contact_field = "customer"
    else:
        source = Payable.objects.select_for_update().filter(
            generated_expense=movement
        ).first()
        settled_date = movement.occurred_on
        settled_date_field = "paid_at"
        contact_field = "supplier"

    if not source:
        return

    source.description = movement.description
    source.amount = movement.amount
    source.category = movement.category
    setattr(source, contact_field, getattr(movement, contact_field))
    source.payment_method = movement.payment_method
    source.notes = movement.notes
    setattr(source, settled_date_field, settled_date)
    source.save(
        update_fields=[
            "description",
            "amount",
            "category",
            contact_field,
            "payment_method",
            "notes",
            settled_date_field,
            "updated_at",
        ]
    )


@transaction.atomic
def delete_movement_and_reopen_commitment(movement):
    model = type(movement)
    movement = model.objects.select_for_update().get(id=movement.id)

    if isinstance(movement, Revenue):
        source = Receivable.objects.select_for_update().filter(
            generated_revenue=movement
        ).first()
        settled_date_field = "received_at"
    else:
        source = Payable.objects.select_for_update().filter(
            generated_expense=movement
        ).first()
        settled_date_field = "paid_at"

    if source:
        source.status = source.Status.PENDING
        source.payment_method = ""
        setattr(source, settled_date_field, None)
        source.save(
            update_fields=[
                "status",
                "payment_method",
                settled_date_field,
                "updated_at",
            ]
        )

    movement.delete()


@transaction.atomic
def settle_payable(*, payable_id, paid_at, payment_method, user):
    validate_settlement_date(paid_at)
    payable = Payable.objects.select_for_update().get(id=payable_id)

    if payable.status != Payable.Status.PENDING:
        raise FinanceDomainError("Esta conta a pagar não está pendente.")

    expense = Expense.objects.create(
        organization=payable.organization,
        description=payable.description,
        amount=payable.amount,
        occurred_on=paid_at,
        category=payable.category,
        supplier=payable.supplier,
        payment_method=payment_method,
        notes=payable.notes,
        source_payable=payable,
        created_by=user,
    )
    payable.status = Payable.Status.PAID
    payable.paid_at = paid_at
    payable.payment_method = payment_method
    payable.save(update_fields=["status", "paid_at", "payment_method", "updated_at"])
    return payable, expense


@transaction.atomic
def settle_receivable(*, receivable_id, received_at, payment_method, user):
    validate_settlement_date(received_at)
    receivable = Receivable.objects.select_for_update().get(id=receivable_id)

    if receivable.status != Receivable.Status.PENDING:
        raise FinanceDomainError("Esta conta a receber não está pendente.")

    revenue = Revenue.objects.create(
        organization=receivable.organization,
        description=receivable.description,
        amount=receivable.amount,
        occurred_on=received_at,
        category=receivable.category,
        customer=receivable.customer,
        payment_method=payment_method,
        notes=receivable.notes,
        source_receivable=receivable,
        created_by=user,
    )
    receivable.status = Receivable.Status.RECEIVED
    receivable.received_at = received_at
    receivable.payment_method = payment_method
    receivable.save(
        update_fields=["status", "received_at", "payment_method", "updated_at"]
    )
    return receivable, revenue


def forecast_commitment_item(commitment, commitment_type, projection_date):
    is_overdue = commitment.due_date < timezone.localdate()
    return {
        "id": str(commitment.id),
        "type": commitment_type,
        "description": commitment.description,
        "amount": money(commitment.amount),
        "due_date": commitment.due_date,
        "projection_date": projection_date,
        "category": commitment.category,
        "category_label": commitment.get_category_display(),
        "counterparty_id": (
            commitment.supplier_id
            if commitment_type == "payable"
            else commitment.customer_id
        ),
        "counterparty_name": (
            commitment.supplier.name
            if commitment_type == "payable" and commitment.supplier
            else commitment.customer.name
            if commitment_type == "receivable" and commitment.customer
            else None
        ),
        "recurrence": commitment.recurrence,
        "recurrence_label": commitment.get_recurrence_display(),
        "recurrence_indefinite": commitment.recurrence_indefinite,
        "effective_status": "overdue" if is_overdue else "pending",
        "effective_status_label": "Vencido" if is_overdue else "Pendente",
    }


def build_cash_flow_forecast(*, organization, start_date=None, days=30):
    start_date = start_date or timezone.localdate()
    end_date = start_date + timedelta(days=days - 1)

    ensure_indefinite_commitments(
        model=Payable,
        organization=organization,
        through_date=end_date,
    )
    ensure_indefinite_commitments(
        model=Receivable,
        organization=organization,
        through_date=end_date,
    )

    realized_revenue = Revenue.objects.filter(
        organization=organization,
        occurred_on__lte=start_date,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    realized_expense = Expense.objects.filter(
        organization=organization,
        occurred_on__lte=start_date,
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    current_balance = (
        organization.initial_balance + realized_revenue - realized_expense
    )

    payables = list(
        Payable.objects.filter(
            organization=organization,
            status=Payable.Status.PENDING,
            due_date__lte=end_date,
        ).select_related("supplier").order_by("due_date", "created_at")
    )
    receivables = list(
        Receivable.objects.filter(
            organization=organization,
            status=Receivable.Status.PENDING,
            due_date__lte=end_date,
        ).select_related("customer").order_by("due_date", "created_at")
    )

    events_by_date = {}
    all_commitments = []
    overdue_payables = Decimal("0")
    overdue_receivables = Decimal("0")

    for commitment_type, commitments in (
        ("payable", payables),
        ("receivable", receivables),
    ):
        for commitment in commitments:
            projection_date = max(commitment.due_date, start_date)
            event = forecast_commitment_item(
                commitment,
                commitment_type,
                projection_date,
            )
            events_by_date.setdefault(projection_date, []).append(event)
            all_commitments.append(event)
            if commitment.due_date < start_date:
                if commitment_type == "payable":
                    overdue_payables += commitment.amount
                else:
                    overdue_receivables += commitment.amount

    running_balance = current_balance
    lowest_balance = current_balance
    lowest_balance_date = start_date
    total_payables = Decimal("0")
    total_receivables = Decimal("0")
    daily = []

    for offset in range(days):
        current_date = start_date + timedelta(days=offset)
        events = events_by_date.get(current_date, [])
        day_payables = sum(
            (
                Decimal(event["amount"])
                for event in events
                if event["type"] == "payable"
            ),
            Decimal("0"),
        )
        day_receivables = sum(
            (
                Decimal(event["amount"])
                for event in events
                if event["type"] == "receivable"
            ),
            Decimal("0"),
        )
        total_payables += day_payables
        total_receivables += day_receivables
        net_change = day_receivables - day_payables
        running_balance += net_change
        if running_balance < lowest_balance:
            lowest_balance = running_balance
            lowest_balance_date = current_date

        daily.append(
            {
                "date": current_date,
                "receivables": money(day_receivables),
                "payables": money(day_payables),
                "net_change": money(net_change),
                "projected_balance": money(running_balance),
                "commitments": events,
            }
        )

    upcoming_impacts = sorted(
        all_commitments,
        key=lambda item: (
            item["projection_date"],
            item["due_date"],
            -Decimal(item["amount"]),
        ),
    )[:8]
    largest_upcoming_impact = (
        max(all_commitments, key=lambda item: Decimal(item["amount"]))
        if all_commitments
        else None
    )
    largest_outflow_day = max(
        daily,
        key=lambda item: Decimal(item["payables"]),
        default=None,
    )
    if largest_outflow_day and Decimal(largest_outflow_day["payables"]) == 0:
        largest_outflow_day = None

    return {
        "start_date": start_date,
        "end_date": end_date,
        "days": days,
        "current_balance": money(current_balance),
        "projected_balance": money(running_balance),
        "lowest_balance": money(lowest_balance),
        "lowest_balance_date": lowest_balance_date,
        "has_deficit": lowest_balance < 0,
        "total_receivables": money(total_receivables),
        "total_payables": money(total_payables),
        "overdue_receivables": money(overdue_receivables),
        "overdue_payables": money(overdue_payables),
        "daily": daily,
        "upcoming_impacts": upcoming_impacts,
        "largest_upcoming_impact": largest_upcoming_impact,
        "largest_outflow_day": largest_outflow_day,
    }
