from datetime import date, datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.chatbot.models import PendingAction
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
from apps.finance.serializers import (
    CustomerSerializer,
    ExpenseSerializer,
    PayableSerializer,
    ReceivableSerializer,
    RevenueSerializer,
    SupplierSerializer,
)
from apps.finance.services import (
    delete_movement_and_reopen_commitment,
    sync_source_commitment_from_movement,
)


class PendingActionError(Exception):
    pass


ENTITY_CONFIG = {
    PendingAction.EntityType.PAYABLE: (Payable, PayableSerializer),
    PendingAction.EntityType.RECEIVABLE: (Receivable, ReceivableSerializer),
    PendingAction.EntityType.REVENUE: (Revenue, RevenueSerializer),
    PendingAction.EntityType.EXPENSE: (Expense, ExpenseSerializer),
    PendingAction.EntityType.CUSTOMER: (Customer, CustomerSerializer),
    PendingAction.EntityType.SUPPLIER: (Supplier, SupplierSerializer),
}

FIELD_LABELS = {
    "name": "Nome",
    "description": "Descrição",
    "amount": "Valor",
    "due_date": "Vencimento",
    "occurred_on": "Data",
    "category": "Categoria",
    "payment_method": "Forma de pagamento",
    "supplier_id": "Fornecedor",
    "customer_id": "Cliente",
    "document": "CPF/CNPJ",
    "email": "E-mail",
    "phone": "Telefone",
    "notes": "Observações",
    "recurrence": "Periodicidade",
    "recurrence_indefinite": "Sem data final",
    "occurrences": "Ocorrências",
}


def validation_message(error):
    detail = getattr(error, "detail", None)
    if isinstance(detail, dict):
        first_value = next(iter(detail.values()), None)
        if isinstance(first_value, (list, tuple)) and first_value:
            return str(first_value[0])
        if first_value is not None:
            return str(first_value)
    if isinstance(detail, (list, tuple)) and detail:
        return str(detail[0])
    return str(error)


def json_value(value):
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "pk"):
        return str(value.pk)
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return value


def canonical_payload(validated_data):
    payload = {}
    for key, value in validated_data.items():
        output_key = f"{key}_id" if key in {"customer", "supplier"} else key
        payload[output_key] = json_value(value)
    return payload


def get_target(*, entity_type, organization, target_id, for_update=False):
    model, _ = ENTITY_CONFIG[entity_type]
    queryset = model.objects.filter(organization=organization)
    if for_update:
        queryset = queryset.select_for_update()
    target = queryset.filter(id=target_id).first()
    if target is None:
        raise PendingActionError("O registro escolhido não foi encontrado nesta empresa.")
    return target


def ensure_target_can_change(target, entity_type):
    if entity_type in {
        PendingAction.EntityType.PAYABLE,
        PendingAction.EntityType.RECEIVABLE,
    } and target.status != target.Status.PENDING:
        raise PendingActionError(
            "Somente compromissos pendentes podem ser editados ou excluídos."
        )
    if entity_type in {
        PendingAction.EntityType.CUSTOMER,
        PendingAction.EntityType.SUPPLIER,
    } and not target.is_active:
        raise PendingActionError("Este cadastro já está inativo.")


def target_snapshot(target, entity_type):
    if entity_type in {
        PendingAction.EntityType.CUSTOMER,
        PendingAction.EntityType.SUPPLIER,
    }:
        return {
            "name": target.name,
            "document": target.document,
            "email": target.email,
            "phone": target.phone,
            "notes": target.notes,
        }

    snapshot = {
        "description": target.description,
        "amount": f"{target.amount:.2f}",
        "category": target.category,
        "notes": target.notes,
    }
    if entity_type in {
        PendingAction.EntityType.PAYABLE,
        PendingAction.EntityType.RECEIVABLE,
    }:
        snapshot["due_date"] = target.due_date.isoformat()
        snapshot["recurrence"] = target.recurrence
    else:
        snapshot["occurred_on"] = target.occurred_on.isoformat()
        snapshot["payment_method"] = target.payment_method

    if entity_type in {
        PendingAction.EntityType.PAYABLE,
        PendingAction.EntityType.EXPENSE,
    }:
        snapshot["supplier_id"] = str(target.supplier_id) if target.supplier_id else None
    else:
        snapshot["customer_id"] = str(target.customer_id) if target.customer_id else None
    return snapshot


