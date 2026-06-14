from rest_framework import serializers

from apps.integrations.services import only_digits


class CepLookupParamsSerializer(serializers.Serializer):
    cep = serializers.CharField()

    def validate_cep(self, value):
        cep = only_digits(value)
        if len(cep) != 8:
            raise serializers.ValidationError("Informe um CEP com 8 dígitos.")
        return cep


class CepLookupSerializer(serializers.Serializer):
    postal_code = serializers.CharField()
    street = serializers.CharField(allow_blank=True)
    address_complement = serializers.CharField(allow_blank=True)
    neighborhood = serializers.CharField(allow_blank=True)
    city = serializers.CharField(allow_blank=True)
    state = serializers.CharField(allow_blank=True)
    ibge_code = serializers.CharField(allow_blank=True)


class CnpjLookupParamsSerializer(serializers.Serializer):
    cnpj = serializers.CharField()

    def validate_cnpj(self, value):
        cnpj = only_digits(value)
        if len(cnpj) != 14:
            raise serializers.ValidationError("Informe um CNPJ com 14 dígitos.")
        return cnpj


class CnpjLookupSerializer(serializers.Serializer):
    cnpj = serializers.CharField()
    business_name = serializers.CharField(allow_blank=True)
    trade_name = serializers.CharField(allow_blank=True)
    postal_code = serializers.CharField(allow_blank=True)
    street = serializers.CharField(allow_blank=True)
    number = serializers.CharField(allow_blank=True)
    address_complement = serializers.CharField(allow_blank=True)
    neighborhood = serializers.CharField(allow_blank=True)
    city = serializers.CharField(allow_blank=True)
    state = serializers.CharField(allow_blank=True)
    ibge_code = serializers.CharField(allow_blank=True)
    cnae_code = serializers.CharField(allow_blank=True)
    cnae_description = serializers.CharField(allow_blank=True)
    mei_opt_in = serializers.BooleanField(allow_null=True)
    registration_status = serializers.CharField(allow_blank=True)
