from django.utils import timezone
from rest_framework import serializers

from apps.finance.models import (
    Customer,
    Expense,
    Payable,
    PaymentMethod,
    Receivable,
    RecurrenceFrequency,
    Revenue,
    Supplier,
)
from apps.finance.services import create_commitment_series


def validate_related_contact(serializer, contact, label):
    if contact is None:
        return None

    organization = serializer.context.get("organization")
    if organization is None and serializer.instance is not None:
        organization = serializer.instance.organization

    if (
        organization is None
        or contact.organization_id != organization.id
        or not contact.is_active
    ):
        raise serializers.ValidationError(
            f"{label} não encontrado para esta empresa."
        )
    return contact


class BusinessContactSerializer(serializers.ModelSerializer):
    organization_id = serializers.UUIDField(source="organization.id", read_only=True)
    document = serializers.CharField(required=False, allow_blank=True, max_length=18)

    class Meta:
        fields = (
            "id",
            "organization_id",
            "name",
            "document",
            "email",
            "phone",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "created_at",
            "updated_at",
        )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Informe um nome.")
        return value

    def validate_document(self, value):
        document = "".join(character for character in value if character.isdigit())
        if document and len(document) not in (11, 14):
            raise serializers.ValidationError("Informe um CPF ou CNPJ válido.")
        return document

    def validate(self, attrs):
        attrs = super().validate(attrs)
        document = attrs.get("document")
        organization = self.context.get("organization")
        if document and organization:
            queryset = self.Meta.model.objects.filter(
                organization=organization,
                document=document,
            )
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"document": "Já existe um cadastro com este CPF ou CNPJ."}
                )
        return attrs


class CustomerSerializer(BusinessContactSerializer):
    class Meta(BusinessContactSerializer.Meta):
        model = Customer


class SupplierSerializer(BusinessContactSerializer):
    class Meta(BusinessContactSerializer.Meta):
        model = Supplier


