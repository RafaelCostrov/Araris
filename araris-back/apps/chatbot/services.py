import logging
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from rest_framework.exceptions import ValidationError

from apps.chatbot.actions import (
    PendingActionError,
    action_tool_result,
    create_pending_action,
    get_target,
    validate_create_payload,
    validate_update_payload,
    validation_message,
)
from apps.chatbot.models import ChatMessage, PendingAction
from apps.finance.models import (
    Customer,
    Expense,
    ExpenseCategory,
    Payable,
    PaymentMethod,
    Receivable,
    RecurrenceFrequency,
    Revenue,
    RevenueCategory,
    Supplier,
)
from apps.finance.services import build_cash_flow_forecast


logger = logging.getLogger(__name__)


class ChatbotConfigurationError(Exception):
    pass


class ChatbotProviderError(Exception):
    pass


@dataclass
class FinancialReply:
    content: str
    pending_action_ids: list[str]
    provider: str = "gemini"
    model: str = ""


def money(value):
    return f"{Decimal(value or 0):.2f}"


def month_bounds(value=""):
    if not value:
        month_start = timezone.localdate().replace(day=1)
    else:
        try:
            month_start = date.fromisoformat(f"{value}-01")
        except (TypeError, ValueError):
            return None

    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)
    return month_start, next_month


def aggregate_amount(queryset):
    return queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0")


def normalize_key(value):
    normalized = unicodedata.normalize("NFD", str(value or ""))
    return "".join(
        character for character in normalized if unicodedata.category(character) != "Mn"
    ).strip().lower()


def normalize_choice(value, choices, aliases=None):
    normalized = normalize_key(value)
    aliases = aliases or {}
    if normalized in aliases:
        return aliases[normalized]
    for code, label in choices:
        if normalized in {normalize_key(code), normalize_key(label)}:
            return code
    raise PendingActionError(f"Valor inválido: {value}.")


