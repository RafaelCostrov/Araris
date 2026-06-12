from django.contrib import admin

from apps.notifications.models import Alert, Notification, NotificationRecipient, PushDevice


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "type", "priority", "resolved_at", "created_at")
    list_filter = ("type", "priority", "resolved_at")
    search_fields = ("title", "message", "organization__business_name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "channel", "type", "status", "scheduled_for", "sent_at")
    list_filter = ("channel", "type", "status")
    search_fields = ("title", "message", "organization__business_name", "idempotency_key")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(NotificationRecipient)
class NotificationRecipientAdmin(admin.ModelAdmin):
    list_display = ("notification", "user", "membership", "delivery_status", "read_at")
    list_filter = ("delivery_status",)
    search_fields = ("notification__title", "user__email")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "device_name", "app_version", "active", "last_seen_at")
    list_filter = ("platform", "active")
    search_fields = ("user__email", "device_name", "token")
    readonly_fields = ("id", "created_at", "updated_at")
