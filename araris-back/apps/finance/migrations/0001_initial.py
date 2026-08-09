import django.core.validators
import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('organizations', '0002_organization_cnae_code_organization_cnae_description_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Payable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('description', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('due_date', models.DateField()),
                ('paid_at', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pendente'), ('paid', 'Pago'), ('canceled', 'Cancelado')], default='pending', max_length=20)),
                ('category', models.CharField(choices=[('supplies', 'Materiais e insumos'), ('rent', 'Aluguel'), ('utilities', 'Água, luz e internet'), ('transportation', 'Transporte'), ('taxes', 'Impostos e taxas'), ('marketing', 'Marketing'), ('salaries', 'Pessoal'), ('bank_fees', 'Tarifas bancárias'), ('other', 'Outros')], max_length=30)),
                ('payment_method', models.CharField(blank=True, choices=[('cash', 'Dinheiro'), ('pix', 'Pix'), ('debit_card', 'Cartão de débito'), ('credit_card', 'Cartão de crédito'), ('bank_transfer', 'Transferência bancária'), ('boleto', 'Boleto'), ('other', 'Outro')], max_length=30)),
                ('notes', models.TextField(blank=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_payables', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payables', to='organizations.organization')),
            ],
            options={
                'ordering': ['due_date', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='Expense',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('description', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('occurred_on', models.DateField()),
                ('category', models.CharField(choices=[('supplies', 'Materiais e insumos'), ('rent', 'Aluguel'), ('utilities', 'Água, luz e internet'), ('transportation', 'Transporte'), ('taxes', 'Impostos e taxas'), ('marketing', 'Marketing'), ('salaries', 'Pessoal'), ('bank_fees', 'Tarifas bancárias'), ('other', 'Outros')], max_length=30)),
                ('payment_method', models.CharField(choices=[('cash', 'Dinheiro'), ('pix', 'Pix'), ('debit_card', 'Cartão de débito'), ('credit_card', 'Cartão de crédito'), ('bank_transfer', 'Transferência bancária'), ('boleto', 'Boleto'), ('other', 'Outro')], max_length=30)),
                ('notes', models.TextField(blank=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_expenses', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='expenses', to='organizations.organization')),
                ('source_payable', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='generated_expense', to='finance.payable')),
            ],
            options={
                'ordering': ['-occurred_on', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Receivable',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('description', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('due_date', models.DateField()),
                ('received_at', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pendente'), ('received', 'Recebido'), ('canceled', 'Cancelado')], default='pending', max_length=20)),
                ('category', models.CharField(choices=[('sales', 'Vendas'), ('services', 'Serviços'), ('refund', 'Reembolso'), ('investment', 'Investimento'), ('other', 'Outros')], max_length=30)),
                ('payment_method', models.CharField(blank=True, choices=[('cash', 'Dinheiro'), ('pix', 'Pix'), ('debit_card', 'Cartão de débito'), ('credit_card', 'Cartão de crédito'), ('bank_transfer', 'Transferência bancária'), ('boleto', 'Boleto'), ('other', 'Outro')], max_length=30)),
                ('notes', models.TextField(blank=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_receivables', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receivables', to='organizations.organization')),
            ],
            options={
                'ordering': ['due_date', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='Revenue',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('description', models.CharField(max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('occurred_on', models.DateField()),
                ('category', models.CharField(choices=[('sales', 'Vendas'), ('services', 'Serviços'), ('refund', 'Reembolso'), ('investment', 'Investimento'), ('other', 'Outros')], max_length=30)),
                ('payment_method', models.CharField(choices=[('cash', 'Dinheiro'), ('pix', 'Pix'), ('debit_card', 'Cartão de débito'), ('credit_card', 'Cartão de crédito'), ('bank_transfer', 'Transferência bancária'), ('boleto', 'Boleto'), ('other', 'Outro')], max_length=30)),
                ('notes', models.TextField(blank=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_revenues', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revenues', to='organizations.organization')),
                ('source_receivable', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='generated_revenue', to='finance.receivable')),
            ],
            options={
                'ordering': ['-occurred_on', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='payable',
            index=models.Index(fields=['organization', 'status', 'due_date'], name='finance_pay_organiz_e64b8f_idx'),
        ),
        migrations.AddIndex(
            model_name='payable',
            index=models.Index(fields=['organization', 'category'], name='finance_pay_organiz_04a51e_idx'),
        ),
        migrations.AddConstraint(
            model_name='payable',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gt', 0)), name='finance_payable_amount_positive'),
        ),
        migrations.AddIndex(
            model_name='expense',
            index=models.Index(fields=['organization', 'occurred_on'], name='finance_exp_organiz_64634b_idx'),
        ),
        migrations.AddIndex(
            model_name='expense',
            index=models.Index(fields=['organization', 'category'], name='finance_exp_organiz_6173f4_idx'),
        ),
        migrations.AddConstraint(
            model_name='expense',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gt', 0)), name='finance_expense_amount_positive'),
        ),
        migrations.AddIndex(
            model_name='receivable',
            index=models.Index(fields=['organization', 'status', 'due_date'], name='finance_rec_organiz_e750eb_idx'),
        ),
        migrations.AddIndex(
            model_name='receivable',
            index=models.Index(fields=['organization', 'category'], name='finance_rec_organiz_90601d_idx'),
        ),
        migrations.AddConstraint(
            model_name='receivable',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gt', 0)), name='finance_receivable_amount_positive'),
        ),
        migrations.AddIndex(
            model_name='revenue',
            index=models.Index(fields=['organization', 'occurred_on'], name='finance_rev_organiz_9aba29_idx'),
        ),
        migrations.AddIndex(
            model_name='revenue',
            index=models.Index(fields=['organization', 'category'], name='finance_rev_organiz_54433d_idx'),
        ),
        migrations.AddConstraint(
            model_name='revenue',
            constraint=models.CheckConstraint(condition=models.Q(('amount__gt', 0)), name='finance_revenue_amount_positive'),
        ),
    ]