class RealizedMovementSerializer(serializers.ModelSerializer):
    organization_id = serializers.UUIDField(source="organization.id", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    payment_method_label = serializers.CharField(
        source="get_payment_method_display",
        read_only=True,
    )

    def validate_occurred_on(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "A data do lançamento não pode estar no futuro."
            )
        return value


class RevenueSerializer(RealizedMovementSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.all(),
        required=False,
        allow_null=True,
    )
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    source_receivable_id = serializers.UUIDField(read_only=True)
    is_recurring = serializers.SerializerMethodField()
    recurrence_label = serializers.SerializerMethodField()

    class Meta:
        model = Revenue
        fields = (
            "id",
            "organization_id",
            "description",
            "amount",
            "occurred_on",
            "category",
            "category_label",
            "customer_id",
            "customer_name",
            "payment_method",
            "payment_method_label",
            "notes",
            "source_receivable_id",
            "is_recurring",
            "recurrence_label",
            "created_at",
            "updated_at",
        )

    def validate_customer_id(self, value):
        return validate_related_contact(self, value, "Cliente")
        read_only_fields = (
            "id",
            "organization_id",
            "source_receivable_id",
            "created_at",
            "updated_at",
        )

    def get_is_recurring(self, obj):
        return bool(
            obj.source_receivable_id
            and obj.source_receivable.recurrence != RecurrenceFrequency.NONE
        )

    def get_recurrence_label(self, obj):
        if self.get_is_recurring(obj):
            return obj.source_receivable.get_recurrence_display()
        return "Lançamento simples"


class ExpenseSerializer(RealizedMovementSerializer):
    supplier_id = serializers.PrimaryKeyRelatedField(
        source="supplier",
        queryset=Supplier.objects.all(),
        required=False,
        allow_null=True,
    )
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    source_payable_id = serializers.UUIDField(read_only=True)
    is_recurring = serializers.SerializerMethodField()
    recurrence_label = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = (
            "id",
            "organization_id",
            "description",
            "amount",
            "occurred_on",
            "category",
            "category_label",
            "supplier_id",
            "supplier_name",
            "payment_method",
            "payment_method_label",
            "notes",
            "source_payable_id",
            "is_recurring",
            "recurrence_label",
            "created_at",
            "updated_at",
        )

    def validate_supplier_id(self, value):
        return validate_related_contact(self, value, "Fornecedor")
        read_only_fields = (
            "id",
            "organization_id",
            "source_payable_id",
            "created_at",
            "updated_at",
        )

    def get_is_recurring(self, obj):
        return bool(
            obj.source_payable_id
            and obj.source_payable.recurrence != RecurrenceFrequency.NONE
        )

    def get_recurrence_label(self, obj):
        if self.get_is_recurring(obj):
            return obj.source_payable.get_recurrence_display()
        return "Lançamento simples"


class CommitmentSerializer(serializers.ModelSerializer):
    occurrences = serializers.IntegerField(
        write_only=True,
        required=False,
        default=1,
        min_value=1,
        max_value=60,
    )
    organization_id = serializers.UUIDField(source="organization.id", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    recurrence_label = serializers.CharField(
        source="get_recurrence_display",
        read_only=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    effective_status = serializers.CharField(read_only=True)
    effective_status_label = serializers.SerializerMethodField()
    payment_method_label = serializers.CharField(
        source="get_payment_method_display",
        read_only=True,
    )

    def get_effective_status_label(self, obj):
        if obj.effective_status == "overdue":
            return "Vencido"
        return obj.get_status_display()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        recurrence = attrs.get("recurrence", RecurrenceFrequency.NONE)
        occurrences = attrs.get("occurrences", 1)
        is_indefinite = attrs.get("recurrence_indefinite", False)

        if recurrence == RecurrenceFrequency.NONE and is_indefinite:
            raise serializers.ValidationError(
                {"recurrence_indefinite": "Escolha uma periodicidade para usar uma série sem data final."}
            )
        if recurrence == RecurrenceFrequency.NONE and occurrences != 1:
            raise serializers.ValidationError(
                {"occurrences": "Um lançamento avulso deve ter uma ocorrência."}
            )
        if is_indefinite and attrs["due_date"] < timezone.localdate():
            raise serializers.ValidationError(
                {"due_date": "Uma recorrência sem data final deve começar hoje ou no futuro."}
            )
        if (
            recurrence != RecurrenceFrequency.NONE
            and not is_indefinite
            and occurrences < 2
        ):
            raise serializers.ValidationError(
                {"occurrences": "Informe ao menos duas ocorrências para a recorrência."}
            )

        return attrs

    def create(self, validated_data):
        occurrences = validated_data.pop("occurrences", 1)
        return create_commitment_series(
            model=self.Meta.model,
            validated_data=validated_data,
            occurrences=occurrences,
        )


class PayableSerializer(CommitmentSerializer):
    supplier_id = serializers.PrimaryKeyRelatedField(
        source="supplier",
        queryset=Supplier.objects.all(),
        required=False,
        allow_null=True,
    )
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    settled_movement_id = serializers.SerializerMethodField()

    class Meta:
        model = Payable
        fields = (
            "id",
            "organization_id",
            "description",
            "amount",
            "due_date",
            "paid_at",
            "status",
            "status_label",
            "effective_status",
            "effective_status_label",
            "category",
            "category_label",
            "supplier_id",
            "supplier_name",
            "payment_method",
            "payment_method_label",
            "notes",
            "recurrence",
            "recurrence_label",
            "recurrence_group",
            "recurrence_indefinite",
            "recurrence_sequence",
            "recurrence_total",
            "occurrences",
            "settled_movement_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "paid_at",
            "status",
            "payment_method",
            "recurrence_group",
            "recurrence_sequence",
            "recurrence_total",
            "settled_movement_id",
            "created_at",
            "updated_at",
        )

    def validate_supplier_id(self, value):
        return validate_related_contact(self, value, "Fornecedor")

    def get_settled_movement_id(self, obj):
        try:
            return obj.generated_expense.id
        except Expense.DoesNotExist:
            return None


class ReceivableSerializer(CommitmentSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.all(),
        required=False,
        allow_null=True,
    )
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    settled_movement_id = serializers.SerializerMethodField()

    class Meta:
        model = Receivable
        fields = (
            "id",
            "organization_id",
            "description",
            "amount",
            "due_date",
            "received_at",
            "status",
            "status_label",
            "effective_status",
            "effective_status_label",
            "category",
            "category_label",
            "customer_id",
            "customer_name",
            "payment_method",
            "payment_method_label",
            "notes",
            "recurrence",
            "recurrence_label",
            "recurrence_group",
            "recurrence_indefinite",
            "recurrence_sequence",
            "recurrence_total",
            "occurrences",
            "settled_movement_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "received_at",
            "status",
            "payment_method",
            "recurrence_group",
            "recurrence_sequence",
            "recurrence_total",
            "settled_movement_id",
            "created_at",
            "updated_at",
        )

    def validate_customer_id(self, value):
        return validate_related_contact(self, value, "Cliente")

    def get_settled_movement_id(self, obj):
        try:
            return obj.generated_revenue.id
        except Revenue.DoesNotExist:
            return None


class OrganizationSelectionSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()


class SettlementSerializer(serializers.Serializer):
    date = serializers.DateField()
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("A data da baixa não pode estar no futuro.")
        return value
