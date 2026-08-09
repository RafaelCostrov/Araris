from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

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


class FinanceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner@araris.local",
            email="owner@araris.local",
            password="safe-password-123",
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

    def test_create_customers_and_suppliers_for_current_organization(self):
        customer_response = self.client.post(
            reverse("customer-list-create"),
            {
                "organization_id": str(self.organization.id),
                "name": "Cliente Araris",
                "document": "123.456.789-01",
                "email": "cliente@example.com",
                "phone": "11999999999",
            },
            format="json",
        )
        supplier_response = self.client.post(
            reverse("supplier-list-create"),
            {
                "organization_id": str(self.organization.id),
                "name": "Fornecedor Araris",
                "document": "12.345.678/0001-95",
            },
            format="json",
        )

        self.assertEqual(customer_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(supplier_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(customer_response.data["document"], "12345678901")
        self.assertEqual(supplier_response.data["document"], "12345678000195")

        self.client.delete(
            reverse(
                "customer-detail",
                kwargs={"contact_id": customer_response.data["id"]},
            )
        )
        active_response = self.client.get(
            reverse("customer-list-create"),
            {"organization_id": str(self.organization.id)},
        )
        self.assertEqual(active_response.data, [])
        self.assertFalse(
            Customer.objects.get(id=customer_response.data["id"]).is_active
        )

    def test_optional_contacts_follow_commitment_settlement(self):
        customer = Customer.objects.create(
            organization=self.organization,
            name="Cliente mensal",
            created_by=self.user,
        )
        supplier = Supplier.objects.create(
            organization=self.organization,
            name="Fornecedor mensal",
            created_by=self.user,
        )
        receivable_response = self.client.post(
            reverse("receivable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Mensalidade do cliente",
                "amount": "450.00",
                "due_date": timezone.localdate().isoformat(),
                "category": "services",
                "customer_id": str(customer.id),
                "recurrence": "none",
            },
            format="json",
        )
        payable_response = self.client.post(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Compra do fornecedor",
                "amount": "125.00",
                "due_date": timezone.localdate().isoformat(),
                "category": "supplies",
                "supplier_id": str(supplier.id),
                "recurrence": "none",
            },
            format="json",
        )

        self.assertEqual(receivable_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(payable_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(receivable_response.data["customer_name"], customer.name)
        self.assertEqual(payable_response.data["supplier_name"], supplier.name)

        received = self.client.post(
            reverse(
                "receivable-settle",
                kwargs={"receivable_id": receivable_response.data["id"]},
            ),
            {"date": timezone.localdate().isoformat(), "payment_method": "pix"},
            format="json",
        )
        paid = self.client.post(
            reverse(
                "payable-settle",
                kwargs={"payable_id": payable_response.data["id"]},
            ),
            {"date": timezone.localdate().isoformat(), "payment_method": "pix"},
            format="json",
        )

        self.assertEqual(received.data["movement"]["customer_id"], customer.id)
        self.assertEqual(paid.data["movement"]["supplier_id"], supplier.id)

    def test_cannot_link_contact_from_another_organization(self):
        other_organization = Organization.objects.create(
            business_name="Empresa sem vínculo",
            cnpj="44555666000177",
            created_by=self.user,
        )
        foreign_customer = Customer.objects.create(
            organization=other_organization,
            name="Cliente de outra empresa",
            created_by=self.user,
        )

        response = self.client.post(
            reverse("revenue-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Receita inválida",
                "amount": "100.00",
                "occurred_on": timezone.localdate().isoformat(),
                "category": "services",
                "payment_method": "pix",
                "customer_id": str(foreign_customer.id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Revenue.objects.filter(description="Receita inválida").exists())

    def test_dashboard_segments_contacts_and_uses_others_when_missing(self):
        today = timezone.localdate()
        customer = Customer.objects.create(
            organization=self.organization,
            name="Cliente principal",
            created_by=self.user,
        )
        supplier = Supplier.objects.create(
            organization=self.organization,
            name="Fornecedor principal",
            created_by=self.user,
        )
        Revenue.objects.create(
            organization=self.organization,
            description="Receita identificada",
            amount=Decimal("300.00"),
            occurred_on=today,
            category="services",
            payment_method="pix",
            customer=customer,
            created_by=self.user,
        )
        Revenue.objects.create(
            organization=self.organization,
            description="Receita sem cliente",
            amount=Decimal("200.00"),
            occurred_on=today,
            category="sales",
            payment_method="pix",
            created_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization,
            description="Despesa identificada",
            amount=Decimal("75.00"),
            occurred_on=today,
            category="supplies",
            payment_method="pix",
            supplier=supplier,
            created_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization,
            description="Despesa sem fornecedor",
            amount=Decimal("25.00"),
            occurred_on=today,
            category="other",
            payment_method="pix",
            created_by=self.user,
        )

        response = self.client.get(
            reverse("financial-dashboard"),
            {
                "organization_id": str(self.organization.id),
                "month": today.strftime("%Y-%m"),
                "history_months": 3,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [(item["label"], item["percentage"]) for item in response.data["revenue_customers"]],
            [("Cliente principal", "60.00"), ("Outros", "40.00")],
        )
        self.assertEqual(
            [(item["label"], item["percentage"]) for item in response.data["expense_suppliers"]],
            [("Fornecedor principal", "75.00"), ("Outros", "25.00")],
        )

    def test_dashboard_limits_contact_segments_and_groups_the_rest_as_others(self):
        today = timezone.localdate()
        revenue_amounts = [600, 500, 400, 300, 200, 100]
        expense_amounts = [60, 50, 40, 30, 20, 10]

        for index, (revenue_amount, expense_amount) in enumerate(
            zip(revenue_amounts, expense_amounts),
            start=1,
        ):
            customer = Customer.objects.create(
                organization=self.organization,
                name=f"Cliente {index}",
                created_by=self.user,
            )
            supplier = Supplier.objects.create(
                organization=self.organization,
                name=f"Fornecedor {index}",
                created_by=self.user,
            )
            Revenue.objects.create(
                organization=self.organization,
                description=f"Receita {index}",
                amount=Decimal(revenue_amount),
                occurred_on=today,
                category="services",
                payment_method="pix",
                customer=customer,
                created_by=self.user,
            )
            Expense.objects.create(
                organization=self.organization,
                description=f"Despesa {index}",
                amount=Decimal(expense_amount),
                occurred_on=today,
                category="supplies",
                payment_method="pix",
                supplier=supplier,
                created_by=self.user,
            )

        Revenue.objects.create(
            organization=self.organization,
            description="Receita sem cliente",
            amount=Decimal("50.00"),
            occurred_on=today,
            category="sales",
            payment_method="pix",
            created_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization,
            description="Despesa sem fornecedor",
            amount=Decimal("5.00"),
            occurred_on=today,
            category="other",
            payment_method="pix",
            created_by=self.user,
        )

        response = self.client.get(
            reverse("financial-dashboard"),
            {
                "organization_id": str(self.organization.id),
                "month": today.strftime("%Y-%m"),
                "history_months": 3,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["label"] for item in response.data["revenue_customers"]],
            [
                "Cliente 1",
                "Cliente 2",
                "Cliente 3",
                "Cliente 4",
                "Cliente 5",
                "Outros",
            ],
        )
        self.assertEqual(response.data["revenue_customers"][-1]["total"], "150.00")
        self.assertEqual(
            [item["label"] for item in response.data["expense_suppliers"]],
            [
                "Fornecedor 1",
                "Fornecedor 2",
                "Fornecedor 3",
                "Fornecedor 4",
                "Fornecedor 5",
                "Outros",
            ],
        )
        self.assertEqual(response.data["expense_suppliers"][-1]["total"], "15.00")

    def test_create_realized_movements_and_return_summary(self):
        today = timezone.localdate().isoformat()
        revenue_response = self.client.post(
            reverse("revenue-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Venda do dia",
                "amount": "500.00",
                "occurred_on": today,
                "category": "sales",
                "payment_method": "pix",
                "notes": "",
            },
            format="json",
        )
        expense_response = self.client.post(
            reverse("expense-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Compra de material",
                "amount": "120.00",
                "occurred_on": today,
                "category": "supplies",
                "payment_method": "credit_card",
                "notes": "",
            },
            format="json",
        )

        self.assertEqual(revenue_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(expense_response.status_code, status.HTTP_201_CREATED)

        summary_response = self.client.get(
            reverse("financial-summary"),
            {"organization_id": str(self.organization.id)},
        )

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["totals"]["revenue"], "500.00")
        self.assertEqual(summary_response.data["totals"]["expense"], "120.00")
        self.assertEqual(summary_response.data["totals"]["monthly_balance"], "380.00")
        self.assertEqual(summary_response.data["totals"]["opening_balance"], "1000.00")
        self.assertEqual(summary_response.data["totals"]["closing_balance"], "1380.00")
        self.assertEqual(summary_response.data["totals"]["balance"], "1380.00")
        self.assertEqual(len(summary_response.data["recent_activity"]), 2)
        self.assertTrue(
            all(
                not item["is_recurring"]
                for item in summary_response.data["recent_activity"]
            )
        )

    def test_summary_separates_due_today_from_overdue_commitments(self):
        today = timezone.localdate()
        Payable.objects.create(
            organization=self.organization,
            description="Conta que vence hoje",
            amount=Decimal("150.00"),
            due_date=today,
            category="utilities",
            created_by=self.user,
        )
        Receivable.objects.create(
            organization=self.organization,
            description="Recebimento de hoje",
            amount=Decimal("300.00"),
            due_date=today,
            category="services",
            created_by=self.user,
        )
        Payable.objects.create(
            organization=self.organization,
            description="Conta vencida",
            amount=Decimal("75.00"),
            due_date=today - timedelta(days=1),
            category="utilities",
            created_by=self.user,
        )

        response = self.client.get(
            reverse("financial-summary"),
            {"organization_id": str(self.organization.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["due_today_payables"], "150.00")
        self.assertEqual(response.data["totals"]["due_today_receivables"], "300.00")
        self.assertEqual(response.data["counts"]["due_today_payables"], 1)
        self.assertEqual(response.data["counts"]["due_today_receivables"], 1)
        self.assertEqual(response.data["counts"]["overdue_payables"], 1)
        self.assertEqual(response.data["counts"]["overdue_receivables"], 0)

        payables_due_today = self.client.get(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "due_today",
            },
        )
        receivables_due_today = self.client.get(
            reverse("receivable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "due_today",
            },
        )
        self.assertEqual(
            [item["description"] for item in payables_due_today.data],
            ["Conta que vence hoje"],
        )
        self.assertEqual(
            [item["description"] for item in receivables_due_today.data],
            ["Recebimento de hoje"],
        )

    def test_settle_payable_creates_expense_only_once(self):
        payable = Payable.objects.create(
            organization=self.organization,
            description="Conta de internet",
            amount=Decimal("150.00"),
            due_date=timezone.localdate(),
            category="utilities",
            created_by=self.user,
        )
        payload = {
            "date": timezone.localdate().isoformat(),
            "payment_method": "pix",
        }

        first_response = self.client.post(
            reverse("payable-settle", kwargs={"payable_id": payable.id}),
            payload,
            format="json",
        )
        second_response = self.client.post(
            reverse("payable-settle", kwargs={"payable_id": payable.id}),
            payload,
            format="json",
        )

        payable.refresh_from_db()
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(payable.status, Payable.Status.PAID)
        self.assertEqual(Expense.objects.filter(source_payable=payable).count(), 1)

    def test_edit_and_cancel_pending_commitments(self):
        today = timezone.localdate()
        supplier = Supplier.objects.create(
            organization=self.organization,
            name="Fornecedor editado",
            created_by=self.user,
        )
        customer = Customer.objects.create(
            organization=self.organization,
            name="Cliente editado",
            created_by=self.user,
        )
        payable = Payable.objects.create(
            organization=self.organization,
            description="Conta original",
            amount=Decimal("100.00"),
            due_date=today,
            category="utilities",
            created_by=self.user,
        )
        receivable = Receivable.objects.create(
            organization=self.organization,
            description="Recebível original",
            amount=Decimal("200.00"),
            due_date=today,
            category="services",
            created_by=self.user,
        )

        payable_response = self.client.patch(
            reverse("payable-detail", kwargs={"commitment_id": payable.id}),
            {
                "description": "Conta atualizada",
                "amount": "125.00",
                "due_date": (today + timedelta(days=2)).isoformat(),
                "supplier_id": str(supplier.id),
            },
            format="json",
        )
        receivable_response = self.client.patch(
            reverse("receivable-detail", kwargs={"commitment_id": receivable.id}),
            {
                "description": "Recebível atualizado",
                "amount": "250.00",
                "customer_id": str(customer.id),
            },
            format="json",
        )

        self.assertEqual(payable_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receivable_response.status_code, status.HTTP_200_OK)
        self.assertEqual(payable_response.data["description"], "Conta atualizada")
        self.assertEqual(payable_response.data["supplier_name"], supplier.name)
        self.assertEqual(receivable_response.data["amount"], "250.00")
        self.assertEqual(receivable_response.data["customer_name"], customer.name)

        self.assertEqual(
            self.client.delete(
                reverse("payable-detail", kwargs={"commitment_id": payable.id})
            ).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(
                reverse(
                    "receivable-detail",
                    kwargs={"commitment_id": receivable.id},
                )
            ).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        payable.refresh_from_db()
        receivable.refresh_from_db()
        self.assertEqual(payable.status, Payable.Status.CANCELED)
        self.assertEqual(receivable.status, Receivable.Status.CANCELED)

        completed = Payable.objects.create(
            organization=self.organization,
            description="Conta já paga",
            amount=Decimal("80.00"),
            due_date=today,
            paid_at=today,
            status=Payable.Status.PAID,
            category="utilities",
            payment_method="pix",
            created_by=self.user,
        )
        completed_url = reverse(
            "payable-detail",
            kwargs={"commitment_id": completed.id},
        )
        self.assertEqual(
            self.client.patch(
                completed_url,
                {"description": "Alteração inválida"},
                format="json",
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.delete(completed_url).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_settle_receivable_creates_revenue(self):
        receivable = Receivable.objects.create(
            organization=self.organization,
            description="Serviço contratado",
            amount=Decimal("800.00"),
            due_date=timezone.localdate(),
            category="services",
            recurrence="monthly",
            created_by=self.user,
        )

        response = self.client.post(
            reverse(
                "receivable-settle",
                kwargs={"receivable_id": receivable.id},
            ),
            {
                "date": timezone.localdate().isoformat(),
                "payment_method": "bank_transfer",
            },
            format="json",
        )

        receivable.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(receivable.status, Receivable.Status.RECEIVED)
        self.assertTrue(Revenue.objects.filter(source_receivable=receivable).exists())
        summary_response = self.client.get(
            reverse("financial-summary"),
            {"organization_id": str(self.organization.id)},
        )
        activity = summary_response.data["recent_activity"][0]
        self.assertTrue(activity["is_recurring"])
        self.assertEqual(activity["recurrence_label"], "Mensal")

        list_response = self.client.get(
            reverse("revenue-list-create"),
            {
                "organization_id": str(self.organization.id),
                "month": timezone.localdate().strftime("%Y-%m"),
            },
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(list_response.data[0]["is_recurring"])
        self.assertEqual(list_response.data[0]["recurrence_label"], "Mensal")

        update_response = self.client.patch(
            reverse("revenue-detail", kwargs={"movement_id": activity["id"]}),
            {
                "description": "Serviço atualizado",
                "amount": "850.00",
                "notes": "Correção da baixa",
            },
            format="json",
        )
        receivable.refresh_from_db()
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receivable.description, "Serviço atualizado")
        self.assertEqual(receivable.amount, Decimal("850.00"))
        self.assertEqual(receivable.notes, "Correção da baixa")

    def test_finance_data_is_isolated_by_active_membership(self):
        other_user = User.objects.create_user(
            username="other@araris.local",
            email="other@araris.local",
            password="safe-password-456",
        )
        other_organization = Organization.objects.create(
            business_name="Outra Empresa",
            cnpj="98765432000199",
            created_by=other_user,
        )
        Membership.objects.create(
            organization=other_organization,
            user=other_user,
            invite_email=other_user.email,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
            invited_by=other_user,
        )

        response = self.client.get(
            reverse("payable-list-create"),
            {"organization_id": str(other_organization.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_future_realized_movement_is_rejected(self):
        response = self.client.post(
            reverse("revenue-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Receita futura",
                "amount": "100.00",
                "occurred_on": (timezone.localdate() + timedelta(days=1)).isoformat(),
                "category": "sales",
                "payment_method": "pix",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_bimonthly_receivable_series(self):
        response = self.client.post(
            reverse("receivable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Contrato de serviços",
                "amount": "900.00",
                "due_date": "2030-01-31",
                "category": "services",
                "recurrence": "bimonthly",
                "occurrences": 3,
                "notes": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        series = Receivable.objects.filter(
            recurrence_group=response.data["recurrence_group"]
        ).order_by("recurrence_sequence")
        self.assertEqual(series.count(), 3)
        self.assertEqual(
            list(series.values_list("due_date", flat=True)),
            [date(2030, 1, 31), date(2030, 3, 31), date(2030, 5, 31)],
        )
        self.assertEqual(
            list(series.values_list("recurrence_sequence", flat=True)),
            [1, 2, 3],
        )

    def test_commitments_respect_month_and_overdue_is_global(self):
        target_year = timezone.localdate().year + 1
        selected = Payable.objects.create(
            organization=self.organization,
            description="Compromisso selecionado",
            amount=Decimal("200.00"),
            due_date=date(target_year, 3, 10),
            category="rent",
            created_by=self.user,
        )
        Payable.objects.create(
            organization=self.organization,
            description="Outro mês",
            amount=Decimal("300.00"),
            due_date=date(target_year, 4, 10),
            category="rent",
            created_by=self.user,
        )
        overdue = Payable.objects.create(
            organization=self.organization,
            description="Sempre visível como vencido",
            amount=Decimal("100.00"),
            due_date=timezone.localdate() - timedelta(days=1),
            category="utilities",
            created_by=self.user,
        )

        pending_response = self.client.get(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "pending",
                "month": f"{target_year}-03",
            },
        )
        overdue_response = self.client.get(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "overdue",
                "month": f"{target_year}-03",
            },
        )
        period_pending_response = self.client.get(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "period_pending",
                "month": f"{target_year}-03",
            },
        )

        self.assertEqual(
            [item["id"] for item in pending_response.data],
            [str(selected.id)],
        )
        self.assertEqual(
            [item["id"] for item in overdue_response.data],
            [str(overdue.id)],
        )
        self.assertEqual(
            [item["id"] for item in period_pending_response.data],
            [str(selected.id)],
        )

    def test_summary_uses_selected_month(self):
        target_year = timezone.localdate().year + 1
        selected = Revenue.objects.create(
            organization=self.organization,
            description="Receita do período",
            amount=Decimal("125.00"),
            occurred_on=date(target_year, 3, 8),
            category="services",
            payment_method="pix",
            created_by=self.user,
        )
        Revenue.objects.create(
            organization=self.organization,
            description="Receita de outro período",
            amount=Decimal("500.00"),
            occurred_on=date(target_year, 4, 8),
            category="sales",
            payment_method="pix",
            created_by=self.user,
        )

        response = self.client.get(
            reverse("financial-summary"),
            {
                "organization_id": str(self.organization.id),
                "month": f"{target_year}-03",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["revenue"], "125.00")
        self.assertEqual(response.data["totals"]["opening_balance"], "1000.00")
        self.assertEqual(response.data["totals"]["closing_balance"], "1125.00")
        self.assertEqual(len(response.data["recent_activity"]), 1)
        self.assertEqual(response.data["recent_activity"][0]["id"], selected.id)

        list_response = self.client.get(
            reverse("revenue-list-create"),
            {
                "organization_id": str(self.organization.id),
                "month": f"{target_year}-03",
            },
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in list_response.data],
            [str(selected.id)],
        )

    def test_monthly_recurrence_can_be_indefinite(self):
        today = timezone.localdate()
        first_due_date = today
        response = self.client.post(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Aluguel sem data final",
                "amount": "1500.00",
                "due_date": first_due_date.isoformat(),
                "category": "rent",
                "recurrence": "monthly",
                "recurrence_indefinite": True,
                "notes": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["recurrence_indefinite"])
        self.assertEqual(response.data["recurrence_total"], 0)
        initial_series = Payable.objects.filter(
            recurrence_group=response.data["recurrence_group"]
        )
        self.assertGreaterEqual(initial_series.count(), 12)

        target_year = today.year + 2
        future_response = self.client.get(
            reverse("payable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "status": "pending",
                "month": f"{target_year}-{today.month:02d}",
            },
        )

        self.assertEqual(future_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(
                item["recurrence_group"] == response.data["recurrence_group"]
                for item in future_response.data
            )
        )

    def test_edit_realized_activity(self):
        revenue = Revenue.objects.create(
            organization=self.organization,
            description="Descrição original",
            amount=Decimal("100.00"),
            occurred_on=timezone.localdate(),
            category="sales",
            payment_method="pix",
            created_by=self.user,
        )

        response = self.client.patch(
            reverse("revenue-detail", kwargs={"movement_id": revenue.id}),
            {
                "description": "Descrição atualizada",
                "amount": "175.50",
                "category": "services",
                "payment_method": "bank_transfer",
                "notes": "Atividade corrigida",
            },
            format="json",
        )

        revenue.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(revenue.description, "Descrição atualizada")
        self.assertEqual(revenue.amount, Decimal("175.50"))
        self.assertEqual(revenue.category, "services")

    def test_delete_generated_activity_reopens_commitment(self):
        payable = Payable.objects.create(
            organization=self.organization,
            description="Fornecedor",
            amount=Decimal("240.00"),
            due_date=timezone.localdate(),
            category="supplies",
            created_by=self.user,
        )
        settlement_response = self.client.post(
            reverse("payable-settle", kwargs={"payable_id": payable.id}),
            {
                "date": timezone.localdate().isoformat(),
                "payment_method": "pix",
            },
            format="json",
        )
        expense_id = settlement_response.data["movement"]["id"]

        delete_response = self.client.delete(
            reverse("expense-detail", kwargs={"movement_id": expense_id})
        )

        payable.refresh_from_db()
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(payable.status, Payable.Status.PENDING)
        self.assertIsNone(payable.paid_at)
        self.assertEqual(payable.payment_method, "")
        self.assertFalse(Expense.objects.filter(id=expense_id).exists())

    def test_dashboard_returns_daily_projection_history_and_categories(self):
        today = timezone.localdate()
        Revenue.objects.create(
            organization=self.organization,
            description="Receita realizada",
            amount=Decimal("500.00"),
            occurred_on=today,
            category="services",
            payment_method="pix",
            created_by=self.user,
        )
        Expense.objects.create(
            organization=self.organization,
            description="Material consumido",
            amount=Decimal("100.00"),
            occurred_on=today,
            category="supplies",
            payment_method="pix",
            created_by=self.user,
        )
        Payable.objects.create(
            organization=self.organization,
            description="Conta vencida",
            amount=Decimal("200.00"),
            due_date=today - timedelta(days=1),
            category="utilities",
            created_by=self.user,
        )
        Receivable.objects.create(
            organization=self.organization,
            description="Recebimento futuro",
            amount=Decimal("800.00"),
            due_date=today + timedelta(days=2),
            category="services",
            created_by=self.user,
        )
        Payable.objects.create(
            organization=self.organization,
            description="Pagamento futuro",
            amount=Decimal("300.00"),
            due_date=today + timedelta(days=5),
            category="rent",
            created_by=self.user,
        )

        response = self.client.get(
            reverse("financial-dashboard"),
            {
                "organization_id": str(self.organization.id),
                "month": today.strftime("%Y-%m"),
                "history_months": 6,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        forecast = response.data["forecast"]
        self.assertEqual(forecast["current_balance"], "1400.00")
        self.assertEqual(forecast["total_receivables"], "800.00")
        self.assertEqual(forecast["total_payables"], "500.00")
        self.assertEqual(forecast["projected_balance"], "1700.00")
        self.assertEqual(forecast["lowest_balance"], "1200.00")
        self.assertEqual(forecast["overdue_payables"], "200.00")
        self.assertEqual(len(forecast["daily"]), 30)
        self.assertEqual(forecast["daily"][0]["payables"], "200.00")
        self.assertEqual(
            forecast["upcoming_impacts"][0]["effective_status"],
            "overdue",
        )
        self.assertEqual(len(response.data["monthly_history"]), 6)
        self.assertEqual(
            response.data["monthly_history"][-1]["revenue"],
            "500.00",
        )
        self.assertEqual(
            response.data["monthly_history"][-1]["expense"],
            "100.00",
        )
        self.assertEqual(
            response.data["expense_categories"][0]["category"],
            "supplies",
        )
        self.assertEqual(
            response.data["expense_categories"][0]["percentage"],
            "100.00",
        )

        three_month_response = self.client.get(
            reverse("financial-dashboard"),
            {
                "organization_id": str(self.organization.id),
                "month": today.strftime("%Y-%m"),
                "history_months": 3,
            },
        )
        self.assertEqual(three_month_response.status_code, status.HTTP_200_OK)
        self.assertEqual(three_month_response.data["history_months"], 3)
        self.assertEqual(len(three_month_response.data["monthly_history"]), 3)

    def test_dashboard_projection_includes_indefinite_recurrence(self):
        today = timezone.localdate()
        create_response = self.client.post(
            reverse("receivable-list-create"),
            {
                "organization_id": str(self.organization.id),
                "description": "Recebimento semanal",
                "amount": "100.00",
                "due_date": (today + timedelta(days=1)).isoformat(),
                "category": "services",
                "recurrence": "weekly",
                "recurrence_indefinite": True,
                "notes": "",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(
            reverse("financial-dashboard"),
            {
                "organization_id": str(self.organization.id),
                "month": today.strftime("%Y-%m"),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        forecast = response.data["forecast"]
        self.assertEqual(forecast["total_receivables"], "500.00")
        self.assertEqual(forecast["projected_balance"], "1500.00")
        self.assertEqual(
            sum(
                len(
                    [
                        item
                        for item in day["commitments"]
                        if item["type"] == "receivable"
                    ]
                )
                for day in forecast["daily"]
            ),
            5,
        )