def normalize_amount(value):
    text = str(value or "").replace("R$", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        amount = Decimal(text)
    except Exception as error:
        raise PendingActionError("Informe um valor monetário válido.") from error
    if amount <= 0:
        raise PendingActionError("O valor deve ser maior que zero.")
    return f"{amount:.2f}"


ENTITY_ALIASES = {
    "conta a pagar": PendingAction.EntityType.PAYABLE,
    "pagar": PendingAction.EntityType.PAYABLE,
    "payable": PendingAction.EntityType.PAYABLE,
    "conta a receber": PendingAction.EntityType.RECEIVABLE,
    "receber": PendingAction.EntityType.RECEIVABLE,
    "receivable": PendingAction.EntityType.RECEIVABLE,
    "entrada": PendingAction.EntityType.REVENUE,
    "receita": PendingAction.EntityType.REVENUE,
    "revenue": PendingAction.EntityType.REVENUE,
    "saida": PendingAction.EntityType.EXPENSE,
    "despesa": PendingAction.EntityType.EXPENSE,
    "expense": PendingAction.EntityType.EXPENSE,
    "cliente": PendingAction.EntityType.CUSTOMER,
    "customer": PendingAction.EntityType.CUSTOMER,
    "fornecedor": PendingAction.EntityType.SUPPLIER,
    "supplier": PendingAction.EntityType.SUPPLIER,
}


def normalize_entity_type(value):
    entity_type = ENTITY_ALIASES.get(normalize_key(value))
    if entity_type is None:
        raise PendingActionError(
            "Tipo inválido. Use conta a pagar, conta a receber, entrada, saída, cliente ou fornecedor."
        )
    return entity_type


def build_financial_tools(
    organization,
    user=None,
    conversation=None,
    action_collector=None,
):
    @tool
    def consultar_resumo_financeiro(mes: str = "") -> dict:
        """Consulta saldos, entradas, saídas e compromissos de um mês. Use mes no formato AAAA-MM ou vazio para o mês atual."""
        bounds = month_bounds(mes)
        if bounds is None:
            return {"erro": "Mês inválido. Use o formato AAAA-MM."}

        month_start, next_month = bounds
        today = timezone.localdate()
        revenues = Revenue.objects.filter(organization=organization)
        expenses = Expense.objects.filter(organization=organization)
        payables = Payable.objects.filter(
            organization=organization,
            status=Payable.Status.PENDING,
        )
        receivables = Receivable.objects.filter(
            organization=organization,
            status=Receivable.Status.PENDING,
        )

        month_revenue = aggregate_amount(
            revenues.filter(occurred_on__gte=month_start, occurred_on__lt=next_month)
        )
        month_expense = aggregate_amount(
            expenses.filter(occurred_on__gte=month_start, occurred_on__lt=next_month)
        )
        previous_revenue = aggregate_amount(
            revenues.filter(occurred_on__lt=month_start)
        )
        previous_expense = aggregate_amount(
            expenses.filter(occurred_on__lt=month_start)
        )
        opening_balance = (
            organization.initial_balance + previous_revenue - previous_expense
        )
        period_payables = payables.filter(
            due_date__gte=month_start,
            due_date__lt=next_month,
        )
        period_receivables = receivables.filter(
            due_date__gte=month_start,
            due_date__lt=next_month,
        )

        return {
            "periodo": month_start.strftime("%Y-%m"),
            "saldo_inicial": money(opening_balance),
            "entradas_realizadas": money(month_revenue),
            "saidas_realizadas": money(month_expense),
            "saldo_realizado_do_mes": money(month_revenue - month_expense),
            "saldo_final_do_mes": money(
                opening_balance + month_revenue - month_expense
            ),
            "a_pagar_no_mes": money(aggregate_amount(period_payables)),
            "a_receber_no_mes": money(aggregate_amount(period_receivables)),
            "quantidade_a_pagar_no_mes": period_payables.count(),
            "quantidade_a_receber_no_mes": period_receivables.count(),
            "a_pagar_vencido": money(
                aggregate_amount(payables.filter(due_date__lt=today))
            ),
            "a_receber_vencido": money(
                aggregate_amount(receivables.filter(due_date__lt=today))
            ),
        }

    @tool
    def consultar_compromissos(
        tipo: str = "todos",
        situacao: str = "todos",
        dias: int = 30,
    ) -> dict:
        """Lista contas a pagar e a receber. tipo: todos, pagar ou receber. situacao: todos, pendentes ou vencidos. dias define o horizonte futuro."""
        if tipo not in {"todos", "pagar", "receber"}:
            return {"erro": "Tipo inválido. Use todos, pagar ou receber."}
        if situacao not in {"todos", "pendentes", "vencidos"}:
            return {"erro": "Situação inválida. Use todos, pendentes ou vencidos."}

        try:
            horizon_days = max(1, min(int(dias), 365))
        except (TypeError, ValueError):
            horizon_days = 30

        today = timezone.localdate()
        end_date = today + timedelta(days=horizon_days)
        items = []

        def add_items(queryset, item_type):
            queryset = queryset.filter(status="pending")
            if situacao == "vencidos":
                queryset = queryset.filter(due_date__lt=today)
            elif situacao == "pendentes":
                queryset = queryset.filter(
                    due_date__gte=today,
                    due_date__lte=end_date,
                )
            else:
                queryset = queryset.filter(due_date__lte=end_date)

            relation = "supplier" if item_type == "conta_a_pagar" else "customer"
            for commitment in queryset.select_related(relation).order_by(
                "due_date", "created_at"
            )[:20]:
                items.append(
                    {
                        "id": str(commitment.id),
                        "tipo": item_type,
                        "descricao": commitment.description,
                        "valor": money(commitment.amount),
                        "vencimento": commitment.due_date.isoformat(),
                        "situacao": (
                            "vencido" if commitment.due_date < today else "pendente"
                        ),
                        "categoria": commitment.get_category_display(),
                        "periodicidade": commitment.get_recurrence_display(),
                        (
                            "fornecedor"
                            if item_type == "conta_a_pagar"
                            else "cliente"
                        ): getattr(commitment, relation).name
                        if getattr(commitment, relation)
                        else "Outros (sem vínculo)",
                    }
                )

        if tipo in {"todos", "pagar"}:
            add_items(
                Payable.objects.filter(organization=organization),
                "conta_a_pagar",
            )
        if tipo in {"todos", "receber"}:
            add_items(
                Receivable.objects.filter(organization=organization),
                "conta_a_receber",
            )

        items.sort(key=lambda item: (item["vencimento"], item["tipo"]))
        items = items[:20]
        return {
            "data_de_referencia": today.isoformat(),
            "horizonte_em_dias": horizon_days,
            "quantidade": len(items),
            "valor_total": money(sum(Decimal(item["valor"]) for item in items)),
            "compromissos": items,
        }

    @tool
    def consultar_projecao_de_caixa(dias: int = 30) -> dict:
        """Consulta o saldo projetado usando o saldo atual e as contas pendentes dos próximos dias. O intervalo permitido é de 7 a 60 dias."""
        try:
            forecast_days = max(7, min(int(dias), 60))
        except (TypeError, ValueError):
            forecast_days = 30

        forecast = build_cash_flow_forecast(
            organization=organization,
            start_date=timezone.localdate(),
            days=forecast_days,
        )
        impacts = []
        for item in forecast["upcoming_impacts"]:
            impacts.append(
                {
                    "tipo": item["type"],
                    "descricao": item["description"],
                    "valor": item["amount"],
                    "vencimento": item["due_date"].isoformat(),
                    "situacao": item["effective_status"],
                    "cliente_ou_fornecedor": item.get("counterparty_name")
                    or "Outros (sem vínculo)",
                }
            )

        return {
            "inicio": forecast["start_date"].isoformat(),
            "fim": forecast["end_date"].isoformat(),
            "saldo_atual": forecast["current_balance"],
            "saldo_projetado": forecast["projected_balance"],
            "menor_saldo": forecast["lowest_balance"],
            "data_do_menor_saldo": forecast["lowest_balance_date"].isoformat(),
            "ha_previsao_de_saldo_negativo": forecast["has_deficit"],
            "total_a_pagar": forecast["total_payables"],
            "total_a_receber": forecast["total_receivables"],
            "proximos_impactos": impacts,
        }

    @tool
    def consultar_despesas_por_categoria(mes: str = "") -> dict:
        """Mostra as despesas realizadas agrupadas por categoria em um mês. Use mes no formato AAAA-MM ou vazio para o mês atual."""
        bounds = month_bounds(mes)
        if bounds is None:
            return {"erro": "Mês inválido. Use o formato AAAA-MM."}

        month_start, next_month = bounds
        rows = (
            Expense.objects.filter(
                organization=organization,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            )
            .values("category")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        labels = dict(Expense._meta.get_field("category").choices)
        categories = [
            {
                "categoria": labels.get(row["category"], row["category"]),
                "valor": money(row["total"]),
            }
            for row in rows
        ]
        return {
            "periodo": month_start.strftime("%Y-%m"),
            "total": money(sum(Decimal(row["valor"]) for row in categories)),
            "categorias": categories,
        }

    @tool
    def consultar_lancamentos_recentes(limite: int = 10) -> dict:
        """Consulta as entradas e saídas já realizadas mais recentes."""
        try:
            item_limit = max(1, min(int(limite), 20))
        except (TypeError, ValueError):
            item_limit = 10

        items = []
        for revenue in Revenue.objects.filter(
            organization=organization
        ).select_related("customer").order_by("-occurred_on", "-created_at")[:item_limit]:
            items.append(
                {
                    "id": str(revenue.id),
                    "tipo": "entrada",
                    "descricao": revenue.description,
                    "valor": money(revenue.amount),
                    "data": revenue.occurred_on.isoformat(),
                    "categoria": revenue.get_category_display(),
                    "cliente": (
                        revenue.customer.name
                        if revenue.customer
                        else "Outros (sem vínculo)"
                    ),
                }
            )
        for expense in Expense.objects.filter(
            organization=organization
        ).select_related("supplier").order_by("-occurred_on", "-created_at")[:item_limit]:
            items.append(
                {
                    "id": str(expense.id),
                    "tipo": "saida",
                    "descricao": expense.description,
                    "valor": money(expense.amount),
                    "data": expense.occurred_on.isoformat(),
                    "categoria": expense.get_category_display(),
                    "fornecedor": (
                        expense.supplier.name
                        if expense.supplier
                        else "Outros (sem vínculo)"
                    ),
                }
            )

        items.sort(key=lambda item: item["data"], reverse=True)
        return {"lancamentos": items[:item_limit]}

    @tool
    def consultar_clientes_e_fornecedores(
        tipo: str = "todos",
        busca: str = "",
        limite: int = 20,
    ) -> dict:
        """Lista clientes e fornecedores ativos da empresa. tipo: todos, clientes ou fornecedores. busca filtra por nome, CPF/CNPJ, e-mail ou telefone."""
        if tipo not in {"todos", "clientes", "fornecedores"}:
            return {
                "erro": "Tipo inválido. Use todos, clientes ou fornecedores."
            }
        try:
            item_limit = max(1, min(int(limite), 50))
        except (TypeError, ValueError):
            item_limit = 20

        search = busca.strip()
        search_filter = Q()
        if search:
            search_filter = (
                Q(name__icontains=search)
                | Q(document__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )

        result = {"busca": search, "clientes": [], "fornecedores": []}
        if tipo in {"todos", "clientes"}:
            customers = Customer.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(search_filter)[:item_limit]
            result["clientes"] = [
                {
                    "id": str(customer.id),
                    "nome": customer.name,
                    "cpf_ou_cnpj": customer.document or None,
                    "email": customer.email or None,
                    "telefone": customer.phone or None,
                }
                for customer in customers
            ]
        if tipo in {"todos", "fornecedores"}:
            suppliers = Supplier.objects.filter(
                organization=organization,
                is_active=True,
            ).filter(search_filter)[:item_limit]
            result["fornecedores"] = [
                {
                    "id": str(supplier.id),
                    "nome": supplier.name,
                    "cpf_ou_cnpj": supplier.document or None,
                    "email": supplier.email or None,
                    "telefone": supplier.phone or None,
                }
                for supplier in suppliers
            ]
        result["quantidade_clientes"] = len(result["clientes"])
        result["quantidade_fornecedores"] = len(result["fornecedores"])
        return result

    @tool
    def consultar_atividades_por_contato(
        nome: str,
        mes: str = "",
        tipo: str = "todos",
        limite: int = 20,
    ) -> dict:
        """Consulta entradas, saídas e compromissos pendentes vinculados a um cliente ou fornecedor. nome é o nome ou parte do nome; tipo: todos, clientes ou fornecedores; mes usa AAAA-MM ou vazio para o mês atual."""
        if tipo not in {"todos", "clientes", "fornecedores"}:
            return {
                "erro": "Tipo inválido. Use todos, clientes ou fornecedores."
            }
        contact_name = nome.strip()
        if len(contact_name) < 2:
            return {"erro": "Informe ao menos dois caracteres do nome."}
        bounds = month_bounds(mes)
        if bounds is None:
            return {"erro": "Mês inválido. Use o formato AAAA-MM."}
        try:
            item_limit = max(1, min(int(limite), 50))
        except (TypeError, ValueError):
            item_limit = 20

        month_start, next_month = bounds
        items = []
        total_revenue = Decimal("0")
        total_expense = Decimal("0")
        total_receivable = Decimal("0")
        total_payable = Decimal("0")

        if tipo in {"todos", "clientes"}:
            revenues = Revenue.objects.filter(
                organization=organization,
                customer__name__icontains=contact_name,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            ).select_related("customer")
            total_revenue = aggregate_amount(revenues)
            for revenue in revenues.order_by("-occurred_on", "-created_at")[:item_limit]:
                items.append(
                    {
                        "id": str(revenue.id),
                        "tipo": "entrada_realizada",
                        "cliente_ou_fornecedor": revenue.customer.name,
                        "descricao": revenue.description,
                        "valor": money(revenue.amount),
                        "data": revenue.occurred_on.isoformat(),
                        "categoria": revenue.get_category_display(),
                    }
                )

            receivables = Receivable.objects.filter(
                organization=organization,
                customer__name__icontains=contact_name,
                status=Receivable.Status.PENDING,
                due_date__gte=month_start,
                due_date__lt=next_month,
            ).select_related("customer")
            total_receivable = aggregate_amount(receivables)
            for receivable in receivables.order_by("due_date", "created_at")[:item_limit]:
                items.append(
                    {
                        "id": str(receivable.id),
                        "tipo": "conta_a_receber_pendente",
                        "cliente_ou_fornecedor": receivable.customer.name,
                        "descricao": receivable.description,
                        "valor": money(receivable.amount),
                        "data": receivable.due_date.isoformat(),
                        "categoria": receivable.get_category_display(),
                    }
                )

        if tipo in {"todos", "fornecedores"}:
            expenses = Expense.objects.filter(
                organization=organization,
                supplier__name__icontains=contact_name,
                occurred_on__gte=month_start,
                occurred_on__lt=next_month,
            ).select_related("supplier")
            total_expense = aggregate_amount(expenses)
            for expense in expenses.order_by("-occurred_on", "-created_at")[:item_limit]:
                items.append(
                    {
                        "id": str(expense.id),
                        "tipo": "saida_realizada",
                        "cliente_ou_fornecedor": expense.supplier.name,
                        "descricao": expense.description,
                        "valor": money(expense.amount),
                        "data": expense.occurred_on.isoformat(),
                        "categoria": expense.get_category_display(),
                    }
                )

            payables = Payable.objects.filter(
                organization=organization,
                supplier__name__icontains=contact_name,
                status=Payable.Status.PENDING,
                due_date__gte=month_start,
                due_date__lt=next_month,
            ).select_related("supplier")
            total_payable = aggregate_amount(payables)
            for payable in payables.order_by("due_date", "created_at")[:item_limit]:
                items.append(
                    {
                        "id": str(payable.id),
                        "tipo": "conta_a_pagar_pendente",
                        "cliente_ou_fornecedor": payable.supplier.name,
                        "descricao": payable.description,
                        "valor": money(payable.amount),
                        "data": payable.due_date.isoformat(),
                        "categoria": payable.get_category_display(),
                    }
                )

        items.sort(key=lambda item: (item["data"], item["tipo"]), reverse=True)
        return {
            "periodo": month_start.strftime("%Y-%m"),
            "busca": contact_name,
            "quantidade": min(len(items), item_limit),
            "totais": {
                "entradas_realizadas": money(total_revenue),
                "saidas_realizadas": money(total_expense),
                "a_receber_pendente": money(total_receivable),
                "a_pagar_pendente": money(total_payable),
            },
            "atividades": items[:item_limit],
        }

    read_tools = [
        consultar_resumo_financeiro,
        consultar_compromissos,
        consultar_projecao_de_caixa,
        consultar_despesas_por_categoria,
        consultar_lancamentos_recentes,
        consultar_clientes_e_fornecedores,
        consultar_atividades_por_contato,
    ]

    if user is None or conversation is None:
        return read_tools

    collector = action_collector if action_collector is not None else []

    def resolve_contact(entity_type, reference):
        reference = str(reference or "").strip()
        if not reference:
            return None
        model = (
            Supplier
            if entity_type
            in {PendingAction.EntityType.PAYABLE, PendingAction.EntityType.EXPENSE}
            else Customer
        )
        queryset = model.objects.filter(organization=organization, is_active=True)
        try:
            contact = queryset.filter(id=UUID(reference)).first()
        except (TypeError, ValueError):
            contact = None
        if contact:
            return contact

        exact = list(queryset.filter(name__iexact=reference)[:2])
        if len(exact) == 1:
            return exact[0]
        matches = list(queryset.filter(name__icontains=reference)[:6])
        if len(matches) == 1:
            return matches[0]
        if not matches:
            raise PendingActionError(
                f"Nenhum cadastro ativo encontrado para '{reference}'."
            )
        options = ", ".join(f"{item.name} ({item.id})" for item in matches)
        raise PendingActionError(
            f"Há mais de um cadastro correspondente. Escolha pelo ID: {options}."
        )

    def prepare_create(entity_type, payload):
        canonical = validate_create_payload(
            entity_type=entity_type,
            payload=payload,
            organization=organization,
        )
        action = create_pending_action(
            organization=organization,
            user=user,
            conversation=conversation,
            action_type=PendingAction.ActionType.CREATE,
            entity_type=entity_type,
            payload=canonical,
            collector=collector,
        )
        return action_tool_result(action)

    @tool
    def buscar_registros_para_acao(
        tipo: str,
        busca: str = "",
        limite: int = 10,
    ) -> dict:
        """Busca registros e retorna IDs seguros para preparar edição ou exclusão. tipo: conta a pagar, conta a receber, entrada, saída, cliente ou fornecedor. Sempre use antes de editar ou excluir e nunca invente um ID."""
        try:
            entity_type = normalize_entity_type(tipo)
            item_limit = max(1, min(int(limite), 20))
            model = {
                PendingAction.EntityType.PAYABLE: Payable,
                PendingAction.EntityType.RECEIVABLE: Receivable,
                PendingAction.EntityType.REVENUE: Revenue,
                PendingAction.EntityType.EXPENSE: Expense,
                PendingAction.EntityType.CUSTOMER: Customer,
                PendingAction.EntityType.SUPPLIER: Supplier,
            }[entity_type]
            queryset = model.objects.filter(organization=organization)
            search = str(busca or "").strip()
            if entity_type in {
                PendingAction.EntityType.PAYABLE,
                PendingAction.EntityType.RECEIVABLE,
            }:
                queryset = queryset.filter(status="pending")
            elif entity_type in {
                PendingAction.EntityType.CUSTOMER,
                PendingAction.EntityType.SUPPLIER,
            }:
                queryset = queryset.filter(is_active=True)
            if search:
                if entity_type in {
                    PendingAction.EntityType.CUSTOMER,
                    PendingAction.EntityType.SUPPLIER,
                }:
                    queryset = queryset.filter(
                        Q(name__icontains=search)
                        | Q(document__icontains=search)
                        | Q(email__icontains=search)
                        | Q(phone__icontains=search)
                    )
                else:
                    relation = (
                        "supplier__name__icontains"
                        if entity_type
                        in {
                            PendingAction.EntityType.PAYABLE,
                            PendingAction.EntityType.EXPENSE,
                        }
                        else "customer__name__icontains"
                    )
                    queryset = queryset.filter(
                        Q(description__icontains=search) | Q(**{relation: search})
                    )

            results = []
            for item in queryset.order_by("-updated_at")[:item_limit]:
                if entity_type in {
                    PendingAction.EntityType.CUSTOMER,
                    PendingAction.EntityType.SUPPLIER,
                }:
                    results.append(
                        {
                            "id": str(item.id),
                            "tipo": entity_type,
                            "nome": item.name,
                            "documento": item.document or None,
                        }
                    )
                else:
                    item_date = getattr(item, "due_date", None) or item.occurred_on
                    results.append(
                        {
                            "id": str(item.id),
                            "tipo": entity_type,
                            "descricao": item.description,
                            "valor": money(item.amount),
                            "data": item_date.isoformat(),
                        }
                    )
            return {"tipo": entity_type, "quantidade": len(results), "registros": results}
        except (PendingActionError, TypeError, ValueError) as error:
            return {"erro": str(error)}

    @tool
    def preparar_criacao_lancamento(
        tipo: str,
        descricao: str,
        valor: str,
        data: str,
        categoria: str,
        forma_pagamento: str,
        cliente_ou_fornecedor: str = "",
        observacoes: str = "",
    ) -> dict:
        """Prepara, sem executar, uma entrada ou saída realizada para confirmação. tipo: entrada ou saída. data: AAAA-MM-DD. categoria e forma_pagamento podem usar o código ou rótulo em português. cliente_ou_fornecedor é nome ou ID opcional."""
        try:
            entity_type = normalize_entity_type(tipo)
            if entity_type not in {
                PendingAction.EntityType.REVENUE,
                PendingAction.EntityType.EXPENSE,
            }:
                raise PendingActionError("Use tipo entrada ou saída.")
            category_choices = (
                RevenueCategory.choices
                if entity_type == PendingAction.EntityType.REVENUE
                else ExpenseCategory.choices
            )
            contact = resolve_contact(entity_type, cliente_ou_fornecedor)
            payload = {
                "description": descricao.strip(),
                "amount": normalize_amount(valor),
                "occurred_on": data,
                "category": normalize_choice(categoria, category_choices),
                "payment_method": normalize_choice(
                    forma_pagamento,
                    PaymentMethod.choices,
                    {"transferencia": PaymentMethod.BANK_TRANSFER},
                ),
                "notes": observacoes.strip(),
                (
                    "customer_id"
                    if entity_type == PendingAction.EntityType.REVENUE
                    else "supplier_id"
                ): str(contact.id)
                if contact
                else None,
            }
            return prepare_create(entity_type, payload)
        except (PendingActionError, ValidationError) as error:
            return {"erro": validation_message(error)}

    @tool
    def preparar_criacao_compromisso(
        tipo: str,
        descricao: str,
        valor: str,
        vencimento: str,
        categoria: str,
        cliente_ou_fornecedor: str = "",
        periodicidade: str = "none",
        ocorrencias: int = 1,
        sem_data_final: bool = False,
        observacoes: str = "",
    ) -> dict:
        """Prepara, sem executar, uma conta a pagar ou receber para confirmação. tipo: conta a pagar ou conta a receber. vencimento: AAAA-MM-DD. periodicidade: none, weekly, fortnightly, monthly, bimonthly, quarterly, semiannual ou annual. Informe ocorrencias >= 2 quando recorrente, ou sem_data_final=true."""
        try:
            entity_type = normalize_entity_type(tipo)
            if entity_type not in {
                PendingAction.EntityType.PAYABLE,
                PendingAction.EntityType.RECEIVABLE,
            }:
                raise PendingActionError(
                    "Use tipo conta a pagar ou conta a receber."
                )
            category_choices = (
                ExpenseCategory.choices
                if entity_type == PendingAction.EntityType.PAYABLE
                else RevenueCategory.choices
            )
            recurrence = normalize_choice(
                periodicidade,
                RecurrenceFrequency.choices,
                {
                    "nao se repete": RecurrenceFrequency.NONE,
                    "quinzenal": RecurrenceFrequency.FORTNIGHTLY,
                },
            )
            contact = resolve_contact(entity_type, cliente_ou_fornecedor)
            payload = {
                "description": descricao.strip(),
                "amount": normalize_amount(valor),
                "due_date": vencimento,
                "category": normalize_choice(categoria, category_choices),
                "recurrence": recurrence,
                "recurrence_indefinite": sem_data_final,
                "occurrences": int(ocorrencias),
                "notes": observacoes.strip(),
                (
                    "supplier_id"
                    if entity_type == PendingAction.EntityType.PAYABLE
                    else "customer_id"
                ): str(contact.id)
                if contact
                else None,
            }
            return prepare_create(entity_type, payload)
        except (PendingActionError, ValidationError, TypeError, ValueError) as error:
            return {"erro": validation_message(error)}

    @tool
    def preparar_criacao_contato(
        tipo: str,
        nome: str,
        documento: str = "",
        email: str = "",
        telefone: str = "",
        observacoes: str = "",
    ) -> dict:
        """Prepara, sem executar, o cadastro de um cliente ou fornecedor para confirmação."""
        try:
            entity_type = normalize_entity_type(tipo)
            if entity_type not in {
                PendingAction.EntityType.CUSTOMER,
                PendingAction.EntityType.SUPPLIER,
            }:
                raise PendingActionError("Use tipo cliente ou fornecedor.")
            return prepare_create(
                entity_type,
                {
                    "name": nome.strip(),
                    "document": documento.strip(),
                    "email": email.strip(),
                    "phone": telefone.strip(),
                    "notes": observacoes.strip(),
                },
            )
        except (PendingActionError, ValidationError) as error:
            return {"erro": validation_message(error)}

    @tool
    def preparar_edicao_registro(
        tipo: str,
        registro_id: str,
        descricao_ou_nome: str = "",
        valor: str = "",
        data: str = "",
        categoria: str = "",
        forma_pagamento: str = "",
        cliente_ou_fornecedor: str = "",
        remover_cliente_ou_fornecedor: bool = False,
        documento: str = "",
        email: str = "",
        telefone: str = "",
        observacoes: str = "",
        limpar_observacoes: bool = False,
    ) -> dict:
        """Prepara, sem executar, a edição de um registro existente. Use um registro_id retornado por buscar_registros_para_acao. Envie somente os campos que mudam. data representa vencimento para compromissos e data realizada para entradas/saídas."""
        try:
            entity_type = normalize_entity_type(tipo)
            target = get_target(
                entity_type=entity_type,
                organization=organization,
                target_id=registro_id,
            )
            payload = {}
            if descricao_ou_nome.strip():
                payload[
                    "name"
                    if entity_type
                    in {
                        PendingAction.EntityType.CUSTOMER,
                        PendingAction.EntityType.SUPPLIER,
                    }
                    else "description"
                ] = descricao_ou_nome.strip()
            if entity_type in {
                PendingAction.EntityType.CUSTOMER,
                PendingAction.EntityType.SUPPLIER,
            }:
                if documento:
                    payload["document"] = documento
                if email:
                    payload["email"] = email
                if telefone:
                    payload["phone"] = telefone
            else:
                if valor:
                    payload["amount"] = normalize_amount(valor)
                if data:
                    payload[
                        "due_date"
                        if entity_type
                        in {
                            PendingAction.EntityType.PAYABLE,
                            PendingAction.EntityType.RECEIVABLE,
                        }
                        else "occurred_on"
                    ] = data
                if categoria:
                    category_choices = (
                        ExpenseCategory.choices
                        if entity_type
                        in {
                            PendingAction.EntityType.PAYABLE,
                            PendingAction.EntityType.EXPENSE,
                        }
                        else RevenueCategory.choices
                    )
                    payload["category"] = normalize_choice(
                        categoria,
                        category_choices,
                    )
                if forma_pagamento:
                    if entity_type in {
                        PendingAction.EntityType.PAYABLE,
                        PendingAction.EntityType.RECEIVABLE,
                    }:
                        raise PendingActionError(
                            "Forma de pagamento só pode ser editada em entradas e saídas realizadas."
                        )
                    payload["payment_method"] = normalize_choice(
                        forma_pagamento,
                        PaymentMethod.choices,
                    )
                if remover_cliente_ou_fornecedor:
                    payload[
                        "supplier_id"
                        if entity_type
                        in {
                            PendingAction.EntityType.PAYABLE,
                            PendingAction.EntityType.EXPENSE,
                        }
                        else "customer_id"
                    ] = None
                elif cliente_ou_fornecedor:
                    contact = resolve_contact(entity_type, cliente_ou_fornecedor)
                    payload[
                        "supplier_id"
                        if entity_type
                        in {
                            PendingAction.EntityType.PAYABLE,
                            PendingAction.EntityType.EXPENSE,
                        }
                        else "customer_id"
                    ] = str(contact.id)
            if observacoes or limpar_observacoes:
                payload["notes"] = "" if limpar_observacoes else observacoes.strip()
            if not payload:
                raise PendingActionError("Informe ao menos um campo para editar.")

            canonical = validate_update_payload(
                entity_type=entity_type,
                target=target,
                payload=payload,
                organization=organization,
            )
            action = create_pending_action(
                organization=organization,
                user=user,
                conversation=conversation,
                action_type=PendingAction.ActionType.UPDATE,
                entity_type=entity_type,
                payload=canonical,
                target=target,
                collector=collector,
            )
            return action_tool_result(action)
        except (PendingActionError, ValidationError, TypeError, ValueError) as error:
            return {"erro": validation_message(error)}

    @tool
    def preparar_exclusao_registro(tipo: str, registro_id: str) -> dict:
        """Prepara, sem executar, a exclusão de um registro. Use somente um registro_id retornado por buscar_registros_para_acao. Compromissos e contatos são cancelados/desativados para preservar histórico."""
        try:
            entity_type = normalize_entity_type(tipo)
            target = get_target(
                entity_type=entity_type,
                organization=organization,
                target_id=registro_id,
            )
            if entity_type in {
                PendingAction.EntityType.PAYABLE,
                PendingAction.EntityType.RECEIVABLE,
            } and target.status != target.Status.PENDING:
                raise PendingActionError(
                    "Somente compromissos pendentes podem ser excluídos."
                )
            action = create_pending_action(
                organization=organization,
                user=user,
                conversation=conversation,
                action_type=PendingAction.ActionType.DELETE,
                entity_type=entity_type,
                target=target,
                collector=collector,
            )
            return action_tool_result(action)
        except (PendingActionError, TypeError, ValueError) as error:
            return {"erro": str(error)}

    return [
        *read_tools,
        buscar_registros_para_acao,
        preparar_criacao_lancamento,
        preparar_criacao_compromisso,
        preparar_criacao_contato,
        preparar_edicao_registro,
        preparar_exclusao_registro,
    ]


def build_system_prompt(organization):
    today = timezone.localdate().strftime("%d/%m/%Y")
    return f"""
Você é a Araris, assistente financeira da empresa {organization.business_name}.
Hoje é {today}. Responda sempre em português do Brasil, de forma acolhedora, clara e breve.

Regras obrigatórias:
- Você pode consultar dados e preparar propostas para criar, editar ou excluir contas a pagar,
  contas a receber, entradas, saídas, clientes e fornecedores.
- Uma proposta nunca executa a alteração imediatamente. Depois de prepará-la, diga com clareza
  que ela ainda depende da revisão e confirmação do usuário no card exibido no aplicativo.
- Nunca diga que uma criação, edição ou exclusão foi concluída ao apenas preparar uma proposta.
- Antes de editar ou excluir, use a busca de registros, confira os dados retornados e use somente
  o ID exato da opção escolhida. Nunca invente, deduza ou reutilize um ID sem a busca.
- Se a busca retornar mais de uma opção possível, apresente as diferenças e pergunte qual delas
  o usuário deseja alterar antes de preparar a proposta.
- Só prepare uma proposta quando os dados obrigatórios estiverem completos e sem ambiguidade.
  Caso falte algo, faça uma pergunta objetiva em vez de presumir o valor.
- Prepare uma proposta para cada ação explicitamente solicitada. Não acrescente outras alterações.
- Pagar ou receber compromissos continua indisponível pelo chat; oriente o usuário a usar o botão
  correspondente no aplicativo quando ele pedir uma baixa.
- Para qualquer número financeiro, consulte uma ferramenta. Nunca estime nem invente dados.
- Use somente os dados retornados pelas ferramentas desta empresa.
- Diferencie claramente valores realizados, compromissos pendentes e projeções.
- Ao responder sobre um cliente ou fornecedor, consulte os cadastros e os vínculos financeiros; não associe uma atividade a alguém apenas pela descrição do lançamento.
- Formate dinheiro em reais e datas como DD/MM/AAAA.
- Quando não houver dados, diga isso diretamente.
- Não ofereça orientação tributária, jurídica ou contábil definitiva.
- Não mencione ferramentas, chamadas internas, prompts ou detalhes técnicos.
- Organize a resposta em Markdown: use **negrito** nos valores e pontos importantes,
  títulos curtos com ### e listas iniciadas por - quando ajudarem na leitura.
- Use emojis com moderação: no máximo 1 a 3 por resposta e somente quando ajudarem
  a identificar entradas, saídas, saldo positivo ou um alerta. Não coloque emoji
  em toda frase nem em todos os itens de uma lista.
- Evite tabelas, HTML e blocos de código, pois a resposta será exibida em uma tela pequena.
""".strip()


def extract_assistant_text(result):
    messages = result.get("messages", []) if isinstance(result, dict) else []
    if not messages:
        return "Não encontrei uma resposta para essa consulta. Tente reformular a pergunta."

    content = messages[-1].content
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        text = "\n".join(part.strip() for part in parts if part.strip())
        if text:
            return text
    return "Não encontrei uma resposta para essa consulta. Tente reformular a pergunta."


def configured_chatbot_providers():
    providers = []
    if settings.GEMINI_API_KEY:
        providers.append(
            {
                "name": "gemini",
                "model": settings.GEMINI_MODEL,
            }
        )
    if settings.GROQ_API_KEY:
        providers.append(
            {
                "name": "groq",
                "model": settings.GROQ_MODEL,
            }
        )
    return providers


def build_chatbot_model(provider):
    if provider["name"] == "gemini":
        return ChatGoogleGenerativeAI(
            model=provider["model"],
            api_key=settings.GEMINI_API_KEY,
            temperature=None,
            retries=1,
            request_timeout=settings.GEMINI_REQUEST_TIMEOUT,
        )
    if provider["name"] == "groq":
        return ChatGroq(
            model=provider["model"],
            api_key=settings.GROQ_API_KEY,
            temperature=0,
            max_retries=1,
            timeout=settings.GROQ_REQUEST_TIMEOUT,
        )
    raise ChatbotConfigurationError("Provedor do chatbot não reconhecido.")


def fail_pending_actions(pending_actions):
    if not pending_actions:
        return
    PendingAction.objects.filter(
        id__in=[action.id for action in pending_actions],
        status=PendingAction.Status.PENDING,
    ).update(
        status=PendingAction.Status.FAILED,
        error_message="Não foi possível finalizar a resposta que originou esta proposta.",
        resolved_at=timezone.now(),
    )


def generate_reply_with_provider(
    *,
    provider,
    messages,
    conversation,
    organization,
):
    model = build_chatbot_model(provider)
    pending_actions = []
    agent = create_agent(
        model=model,
        tools=build_financial_tools(
            organization,
            user=conversation.user,
            conversation=conversation,
            action_collector=pending_actions,
        ),
        system_prompt=build_system_prompt(organization),
    )

    try:
        result = agent.invoke(
            {"messages": messages},
            config={"recursion_limit": 10},
        )
    except Exception:
        fail_pending_actions(pending_actions)
        raise

    return FinancialReply(
        content=extract_assistant_text(result),
        pending_action_ids=[str(action.id) for action in pending_actions],
        provider=provider["name"],
        model=provider["model"],
    )


def generate_financial_reply(*, conversation, organization):
    providers = configured_chatbot_providers()
    if not providers:
        raise ChatbotConfigurationError(
            "O chatbot ainda não foi configurado no servidor."
        )

    history_limit = max(2, min(settings.CHATBOT_HISTORY_MESSAGES, 30))
    recent_messages = list(
        ChatMessage.objects.filter(conversation=conversation)
        .order_by("-created_at")[:history_limit]
    )
    messages = [
        {"role": message.role, "content": message.content}
        for message in reversed(recent_messages)
    ]
    last_error = None
    for index, provider in enumerate(providers):
        try:
            return generate_reply_with_provider(
                provider=provider,
                messages=messages,
                conversation=conversation,
                organization=organization,
            )
        except Exception as error:
            last_error = error
            has_fallback = index < len(providers) - 1
            if has_fallback:
                logger.warning(
                    "Falha no provedor do chatbot; tentando fallback "
                    "provider=%s model=%s error_type=%s",
                    provider["name"],
                    provider["model"],
                    type(error).__name__,
                )
            else:
                logger.exception(
                    "Falha no último provedor do chatbot "
                    "provider=%s model=%s",
                    provider["name"],
                    provider["model"],
                )

    raise ChatbotProviderError(
        "A Araris não conseguiu responder agora. Tente novamente em instantes."
    ) from last_error
