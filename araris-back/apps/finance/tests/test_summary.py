from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.finance.models import Expense, Payable, Receivable, Revenue
from apps.organizations.models import Membership, Organization


class FinancialSummaryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="summary@araris.local",
            email="summary@araris.local",
        )
        cls.organization = Organization.objects.create(
            business_name="Empresa do resumo",
            cnpj="12345678000190",
            initial_balance=Decimal("1000.25"),
            created_by=cls.user,
        )
        Membership.objects.create(
            organization=cls.organization,
            user=cls.user,
            invite_email=cls.user.email,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
        )

    def setUp(self):
        self.client.force_authenticate(self.user)
        today = patch("django.utils.timezone.localdate", return_value=date(2026, 9, 15))
        today.start()
        self.addCleanup(today.stop)

    def summary(self, month="2026-09", organization=None):
        return self.client.get(
            reverse("financial-summary"),
            {
                "organization_id": str((organization or self.organization).id),
                "month": month,
            },
        )

    def create_history(self):
        for model, amounts, category in (
            (Revenue, ("200", "100.10", "50.20", "999"), "sales"),
            (Expense, ("40", "20.05", "10.10", "777"), "supplies"),
        ):
            for occurred_on, amount in zip(
                (date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 30), date(2026, 10, 1)),
                amounts,
            ):
                model.objects.create(
                    organization=self.organization,
                    description="Movimentação de teste",
                    amount=Decimal(amount),
                    occurred_on=occurred_on,
                    category=category,
                    payment_method="pix",
                    created_by=self.user,
                )

        for model, multiplier, category, completed_status in (
            (Payable, 10, "supplies", Payable.Status.PAID),
            (Receivable, 1, "sales", Receivable.Status.RECEIVED),
        ):
            for index, due_date in enumerate(
                (date(2026, 8, 31), date(2026, 9, 1), date(2026, 9, 15),
                 date(2026, 9, 30), date(2026, 10, 1)),
                start=1,
            ):
                model.objects.create(
                    organization=self.organization,
                    description="Compromisso pendente",
                    amount=Decimal(index * multiplier),
                    due_date=due_date,
                    category=category,
                    created_by=self.user,
                )
            for commitment_status in (completed_status, model.Status.CANCELED):
                model.objects.create(
                    organization=self.organization,
                    description="Compromisso fora dos totais pendentes",
                    amount=Decimal("10000"),
                    due_date=date(2026, 9, 1),
                    category=category,
                    status=commitment_status,
                    created_by=self.user,
                )

    def test_summary_preserves_balances_period_boundaries_and_pending_statuses(self):
        self.create_history()

        response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period"], date(2026, 9, 1))
        self.assertEqual(response.data["totals"], {
            "revenue": "150.30",
            "expense": "30.15",
            "monthly_balance": "120.15",
            "opening_balance": "1160.25",
            "closing_balance": "1280.40",
            "balance": "1280.40",
            "payables_due_in_period": "90.00",
            "receivables_due_in_period": "9.00",
            "overdue_payables": "30.00",
            "overdue_receivables": "3.00",
            "due_today_payables": "30.00",
            "due_today_receivables": "3.00",
        })
        self.assertEqual(response.data["counts"], {
            "pending_payables": 3,
            "pending_receivables": 3,
            "overdue_payables": 2,
            "overdue_receivables": 2,
            "due_today_payables": 1,
            "due_today_receivables": 1,
        })
        self.assertEqual(len(response.data["recent_activity"]), 4)
        self.assertEqual(
            [item["date"] for item in response.data["recent_activity"]],
            [date(2026, 9, 30)] * 2 + [date(2026, 9, 1)] * 2,
        )

    def test_overdue_and_due_today_remain_global_when_another_month_is_selected(self):
        self.create_history()

        response = self.summary(month="2026-10")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["opening_balance"], "1280.40")
        self.assertEqual(response.data["totals"]["closing_balance"], "1502.40")
        self.assertEqual(response.data["totals"]["payables_due_in_period"], "50.00")
        self.assertEqual(response.data["totals"]["receivables_due_in_period"], "5.00")
        self.assertEqual(response.data["totals"]["overdue_payables"], "30.00")
        self.assertEqual(response.data["totals"]["overdue_receivables"], "3.00")
        self.assertEqual(response.data["totals"]["due_today_payables"], "30.00")
        self.assertEqual(response.data["totals"]["due_today_receivables"], "3.00")
        self.assertEqual(response.data["counts"]["pending_payables"], 1)
        self.assertEqual(response.data["counts"]["overdue_payables"], 2)

    def test_empty_summary_returns_zero_totals_and_preserves_initial_balance(self):
        response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for key, value in response.data["totals"].items():
            expected = "1000.25" if key in {"opening_balance", "closing_balance", "balance"} else "0.00"
            self.assertEqual(value, expected, key)
        self.assertTrue(all(count == 0 for count in response.data["counts"].values()))
        self.assertEqual(response.data["recent_activity"], [])

    def test_summary_excludes_other_organizations(self):
        self.create_history()
        other = Organization.objects.create(
            business_name="Outra empresa",
            cnpj="98765432000190",
            created_by=self.user,
        )
        for model, category, date_field in (
            (Revenue, "sales", "occurred_on"),
            (Expense, "supplies", "occurred_on"),
            (Payable, "supplies", "due_date"),
            (Receivable, "sales", "due_date"),
        ):
            model.objects.create(
                organization=other,
                description="Dados de outra empresa",
                amount=Decimal("99999"),
                category=category,
                payment_method="pix",
                created_by=self.user,
                **{date_field: date(2026, 9, 15)},
            )

        response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["revenue"], "150.30")
        self.assertEqual(response.data["totals"]["expense"], "30.15")
        self.assertEqual(response.data["totals"]["payables_due_in_period"], "90.00")
        self.assertEqual(response.data["totals"]["receivables_due_in_period"], "9.00")
        self.assertEqual(len(response.data["recent_activity"]), 4)
        self.assertEqual(self.summary(organization=other).status_code, status.HTTP_404_NOT_FOUND)

    def test_summary_uses_one_aggregation_query_per_financial_table(self):
        self.create_history()

        with CaptureQueriesContext(connection) as queries:
            response = self.summary()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        aggregates = [
            query["sql"] for query in queries
            if "SUM(" in query["sql"].upper() or "COUNT(" in query["sql"].upper()
        ]
        self.assertEqual(len(aggregates), 4, aggregates)
        for model in (Revenue, Expense, Payable, Receivable):
            self.assertEqual(
                sum(f'FROM "{model._meta.db_table}"' in sql for sql in aggregates),
                1,
                model.__name__,
            )
