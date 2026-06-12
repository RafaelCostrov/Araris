from django.db import models
from django.utils import timezone

from apps.common.models import TimestampedUUIDModel


class DasTaxGuide(TimestampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        PAID = "paid", "Pago"
        OVERDUE = "overdue", "Vencido"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="das_tax_guides",
    )
    reference_month = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    paid_at = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    barcode = models.CharField(max_length=255, blank=True)
    proof_document_id = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ["-reference_month"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "reference_month"],
                name="unique_das_tax_guide_per_month",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["due_date"]),
        ]

    def save(self, *args, **kwargs):
        if self.reference_month:
            self.reference_month = self.reference_month.replace(day=1)
        super().save(*args, **kwargs)

    def is_overdue(self):
        return self.status != self.Status.PAID and self.due_date < timezone.localdate()

    def days_until_due(self):
        return (self.due_date - timezone.localdate()).days

    def __str__(self):
        return f"DAS {self.reference_month:%m/%Y} - {self.organization}"
