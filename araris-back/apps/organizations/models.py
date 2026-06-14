from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.models import TimestampedUUIDModel


class Organization(TimestampedUUIDModel):
    class BusinessCategory(models.TextChoices):
        COMMERCE = "commerce", "Comércio"
        SERVICE = "service", "Serviço"
        FOOD = "food", "Alimentação"
        BEAUTY = "beauty", "Beleza"
        HEALTH = "health", "Saúde"
        TECHNOLOGY = "technology", "Tecnologia"
        EDUCATION = "education", "Educação"
        OTHER = "other", "Outros"

    class Status(models.TextChoices):
        ACTIVE = "active", "Ativa"
        SUSPENDED = "suspended", "Suspensa"
        CANCELED = "canceled", "Cancelada"

    business_name = models.CharField(max_length=255)
    trade_name = models.CharField(max_length=255, blank=True)
    cnpj = models.CharField(max_length=14, unique=True)
    business_category = models.CharField(
        max_length=30,
        choices=BusinessCategory.choices,
        blank=True,
    )
    postal_code = models.CharField(max_length=8, blank=True)
    street = models.CharField(max_length=255, blank=True)
    number = models.CharField(max_length=30, blank=True)
    address_complement = models.CharField(max_length=120, blank=True)
    neighborhood = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=2, blank=True)
    ibge_code = models.CharField(max_length=20, blank=True)
    cnae_code = models.CharField(max_length=20, blank=True)
    cnae_description = models.CharField(max_length=255, blank=True)
    mei_opt_in = models.BooleanField(null=True, blank=True)
    registration_status = models.CharField(max_length=40, blank=True)
    initial_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_organizations",
    )

    class Meta:
        ordering = ["business_name"]
        indexes = [
            models.Index(fields=["cnpj"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.business_name


class Membership(TimestampedUUIDModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Proprietário"
        COLLABORATOR = "collaborator", "Colaborador"

    class Status(models.TextChoices):
        INVITED = "invited", "Convidado"
        ACTIVE = "active", "Ativo"
        INACTIVE = "inactive", "Inativo"
        REVOKED = "revoked", "Revogado"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
        null=True,
        blank=True,
    )
    invite_email = models.EmailField()
    role = models.CharField(max_length=20, choices=Role.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INVITED,
    )
    invite_token = models.CharField(max_length=255, blank=True, null=True, unique=True)
    invited_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sent_membership_invites",
        null=True,
        blank=True,
    )
    last_access_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["organization__business_name", "invite_email"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                condition=Q(user__isnull=False),
                name="unique_membership_per_user_organization",
            ),
            models.UniqueConstraint(
                fields=["organization", "invite_email"],
                condition=Q(status="invited"),
                name="unique_pending_invite_per_email_organization",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["invite_email"]),
        ]

    def __str__(self):
        return f"{self.invite_email} - {self.organization}"
