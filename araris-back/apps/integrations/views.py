from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.integrations.serializers import (
    CepLookupParamsSerializer,
    CepLookupSerializer,
    CnpjLookupParamsSerializer,
    CnpjLookupSerializer,
)
from apps.integrations.services import (
    IntegrationNotFoundError,
    IntegrationServiceError,
    lookup_cep,
    lookup_cnpj,
)


def get_request_organization(user):
    if not getattr(user, "is_authenticated", False):
        return None

    membership = (
        user.memberships.select_related("organization")
        .filter(status="active")
        .order_by("created_at")
        .first()
    )
    return membership.organization if membership else None


class CepLookupView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, cep):
        params_serializer = CepLookupParamsSerializer(data={"cep": cep})
        params_serializer.is_valid(raise_exception=True)

        try:
            data = lookup_cep(
                params_serializer.validated_data["cep"],
                user=request.user,
                organization=get_request_organization(request.user),
            )
        except IntegrationNotFoundError as error:
            return Response({"detail": str(error)}, status=status.HTTP_404_NOT_FOUND)
        except IntegrationServiceError as error:
            return Response({"detail": str(error)}, status=status.HTTP_502_BAD_GATEWAY)

        serializer = CepLookupSerializer(data)
        return Response(serializer.data)


class CnpjLookupView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, cnpj):
        params_serializer = CnpjLookupParamsSerializer(data={"cnpj": cnpj})
        params_serializer.is_valid(raise_exception=True)

        try:
            data = lookup_cnpj(
                params_serializer.validated_data["cnpj"],
                user=request.user,
                organization=get_request_organization(request.user),
            )
        except IntegrationNotFoundError as error:
            return Response({"detail": str(error)}, status=status.HTTP_404_NOT_FOUND)
        except IntegrationServiceError as error:
            return Response({"detail": str(error)}, status=status.HTTP_502_BAD_GATEWAY)

        serializer = CnpjLookupSerializer(data)
        return Response(serializer.data)