def choice_label(entity_type, field, value):
    if field == "payment_method":
        return dict(PaymentMethod.choices).get(value, value)
    if field == "recurrence":
        return dict(RecurrenceFrequency.choices).get(value, value)
    if field == "category":
        model, _ = ENTITY_CONFIG[entity_type]
        return dict(model._meta.get_field("category").choices).get(value, value)
    return value


def display_value(*, entity_type, field, value, organization):
    if value in (None, ""):
        return "Não informado"
    if field == "amount":
        return f"R$ {Decimal(str(value)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if field in {"due_date", "occurred_on"}:
        parsed = date.fromisoformat(str(value))
        return parsed.strftime("%d/%m/%Y")
    if field in {"category", "payment_method", "recurrence"}:
        return str(choice_label(entity_type, field, value))
    if field in {"customer_id", "supplier_id"}:
        model = Customer if field == "customer_id" else Supplier
        contact = model.objects.filter(organization=organization, id=value).first()
        return contact.name if contact else "Outros (sem vínculo)"
    if field == "recurrence_indefinite":
        return "Sim" if value else "Não"
    return str(value)


def build_summary(
    *,
    action_type,
    entity_type,
    payload,
    organization,
    before=None,
):
    action_label = dict(PendingAction.ActionType.choices)[action_type]
    entity_label = dict(PendingAction.EntityType.choices)[entity_type]
    rows = []
    source = before if action_type == PendingAction.ActionType.DELETE else payload
    for field, value in source.items():
        if field not in FIELD_LABELS or field in {"recurrence_indefinite"} and not value:
            continue
        displayed = display_value(
            entity_type=entity_type,
            field=field,
            value=value,
            organization=organization,
        )
        if action_type == PendingAction.ActionType.UPDATE and before is not None:
            previous = display_value(
                entity_type=entity_type,
                field=field,
                value=before.get(field),
                organization=organization,
            )
            displayed = f"{previous} → {displayed}"
        rows.append({"label": FIELD_LABELS[field], "value": displayed})

    title = f"{action_label} {entity_label.lower()}"
    compact = "; ".join(f"{row['label']}: {row['value']}" for row in rows)
    return {
        "title": title,
        "rows": rows,
        "edit_prompt": f"Quero substituir a proposta de {title.lower()} ({compact}). Novos ajustes:",
    }


def create_pending_action(
    *,
    organization,
    user,
    conversation,
    action_type,
    entity_type,
    payload=None,
    target=None,
    collector=None,
):
    payload = payload or {}
    before = target_snapshot(target, entity_type) if target is not None else None
    summary = build_summary(
        action_type=action_type,
        entity_type=entity_type,
        payload=payload,
        organization=organization,
        before=before,
    )
    duplicate = next(
        (
            item
            for item in collector or []
            if item.action_type == action_type
            and item.entity_type == entity_type
            and item.target_id == (target.id if target else None)
            and item.payload == payload
        ),
        None,
    )
    if duplicate:
        return duplicate

    action = PendingAction.objects.create(
        organization=organization,
        user=user,
        conversation=conversation,
        action_type=action_type,
        entity_type=entity_type,
        target_id=target.id if target else None,
        target_version=target.updated_at if target else None,
        payload=payload,
        summary=summary,
        expires_at=timezone.now()
        + timedelta(minutes=settings.CHATBOT_ACTION_EXPIRATION_MINUTES),
    )
    if collector is not None:
        collector.append(action)
    return action


def validate_create_payload(*, entity_type, payload, organization):
    _, serializer_class = ENTITY_CONFIG[entity_type]
    serializer = serializer_class(
        data=payload,
        context={"organization": organization},
    )
    serializer.is_valid(raise_exception=True)
    return canonical_payload(serializer.validated_data)


def validate_update_payload(*, entity_type, target, payload, organization):
    ensure_target_can_change(target, entity_type)
    _, serializer_class = ENTITY_CONFIG[entity_type]
    serializer = serializer_class(
        target,
        data=payload,
        partial=True,
        context={"organization": organization},
    )
    serializer.is_valid(raise_exception=True)
    return canonical_payload(serializer.validated_data)


def action_tool_result(action):
    return {
        "status": "aguardando_confirmacao",
        "acao_id": str(action.id),
        "titulo": action.summary.get("title"),
        "resumo": action.summary.get("rows", []),
        "instrucao": (
            "A proposta foi preparada, mas ainda não foi executada. "
            "Peça ao usuário para revisar o card e tocar em Confirmar."
        ),
    }


