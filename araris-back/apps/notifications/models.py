from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.models import TimestampedUUIDModel


class Alert(TimestampedUUIDModel):
    class Type(models.TextChoices):
        DAS_DUE = "das_due", "Vencimento do DAS"
        OVERDUE_BILL = "overdue_bill", "Conta vencida"
        MEI_LIMIT = "mei_limit", "Limite MEI"
        DEFAULTED_PAYMENT = "defaulted_payment", "Inadimplência"
        BILL_DUE_SOON = "bill_due_soon", "Conta a vencer"
        SUBSCRIPTION_OVERDUE = "subscription_overdue", "Assinatura em débito"
        FORECAST_DEFICIT = "forecast_deficit", "Previsão de déficit"
        GENERAL = "general", "Geral"

    class Priority(models.TextChoices):
        LOW = "low", "Baixa"
        MEDIUM = "medium", "Média"
        HIGH = "high", "Alta"
        CRITICAL = "critical", "Crítica"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    type = models.CharField(max_length=40, choices=Type.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    source_entity = models.CharField(max_length=100, blank=True)
    source_entity_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "type"]),
            models.Index(fields=["priority", "resolved_at"]),
        ]

    def __str__(self):
        return self.title


class Notification(TimestampedUUIDModel):
    class Channel(models.TextChoices):
        INTERNAL = "internal", "Interna"
        PUSH = "push", "Push"
        EMAIL = "email", "E-mail"
        FUTURE_WEBHOOK = "future_webhook", "Webhook futuro"

    class Type(models.TextChoices):
        ALERT = "alert", "Alerta"
        SYSTEM = "system", "Sistema"
        BILLING = "billing", "Cobrança"
        AUTOMATION = "automation", "Automação"

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        SCHEDULED = "scheduled", "Agendada"
        PROCESSING = "processing", "Processando"
        SENT = "sent", "Enviada"
        FAILED = "failed", "Falha"
        CANCELED = "canceled", "Cancelada"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    alert = models.ForeignKey(
        Alert,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    channel = models.CharField(max_length=30, choices=Channel.choices)
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["idempotency_key"],
                condition=Q(idempotency_key__isnull=False),
                name="unique_notification_idempotency_key",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["channel", "status"]),
            models.Index(fields=["scheduled_for"]),
        ]

    def __str__(self):
        return self.title


class NotificationRecipient(TimestampedUUIDModel):
    class DeliveryStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        DELIVERED = "delivered", "Entregue"
        READ = "read", "Lida"
        FAILED = "failed", "Falha"

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="recipients",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_recipients",
    )
    membership = models.ForeignKey(
        "organizations.Membership",
        on_delete=models.SET_NULL,
        related_name="notification_recipients",
        null=True,
        blank=True,
    )
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    failure_detail = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "user"],
                name="unique_notification_recipient_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "delivery_status"]),
        ]

    def __str__(self):
        return f"{self.notification} -> {self.user}"


class PushDevice(TimestampedUUIDModel):
    class Platform(models.TextChoices):
        ANDROID = "android", "Android"
        IOS = "ios", "iOS"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_devices",
    )
    platform = models.CharField(max_length=20, choices=Platform.choices)
    token = models.TextField(unique=True)
    device_name = models.CharField(max_length=120, blank=True)
    app_version = models.CharField(max_length=40, blank=True)
    active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "active"]),
            models.Index(fields=["platform"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.platform}"
