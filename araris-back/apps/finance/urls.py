from django.urls import path

from apps.finance.views import (
    CustomerDetailView,
    CustomerListCreateView,
    ExpenseListCreateView,
    ExpenseDetailView,
    FinancialDashboardView,
    FinancialSummaryView,
    PayableDetailView,
    PayableListCreateView,
    PayableSettlementView,
    ReceivableListCreateView,
    ReceivableDetailView,
    ReceivableSettlementView,
    RevenueListCreateView,
    RevenueDetailView,
    SupplierDetailView,
    SupplierListCreateView,
)


urlpatterns = [
    path("customers/", CustomerListCreateView.as_view(), name="customer-list-create"),
    path(
        "customers/<uuid:contact_id>/",
        CustomerDetailView.as_view(),
        name="customer-detail",
    ),
    path("suppliers/", SupplierListCreateView.as_view(), name="supplier-list-create"),
    path(
        "suppliers/<uuid:contact_id>/",
        SupplierDetailView.as_view(),
        name="supplier-detail",
    ),
    path("revenues/", RevenueListCreateView.as_view(), name="revenue-list-create"),
    path(
        "revenues/<uuid:movement_id>/",
        RevenueDetailView.as_view(),
        name="revenue-detail",
    ),
    path("expenses/", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path(
        "expenses/<uuid:movement_id>/",
        ExpenseDetailView.as_view(),
        name="expense-detail",
    ),
    path("payables/", PayableListCreateView.as_view(), name="payable-list-create"),
    path(
        "payables/<uuid:commitment_id>/",
        PayableDetailView.as_view(),
        name="payable-detail",
    ),
    path(
        "payables/<uuid:payable_id>/settle/",
        PayableSettlementView.as_view(),
        name="payable-settle",
    ),
    path(
        "receivables/",
        ReceivableListCreateView.as_view(),
        name="receivable-list-create",
    ),
    path(
        "receivables/<uuid:commitment_id>/",
        ReceivableDetailView.as_view(),
        name="receivable-detail",
    ),
    path(
        "receivables/<uuid:receivable_id>/settle/",
        ReceivableSettlementView.as_view(),
        name="receivable-settle",
    ),
    path("summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("dashboard/", FinancialDashboardView.as_view(), name="financial-dashboard"),
]