def _execute_action(action):
    entity_type = action.entity_type
    _, serializer_class = ENTITY_CONFIG[entity_type]

    if action.action_type == PendingAction.ActionType.CREATE:
        serializer = serializer_class(
            data=action.payload,
            context={"organization": action.organization},
        )
        serializer.is_valid(raise_exception=True)
        target = serializer.save(
            organization=action.organization,
            created_by=action.user,
        )
        target_id = target.id
    else:
        target = get_target(
            entity_type=entity_type,
            organization=action.organization,
            target_id=action.target_id,
            for_update=True,
        )
        ensure_target_can_change(target, entity_type)
        if action.target_version and target.updated_at != action.target_version:
            raise PendingActionError(
                "O registro mudou depois da proposta. Solicite uma nova ação pelo chat."
            )
        target_id = target.id

        if action.action_type == PendingAction.ActionType.UPDATE:
            serializer = serializer_class(
                target,
                data=action.payload,
                partial=True,
                context={"organization": action.organization},
            )
            serializer.is_valid(raise_exception=True)
            target = serializer.save()
            if entity_type in {
                PendingAction.EntityType.REVENUE,
                PendingAction.EntityType.EXPENSE,
            }:
                sync_source_commitment_from_movement(target)
        elif entity_type in {
            PendingAction.EntityType.PAYABLE,
            PendingAction.EntityType.RECEIVABLE,
        }:
            target.status = target.Status.CANCELED
            target.save(update_fields=["status", "updated_at"])
        elif entity_type in {
            PendingAction.EntityType.CUSTOMER,
            PendingAction.EntityType.SUPPLIER,
        }:
            target.is_active = False
            target.save(update_fields=["is_active", "updated_at"])
        else:
            delete_movement_and_reopen_commitment(target)

    entity_label = dict(PendingAction.EntityType.choices)[entity_type]
    action_label = {
        PendingAction.ActionType.CREATE: "Criação",
        PendingAction.ActionType.UPDATE: "Edição",
        PendingAction.ActionType.DELETE: "Remoção",
    }[action.action_type]
    return {
        "entity_id": str(target_id),
        "entity_type": entity_type,
        "message": f"{action_label} de {entity_label.lower()} concluída.",
    }


def confirm_pending_action(*, action, user):
    failure_message = None
    expired = False
    confirmed_action = None

    with transaction.atomic():
        locked = PendingAction.objects.select_for_update().get(
            id=action.id,
            user=user,
            organization=action.organization,
        )
        if locked.status == PendingAction.Status.CONFIRMED:
            return locked
        if locked.effective_status == PendingAction.Status.EXPIRED:
            locked.status = PendingAction.Status.EXPIRED
            locked.resolved_at = timezone.now()
            locked.save(update_fields=["status", "resolved_at", "updated_at"])
            expired = True
        elif locked.status != PendingAction.Status.PENDING:
            raise PendingActionError("Esta proposta não está mais disponível.")
        else:
            try:
                with transaction.atomic():
                    result = _execute_action(locked)
            except (PendingActionError, ValidationError, IntegrityError) as error:
                failure_message = validation_message(error)
                locked.status = PendingAction.Status.FAILED
                locked.error_message = failure_message
                locked.resolved_at = timezone.now()
                locked.save(
                    update_fields=[
                        "status",
                        "error_message",
                        "resolved_at",
                        "updated_at",
                    ]
                )
            else:
                locked.status = PendingAction.Status.CONFIRMED
                locked.result = result
                locked.resolved_at = timezone.now()
                locked.save(
                    update_fields=[
                        "status",
                        "result",
                        "resolved_at",
                        "updated_at",
                    ]
                )
                confirmed_action = locked

    if expired:
        raise PendingActionError("Esta proposta expirou. Solicite uma nova pelo chat.")
    if failure_message:
        raise PendingActionError(failure_message)
    return confirmed_action


def cancel_pending_action(*, action, user):
    with transaction.atomic():
        locked = PendingAction.objects.select_for_update().get(
            id=action.id,
            user=user,
            organization=action.organization,
        )
        if locked.status == PendingAction.Status.CANCELED:
            return locked
        if locked.status != PendingAction.Status.PENDING:
            raise PendingActionError("Esta proposta não pode mais ser cancelada.")
        locked.status = PendingAction.Status.CANCELED
        locked.resolved_at = timezone.now()
        locked.save(update_fields=["status", "resolved_at", "updated_at"])
        return locked
