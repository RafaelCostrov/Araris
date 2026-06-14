from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification, NotificationRecipient, PushDevice
from apps.notifications.serializers import (
    PushDeviceSerializer,
    UserNotificationSerializer,
)
from apps.notifications.services import create_test_notification


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


class TestNotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            notification = create_test_notification(request.user)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        recipient = get_object_or_404(
            NotificationRecipient.objects.select_related("notification"),
            notification=notification,
            user=request.user,
        )
        serializer = UserNotificationSerializer(recipient)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
