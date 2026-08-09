from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.finance.models import (
    Customer,
    Expense,
    ExpenseCategory,
    Payable,
    Receivable,
    Revenue,
    Supplier,
)
from apps.finance.serializers import (
    CustomerSerializer,
    ExpenseSerializer,
    OrganizationSelectionSerializer,
    PayableSerializer,
    ReceivableSerializer,
    RevenueSerializer,
    SettlementSerializer,
    SupplierSerializer,
)
from apps.finance.services import (
    FinanceDomainError,
    add_months,
    build_cash_flow_forecast,
    delete_movement_and_reopen_commitment,
    ensure_indefinite_commitments,
    settle_payable,
    settle_receivable,
    sync_source_commitment_from_movement,
)
from apps.organizations.models import Membership, Organization


def active_organizations_for(user):
    return Organization.objects.filter(
        memberships__user=user,
        memberships__status=Membership.Status.ACTIVE,
        status=Organization.Status.ACTIVE,
    ).distinct()


def get_active_organization(user, organization_id):
    selector = OrganizationSelectionSerializer(
        data={"organization_id": organization_id}
    )
    selector.is_valid(raise_exception=True)
    return get_object_or_404(
        active_organizations_for(user),
        id=selector.validated_data["organization_id"],
    )


def money(value):
    return f"{Decimal(value or 0):.2f}"


def financial_breakdown(queryset, relation, output_id, limit=5):
    id_field = f"{relation}_id"
    name_field = f"{relation}__name"
    rows = list(
        queryset.values(id_field, name_field)
        .annotate(total=Sum("amount"))
        .order_by("-total", name_field)
    )
    total = sum((row["total"] for row in rows), Decimal("0"))
    identified_rows = [row for row in rows if row[id_field]]
    visible_rows = identified_rows[:limit]
    other_total = sum(
        (row["total"] for row in rows if not row[id_field]),
        Decimal("0"),
    ) + sum(
        (row["total"] for row in identified_rows[limit:]),
        Decimal("0"),
    )
    result = [
        {
            output_id: str(row[id_field]),
            "label": row[name_field],
            "total": money(row["total"]),
            "percentage": (
                f"{((row['total'] / total) * 100):.2f}" if total else "0.00"
            ),
        }
        for row in visible_rows
    ]
    if other_total:
        result.append(
            {
                output_id: None,
                "label": "Outros",
                "total": money(other_total),
                "percentage": (
                    f"{((other_total / total) * 100):.2f}" if total else "0.00"
                ),
            }
        )
    return result


def month_bounds(value=None):
    if value:
        try:
            month_start = date.fromisoformat(f"{value}-01")
        except ValueError:
            return None
    else:
        month_start = timezone.localdate().replace(day=1)

    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)
    return month_start, next_month


def filter_realized_month(queryset, month_value, date_field):
    if not month_value:
        return queryset
    bounds = month_bounds(month_value)
    if bounds is None:
        raise ValidationError({"month": "Mês inválido. Use o formato AAAA-MM."})
    month_start, next_month = bounds
    return queryset.filter(
        **{
            f"{date_field}__gte": month_start,
            f"{date_field}__lt": next_month,
        }
    )


def filter_commitments(
    queryset,
    requested_status,
    completed_status,
    completed_date_field,
    month_start,
    next_month,
):
    today = timezone.localdate()
    period_filter = Q(due_date__gte=month_start, due_date__lt=next_month)

    if requested_status in (None, "all"):
        return queryset.filter(
            period_filter | Q(status="pending", due_date__lt=today)
        )
    if requested_status == "pending":
        return queryset.filter(
            period_filter,
            status="pending",
            due_date__gte=today,
        )
    if requested_status == "period_pending":
        return queryset.filter(period_filter, status="pending")
    if requested_status == "due_today":
        return queryset.filter(status="pending", due_date=today)
    if requested_status == "overdue":
        return queryset.filter(status="pending", due_date__lt=today)
    if requested_status == "completed":
        return queryset.filter(
            status=completed_status,
            **{
                f"{completed_date_field}__gte": month_start,
                f"{completed_date_field}__lt": next_month,
            },
        )
    if requested_status == "canceled":
        return queryset.filter(period_filter, status="canceled")
    return None


class FinanceListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer_class = None

    def get_queryset(self, organization):
        return self.model.objects.filter(organization=organization)

    def get(self, request):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        serializer = self.serializer_class(
            self.get_queryset(organization),
            many=True,
            context={"organization": organization},
        )
        return Response(serializer.data)

    def post(self, request):
        organization = get_active_organization(
            request.user,
            request.data.get("organization_id"),
        )
        serializer = self.serializer_class(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RevenueListCreateView(FinanceListCreateView):
    model = Revenue
    serializer_class = RevenueSerializer

    def get_queryset(self, organization):
        return filter_realized_month(
            Revenue.objects.filter(organization=organization).select_related(
                "source_receivable",
                "customer",
            ),
            self.request.query_params.get("month"),
            "occurred_on",
        )


class ExpenseListCreateView(FinanceListCreateView):
    model = Expense
    serializer_class = ExpenseSerializer

    def get_queryset(self, organization):
        return filter_realized_month(
            Expense.objects.filter(organization=organization).select_related(
                "source_payable",
                "supplier",
            ),
            self.request.query_params.get("month"),
            "occurred_on",
        )


class FinanceMovementDetailView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer_class = None

    def get_object(self, request, movement_id, for_update=False):
        queryset = self.model.objects.filter(
            organization__in=active_organizations_for(request.user)
        )
        if for_update:
            queryset = queryset.select_for_update()
        return get_object_or_404(queryset, id=movement_id)

    def patch(self, request, movement_id):
        with transaction.atomic():
            movement = self.get_object(request, movement_id, for_update=True)
            serializer = self.serializer_class(
                movement,
                data=request.data,
                partial=True,
                context={"organization": movement.organization},
            )
            serializer.is_valid(raise_exception=True)
            movement = serializer.save()
            sync_source_commitment_from_movement(movement)
        return Response(
            self.serializer_class(
                movement,
                context={"organization": movement.organization},
            ).data
        )

    def delete(self, request, movement_id):
        movement = self.get_object(request, movement_id)
        delete_movement_and_reopen_commitment(movement)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RevenueDetailView(FinanceMovementDetailView):
    model = Revenue
    serializer_class = RevenueSerializer


class ExpenseDetailView(FinanceMovementDetailView):
    model = Expense
    serializer_class = ExpenseSerializer


class BusinessContactListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer_class = None

    def get(self, request):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        queryset = self.model.objects.filter(organization=organization)
        if request.query_params.get("include_inactive") != "true":
            queryset = queryset.filter(is_active=True)
        serializer = self.serializer_class(
            queryset,
            many=True,
            context={"organization": organization},
        )
        return Response(serializer.data)

    def post(self, request):
        organization = get_active_organization(
            request.user,
            request.data.get("organization_id"),
        )
        serializer = self.serializer_class(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BusinessContactDetailView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer_class = None

    def get_object(self, request, contact_id):
        return get_object_or_404(
            self.model.objects.filter(
                organization__in=active_organizations_for(request.user)
            ),
            id=contact_id,
        )

    def get(self, request, contact_id):
        contact = self.get_object(request, contact_id)
        return Response(
            self.serializer_class(
                contact,
                context={"organization": contact.organization},
            ).data
        )

    def patch(self, request, contact_id):
        contact = self.get_object(request, contact_id)
        serializer = self.serializer_class(
            contact,
            data=request.data,
            partial=True,
            context={"organization": contact.organization},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, contact_id):
        contact = self.get_object(request, contact_id)
        contact.is_active = False
        contact.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerListCreateView(BusinessContactListCreateView):
    model = Customer
    serializer_class = CustomerSerializer


class CustomerDetailView(BusinessContactDetailView):
    model = Customer
    serializer_class = CustomerSerializer


class SupplierListCreateView(BusinessContactListCreateView):
    model = Supplier
    serializer_class = SupplierSerializer


class SupplierDetailView(BusinessContactDetailView):
    model = Supplier
    serializer_class = SupplierSerializer


class PayableListCreateView(FinanceListCreateView):
    model = Payable
    serializer_class = PayableSerializer

    def get_queryset(self, organization):
        queryset = Payable.objects.filter(organization=organization).select_related(
            "supplier"
        )
        bounds = month_bounds(self.request.query_params.get("month"))
        if bounds is None:
            return None
        ensure_indefinite_commitments(
            model=Payable,
            organization=organization,
            through_date=bounds[1],
        )
        return filter_commitments(
            queryset,
            self.request.query_params.get("status"),
            Payable.Status.PAID,
            "paid_at",
            *bounds,
        )

    def get(self, request):
        self.request = request
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        queryset = self.get_queryset(organization)
        if queryset is None:
            return Response(
                {"detail": "Status de compromisso inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            PayableSerializer(
                queryset,
                many=True,
                context={"organization": organization},
            ).data
        )


class ReceivableListCreateView(FinanceListCreateView):
    model = Receivable
    serializer_class = ReceivableSerializer

    def get_queryset(self, organization):
        queryset = Receivable.objects.filter(
            organization=organization
        ).select_related("customer")
        bounds = month_bounds(self.request.query_params.get("month"))
        if bounds is None:
            return None
        ensure_indefinite_commitments(
            model=Receivable,
            organization=organization,
            through_date=bounds[1],
        )
        return filter_commitments(
            queryset,
            self.request.query_params.get("status"),
            Receivable.Status.RECEIVED,
            "received_at",
            *bounds,
        )

    def get(self, request):
        self.request = request
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        queryset = self.get_queryset(organization)
        if queryset is None:
            return Response(
                {"detail": "Status de compromisso inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            ReceivableSerializer(
                queryset,
                many=True,
                context={"organization": organization},
            ).data
        )


class CommitmentDetailView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer_class = None
    contact_field = None

    @property
    def editable_fields(self):
        return {
            "description",
            "amount",
            "due_date",
            "category",
            "notes",
            self.contact_field,
        }

    def get_object(self, request, commitment_id, for_update=False):
        queryset = self.model.objects.filter(
            organization__in=active_organizations_for(request.user)
        )
        if for_update:
            queryset = queryset.select_for_update()
        return get_object_or_404(queryset, id=commitment_id)

    def ensure_pending(self, commitment):
        if commitment.status != commitment.Status.PENDING:
            raise ValidationError(
                {"detail": "Somente compromissos pendentes podem ser alterados."}
            )

    def patch(self, request, commitment_id):
        unsupported_fields = set(request.data) - self.editable_fields
        if unsupported_fields:
            raise ValidationError(
                {
                    "detail": (
                        "Estes campos não podem ser editados: "
                        + ", ".join(sorted(unsupported_fields))
                        + "."
                    )
                }
            )

        with transaction.atomic():
            commitment = self.get_object(request, commitment_id, for_update=True)
            self.ensure_pending(commitment)
            serializer = self.serializer_class(
                commitment,
                data=request.data,
                partial=True,
                context={"organization": commitment.organization},
            )
            serializer.is_valid(raise_exception=True)
            commitment = serializer.save()

        return Response(
            self.serializer_class(
                commitment,
                context={"organization": commitment.organization},
            ).data
        )

    def delete(self, request, commitment_id):
        with transaction.atomic():
            commitment = self.get_object(request, commitment_id, for_update=True)
            self.ensure_pending(commitment)
            commitment.status = commitment.Status.CANCELED
            commitment.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PayableDetailView(CommitmentDetailView):
    model = Payable
    serializer_class = PayableSerializer
    contact_field = "supplier_id"


class ReceivableDetailView(CommitmentDetailView):
    model = Receivable
    serializer_class = ReceivableSerializer
    contact_field = "customer_id"


class PayableSettlementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payable_id):
        payable = get_object_or_404(
            Payable.objects.filter(organization__in=active_organizations_for(request.user)),
            id=payable_id,
        )
        serializer = SettlementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payable, expense = settle_payable(
                payable_id=payable.id,
                paid_at=serializer.validated_data["date"],
                payment_method=serializer.validated_data["payment_method"],
                user=request.user,
            )
        except FinanceDomainError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "commitment": PayableSerializer(payable).data,
                "movement": ExpenseSerializer(expense).data,
            }
        )


class ReceivableSettlementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, receivable_id):
        receivable = get_object_or_404(
            Receivable.objects.filter(
                organization__in=active_organizations_for(request.user)
            ),
            id=receivable_id,
        )
        serializer = SettlementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            receivable, revenue = settle_receivable(
                receivable_id=receivable.id,
                received_at=serializer.validated_data["date"],
                payment_method=serializer.validated_data["payment_method"],
                user=request.user,
            )
        except FinanceDomainError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "commitment": ReceivableSerializer(receivable).data,
                "movement": RevenueSerializer(revenue).data,
            }
        )


class FinancialSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        today = timezone.localdate()
        bounds = month_bounds(request.query_params.get("month"))
        if bounds is None:
            return Response(
                {"detail": "Mês inválido. Use o formato AAAA-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        month_start, next_month = bounds

        ensure_indefinite_commitments(
            model=Payable,
            organization=organization,
            through_date=next_month,
        )
        ensure_indefinite_commitments(
            model=Receivable,
            organization=organization,
            through_date=next_month,
        )

        revenues = Revenue.objects.filter(organization=organization)
        expenses = Expense.objects.filter(organization=organization)
        payables = Payable.objects.filter(organization=organization)
        receivables = Receivable.objects.filter(organization=organization)

        month_revenue = revenues.filter(
            occurred_on__gte=month_start,
            occurred_on__lt=next_month,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        month_expense = expenses.filter(
            occurred_on__gte=month_start,
            occurred_on__lt=next_month,
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        all_revenue = revenues.filter(occurred_on__lt=next_month).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        all_expense = expenses.filter(occurred_on__lt=next_month).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        previous_revenue = revenues.filter(occurred_on__lt=month_start).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        previous_expense = expenses.filter(occurred_on__lt=month_start).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0")
        opening_balance = (
            organization.initial_balance + previous_revenue - previous_expense
        )
        closing_balance = opening_balance + month_revenue - month_expense
        period_payables = payables.filter(
            status=Payable.Status.PENDING,
            due_date__gte=month_start,
            due_date__lt=next_month,
        )
        period_receivables = receivables.filter(
            status=Receivable.Status.PENDING,
            due_date__gte=month_start,
            due_date__lt=next_month,
        )
        overdue_payables = payables.filter(
            status=Payable.Status.PENDING,
            due_date__lt=today,
        )
        overdue_receivables = receivables.filter(
            status=Receivable.Status.PENDING,
            due_date__lt=today,
        )
        due_today_payables = payables.filter(
            status=Payable.Status.PENDING,
            due_date=today,
        )
        due_today_receivables = receivables.filter(
            status=Receivable.Status.PENDING,
            due_date=today,
        )

        activity = []
        for revenue in revenues.filter(
            occurred_on__gte=month_start,
            occurred_on__lt=next_month,
        ).select_related("source_receivable", "customer").order_by(
            "-occurred_on",
            "-created_at",
        )[:8]:
            source = revenue.source_receivable
            is_recurring = bool(source and source.recurrence != "none")
            activity.append(
                {
                    "id": revenue.id,
                    "type": "revenue",
                    "description": revenue.description,
                    "amount": money(revenue.amount),
                    "date": revenue.occurred_on,
                    "category": revenue.category,
                    "category_label": revenue.get_category_display(),
                    "customer_id": revenue.customer_id,
                    "customer_name": revenue.customer.name if revenue.customer else None,
                    "payment_method": revenue.payment_method,
                    "payment_method_label": revenue.get_payment_method_display(),
                    "is_recurring": is_recurring,
                    "recurrence": source.recurrence if is_recurring else "none",
                    "recurrence_label": (
                        source.get_recurrence_display()
                        if is_recurring
                        else "Lançamento simples"
                    ),
                    "source_commitment_id": source.id if source else None,
                    "notes": revenue.notes,
                    "created_at": revenue.created_at,
                }
            )
        for expense in expenses.filter(
            occurred_on__gte=month_start,
            occurred_on__lt=next_month,
        ).select_related("source_payable", "supplier").order_by(
            "-occurred_on",
            "-created_at",
        )[:8]:
            source = expense.source_payable
            is_recurring = bool(source and source.recurrence != "none")
            activity.append(
                {
                    "id": expense.id,
                    "type": "expense",
                    "description": expense.description,
                    "amount": money(expense.amount),
                    "date": expense.occurred_on,
                    "category": expense.category,
                    "category_label": expense.get_category_display(),
                    "supplier_id": expense.supplier_id,
                    "supplier_name": expense.supplier.name if expense.supplier else None,
                    "payment_method": expense.payment_method,
                    "payment_method_label": expense.get_payment_method_display(),
                    "is_recurring": is_recurring,
                    "recurrence": source.recurrence if is_recurring else "none",
                    "recurrence_label": (
                        source.get_recurrence_display()
                        if is_recurring
                        else "Lançamento simples"
                    ),
                    "source_commitment_id": source.id if source else None,
                    "notes": expense.notes,
                    "created_at": expense.created_at,
                }
            )
        activity.sort(
            key=lambda item: (item["date"], item["created_at"]),
            reverse=True,
        )

        return Response(
            {
                "period": month_start,
                "totals": {
                    "revenue": money(month_revenue),
                    "expense": money(month_expense),
                    "monthly_balance": money(month_revenue - month_expense),
                    "opening_balance": money(opening_balance),
                    "closing_balance": money(closing_balance),
                    "balance": money(organization.initial_balance + all_revenue - all_expense),
                    "payables_due_in_period": money(
                        period_payables.aggregate(total=Sum("amount"))["total"]
                    ),
                    "receivables_due_in_period": money(
                        period_receivables.aggregate(total=Sum("amount"))["total"]
                    ),
                    "overdue_payables": money(
                        overdue_payables.aggregate(total=Sum("amount"))["total"]
                    ),
                    "overdue_receivables": money(
                        overdue_receivables.aggregate(total=Sum("amount"))["total"]
                    ),
                    "due_today_payables": money(
                        due_today_payables.aggregate(total=Sum("amount"))["total"]
                    ),
                    "due_today_receivables": money(
                        due_today_receivables.aggregate(total=Sum("amount"))["total"]
                    ),
                },
                "counts": {
                    "pending_payables": period_payables.count(),
                    "pending_receivables": period_receivables.count(),
                    "overdue_payables": overdue_payables.count(),
                    "overdue_receivables": overdue_receivables.count(),
                    "due_today_payables": due_today_payables.count(),
                    "due_today_receivables": due_today_receivables.count(),
                },
                "recent_activity": activity[:8],
            }
        )


class FinancialDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        bounds = month_bounds(request.query_params.get("month"))
        if bounds is None:
            return Response(
                {"detail": "Mês inválido. Use o formato AAAA-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            history_months = int(request.query_params.get("history_months", 6))
        except (TypeError, ValueError):
            history_months = 0
        if history_months not in (3, 6, 12):
            return Response(
                {"detail": "O histórico deve conter 3, 6 ou 12 meses."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_start, next_month = bounds
        history_start = add_months(month_start, -(history_months - 1))
        forecast = build_cash_flow_forecast(
            organization=organization,
            start_date=timezone.localdate(),
            days=30,
        )

        history = {}
        for index in range(history_months):
            item_month = add_months(history_start, index)
            history[item_month.strftime("%Y-%m")] = {
                "month": item_month.strftime("%Y-%m"),
                "revenue": Decimal("0"),
                "expense": Decimal("0"),
            }

        revenue_history = (
            Revenue.objects.filter(
                organization=organization,
                occurred_on__gte=history_start,
                occurred_on__lt=next_month,
            )
            .annotate(period=TruncMonth("occurred_on"))
            .values("period")
            .annotate(total=Sum("amount"))
        )
        expense_history = (
            Expense.objects.filter(
                organization=organization,
                occurred_on__gte=history_start,
                occurred_on__lt=next_month,
            )
            .annotate(period=TruncMonth("occurred_on"))
            .values("period")
            .annotate(total=Sum("amount"))
        )
        for item in revenue_history:
            key = item["period"].strftime("%Y-%m")
            if key in history:
                history[key]["revenue"] = item["total"]
        for item in expense_history:
            key = item["period"].strftime("%Y-%m")
            if key in history:
                history[key]["expense"] = item["total"]

        expense_rows = list(
            Expense.objects.filter(
                organization=organization,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            )
            .values("category")
            .annotate(total=Sum("amount"))
            .order_by("-total", "category")
        )
        expense_total = sum(
            (row["total"] for row in expense_rows),
            Decimal("0"),
        )
        expense_labels = dict(ExpenseCategory.choices)
        expense_categories = [
            {
                "category": row["category"],
                "label": expense_labels.get(row["category"], row["category"]),
                "total": money(row["total"]),
                "percentage": (
                    f"{((row['total'] / expense_total) * 100):.2f}"
                    if expense_total
                    else "0.00"
                ),
            }
            for row in expense_rows
        ]
        revenue_customers = financial_breakdown(
            Revenue.objects.filter(
                organization=organization,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            ),
            "customer",
            "customer_id",
        )
        expense_suppliers = financial_breakdown(
            Expense.objects.filter(
                organization=organization,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            ),
            "supplier",
            "supplier_id",
        )

        monthly_history = [
            {
                "month": item["month"],
                "revenue": money(item["revenue"]),
                "expense": money(item["expense"]),
            }
            for item in history.values()
        ]
        top_expense_category = (
            expense_categories[0] if expense_categories else None
        )

        return Response(
            {
                "period": month_start,
                "history_months": history_months,
                "forecast": forecast,
                "monthly_history": monthly_history,
                "expense_categories": expense_categories,
                "revenue_customers": revenue_customers,
                "expense_suppliers": expense_suppliers,
                "insights": {
                    "top_expense_category": top_expense_category,
                    "largest_upcoming_impact": forecast[
                        "largest_upcoming_impact"
                    ],
                    "largest_outflow_day": forecast["largest_outflow_day"],
                    "lowest_balance": forecast["lowest_balance"],
                    "lowest_balance_date": forecast["lowest_balance_date"],
                    "has_deficit": forecast["has_deficit"],
                },
            }
        )
