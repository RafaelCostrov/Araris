from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.services import GoogleAuthError, validate_google_id_token
from apps.organizations.models import Membership, Organization
from apps.organizations.serializers import MembershipSerializer, OrganizationSerializer


User = get_user_model()


def build_token_pair(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def split_google_name(google_user):
    name = google_user.get("name", "").strip()
    first_name = google_user.get("given_name", "").strip()
    last_name = google_user.get("family_name", "").strip()

    if not first_name and name:
        name_parts = name.split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

    return first_name, last_name


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

        return {
            "user": user,
            "organization": organization,
            "membership": membership,
            **build_token_pair(user),
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


class GoogleLoginResponseSerializer(serializers.Serializer):
    user = UserSerializer()
    refresh = serializers.CharField()
    access = serializers.CharField()


class GoogleAuthTokenSerializer(serializers.Serializer):
    id_token = serializers.CharField(write_only=True)

    def validate_id_token(self, value):
        try:
            self.google_user = validate_google_id_token(value)
        except GoogleAuthError as error:
            raise serializers.ValidationError(str(error)) from error
        return value


class GoogleLoginSerializer(GoogleAuthTokenSerializer):
    def save(self):
        google_user = self.google_user
        user = (
            User.objects.filter(google_id=google_user["google_id"]).first()
            or User.objects.filter(email=google_user["email"]).first()
        )

        if not user:
            raise serializers.ValidationError(
                "Conta Google ainda não cadastrada. Crie sua conta primeiro."
            )

        first_name, last_name = split_google_name(google_user)
        user.google_id = google_user["google_id"]
        user.auth_provider = User.AuthProvider.GOOGLE
        user.first_name = user.first_name or first_name
        user.last_name = user.last_name or last_name
        user.save(update_fields=["google_id", "auth_provider", "first_name", "last_name"])

        return {
            "user": user,
            **build_token_pair(user),
        }


class GoogleRegisterSerializer(GoogleAuthTokenSerializer):
    lgpd_consent_given = serializers.BooleanField(default=False)
    organization = OrganizationSerializer()

    @transaction.atomic
    def save(self):
        google_user = self.google_user
        organization_data = self.validated_data["organization"]
        user = (
            User.objects.filter(google_id=google_user["google_id"]).first()
            or User.objects.filter(email=google_user["email"]).first()
        )

        if user and user.memberships.filter(status=Membership.Status.ACTIVE).exists():
            raise serializers.ValidationError(
                "Já existe uma conta com este Google. Acesse sua conta para continuar."
            )

        first_name, last_name = split_google_name(google_user)

        if not user:
            user = User(
                username=google_user["email"],
                email=google_user["email"],
                first_name=first_name,
                last_name=last_name,
                auth_provider=User.AuthProvider.GOOGLE,
                google_id=google_user["google_id"],
                lgpd_consent_given=self.validated_data.get(
                    "lgpd_consent_given",
                    False,
                ),
                lgpd_consented_at=timezone.now()
                if self.validated_data.get("lgpd_consent_given", False)
                else None,
            )
            user.set_unusable_password()
            user.save()
        else:
            user.google_id = google_user["google_id"]
            user.auth_provider = User.AuthProvider.GOOGLE
            user.first_name = user.first_name or first_name
            user.last_name = user.last_name or last_name
            user.lgpd_consent_given = self.validated_data.get(
                "lgpd_consent_given",
                user.lgpd_consent_given,
            )
            if user.lgpd_consent_given and not user.lgpd_consented_at:
                user.lgpd_consented_at = timezone.now()
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

        return {
            "user": user,
            "organization": organization,
            "membership": membership,
            **build_token_pair(user),
        }


class MeSerializer(serializers.Serializer):
    user = UserSerializer()
    memberships = MembershipSerializer(many=True)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD
