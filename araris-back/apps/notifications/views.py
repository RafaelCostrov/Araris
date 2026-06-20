from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification, NotificationRecipient, PushDevice
from apps.notifications.serializers import (
    InternalNotificationSendSerializer,
    PushDeviceSerializer,
    UserNotificationSerializer,
)
from apps.notifications.services import create_and_send_notifications
from apps.organizations.models import Organization


class PushDeviceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        device, _created = PushDevice.objects.update_or_create(
            token=data["token"],
            defaults={
                "user": request.user,
                "platform": data["platform"],
                "device_name": data.get("device_name", ""),
                "app_version": data.get("app_version", ""),
                "active": True,
                "last_seen_at": timezone.now(),
            },
        )
        response_serializer = PushDeviceSerializer(device)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recipients = (
            request.user.notification_recipients.select_related(
                "notification",
                "notification__organization",
                "notification__alert",
            )
            .filter(
                notification__status__in=[
                    Notification.Status.SENT,
                    Notification.Status.FAILED,
                    Notification.Status.PENDING,
                ]
            )
            .order_by("-notification__created_at")
        )
        serializer = UserNotificationSerializer(recipients, many=True)
        return Response(serializer.data)


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        recipient = get_object_or_404(
            NotificationRecipient.objects.select_related("notification"),
            notification_id=notification_id,
            user=request.user,
        )
        recipient.delivery_status = NotificationRecipient.DeliveryStatus.READ
        recipient.read_at = timezone.now()
        recipient.save(update_fields=["delivery_status", "read_at", "updated_at"])

        serializer = UserNotificationSerializer(recipient)
        return Response(serializer.data)


class InternalNotificationSendView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = InternalNotificationSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        organization_ids = data["organization_ids"]
        organizations_by_id = {
            organization.id: organization
            for organization in Organization.objects.filter(id__in=organization_ids)
        }
        missing_organization_ids = [
            str(organization_id)
            for organization_id in organization_ids
            if organization_id not in organizations_by_id
        ]
        if missing_organization_ids:
            return Response(
                {
                    "detail": "As seguintes empresas não foram encontradas: "
                    + ", ".join(missing_organization_ids)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        organizations = [
            organizations_by_id[organization_id]
            for organization_id in organization_ids
        ]

        try:
            results = create_and_send_notifications(
                organizations=organizations,
                notification_type=data["type"],
                title=data["title"],
                message=data["message"],
                priority=data["priority"],
                data=data["data"],
                requested_by=request.user,
            )
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        response_results = []
        for result in results:
            alert = result["alert"]
            notification = result["notification"]
            response_results.append(
                {
                    "organization_id": notification.organization_id,
                    "alert_id": alert.id,
                    "notification_id": notification.id,
                    "status": notification.status,
                    "recipient_count": notification.recipients.count(),
                    "sent_at": notification.sent_at,
                    "delivery": result["delivery"],
                }
            )

        return Response(
            {
                "organization_count": len(response_results),
                "notification_count": len(response_results),
                "sent_recipient_count": sum(
                    result["delivery"]["sent"]
                    for result in response_results
                ),
                "failed_recipient_count": sum(
                    result["delivery"]["failed"]
                    for result in response_results
                ),
                "results": response_results,
            },
            status=status.HTTP_201_CREATED,
        )
