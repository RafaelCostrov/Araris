from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedUUIDModel


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Dinheiro"
    PIX = "pix", "Pix"
    DEBIT_CARD = "debit_card", "Cartão de débito"
    CREDIT_CARD = "credit_card", "Cartão de crédito"
    BANK_TRANSFER = "bank_transfer", "Transferência bancária"
    BOLETO = "boleto", "Boleto"
    OTHER = "other", "Outro"


class RevenueCategory(models.TextChoices):
    SALES = "sales", "Vendas"
    SERVICES = "services", "Serviços"
    REFUND = "refund", "Reembolso"
    INVESTMENT = "investment", "Investimento"
    OTHER = "other", "Outros"


class ExpenseCategory(models.TextChoices):
    SUPPLIES = "supplies", "Materiais e insumos"
    RENT = "rent", "Aluguel"
    UTILITIES = "utilities", "Água, luz e internet"
    TRANSPORTATION = "transportation", "Transporte"
    TAXES = "taxes", "Impostos e taxas"
    MARKETING = "marketing", "Marketing"
    SALARIES = "salaries", "Pessoal"
    BANK_FEES = "bank_fees", "Tarifas bancárias"
    OTHER = "other", "Outros"


class RecurrenceFrequency(models.TextChoices):
    NONE = "none", "Não se repete"
    WEEKLY = "weekly", "Semanal"
    FORTNIGHTLY = "fortnightly", "Quinzenal"
    MONTHLY = "monthly", "Mensal"
    BIMONTHLY = "bimonthly", "Bimestral"
    QUARTERLY = "quarterly", "Trimestral"
    SEMIANNUAL = "semiannual", "Semestral"
    ANNUAL = "annual", "Anual"


class Customer(TimestampedUUIDModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="customers",
    )
    name = models.CharField(max_length=255)
    document = models.CharField(max_length=14, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_finance_customers",
        null=True,
    )

    class Meta:
        ordering = ["name", "created_at"]
        indexes = [
            models.Index(fields=["organization", "is_active", "name"]),
            models.Index(fields=["organization", "document"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "document"],
                condition=~models.Q(document=""),
                name="finance_customer_unique_document_per_org",
            ),
        ]

    def __str__(self):
        return self.name


class Supplier(TimestampedUUIDModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="suppliers",
    )
    name = models.CharField(max_length=255)
    document = models.CharField(max_length=14, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_finance_suppliers",
        null=True,
    )

    class Meta:
        ordering = ["name", "created_at"]
        indexes = [
            models.Index(fields=["organization", "is_active", "name"]),
            models.Index(fields=["organization", "document"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "document"],
                condition=~models.Q(document=""),
                name="finance_supplier_unique_document_per_org",
            ),
        ]

    def __str__(self):
        return self.name


class Payable(TimestampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        PAID = "paid", "Pago"
        CANCELED = "canceled", "Cancelado"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="payables",
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    due_date = models.DateField()
    paid_at = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    category = models.CharField(max_length=30, choices=ExpenseCategory.choices)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="payables",
        null=True,
        blank=True,
    )
    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        blank=True,
    )
    notes = models.TextField(blank=True)
    recurrence = models.CharField(
        max_length=20,
        choices=RecurrenceFrequency.choices,
        default=RecurrenceFrequency.NONE,
    )
    recurrence_group = models.UUIDField(null=True, blank=True, db_index=True)
    recurrence_indefinite = models.BooleanField(default=False)
    recurrence_sequence = models.PositiveSmallIntegerField(default=1)
    recurrence_total = models.PositiveSmallIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_payables",
        null=True,
    )

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [
            models.Index(fields=["organization", "status", "due_date"]),
            models.Index(fields=["organization", "category"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="finance_payable_amount_positive",
            ),
        ]

    @property
    def effective_status(self):
        if self.status == self.Status.PENDING and self.due_date < timezone.localdate():
            return "overdue"
        return self.status

    def __str__(self):
        return self.description


class Receivable(TimestampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        RECEIVED = "received", "Recebido"
        CANCELED = "canceled", "Cancelado"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="receivables",
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    due_date = models.DateField()
    received_at = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    category = models.CharField(max_length=30, choices=RevenueCategory.choices)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="receivables",
        null=True,
        blank=True,
    )
    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        blank=True,
    )
    notes = models.TextField(blank=True)
    recurrence = models.CharField(
        max_length=20,
        choices=RecurrenceFrequency.choices,
        default=RecurrenceFrequency.NONE,
    )
    recurrence_group = models.UUIDField(null=True, blank=True, db_index=True)
    recurrence_indefinite = models.BooleanField(default=False)
    recurrence_sequence = models.PositiveSmallIntegerField(default=1)
    recurrence_total = models.PositiveSmallIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_receivables",
        null=True,
    )

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [
            models.Index(fields=["organization", "status", "due_date"]),
            models.Index(fields=["organization", "category"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="finance_receivable_amount_positive",
            ),
        ]

    @property
    def effective_status(self):
        if self.status == self.Status.PENDING and self.due_date < timezone.localdate():
            return "overdue"
        return self.status

    def __str__(self):
        return self.description


class Revenue(TimestampedUUIDModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="revenues",
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    occurred_on = models.DateField()
    category = models.CharField(max_length=30, choices=RevenueCategory.choices)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        related_name="revenues",
        null=True,
        blank=True,
    )
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices)
    notes = models.TextField(blank=True)
    source_receivable = models.OneToOneField(
        Receivable,
        on_delete=models.PROTECT,
        related_name="generated_revenue",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_revenues",
        null=True,
    )

    class Meta:
        ordering = ["-occurred_on", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "occurred_on"]),
            models.Index(fields=["organization", "category"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="finance_revenue_amount_positive",
            ),
        ]

    def __str__(self):
        return self.description


class Expense(TimestampedUUIDModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    occurred_on = models.DateField()
    category = models.CharField(max_length=30, choices=ExpenseCategory.choices)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        related_name="expenses",
        null=True,
        blank=True,
    )
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices)
    notes = models.TextField(blank=True)
    source_payable = models.OneToOneField(
        Payable,
        on_delete=models.PROTECT,
        related_name="generated_expense",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_expenses",
        null=True,
    )

    class Meta:
        ordering = ["-occurred_on", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "occurred_on"]),
            models.Index(fields=["organization", "category"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="finance_expense_amount_positive",
            ),
        ]

    def __str__(self):
        return self.description
