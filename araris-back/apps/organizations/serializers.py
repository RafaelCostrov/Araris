import re

from rest_framework import serializers

from apps.organizations.models import Membership, Organization


def only_digits(value):
    return re.sub(r"\D", "", value or "")


class OrganizationSerializer(serializers.ModelSerializer):
    cnpj = serializers.CharField(max_length=18)
    postal_code = serializers.CharField(max_length=10, required=False, allow_blank=True)

    class Meta:
        model = Organization
        fields = (
            "id",
            "business_name",
            "cnpj",
            "business_category",
            "postal_code",
            "street",
            "number",
            "address_complement",
            "neighborhood",
            "city",
            "state",
            "ibge_code",
            "initial_balance",
            "status",
            "timezone",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def validate_cnpj(self, value):
        cnpj = only_digits(value)
        if len(cnpj) != 14:
            raise serializers.ValidationError("Informe um CNPJ com 14 dígitos.")
        queryset = Organization.objects.filter(cnpj=cnpj)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Já existe uma empresa com este CNPJ.")
        return cnpj

    def validate_postal_code(self, value):
        postal_code = only_digits(value)
        if value and len(postal_code) != 8:
            raise serializers.ValidationError("Informe um CEP com 8 dígitos.")
        return postal_code

    def validate_state(self, value):
        return (value or "").upper()


class MembershipSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "organization",
            "role",
            "status",
            "invite_email",
            "accepted_at",
            "last_access_at",
            "created_at",
        )
        read_only_fields = fields
