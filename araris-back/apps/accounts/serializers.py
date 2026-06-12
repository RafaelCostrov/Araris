from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.models import Membership, Organization
from apps.organizations.serializers import MembershipSerializer, OrganizationSerializer


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "auth_provider",
            "lgpd_consent_given",
            "lgpd_consented_at",
            "date_joined",
        )
        read_only_fields = fields

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    lgpd_consent_given = serializers.BooleanField(default=False)
    organization = OrganizationSerializer()

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Já existe um usuário com este e-mail.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "As senhas não conferem."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        organization_data = validated_data.pop("organization")
        password = validated_data.pop("password")
        validated_data.pop("password_confirm")
        name = validated_data.pop("name").strip()
        email = validated_data["email"]

        name_parts = name.split(maxsplit=1)
        user = User(
            username=email,
            email=email,
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else "",
            phone=validated_data.get("phone", ""),
            lgpd_consent_given=validated_data.get("lgpd_consent_given", False),
            lgpd_consented_at=timezone.now()
            if validated_data.get("lgpd_consent_given", False)
            else None,
        )
        user.set_password(password)
        user.save()

        organization = Organization.objects.create(
            created_by=user,
            **organization_data,
        )
        membership = Membership.objects.create(
            organization=organization,
            user=user,
            invite_email=user.email,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
            invited_by=user,
        )

        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "organization": organization,
            "membership": membership,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class EmailAvailabilitySerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()


class RegisterResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    organization = OrganizationSerializer()
    membership = MembershipSerializer()
    refresh = serializers.CharField()
    access = serializers.CharField()


class MeSerializer(serializers.Serializer):
    user = UserSerializer()
    memberships = MembershipSerializer(many=True)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD
