from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedUUIDModel


class Conversation(TimestampedUUIDModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="chat_conversations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_conversations",
    )
    title = models.CharField(max_length=120, default="Nova conversa")
    last_message_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "user", "last_message_at"]),
        ]

    def __str__(self):
        return self.title


class ChatMessage(TimestampedUUIDModel):
    class Role(models.TextChoices):
        USER = "user", "Usuário"
        ASSISTANT = "assistant", "Assistente"

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "created_at"])]

    def __str__(self):
        return f"{self.get_role_display()}: {self.content[:50]}"


class PendingAction(TimestampedUUIDModel):
    class ActionType(models.TextChoices):
        CREATE = "create", "Criar"
        UPDATE = "update", "Editar"
        DELETE = "delete", "Excluir"

    class EntityType(models.TextChoices):
        PAYABLE = "payable", "Conta a pagar"
        RECEIVABLE = "receivable", "Conta a receber"
        REVENUE = "revenue", "Entrada"
        EXPENSE = "expense", "Saída"
        CUSTOMER = "customer", "Cliente"
        SUPPLIER = "supplier", "Fornecedor"

    class Status(models.TextChoices):
        PENDING = "pending", "Aguardando confirmação"
        CONFIRMED = "confirmed", "Confirmada"
        CANCELED = "canceled", "Cancelada"
        EXPIRED = "expired", "Expirada"
        FAILED = "failed", "Falhou"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="chatbot_actions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chatbot_actions",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="pending_actions",
    )
    assistant_message = models.ForeignKey(
        ChatMessage,
        on_delete=models.SET_NULL,
        related_name="pending_actions",
        null=True,
        blank=True,
    )
    action_type = models.CharField(max_length=20, choices=ActionType.choices)
    entity_type = models.CharField(max_length=20, choices=EntityType.choices)
    target_id = models.UUIDField(null=True, blank=True)
    target_version = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    expires_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["organization", "user", "status"]),
            models.Index(fields=["conversation", "created_at"]),
        ]

    @property
    def effective_status(self):
        if self.status == self.Status.PENDING and self.expires_at <= timezone.now():
            return self.Status.EXPIRED
        return self.status

    def __str__(self):
        return f"{self.get_action_type_display()} {self.get_entity_type_display()}"
