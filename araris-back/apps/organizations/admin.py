from django.contrib import admin

from apps.organizations.models import Membership, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "business_name",
        "trade_name",
        "cnpj",
        "business_category",
        "registration_status",
        "status",
        "city",
        "state",
    )
    list_filter = ("status", "business_category", "registration_status", "state")
    search_fields = ("business_name", "trade_name", "cnpj", "city", "cnae_code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("invite_email", "organization", "role", "status", "user")
    list_filter = ("role", "status")
    search_fields = ("invite_email", "organization__business_name", "user__email")
    readonly_fields = ("id", "created_at", "updated_at", "invited_at")
