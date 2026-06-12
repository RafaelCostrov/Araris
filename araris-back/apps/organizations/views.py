import re

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Membership, Organization
from apps.organizations.serializers import OrganizationSerializer


def only_digits(value):
    return re.sub(r"\D", "", value or "")


class CnpjAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cnpj = only_digits(request.query_params.get("cnpj"))
        if len(cnpj) != 14:
            return Response(
                {"detail": "Informe um CNPJ com 14 dígitos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "available": not Organization.objects.filter(cnpj=cnpj).exists()
        })


class CurrentOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, user):
        return (
            Membership.objects.select_related("organization")
            .filter(user=user, status=Membership.Status.ACTIVE)
            .order_by("created_at")
            .first()
        )

    def get(self, request):
        membership = self.get_membership(request.user)
        if not membership:
            return Response(
                {"detail": "Usuário não possui empresa ativa."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = OrganizationSerializer(membership.organization)
        return Response(serializer.data)

    def patch(self, request):
        membership = self.get_membership(request.user)
        if not membership:
            return Response(
                {"detail": "Usuário não possui empresa ativa."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = OrganizationSerializer(
            membership.organization,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
