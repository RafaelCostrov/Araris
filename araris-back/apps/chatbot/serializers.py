from rest_framework import serializers

from apps.chatbot.models import ChatMessage, Conversation, PendingAction


class PendingActionSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    action_type_label = serializers.CharField(
        source="get_action_type_display",
        read_only=True,
    )
    entity_type_label = serializers.CharField(
        source="get_entity_type_display",
        read_only=True,
    )

    class Meta:
        model = PendingAction
        fields = (
            "id",
            "action_type",
            "action_type_label",
            "entity_type",
            "entity_type_label",
            "target_id",
            "summary",
            "status",
            "status_label",
            "expires_at",
            "resolved_at",
            "result",
            "error_message",
        )
        read_only_fields = fields

    def get_status(self, obj):
        return obj.effective_status

    def get_status_label(self, obj):
        return dict(PendingAction.Status.choices)[obj.effective_status]


class ChatMessageSerializer(serializers.ModelSerializer):
    actions = PendingActionSerializer(
        source="pending_actions",
        many=True,
        read_only=True,
    )

    class Meta:
        model = ChatMessage
        fields = ("id", "role", "content", "actions", "created_at")
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "title", "preview", "last_message_at")
        read_only_fields = fields

    def get_preview(self, obj):
        messages = list(obj.messages.all())
        if not messages:
            return ""
        return messages[-1].content


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "last_message_at", "messages")
        read_only_fields = fields


class SendMessageSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()
    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    message = serializers.CharField(max_length=1500, trim_whitespace=True)

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("Escreva uma mensagem para a Araris.")
        return value.strip()


class RetryMessageSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()


class PendingActionRequestSerializer(serializers.Serializer):
    organization_id = serializers.UUIDField()
