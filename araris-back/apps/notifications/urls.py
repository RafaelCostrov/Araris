from django.urls import path

from apps.notifications.views import (
    NotificationListView,
    NotificationReadView,
    PushDeviceListCreateView,
    TestNotificationView,
)


urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("test/", TestNotificationView.as_view(), name="notification-test"),
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
