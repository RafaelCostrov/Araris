from django.contrib import admin

from apps.tax.models import DasTaxGuide


@admin.register(DasTaxGuide)
class DasTaxGuideAdmin(admin.ModelAdmin):
    list_display = ("organization", "reference_month", "amount", "due_date", "paid_at", "status")
    list_filter = ("status", "reference_month")
    search_fields = ("organization__business_name", "organization__cnpj", "barcode")
    readonly_fields = ("id", "created_at", "updated_at")
