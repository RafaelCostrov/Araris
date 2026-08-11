from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.chatbot.actions import (
    create_pending_action,
    validate_create_payload,
    validate_update_payload,
)
from apps.chatbot.models import ChatMessage, Conversation, PendingAction
from apps.chatbot.services import (
    ChatbotProviderError,
    ChatbotProviderResponseError,
    FinancialReply,
    build_financial_tools,
    finalize_assistant_content,
    generate_financial_reply,
)
from apps.finance.models import (
    Customer,
    Expense,
    Payable,
    Receivable,
    Revenue,
    Supplier,
)
from apps.organizations.models import Membership, Organization


User = get_user_model()


class ChatbotApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="rafael@example.com",
            email="rafael@example.com",
            password="test-password",
        )
        self.organization = Organization.objects.create(
            business_name="Araris Teste",
            cnpj="12345678000190",
            initial_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        Membership.objects.create(
            organization=self.organization,
            user=self.user,
            invite_email=self.user.email,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
            invited_by=self.user,
        )
        self.client.force_authenticate(self.user)

    @patch(
        "apps.chatbot.views.generate_financial_reply",
        return_value="Você recebeu R$ 500,00 neste mês.",
    )
    def test_send_message_creates_conversation_and_persists_reply(self, generate):
        response = self.client.post(
            "/api/chatbot/messages/",
            {
                "organization_id": str(self.organization.id),
                "message": "Quanto eu recebi neste mês?",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Quanto eu recebi neste mês?")
        self.assertEqual(len(response.data["messages"]), 2)
        self.assertEqual(response.data["messages"][0]["role"], "user")
        self.assertEqual(response.data["messages"][1]["role"], "assistant")
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(ChatMessage.objects.count(), 2)
        generate.assert_called_once()

    def test_conversation_from_another_user_is_not_accessible(self):
        another_user = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="test-password",
        )
        conversation = Conversation.objects.create(
            organization=self.organization,
            user=another_user,
            title="Conversa privada",
        )

        response = self.client.get(
            f"/api/chatbot/conversations/{conversation.id}/",
            {"organization_id": str(self.organization.id)},
        )

        self.assertEqual(response.status_code, 404)

        delete_response = self.client.delete(
            f"/api/chatbot/conversations/{conversation.id}/"
            f"?organization_id={self.organization.id}",
        )
        self.assertEqual(delete_response.status_code, 404)
        self.assertTrue(Conversation.objects.filter(id=conversation.id).exists())

    def test_user_can_delete_own_conversation(self):
        conversation = Conversation.objects.create(
            organization=self.organization,
            user=self.user,
            title="Conversa descartável",
        )
        ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            content="Mensagem que será removida",
        )

        response = self.client.delete(
            f"/api/chatbot/conversations/{conversation.id}/"
            f"?organization_id={self.organization.id}",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Conversation.objects.filter(id=conversation.id).exists())
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_conversation_list_returns_latest_message_as_preview(self):
        conversation = Conversation.objects.create(
            organization=self.organization,
            user=self.user,
            title="Resumo financeiro",
        )
        ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            content="Como estão minhas finanças?",
        )
        ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.ASSISTANT,
            content="Seu saldo está positivo.",
        )

        response = self.client.get(
            "/api/chatbot/conversations/",
            {"organization_id": str(self.organization.id)},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["preview"], "Seu saldo está positivo.")

    def test_conversation_list_respects_requested_limit(self):
        for index in range(5):
            Conversation.objects.create(
                organization=self.organization,
                user=self.user,
                title=f"Conversa {index}",
            )

        response = self.client.get(
            "/api/chatbot/conversations/",
            {"organization_id": str(self.organization.id), "limit": 3},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)

    @patch("apps.chatbot.views.generate_financial_reply")
    def test_send_message_attaches_pending_action_to_assistant_reply(self, generate):
        def reply_with_action(*, conversation, organization):
            action = create_pending_action(
                organization=organization,
                user=self.user,
                conversation=conversation,
                action_type=PendingAction.ActionType.CREATE,
                entity_type=PendingAction.EntityType.CUSTOMER,
                payload={"name": "Cliente pelo chat"},
            )
            return FinancialReply(
                content="Revise a proposta antes de confirmar.",
                pending_action_ids=[str(action.id)],
            )

        generate.side_effect = reply_with_action

        response = self.client.post(
            "/api/chatbot/messages/",
            {
                "organization_id": str(self.organization.id),
                "message": "Cadastre o cliente pelo chat",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        assistant_message = response.data["messages"][1]
        self.assertEqual(len(assistant_message["actions"]), 1)
        self.assertEqual(assistant_message["actions"][0]["status"], "pending")
        self.assertNotIn("payload", assistant_message["actions"][0])

    @patch("apps.chatbot.views.generate_financial_reply")
    def test_failed_message_can_be_retried_without_duplicate_user_message(
        self,
        generate,
    ):
        generate.side_effect = ChatbotProviderError(
            "A Araris não conseguiu responder agora. Tente novamente em instantes."
        )
        first_response = self.client.post(
            "/api/chatbot/messages/",
            {
                "organization_id": str(self.organization.id),
                "message": "Como estão minhas finanças?",
            },
            format="json",
        )

        self.assertEqual(first_response.status_code, 503)
        conversation_id = first_response.data["conversation_id"]
        user_message_id = first_response.data["user_message_id"]
        self.assertEqual(ChatMessage.objects.count(), 1)

        generate.side_effect = None
        generate.return_value = FinancialReply(
            content="Seu saldo está positivo.",
            pending_action_ids=[],
            provider="groq",
            model="llama-3.3-70b-versatile",
        )
        retry_response = self.client.post(
            f"/api/chatbot/messages/{user_message_id}/retry/",
            {"organization_id": str(self.organization.id)},
            format="json",
        )

        self.assertEqual(retry_response.status_code, 201)
        self.assertEqual(str(retry_response.data["id"]), str(conversation_id))
        self.assertEqual(len(retry_response.data["messages"]), 2)
        self.assertEqual(
            ChatMessage.objects.filter(role=ChatMessage.Role.USER).count(),
            1,
        )
        assistant = ChatMessage.objects.get(role=ChatMessage.Role.ASSISTANT)
        self.assertEqual(assistant.metadata["provider"], "groq")


class ChatbotProviderFallbackTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="fallback@example.com",
            email="fallback@example.com",
            password="test-password",
        )
        self.organization = Organization.objects.create(
            business_name="Fallback Teste",
            cnpj="44444444000144",
            initial_balance=Decimal("0.00"),
            created_by=self.user,
        )
        self.conversation = Conversation.objects.create(
            organization=self.organization,
            user=self.user,
            title="Teste de fallback",
        )
        ChatMessage.objects.create(
            conversation=self.conversation,
            role=ChatMessage.Role.USER,
            content="Qual é o meu saldo?",
        )

    def test_pending_action_response_uses_the_confirmation_card_summary(self):
        content = finalize_assistant_content(
            "Preparei uma resposta longa repetindo valor, data e categoria.",
            [object()],
        )

        self.assertIn("Proposta pronta para revisão", content)
        self.assertIn("card abaixo", content)
        self.assertNotIn("valor", content)
        self.assertNotIn("categoria", content)

    def test_provider_cannot_claim_an_action_that_was_not_created(self):
        with self.assertRaises(ChatbotProviderResponseError):
            finalize_assistant_content(
                "Preparei **a proposta**. Toque em Confirmar no card.",
                [],
            )

    @override_settings(
        GEMINI_API_KEY="gemini-test-key",
        GEMINI_MODEL="gemini-test-model",
        GROQ_API_KEY="groq-test-key",
        GROQ_MODEL="qwen-test-model",
        GROQ_FALLBACK_MODEL="cheap-groq-test-model",
    )
    @patch("apps.chatbot.services.generate_reply_with_provider")
    def test_second_groq_model_is_used_after_primary_failure(
        self,
        generate_with_provider,
    ):
        generate_with_provider.side_effect = [
            RuntimeError("Falha simulada no Qwen"),
            FinancialReply(
                content="Resposta pelo segundo modelo Groq.",
                pending_action_ids=[],
                provider="groq",
                model="cheap-groq-test-model",
            ),
        ]

        reply = generate_financial_reply(
            conversation=self.conversation,
            organization=self.organization,
        )

        self.assertEqual(reply.provider, "groq")
        self.assertEqual(reply.model, "cheap-groq-test-model")
        models = [
            call.kwargs["provider"]["model"]
            for call in generate_with_provider.call_args_list
        ]
        self.assertEqual(models, ["qwen-test-model", "cheap-groq-test-model"])

    @override_settings(
        GEMINI_API_KEY="gemini-test-key",
        GEMINI_MODEL="gemini-test-model",
        GROQ_API_KEY="groq-test-key",
        GROQ_MODEL="qwen-test-model",
        GROQ_FALLBACK_MODEL="cheap-groq-test-model",
    )
    @patch("apps.chatbot.services.generate_reply_with_provider")
    def test_gemini_is_used_after_both_groq_models_fail(
        self,
        generate_with_provider,
    ):
        generate_with_provider.side_effect = [
            RuntimeError("Falha simulada no Qwen"),
            RuntimeError("Falha simulada no segundo Groq"),
            FinancialReply(
                content="Resposta pelo fallback.",
                pending_action_ids=[],
                provider="gemini",
                model="gemini-test-model",
            ),
        ]

        reply = generate_financial_reply(
            conversation=self.conversation,
            organization=self.organization,
        )

        self.assertEqual(reply.provider, "gemini")
        self.assertEqual(generate_with_provider.call_count, 3)
        provider_models = [
            (
                call.kwargs["provider"]["name"],
                call.kwargs["provider"]["model"],
            )
            for call in generate_with_provider.call_args_list
        ]
        self.assertEqual(
            provider_models,
            [
                ("groq", "qwen-test-model"),
                ("groq", "cheap-groq-test-model"),
                ("gemini", "gemini-test-model"),
            ],
        )


class PendingActionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="actions@example.com",
            email="actions@example.com",
            password="test-password",
        )
        self.organization = Organization.objects.create(
            business_name="Ações pelo Chat",
            cnpj="33333333000133",
            initial_balance=Decimal("0.00"),
            created_by=self.user,
        )
        Membership.objects.create(
            organization=self.organization,
            user=self.user,
            invite_email=self.user.email,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
            invited_by=self.user,
        )
        self.conversation = Conversation.objects.create(
            organization=self.organization,
            user=self.user,
            title="Ações financeiras",
        )
        self.client.force_authenticate(self.user)

    def prepare_create(self, entity_type, payload):
        canonical = validate_create_payload(
            entity_type=entity_type,
            payload=payload,
            organization=self.organization,
        )
        return create_pending_action(
            organization=self.organization,
            user=self.user,
            conversation=self.conversation,
            action_type=PendingAction.ActionType.CREATE,
            entity_type=entity_type,
            payload=canonical,
        )

    def prepare_update(self, entity_type, target, payload):
        canonical = validate_update_payload(
            entity_type=entity_type,
            target=target,
            payload=payload,
            organization=self.organization,
        )
        return create_pending_action(
            organization=self.organization,
            user=self.user,
            conversation=self.conversation,
            action_type=PendingAction.ActionType.UPDATE,
            entity_type=entity_type,
            target=target,
            payload=canonical,
        )

    def prepare_delete(self, entity_type, target):
        return create_pending_action(
            organization=self.organization,
            user=self.user,
            conversation=self.conversation,
            action_type=PendingAction.ActionType.DELETE,
            entity_type=entity_type,
            target=target,
        )

    def resolve(self, action, operation="confirm"):
        return self.client.post(
            f"/api/chatbot/actions/{action.id}/{operation}/",
            {"organization_id": str(self.organization.id)},
            format="json",
        )

    def make_records(self):
        today = timezone.localdate()
        customer = Customer.objects.create(
            organization=self.organization,
            name="Cliente original",
            created_by=self.user,
        )
        supplier = Supplier.objects.create(
            organization=self.organization,
            name="Fornecedor original",
            created_by=self.user,
        )
        return {
            PendingAction.EntityType.PAYABLE: Payable.objects.create(
                organization=self.organization,
                description="Conta original",
                amount=Decimal("100.00"),
                due_date=today,
                category="other",
                supplier=supplier,
                created_by=self.user,
            ),
            PendingAction.EntityType.RECEIVABLE: Receivable.objects.create(
                organization=self.organization,
                description="Recebível original",
                amount=Decimal("110.00"),
                due_date=today,
                category="other",
                customer=customer,
                created_by=self.user,
            ),
            PendingAction.EntityType.REVENUE: Revenue.objects.create(
                organization=self.organization,
                description="Entrada original",
                amount=Decimal("120.00"),
                occurred_on=today,
                category="other",
                payment_method="pix",
                customer=customer,
                created_by=self.user,
            ),
            PendingAction.EntityType.EXPENSE: Expense.objects.create(
                organization=self.organization,
                description="Saída original",
                amount=Decimal("130.00"),
                occurred_on=today,
                category="other",
                payment_method="pix",
                supplier=supplier,
                created_by=self.user,
            ),
            PendingAction.EntityType.CUSTOMER: customer,
            PendingAction.EntityType.SUPPLIER: supplier,
        }

    def test_write_tool_only_prepares_action_until_user_confirms(self):
        tools = {
            item.name: item
            for item in build_financial_tools(
                self.organization,
                user=self.user,
                conversation=self.conversation,
            )
        }

        for tool_name, argument_name in (
            ("buscar_registros_para_acao", "limite"),
            ("preparar_criacao_compromisso", "ocorrencias"),
        ):
            with self.subTest(tool=tool_name, argument=argument_name):
                argument_schema = tools[
                    tool_name
                ].args_schema.model_json_schema()["properties"][argument_name]
                allowed_types = {
                    option.get("type") for option in argument_schema.get("anyOf", [])
                }
                self.assertEqual(allowed_types, {"integer", "string"})

        for tool_name in (
            "preparar_criacao_lancamento",
            "preparar_criacao_compromisso",
            "preparar_edicao_registro",
        ):
            with self.subTest(tool=tool_name, argument="valor"):
                argument_schema = tools[
                    tool_name
                ].args_schema.model_json_schema()["properties"]["valor"]
                allowed_types = {
                    option.get("type") for option in argument_schema.get("anyOf", [])
                }
                self.assertEqual(
                    allowed_types,
                    {"integer", "number", "string"},
                )

        for tool_name, argument_name in (
            ("preparar_criacao_compromisso", "sem_data_final"),
            ("preparar_edicao_registro", "remover_cliente_ou_fornecedor"),
            ("preparar_edicao_registro", "limpar_observacoes"),
        ):
            with self.subTest(tool=tool_name, argument=argument_name):
                argument_schema = tools[
                    tool_name
                ].args_schema.model_json_schema()["properties"][argument_name]
                allowed_types = {
                    option.get("type") for option in argument_schema.get("anyOf", [])
                }
                self.assertEqual(
                    allowed_types,
                    {"boolean", "integer", "string"},
                )

        result = tools["preparar_criacao_compromisso"].invoke(
            {
                "tipo": "conta a pagar",
                "descricao": "Internet",
                "valor": 89.9,
                "vencimento": timezone.localdate().strftime("%d/%m/%Y"),
                "categoria": "servicos",
                "ocorrencias": "1",
                "sem_data_final": "false",
            }
        )

        self.assertEqual(result["status"], "aguardando_confirmacao")
        self.assertFalse(Payable.objects.filter(description="Internet").exists())
        action = PendingAction.objects.get(id=result["acao_id"])
        self.assertEqual(action.payload["due_date"], timezone.localdate().isoformat())
        self.assertEqual(action.payload["category"], "utilities")
        self.assertFalse(action.payload["recurrence_indefinite"])

        response = self.resolve(action)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Payable.objects.filter(description="Internet").exists())
        self.assertEqual(response.data["status"], PendingAction.Status.CONFIRMED)
        second_response = self.resolve(action)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Payable.objects.filter(description="Internet").count(), 1)

    def test_creation_is_supported_for_every_requested_entity(self):
        today = timezone.localdate().isoformat()
        cases = (
            (
                PendingAction.EntityType.PAYABLE,
                Payable,
                {
                    "description": "Nova conta a pagar",
                    "amount": "101.00",
                    "due_date": today,
                    "category": "other",
                    "recurrence": "none",
                    "occurrences": 1,
                },
            ),
            (
                PendingAction.EntityType.RECEIVABLE,
                Receivable,
                {
                    "description": "Nova conta a receber",
                    "amount": "102.00",
                    "due_date": today,
                    "category": "other",
                    "recurrence": "none",
                    "occurrences": 1,
                },
            ),
            (
                PendingAction.EntityType.REVENUE,
                Revenue,
                {
                    "description": "Nova entrada",
                    "amount": "103.00",
                    "occurred_on": today,
                    "category": "other",
                    "payment_method": "pix",
                },
            ),
            (
                PendingAction.EntityType.EXPENSE,
                Expense,
                {
                    "description": "Nova saída",
                    "amount": "104.00",
                    "occurred_on": today,
                    "category": "other",
                    "payment_method": "pix",
                },
            ),
            (
                PendingAction.EntityType.CUSTOMER,
                Customer,
                {"name": "Novo cliente"},
            ),
            (
                PendingAction.EntityType.SUPPLIER,
                Supplier,
                {"name": "Novo fornecedor"},
            ),
        )

        for entity_type, model, payload in cases:
            with self.subTest(entity_type=entity_type):
                initial_count = model.objects.count()
                action = self.prepare_create(entity_type, payload)
                self.assertEqual(model.objects.count(), initial_count)
                response = self.resolve(action)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(model.objects.count(), initial_count + 1)

    def test_editing_is_supported_for_every_requested_entity(self):
        records = self.make_records()

        for entity_type, target in records.items():
            with self.subTest(entity_type=entity_type):
                is_contact = entity_type in {
                    PendingAction.EntityType.CUSTOMER,
                    PendingAction.EntityType.SUPPLIER,
                }
                field = "name" if is_contact else "description"
                value = f"Editado {entity_type}"
                action = self.prepare_update(entity_type, target, {field: value})
                target.refresh_from_db()
                self.assertNotEqual(getattr(target, field), value)

                response = self.resolve(action)

                self.assertEqual(response.status_code, 200)
                target.refresh_from_db()
                self.assertEqual(getattr(target, field), value)

    def test_removal_is_supported_for_every_requested_entity(self):
        records = self.make_records()

        for entity_type, target in records.items():
            with self.subTest(entity_type=entity_type):
                action = self.prepare_delete(entity_type, target)
                response = self.resolve(action)
                self.assertEqual(response.status_code, 200)

                if entity_type in {
                    PendingAction.EntityType.PAYABLE,
                    PendingAction.EntityType.RECEIVABLE,
                }:
                    target.refresh_from_db()
                    self.assertEqual(target.status, target.Status.CANCELED)
                elif entity_type in {
                    PendingAction.EntityType.CUSTOMER,
                    PendingAction.EntityType.SUPPLIER,
                }:
                    target.refresh_from_db()
                    self.assertFalse(target.is_active)
                else:
                    self.assertFalse(type(target).objects.filter(id=target.id).exists())

    def test_canceled_action_cannot_be_confirmed(self):
        action = self.prepare_create(
            PendingAction.EntityType.CUSTOMER,
            {"name": "Cliente cancelado"},
        )

        cancel_response = self.resolve(action, "cancel")
        confirm_response = self.resolve(action)

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.data["status"], PendingAction.Status.CANCELED)
        self.assertEqual(confirm_response.status_code, 400)
        self.assertFalse(Customer.objects.filter(name="Cliente cancelado").exists())

    def test_expired_action_cannot_be_confirmed(self):
        action = self.prepare_create(
            PendingAction.EntityType.CUSTOMER,
            {"name": "Cliente expirado"},
        )
        action.expires_at = timezone.now() - timedelta(seconds=1)
        action.save(update_fields=["expires_at", "updated_at"])

        response = self.resolve(action)

        self.assertEqual(response.status_code, 400)
        action.refresh_from_db()
        self.assertEqual(action.status, PendingAction.Status.EXPIRED)
        self.assertFalse(Customer.objects.filter(name="Cliente expirado").exists())

    def test_action_is_private_to_the_user_who_requested_it(self):
        action = self.prepare_create(
            PendingAction.EntityType.CUSTOMER,
            {"name": "Cliente privado"},
        )
        another_user = User.objects.create_user(
            username="another-member@example.com",
            email="another-member@example.com",
            password="test-password",
        )
        Membership.objects.create(
            organization=self.organization,
            user=another_user,
            invite_email=another_user.email,
            role=Membership.Role.COLLABORATOR,
            status=Membership.Status.ACTIVE,
            invited_by=self.user,
        )
        self.client.force_authenticate(another_user)

        response = self.resolve(action)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Customer.objects.filter(name="Cliente privado").exists())

    def test_stale_edit_is_rejected(self):
        customer = Customer.objects.create(
            organization=self.organization,
            name="Nome inicial",
            created_by=self.user,
        )
        action = self.prepare_update(
            PendingAction.EntityType.CUSTOMER,
            customer,
            {"name": "Nome proposto"},
        )
        customer.name = "Nome alterado em outra tela"
        customer.save(update_fields=["name", "updated_at"])

        response = self.resolve(action)

        self.assertEqual(response.status_code, 400)
        action.refresh_from_db()
        customer.refresh_from_db()
        self.assertEqual(action.status, PendingAction.Status.FAILED)
        self.assertEqual(customer.name, "Nome alterado em outra tela")


class FinancialToolsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="finance@example.com",
            email="finance@example.com",
            password="test-password",
        )
        self.organization = Organization.objects.create(
            business_name="Financeiro Teste",
            cnpj="98765432000199",
            initial_balance=Decimal("1000.00"),
            created_by=self.user,
        )
        today = timezone.localdate()
        self.customer = Customer.objects.create(
            organization=self.organization,
            name="Cliente Aurora",
            email="aurora@example.com",
            created_by=self.user,
        )
        self.supplier = Supplier.objects.create(
            organization=self.organization,
            name="Fornecedor Horizonte",
            phone="11999999999",
            created_by=self.user,
        )
        Revenue.objects.create(
            organization=self.organization,
            description="Serviço recebido",
            amount=Decimal("500.00"),
            occurred_on=today,
            category="services",
            payment_method="pix",
            customer=self.customer,
            created_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization,
            description="Internet",
            amount=Decimal("120.00"),
            occurred_on=today,
            category="utilities",
            payment_method="pix",
            supplier=self.supplier,
            created_by=self.user,
        )
        Payable.objects.create(
            organization=self.organization,
            description="Fornecedor",
            amount=Decimal("200.00"),
            due_date=today + timedelta(days=5),
            category="supplies",
            supplier=self.supplier,
            created_by=self.user,
        )
        Receivable.objects.create(
            organization=self.organization,
            description="Cliente",
            amount=Decimal("350.00"),
            due_date=today + timedelta(days=8),
            category="services",
            customer=self.customer,
            created_by=self.user,
        )

    def test_summary_tool_uses_real_financial_records(self):
        tools = {item.name: item for item in build_financial_tools(self.organization)}
        current_month = timezone.localdate().strftime("%Y-%m")

        result = tools["consultar_resumo_financeiro"].invoke(
            {"mes": current_month}
        )

        self.assertEqual(result["entradas_realizadas"], "500.00")
        self.assertEqual(result["saidas_realizadas"], "120.00")
        self.assertEqual(result["saldo_realizado_do_mes"], "380.00")
        self.assertEqual(result["a_pagar_no_mes"], "200.00")
        self.assertEqual(result["a_receber_no_mes"], "350.00")

    def test_commitments_tool_returns_only_current_organization(self):
        other_organization = Organization.objects.create(
            business_name="Outra Empresa",
            cnpj="11111111000111",
            created_by=self.user,
        )
        Payable.objects.create(
            organization=other_organization,
            description="Não deve aparecer",
            amount=Decimal("999.00"),
            due_date=timezone.localdate() + timedelta(days=2),
            category="other",
            created_by=self.user,
        )
        tools = {item.name: item for item in build_financial_tools(self.organization)}

        result = tools["consultar_compromissos"].invoke(
            {"tipo": "todos", "situacao": "todos", "dias": 30}
        )

        descriptions = [item["descricao"] for item in result["compromissos"]]
        self.assertIn("Fornecedor", descriptions)
        self.assertIn("Cliente", descriptions)
        self.assertNotIn("Não deve aparecer", descriptions)
        contacts = {
            item.get("cliente") or item.get("fornecedor")
            for item in result["compromissos"]
        }
        self.assertIn(self.customer.name, contacts)
        self.assertIn(self.supplier.name, contacts)

    def test_contacts_and_contact_activities_tools_are_organization_scoped(self):
        other_organization = Organization.objects.create(
            business_name="Outra Empresa de Contatos",
            cnpj="22222222000122",
            created_by=self.user,
        )
        Customer.objects.create(
            organization=other_organization,
            name="Cliente que não pode aparecer",
            created_by=self.user,
        )
        tools = {item.name: item for item in build_financial_tools(self.organization)}

        contacts = tools["consultar_clientes_e_fornecedores"].invoke(
            {"tipo": "todos", "busca": "", "limite": 20}
        )
        activities = tools["consultar_atividades_por_contato"].invoke(
            {
                "nome": "Aurora",
                "mes": timezone.localdate().strftime("%Y-%m"),
                "tipo": "clientes",
                "limite": 20,
            }
        )

        self.assertEqual(
            [item["nome"] for item in contacts["clientes"]],
            [self.customer.name],
        )
        self.assertEqual(
            [item["nome"] for item in contacts["fornecedores"]],
            [self.supplier.name],
        )
        self.assertEqual(activities["totais"]["entradas_realizadas"], "500.00")
        self.assertEqual(activities["totais"]["a_receber_pendente"], "350.00")
        self.assertTrue(
            all(
                item["cliente_ou_fornecedor"] == self.customer.name
                for item in activities["atividades"]
            )
        )

    def test_numeric_tool_arguments_allow_numbers_returned_as_strings(self):
        tools = {item.name: item for item in build_financial_tools(self.organization)}
        numeric_arguments = {
            "consultar_compromissos": "dias",
            "consultar_projecao_de_caixa": "dias",
            "consultar_lancamentos_recentes": "limite",
            "consultar_clientes_e_fornecedores": "limite",
            "consultar_atividades_por_contato": "limite",
        }

        for tool_name, argument_name in numeric_arguments.items():
            with self.subTest(tool=tool_name, argument=argument_name):
                argument_schema = tools[
                    tool_name
                ].args_schema.model_json_schema()["properties"][argument_name]
                allowed_types = {
                    option.get("type") for option in argument_schema.get("anyOf", [])
                }
                self.assertEqual(allowed_types, {"integer", "string"})

        contacts = tools["consultar_clientes_e_fornecedores"].invoke(
            {"tipo": "clientes", "busca": "", "limite": "10"}
        )

        self.assertEqual(contacts["quantidade_clientes"], 1)
        self.assertEqual(contacts["clientes"][0]["nome"], self.customer.name)

    def test_recent_movements_include_customer_and_supplier(self):
        tools = {item.name: item for item in build_financial_tools(self.organization)}

        result = tools["consultar_lancamentos_recentes"].invoke({"limite": 10})

        revenue = next(item for item in result["lancamentos"] if item["tipo"] == "entrada")
        expense = next(item for item in result["lancamentos"] if item["tipo"] == "saida")
        self.assertEqual(revenue["cliente"], self.customer.name)
        self.assertEqual(expense["fornecedor"], self.supplier.name)
