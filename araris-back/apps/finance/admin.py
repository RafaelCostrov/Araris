from django.contrib import admin

from apps.finance.models import Customer, Expense, Payable, Receivable, Revenue, Supplier


class BusinessContactAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "document", "email", "phone", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "document", "email", "organization__business_name")


@admin.register(Customer)
class CustomerAdmin(BusinessContactAdmin):
    pass


@admin.register(Supplier)
class SupplierAdmin(BusinessContactAdmin):
    pass


@admin.register(Revenue)
class RevenueAdmin(admin.ModelAdmin):
    list_display = ("description", "organization", "amount", "occurred_on", "category")
    list_filter = ("category", "payment_method", "occurred_on")
    search_fields = ("description", "organization__business_name")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("description", "organization", "amount", "occurred_on", "category")
    list_filter = ("category", "payment_method", "occurred_on")
    search_fields = ("description", "organization__business_name")


@admin.register(Payable)
class PayableAdmin(admin.ModelAdmin):
    list_display = (
        "description",
        "organization",
        "amount",
        "due_date",
        "status",
        "recurrence",
    )
    list_filter = ("status", "category", "recurrence", "due_date")
    search_fields = ("description", "organization__business_name")


@admin.register(Receivable)
class ReceivableAdmin(admin.ModelAdmin):
    list_display = (
        "description",
        "organization",
        "amount",
        "due_date",
        "status",
        "recurrence",
    )
    list_filter = ("status", "category", "recurrence", "due_date")
    search_fields = ("description", "organization__business_name")
