from django.urls import path

from apps.chatbot.views import (
    ConversationDetailView,
    ConversationListView,
    PendingActionView,
    RetryMessageView,
    SendMessageView,
)


urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),
    path("messages/", SendMessageView.as_view(), name="message-send"),
    path(
        "messages/<uuid:user_message_id>/retry/",
        RetryMessageView.as_view(),
        name="message-retry",
    ),
    path(
        "actions/<uuid:action_id>/<str:operation>/",
        PendingActionView.as_view(),
        name="pending-action",
    ),
]
