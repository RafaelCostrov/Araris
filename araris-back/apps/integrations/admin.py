from django.contrib import admin

from apps.integrations.models import ExternalServiceLog


@admin.register(ExternalServiceLog)
class ExternalServiceLogAdmin(admin.ModelAdmin):
    list_display = ("service", "status", "http_status", "duration_ms", "organization", "user", "created_at")
    list_filter = ("service", "status", "http_status")
    search_fields = ("endpoint", "error_message", "organization__business_name", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")
