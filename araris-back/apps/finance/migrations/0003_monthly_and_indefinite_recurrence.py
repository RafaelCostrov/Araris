from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0002_commitment_recurrence"),
    ]

    operations = [
        migrations.AddField(
            model_name="payable",
            name="recurrence_indefinite",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="receivable",
            name="recurrence_indefinite",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="payable",
            name="recurrence",
            field=models.CharField(
                choices=[
                    ("none", "Não se repete"),
                    ("weekly", "Semanal"),
                    ("fortnightly", "Quinzenal"),
                    ("monthly", "Mensal"),
                    ("bimonthly", "Bimestral"),
                    ("quarterly", "Trimestral"),
                    ("semiannual", "Semestral"),
                    ("annual", "Anual"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="receivable",
            name="recurrence",
            field=models.CharField(
                choices=[
                    ("none", "Não se repete"),
                    ("weekly", "Semanal"),
                    ("fortnightly", "Quinzenal"),
                    ("monthly", "Mensal"),
                    ("bimonthly", "Bimestral"),
                    ("quarterly", "Trimestral"),
                    ("semiannual", "Semestral"),
                    ("annual", "Anual"),
                ],
                default="none",
                max_length=20,
            ),
        ),
    ]
