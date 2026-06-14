from django.conf import settings
from django.db import models

from apps.common.models import TimestampedUUIDModel


class ExternalServiceLog(TimestampedUUIDModel):
    class Service(models.TextChoices):
        VIACEP = "viacep", "ViaCEP"
        BRASIL_API_CNPJ = "brasil_api_cnpj", "BrasilAPI CNPJ"
        AWESOME_API_EXCHANGE = "awesome_api_exchange", "AwesomeAPI Câmbio"
        DAS_MEI_SIMULATED = "das_mei_simulated", "DAS MEI Simulado"
        FIREBASE_CLOUD_MESSAGING = "firebase_cloud_messaging", "Firebase Cloud Messaging"
        GOOGLE_OAUTH = "google_oauth", "Google OAuth"

    class Status(models.TextChoices):
        SUCCESS = "success", "Sucesso"
        FAILURE = "failure", "Falha"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        related_name="external_service_logs",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="external_service_logs",
        null=True,
        blank=True,
    )
    service = models.CharField(max_length=40, choices=Service.choices)
    http_method = models.CharField(max_length=10)
    endpoint = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices)
    http_status = models.PositiveSmallIntegerField(null=True, blank=True)
    request_payload = models.JSONField(null=True, blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service", "status"]),
            models.Index(fields=["organization", "created_at"]),
        ]

    def __str__(self):
        return f"{self.service} - {self.status}"
