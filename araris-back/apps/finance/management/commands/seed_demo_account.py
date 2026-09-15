from datetime import date
from decimal import Decimal
from uuid import NAMESPACE_DNS, uuid5

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.finance.models import (
    Customer,
    Expense,
    ExpenseCategory,
    Payable,
    PaymentMethod,
    Receivable,
    RecurrenceFrequency,
    Revenue,
    RevenueCategory,
    Supplier,
)
from apps.organizations.models import Membership, Organization


DEMO_CNPJ = "48510276000162"
DEMO_NOTE = "Dado fictício criado para a conta de demonstração."


class Command(BaseCommand):
    help = "Cria ou atualiza uma conta de demonstração financeira do Araris."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        password = options["password"]
        stats = {"created": 0, "updated": 0}

        user, user_created = get_user_model().objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "first_name": "Millena",
                "last_name": "",
                "auth_provider": "local",
                "lgpd_consent_given": True,
                "lgpd_consented_at": timezone.now(),
            },
        )
        user.username = email
        user.first_name = "Millena"
        user.last_name = ""
        user.auth_provider = "local"
        user.is_active = True
        user.lgpd_consent_given = True
        user.lgpd_consented_at = user.lgpd_consented_at or timezone.now()
        user.set_password(password)
        user.save()
        stats["created" if user_created else "updated"] += 1

        organization, organization_created = Organization.objects.update_or_create(
            cnpj=DEMO_CNPJ,
            defaults={
                "business_name": "Studio Millena Cabelos & Beleza",
                "trade_name": "Studio Millena",
                "business_category": Organization.BusinessCategory.BEAUTY,
                "postal_code": "01310100",
                "street": "Avenida Paulista",
                "number": "1000",
                "address_complement": "Sala 12",
                "neighborhood": "Bela Vista",
                "city": "São Paulo",
                "state": "SP",
                "cnae_code": "9602501",
                "cnae_description": "Cabeleireiros, manicure e pedicure",
                "mei_opt_in": True,
                "registration_status": "ATIVA",
                "initial_balance": Decimal("4500.00"),
                "status": Organization.Status.ACTIVE,
                "timezone": "America/Sao_Paulo",
                "created_by": user,
            },
        )
        stats["created" if organization_created else "updated"] += 1

        _, membership_created = Membership.objects.update_or_create(
            organization=organization,
            user=user,
            defaults={
                "invite_email": email,
                "role": Membership.Role.OWNER,
                "status": Membership.Status.ACTIVE,
                "accepted_at": timezone.now(),
                "invited_by": user,
            },
        )
        stats["created" if membership_created else "updated"] += 1

        customers = self._seed_customers(organization, user, stats)
        suppliers = self._seed_suppliers(organization, user, stats)
        self._seed_recurring_movements(
            organization,
            user,
            customers,
            suppliers,
            stats,
        )
        self._seed_realized_movements(
            organization,
            user,
            customers,
            suppliers,
            stats,
        )
        self._seed_pending_commitments(
            organization,
            user,
            customers,
            suppliers,
            stats,
        )

        self.stdout.write(self.style.SUCCESS("Conta de demonstração preparada."))
        self.stdout.write(f"E-mail: {email}")
        self.stdout.write(f"Empresa: {organization.business_name}")
        self.stdout.write(
            "Registros processados: "
            f"{stats['created']} criados e {stats['updated']} atualizados."
        )

    def _upsert(self, model, lookup, defaults, stats):
        obj, created = model.objects.update_or_create(
            **lookup,
            defaults=defaults,
        )
        stats["created" if created else "updated"] += 1
        return obj

    def _seed_customers(self, organization, user, stats):
        data = [
            ("Ana Carolina", "ana.carolina@example.com", "11991110001"),
            ("Beatriz Souza", "beatriz.souza@example.com", "11991110002"),
            ("Camila Rocha", "camila.rocha@example.com", "11991110003"),
            ("Daniela Martins", "daniela.martins@example.com", "11991110004"),
            ("Elisa Ferreira", "elisa.ferreira@example.com", "11991110005"),
            ("Fernanda Lima", "fernanda.lima@example.com", "11991110006"),
            ("Gabriela Alves", "gabriela.alves@example.com", "11991110007"),
            ("Mariana Costa", "mariana.costa@example.com", "11991110008"),
            ("Isabela Nunes", "isabela.nunes@example.com", "11991110009"),
        ]
        return {
            name: self._upsert(
                Customer,
                {"organization": organization, "name": name},
                {
                    "email": email,
                    "phone": phone,
                    "notes": DEMO_NOTE,
                    "is_active": True,
                    "created_by": user,
                },
                stats,
            )
            for name, email, phone in data
        }

    def _seed_suppliers(self, organization, user, stats):
        data = [
            "Bella Cosméticos Distribuidora",
            "Fios & Cores Profissional",
            "Imobiliária Central",
            "Energia Paulista",
            "Meta Ads",
            "Atacado Beauty Pro",
            "Motoboy Express",
            "Conecta Telecom",
        ]
        return {
            name: self._upsert(
                Supplier,
                {"organization": organization, "name": name},
                {
                    "notes": DEMO_NOTE,
                    "is_active": True,
                    "created_by": user,
                },
                stats,
            )
            for name in data
        }

    def _seed_recurring_movements(
        self,
        organization,
        user,
        customers,
        suppliers,
        stats,
    ):
        rent_group = uuid5(NAMESPACE_DNS, "araris-demo-monthly-rent")
        care_group = uuid5(NAMESPACE_DNS, "araris-demo-monthly-care-package")
        months = range(3, 13)

        for sequence, month in enumerate(months, start=1):
            due_date = date(2026, month, 1)
            is_settled = month <= 9
            payable = self._upsert(
                Payable,
                {
                    "organization": organization,
                    "description": "Aluguel mensal do salão",
                    "due_date": due_date,
                },
                {
                    "amount": Decimal("1800.00"),
                    "paid_at": due_date if is_settled else None,
                    "status": (
                        Payable.Status.PAID
                        if is_settled
                        else Payable.Status.PENDING
                    ),
                    "category": ExpenseCategory.RENT,
                    "supplier": suppliers["Imobiliária Central"],
                    "payment_method": (
                        PaymentMethod.BANK_TRANSFER if is_settled else ""
                    ),
                    "notes": "Aluguel fixo do espaço do salão.",
                    "recurrence": RecurrenceFrequency.MONTHLY,
                    "recurrence_group": rent_group,
                    "recurrence_indefinite": False,
                    "recurrence_sequence": sequence,
                    "recurrence_total": 10,
                    "created_by": user,
                },
                stats,
            )
            if is_settled:
                self._upsert(
                    Expense,
                    {"source_payable": payable},
                    {
                        "organization": organization,
                        "description": payable.description,
                        "amount": payable.amount,
                        "occurred_on": due_date,
                        "category": payable.category,
                        "supplier": payable.supplier,
                        "payment_method": PaymentMethod.BANK_TRANSFER,
                        "notes": payable.notes,
                        "created_by": user,
                    },
                    stats,
                )

            care_due_date = date(2026, month, 5)
            care_is_settled = month <= 9
            receivable = self._upsert(
                Receivable,
                {
                    "organization": organization,
                    "description": "Plano mensal de cuidados capilares",
                    "due_date": care_due_date,
                },
                {
                    "amount": Decimal("420.00"),
                    "received_at": care_due_date if care_is_settled else None,
                    "status": (
                        Receivable.Status.RECEIVED
                        if care_is_settled
                        else Receivable.Status.PENDING
                    ),
                    "category": RevenueCategory.SERVICES,
                    "customer": customers["Daniela Martins"],
                    "payment_method": PaymentMethod.PIX if care_is_settled else "",
                    "notes": "Pacote recorrente de hidratação e escova.",
                    "recurrence": RecurrenceFrequency.MONTHLY,
                    "recurrence_group": care_group,
                    "recurrence_indefinite": False,
                    "recurrence_sequence": sequence,
                    "recurrence_total": 10,
                    "created_by": user,
                },
                stats,
            )
            if care_is_settled:
                self._upsert(
                    Revenue,
                    {"source_receivable": receivable},
                    {
                        "organization": organization,
                        "description": receivable.description,
                        "amount": receivable.amount,
                        "occurred_on": care_due_date,
                        "category": receivable.category,
                        "customer": receivable.customer,
                        "payment_method": PaymentMethod.PIX,
                        "notes": receivable.notes,
                        "created_by": user,
                    },
                    stats,
                )

    def _seed_realized_movements(
        self,
        organization,
        user,
        customers,
        suppliers,
        stats,
    ):
        revenues = [
            ("Corte e escova - Ana", "240.00", date(2026, 3, 3), "services", "Ana Carolina", "pix"),
            ("Coloração completa - Beatriz", "430.00", date(2026, 3, 7), "services", "Beatriz Souza", "credit_card"),
            ("Venda de kit nutritivo", "280.00", date(2026, 3, 12), "sales", "Camila Rocha", "pix"),
            ("Luzes e tonalização - Daniela", "590.00", date(2026, 3, 18), "services", "Daniela Martins", "credit_card"),
            ("Escova progressiva", "480.00", date(2026, 3, 23), "services", None, "debit_card"),
            ("Venda de produtos home care", "210.00", date(2026, 3, 27), "sales", "Elisa Ferreira", "cash"),
            ("Corte, tratamento e finalização", "360.00", date(2026, 4, 2), "services", "Ana Carolina", "pix"),
            ("Mechas iluminadas - Fernanda", "680.00", date(2026, 4, 8), "services", "Fernanda Lima", "credit_card"),
            ("Venda de shampoo profissional", "230.00", date(2026, 4, 11), "sales", "Beatriz Souza", "pix"),
            ("Coloração e corte - Camila", "520.00", date(2026, 4, 16), "services", "Camila Rocha", "credit_card"),
            ("Penteado para evento", "350.00", date(2026, 4, 21), "services", "Gabriela Alves", "pix"),
            ("Progressiva e reconstrução", "610.00", date(2026, 4, 27), "services", None, "debit_card"),
            ("Pacote de tratamentos - Ana", "540.00", date(2026, 5, 3), "services", "Ana Carolina", "pix"),
            ("Luzes premium - Beatriz", "760.00", date(2026, 5, 8), "services", "Beatriz Souza", "credit_card"),
            ("Venda de kit pós-química", "320.00", date(2026, 5, 12), "sales", "Elisa Ferreira", "pix"),
            ("Dia da beleza - Camila", "690.00", date(2026, 5, 17), "services", "Camila Rocha", "credit_card"),
            ("Penteados para formatura", "580.00", date(2026, 5, 23), "services", "Gabriela Alves", "bank_transfer"),
            ("Serviços sem cliente cadastrado", "470.00", date(2026, 5, 28), "services", None, "cash"),
            ("Cronograma capilar trimestral", "720.00", date(2026, 6, 2), "services", "Daniela Martins", "pix"),
            ("Mechas e reconstrução - Fernanda", "840.00", date(2026, 6, 7), "services", "Fernanda Lima", "credit_card"),
            ("Venda de produtos profissionais", "390.00", date(2026, 6, 11), "sales", "Elisa Ferreira", "pix"),
            ("Pacote de inverno - Ana", "620.00", date(2026, 6, 16), "services", "Ana Carolina", "credit_card"),
            ("Produção para casamento", "980.00", date(2026, 6, 22), "services", "Mariana Costa", "bank_transfer"),
            ("Coloração e corte", "510.00", date(2026, 6, 27), "services", None, "debit_card"),
            ("Pacote de cuidados - Beatriz", "680.00", date(2026, 7, 2), "services", "Beatriz Souza", "pix"),
            ("Luzes premium - Camila", "890.00", date(2026, 7, 7), "services", "Camila Rocha", "credit_card"),
            ("Venda de kits home care", "450.00", date(2026, 7, 11), "sales", "Elisa Ferreira", "pix"),
            ("Dia da noiva - Mariana", "1350.00", date(2026, 7, 17), "services", "Mariana Costa", "bank_transfer"),
            ("Tratamento e tonalização", "590.00", date(2026, 7, 23), "services", "Fernanda Lima", "credit_card"),
            ("Atendimentos sem cadastro", "520.00", date(2026, 7, 28), "services", None, "cash"),
            ("Venda de kit home care - Ana", "380.00", date(2026, 8, 1), "sales", "Ana Carolina", "pix"),
            ("Corte e escova - Beatriz", "220.00", date(2026, 8, 2), "services", "Beatriz Souza", "pix"),
            ("Coloração completa - Camila", "480.00", date(2026, 8, 3), "services", "Camila Rocha", "credit_card"),
            ("Cronograma capilar - Daniela", "350.00", date(2026, 8, 4), "services", "Daniela Martins", "pix"),
            ("Venda de shampoo e máscara", "260.00", date(2026, 8, 5), "sales", "Elisa Ferreira", "debit_card"),
            ("Luzes e tonalização - Fernanda", "650.00", date(2026, 8, 6), "services", "Fernanda Lima", "credit_card"),
            ("Penteado para evento - Gabriela", "320.00", date(2026, 8, 7), "services", "Gabriela Alves", "pix"),
            ("Escova progressiva", "520.00", date(2026, 8, 8), "services", None, "debit_card"),
            ("Serviços do dia - Ana", "410.00", date(2026, 8, 9), "services", "Ana Carolina", "pix"),
            ("Venda de kit home care - Fernanda", "420.00", date(2026, 9, 1), "sales", "Fernanda Lima", "pix"),
            ("Corte e escova - Ana", "230.00", date(2026, 9, 2), "services", "Ana Carolina", "pix"),
            ("Coloração completa - Beatriz", "510.00", date(2026, 9, 3), "services", "Beatriz Souza", "credit_card"),
            ("Cronograma capilar - Elisa", "380.00", date(2026, 9, 5), "services", "Elisa Ferreira", "pix"),
            ("Mechas e reconstrução - Camila", "760.00", date(2026, 9, 7), "services", "Camila Rocha", "credit_card"),
            ("Penteado para casamento", "460.00", date(2026, 9, 9), "services", "Mariana Costa", "bank_transfer"),
            ("Progressiva premium - Gabriela", "620.00", date(2026, 9, 11), "services", "Gabriela Alves", "debit_card"),
            ("Atendimentos do fim de semana", "540.00", date(2026, 9, 13), "services", None, "cash"),
            ("Venda de shampoo e finalizador", "330.00", date(2026, 9, 14), "sales", "Isabela Nunes", "debit_card"),
        ]
        expenses = [
            ("Reposição de produtos profissionais", "610.00", date(2026, 3, 4), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Compra de tinturas", "340.00", date(2026, 3, 9), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "260.00", date(2026, 3, 12), "utilities", "Energia Paulista", "boleto"),
            ("Campanha de inauguração", "280.00", date(2026, 3, 16), "marketing", "Meta Ads", "credit_card"),
            ("Entregas de produtos", "80.00", date(2026, 3, 24), "transportation", "Motoboy Express", "pix"),
            ("Produtos para hidratação", "640.00", date(2026, 4, 4), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Tinturas e tonalizantes", "390.00", date(2026, 4, 9), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "275.00", date(2026, 4, 12), "utilities", "Energia Paulista", "boleto"),
            ("Anúncios em redes sociais", "210.00", date(2026, 4, 17), "marketing", "Meta Ads", "credit_card"),
            ("Tarifas das maquininhas", "95.00", date(2026, 4, 26), "bank_fees", None, "bank_transfer"),
            ("Máscaras e finalizadores", "720.00", date(2026, 5, 4), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Estoque de coloração", "420.00", date(2026, 5, 9), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "268.00", date(2026, 5, 12), "utilities", "Energia Paulista", "boleto"),
            ("Campanha de Dia das Mães", "340.00", date(2026, 5, 15), "marketing", "Meta Ads", "credit_card"),
            ("Materiais de limpeza", "125.00", date(2026, 5, 24), "supplies", "Atacado Beauty Pro", "debit_card"),
            ("Produtos para reconstrução", "790.00", date(2026, 6, 4), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Estoque de tinturas", "455.00", date(2026, 6, 9), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "290.00", date(2026, 6, 12), "utilities", "Energia Paulista", "boleto"),
            ("Anúncios do mês", "260.00", date(2026, 6, 18), "marketing", "Meta Ads", "credit_card"),
            ("Transporte e entregas", "110.00", date(2026, 6, 25), "transportation", "Motoboy Express", "pix"),
            ("Linha premium de tratamentos", "860.00", date(2026, 7, 4), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Tinturas profissionais", "480.00", date(2026, 7, 9), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "305.00", date(2026, 7, 12), "utilities", "Energia Paulista", "boleto"),
            ("Campanha para noivas", "320.00", date(2026, 7, 18), "marketing", "Meta Ads", "credit_card"),
            ("Tarifas bancárias", "118.00", date(2026, 7, 27), "bank_fees", None, "bank_transfer"),
            ("Produtos profissionais", "720.00", date(2026, 8, 2), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Tinturas e tonalizantes", "460.00", date(2026, 8, 3), "supplies", "Fios & Cores Profissional", "pix"),
            ("Conta de energia", "285.00", date(2026, 8, 4), "utilities", "Energia Paulista", "boleto"),
            ("Anúncios em redes sociais", "190.00", date(2026, 8, 5), "marketing", "Meta Ads", "credit_card"),
            ("Entregas para clientes", "95.00", date(2026, 8, 6), "transportation", "Motoboy Express", "pix"),
            ("Tarifas das maquininhas", "128.00", date(2026, 8, 7), "bank_fees", None, "bank_transfer"),
            ("Materiais de limpeza", "115.00", date(2026, 8, 8), "supplies", "Atacado Beauty Pro", "debit_card"),
            ("Produtos profissionais", "760.00", date(2026, 9, 2), "supplies", "Bella Cosméticos Distribuidora", "bank_transfer"),
            ("Tinturas para coloração", "490.00", date(2026, 9, 4), "supplies", "Fios & Cores Profissional", "pix"),
            ("Materiais descartáveis", "145.00", date(2026, 9, 6), "supplies", "Atacado Beauty Pro", "debit_card"),
            ("Anúncios de primavera", "230.00", date(2026, 9, 8), "marketing", "Meta Ads", "credit_card"),
            ("Transporte e entregas", "105.00", date(2026, 9, 10), "transportation", "Motoboy Express", "pix"),
            ("Tarifas das maquininhas", "132.00", date(2026, 9, 13), "bank_fees", None, "bank_transfer"),
            ("Manutenção de equipamentos", "280.00", date(2026, 9, 14), "other", None, "pix"),
        ]

        for description, amount, occurred_on, category, customer, method in revenues:
            self._upsert(
                Revenue,
                {
                    "organization": organization,
                    "description": description,
                    "occurred_on": occurred_on,
                },
                {
                    "amount": Decimal(amount),
                    "category": category,
                    "customer": customers.get(customer),
                    "payment_method": method,
                    "notes": DEMO_NOTE,
                    "created_by": user,
                },
                stats,
            )

        for description, amount, occurred_on, category, supplier, method in expenses:
            self._upsert(
                Expense,
                {
                    "organization": organization,
                    "description": description,
                    "occurred_on": occurred_on,
                },
                {
                    "amount": Decimal(amount),
                    "category": category,
                    "supplier": suppliers.get(supplier),
                    "payment_method": method,
                    "notes": DEMO_NOTE,
                    "created_by": user,
                },
                stats,
            )

    def _seed_pending_commitments(
        self,
        organization,
        user,
        customers,
        suppliers,
        stats,
    ):
        payables = [
            ("Reposição urgente de tinturas", "640.00", date(2026, 8, 8), "supplies", "Fios & Cores Profissional"),
            ("Manutenção do lavatório", "350.00", date(2026, 8, 8), "other", None),
            ("Conta de energia do salão", "310.00", date(2026, 8, 12), "utilities", "Energia Paulista"),
            ("Compra de secadores profissionais", "1280.00", date(2026, 8, 15), "supplies", "Bella Cosméticos Distribuidora"),
            ("Internet e telefone", "140.00", date(2026, 8, 20), "utilities", "Conecta Telecom"),
            ("DAS de agosto", "82.60", date(2026, 8, 25), "taxes", None),
            ("Campanha de primavera", "360.00", date(2026, 8, 29), "marketing", "Meta Ads"),
            ("Manutenção do ar-condicionado", "420.00", date(2026, 9, 15), "other", None),
            ("Reposição de produtos profissionais", "780.00", date(2026, 9, 18), "supplies", "Bella Cosméticos Distribuidora"),
            ("Internet e telefone de setembro", "145.00", date(2026, 9, 20), "utilities", "Conecta Telecom"),
            ("DAS de setembro", "82.60", date(2026, 9, 25), "taxes", None),
            ("Campanha promocional de primavera", "390.00", date(2026, 9, 28), "marketing", "Meta Ads"),
        ]
        receivables = [
            ("Pacote noiva - parcela final", "950.00", date(2026, 8, 14), "services", "Mariana Costa"),
            ("Dia da noiva - Mariana", "1350.00", date(2026, 8, 18), "services", "Mariana Costa"),
            ("Pacote de mechas - Isabela", "680.00", date(2026, 8, 22), "services", "Isabela Nunes"),
            ("Venda de kits home care", "540.00", date(2026, 8, 28), "sales", None),
            ("Produção para evento corporativo", "1200.00", date(2026, 9, 7), "services", "Gabriela Alves"),
            ("Pacote de coloração - Mariana", "560.00", date(2026, 9, 15), "services", "Mariana Costa"),
            ("Pacote de mechas - Isabela", "720.00", date(2026, 9, 16), "services", "Isabela Nunes"),
            ("Dia da noiva - parcela final", "1400.00", date(2026, 9, 22), "services", "Mariana Costa"),
            ("Venda de kits home care - setembro", "620.00", date(2026, 9, 27), "sales", None),
        ]

        for description, amount, due_date, category, supplier in payables:
            self._upsert(
                Payable,
                {
                    "organization": organization,
                    "description": description,
                    "due_date": due_date,
                },
                {
                    "amount": Decimal(amount),
                    "status": Payable.Status.PENDING,
                    "paid_at": None,
                    "category": category,
                    "supplier": suppliers.get(supplier),
                    "payment_method": "",
                    "notes": DEMO_NOTE,
                    "recurrence": RecurrenceFrequency.NONE,
                    "recurrence_group": None,
                    "recurrence_indefinite": False,
                    "recurrence_sequence": 1,
                    "recurrence_total": 1,
                    "created_by": user,
                },
                stats,
            )

        for description, amount, due_date, category, customer in receivables:
            self._upsert(
                Receivable,
                {
                    "organization": organization,
                    "description": description,
                    "due_date": due_date,
                },
                {
                    "amount": Decimal(amount),
                    "status": Receivable.Status.PENDING,
                    "received_at": None,
                    "category": category,
                    "customer": customers.get(customer),
                    "payment_method": "",
                    "notes": DEMO_NOTE,
                    "recurrence": RecurrenceFrequency.NONE,
                    "recurrence_group": None,
                    "recurrence_indefinite": False,
                    "recurrence_sequence": 1,
                    "recurrence_total": 1,
                    "created_by": user,
                },
                stats,
            )
