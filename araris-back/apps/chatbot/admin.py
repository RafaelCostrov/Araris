from django.contrib import admin

from apps.chatbot.models import ChatMessage, Conversation, PendingAction


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ("role", "content", "metadata", "created_at")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "user", "last_message_at")
    list_filter = ("organization",)
    search_fields = ("title", "user__email", "organization__business_name")
    inlines = (ChatMessageInline,)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("content", "conversation__title")


@admin.register(PendingAction)
class PendingActionAdmin(admin.ModelAdmin):
    list_display = (
        "action_type",
        "entity_type",
        "status",
        "organization",
        "user",
        "expires_at",
    )
    list_filter = ("action_type", "entity_type", "status")
    search_fields = (
        "conversation__title",
        "user__email",
        "organization__business_name",
    )
    readonly_fields = (
        "payload",
        "summary",
        "result",
        "error_message",
        "created_at",
        "updated_at",
    )
