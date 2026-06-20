from rest_framework import serializers

from apps.notifications.models import Alert, Notification, PushDevice


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
    delivery_status_label = serializers.CharField(
        source="get_delivery_status_display",
    )
    payload = serializers.JSONField(source="notification.payload")
    created_at = serializers.DateTimeField(source="notification.created_at")
    sent_at = serializers.DateTimeField(source="notification.sent_at", allow_null=True)
    read_at = serializers.DateTimeField(allow_null=True)


class InternalNotificationSendSerializer(serializers.Serializer):
    organization_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=500,
    )
    type = serializers.ChoiceField(choices=Notification.Type.choices)
    title = serializers.CharField(max_length=160, trim_whitespace=True)
    message = serializers.CharField(trim_whitespace=True)
    priority = serializers.ChoiceField(
        choices=Alert.Priority.choices,
        default=Alert.Priority.MEDIUM,
    )
    data = serializers.DictField(required=False, default=dict)

    def validate_organization_ids(self, value):
        return list(dict.fromkeys(value))
