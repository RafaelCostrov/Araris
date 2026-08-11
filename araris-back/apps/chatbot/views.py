from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chatbot.actions import (
    PendingActionError,
    cancel_pending_action,
    confirm_pending_action,
)
from apps.chatbot.models import ChatMessage, Conversation, PendingAction
from apps.chatbot.serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    PendingActionRequestSerializer,
    PendingActionSerializer,
    RetryMessageSerializer,
    SendMessageSerializer,
)
from apps.chatbot.services import (
    ChatbotConfigurationError,
    ChatbotProviderError,
    generate_financial_reply,
)
from apps.organizations.models import Membership, Organization


def get_active_organization(user, organization_id):
    return get_object_or_404(
        Organization.objects.filter(
            memberships__user=user,
            memberships__status=Membership.Status.ACTIVE,
            status=Organization.Status.ACTIVE,
        ).distinct(),
        id=organization_id,
    )


def get_user_conversation(*, user, organization, conversation_id):
    return get_object_or_404(
        Conversation.objects.prefetch_related("messages__pending_actions"),
        id=conversation_id,
        user=user,
        organization=organization,
    )


def conversation_title(message):
    compact = " ".join(message.split())
    if len(compact) <= 58:
        return compact
    return f"{compact[:57].rstrip()}…"


def persist_assistant_reply(*, conversation, generated_reply):
    if isinstance(generated_reply, str):
        reply = generated_reply
        pending_action_ids = []
        provider = "groq"
        model = settings.GROQ_MODEL
    else:
        reply = generated_reply.content
        pending_action_ids = generated_reply.pending_action_ids
        provider = generated_reply.provider
        model = generated_reply.model or (
            settings.GROQ_MODEL if provider == "groq" else settings.GEMINI_MODEL
        )

    assistant_message = ChatMessage.objects.create(
        conversation=conversation,
        role=ChatMessage.Role.ASSISTANT,
        content=reply,
        metadata={"provider": provider, "model": model},
    )
    if pending_action_ids:
        PendingAction.objects.filter(
            id__in=pending_action_ids,
            conversation=conversation,
            user=conversation.user,
            assistant_message__isnull=True,
        ).update(assistant_message=assistant_message)
    conversation.last_message_at = assistant_message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return Conversation.objects.prefetch_related(
        "messages__pending_actions"
    ).get(id=conversation.id)


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        try:
            limit = max(1, min(int(request.query_params.get("limit", 12)), 50))
        except (TypeError, ValueError):
            limit = 12
        conversations = (
            Conversation.objects.filter(
                user=request.user,
                organization=organization,
            )
            .prefetch_related("messages")[:limit]
        )
        return Response(ConversationListSerializer(conversations, many=True).data)


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        conversation = get_user_conversation(
            user=request.user,
            organization=organization,
            conversation_id=conversation_id,
        )
        return Response(ConversationDetailSerializer(conversation).data)

    def delete(self, request, conversation_id):
        organization = get_active_organization(
            request.user,
            request.query_params.get("organization_id"),
        )
        conversation = get_user_conversation(
            user=request.user,
            organization=organization,
            conversation_id=conversation_id,
        )
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        organization = get_active_organization(
            request.user,
            data["organization_id"],
        )
        conversation_id = data.get("conversation_id")

        if conversation_id:
            conversation = get_user_conversation(
                user=request.user,
                organization=organization,
                conversation_id=conversation_id,
            )
        else:
            conversation = Conversation.objects.create(
                organization=organization,
                user=request.user,
                title=conversation_title(data["message"]),
            )

        is_first_user_message = not conversation.messages.filter(
            role=ChatMessage.Role.USER
        ).exists()
        user_message = ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            content=data["message"],
        )
        if is_first_user_message:
            conversation.title = conversation_title(data["message"])
        conversation.last_message_at = user_message.created_at
        conversation.save(update_fields=["title", "last_message_at", "updated_at"])

        try:
            generated_reply = generate_financial_reply(
                conversation=conversation,
                organization=organization,
            )
        except (ChatbotConfigurationError, ChatbotProviderError) as error:
            return Response(
                {
                    "detail": str(error),
                    "conversation_id": conversation.id,
                    "user_message_id": user_message.id,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        conversation = persist_assistant_reply(
            conversation=conversation,
            generated_reply=generated_reply,
        )

        return Response(
            ConversationDetailSerializer(conversation).data,
            status=status.HTTP_201_CREATED,
        )


class RetryMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_message_id):
        serializer = RetryMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = get_active_organization(
            request.user,
            serializer.validated_data["organization_id"],
        )
        user_message = get_object_or_404(
            ChatMessage.objects.select_related("conversation"),
            id=user_message_id,
            role=ChatMessage.Role.USER,
            conversation__user=request.user,
            conversation__organization=organization,
        )
        conversation = user_message.conversation
        latest_message = conversation.messages.order_by("-created_at").first()
        if latest_message.id != user_message.id:
            return Response(
                {"detail": "Esta pergunta já recebeu uma resposta."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            generated_reply = generate_financial_reply(
                conversation=conversation,
                organization=organization,
            )
        except (ChatbotConfigurationError, ChatbotProviderError) as error:
            return Response(
                {
                    "detail": str(error),
                    "conversation_id": conversation.id,
                    "user_message_id": user_message.id,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        conversation = persist_assistant_reply(
            conversation=conversation,
            generated_reply=generated_reply,
        )
        return Response(
            ConversationDetailSerializer(conversation).data,
            status=status.HTTP_201_CREATED,
        )


class PendingActionView(APIView):
    permission_classes = [IsAuthenticated]

    def get_action(self, request, action_id, organization):
        return get_object_or_404(
            PendingAction.objects.select_related("conversation"),
            id=action_id,
            user=request.user,
            organization=organization,
            conversation__user=request.user,
        )

    def post(self, request, action_id, operation):
        if operation not in {"confirm", "cancel"}:
            return Response(
                {"detail": "Operação inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PendingActionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = get_active_organization(
            request.user,
            serializer.validated_data["organization_id"],
        )
        action = self.get_action(request, action_id, organization)

        try:
            if operation == "confirm":
                action = confirm_pending_action(action=action, user=request.user)
            else:
                action = cancel_pending_action(action=action, user=request.user)
        except PendingActionError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(PendingActionSerializer(action).data)
