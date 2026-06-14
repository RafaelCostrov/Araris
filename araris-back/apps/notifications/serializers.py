from rest_framework import serializers

from apps.notifications.models import PushDevice


class PushDeviceSerializer(serializers.ModelSerializer):
    token = serializers.CharField()

    class Meta:
        model = PushDevice
        fields = (
            "id",
            "platform",
            "token",
            "device_name",
            "app_version",
            "active",
            "last_seen_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "active", "last_seen_at", "created_at", "updated_at")


class UserNotificationSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="notification.id")
    recipient_id = serializers.UUIDField(source="id")
    title = serializers.CharField(source="notification.title")
    message = serializers.CharField(source="notification.message")
    channel = serializers.CharField(source="notification.channel")
    type = serializers.CharField(source="notification.type")
    status = serializers.CharField(source="notification.status")
    delivery_status = serializers.CharField()
    payload = serializers.JSONField(source="notification.payload")
    created_at = serializers.DateTimeField(source="notification.created_at")
    sent_at = serializers.DateTimeField(source="notification.sent_at", allow_null=True)
    read_at = serializers.DateTimeField(allow_null=True)
