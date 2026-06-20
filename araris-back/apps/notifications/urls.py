from django.urls import path

from apps.notifications.views import (
    InternalNotificationSendView,
    NotificationListView,
    NotificationReadView,
    PushDeviceListCreateView,
)


urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path(
        "internal/send/",
        InternalNotificationSendView.as_view(),
        name="notification-internal-send",
    ),
    path(
        "push-devices/",
        PushDeviceListCreateView.as_view(),
        name="push-device-list-create",
    ),
    path(
        "<uuid:notification_id>/read/",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
]
