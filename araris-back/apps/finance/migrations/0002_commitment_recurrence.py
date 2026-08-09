from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="payable",
            name="recurrence",
            field=models.CharField(
                choices=[
                    ("none", "Não se repete"),
                    ("weekly", "Semanal"),
                    ("fortnightly", "Quinzenal"),
                    ("bimonthly", "Bimestral"),
                    ("quarterly", "Trimestral"),
                    ("semiannual", "Semestral"),
                    ("annual", "Anual"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="payable",
            name="recurrence_group",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="payable",
            name="recurrence_sequence",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="payable",
            name="recurrence_total",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="receivable",
            name="recurrence",
            field=models.CharField(
                choices=[
                    ("none", "Não se repete"),
                    ("weekly", "Semanal"),
                    ("fortnightly", "Quinzenal"),
                    ("bimonthly", "Bimestral"),
                    ("quarterly", "Trimestral"),
                    ("semiannual", "Semestral"),
                    ("annual", "Anual"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="receivable",
            name="recurrence_group",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="receivable",
            name="recurrence_sequence",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="receivable",
            name="recurrence_total",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
