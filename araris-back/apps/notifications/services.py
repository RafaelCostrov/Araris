import base64
import binascii
import json
from pathlib import Path
from time import perf_counter

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.integrations.models import ExternalServiceLog
from apps.notifications.models import (
    Alert,
    Notification,
    NotificationRecipient,
    PushDevice,
)
from apps.organizations.models import Membership


class FirebaseMessagingError(Exception):
    pass


_firebase_app = None
FCM_MULTICAST_LIMIT = 500


def _duration_ms(start):
    return max(1, round((perf_counter() - start) * 1000))


def _mask_token(token):
    if not token:
        return ""
    if len(token) <= 14:
        return "***"
    return f"{token[:6]}...{token[-6:]}"


def _log_fcm_call(
    *,
    organization=None,
    user=None,
    status,
    request_payload=None,
    response_payload=None,
    error_message="",
    duration_ms=None,
):
    ExternalServiceLog.objects.create(
        service=ExternalServiceLog.Service.FIREBASE_CLOUD_MESSAGING,
        http_method="POST",
        endpoint="firebase_admin.messaging.send",
        organization=organization,
        user=user,
        status=status,
        request_payload=request_payload,
        response_payload=response_payload,
        error_message=error_message,
        duration_ms=duration_ms,
    )


def _get_firebase_app():
    global _firebase_app

    if _firebase_app:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as error:
        raise FirebaseMessagingError(
            "firebase-admin não está instalado no ambiente."
        ) from error

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    if settings.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64:
        try:
            service_account = json.loads(
                base64.b64decode(
                    settings.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
                ).decode("utf-8")
            )
        except (
            binascii.Error,
            json.JSONDecodeError,
            UnicodeDecodeError,
            ValueError,
        ) as error:
            raise FirebaseMessagingError(
                "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 inválido."
            ) from error
        credential = credentials.Certificate(service_account)
    elif settings.FIREBASE_SERVICE_ACCOUNT_FILE:
        configured_file = Path(settings.FIREBASE_SERVICE_ACCOUNT_FILE)
        service_account_file = configured_file

        if not configured_file.is_absolute():
            candidates = [
                settings.BASE_DIR / configured_file,
                settings.BASE_DIR.parent / configured_file,
            ]

            if configured_file.parts and configured_file.parts[0] == settings.BASE_DIR.name:
                candidates.append(settings.BASE_DIR / Path(*configured_file.parts[1:]))

            service_account_file = next(
                (candidate for candidate in candidates if candidate.exists()),
                candidates[0],
            )

        if not service_account_file.exists():
            raise FirebaseMessagingError(
                "Arquivo de credenciais Firebase não encontrado."
            )

        credential = credentials.Certificate(str(service_account_file))
    else:
        raise FirebaseMessagingError("Credenciais Firebase Admin não configuradas.")

    options = {}
    if settings.FIREBASE_PROJECT_ID:
        options["projectId"] = settings.FIREBASE_PROJECT_ID

    _firebase_app = firebase_admin.initialize_app(credential, options)
    return _firebase_app


def create_and_send_notification(
    *,
    organization,
    notification_type,
    title,
    message,
    priority=Alert.Priority.MEDIUM,
    data=None,
    requested_by=None,
    alert_type=Alert.Type.GENERAL,
    source_entity="",
    source_entity_id=None,
    idempotency_key=None,
):
    memberships = list(
        Membership.objects.select_related("user")
        .filter(
            organization=organization,
            status=Membership.Status.ACTIVE,
            user__isnull=False,
        )
        .order_by("created_at")
    )
    if not memberships:
        raise ValueError("A empresa não possui membros ativos.")

    payload = dict(data or {})
    with transaction.atomic():
        alert = Alert.objects.create(
            organization=organization,
            type=alert_type,
            title=title,
            message=message,
            priority=priority,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
            payload=payload,
        )
        notification = Notification.objects.create(
            organization=organization,
            alert=alert,
            channel=Notification.Channel.PUSH,
            type=notification_type,
            title=title,
            message=message,
            status=Notification.Status.PENDING,
            payload={**payload, "alert_id": str(alert.id)},
            idempotency_key=idempotency_key,
        )
        NotificationRecipient.objects.bulk_create(
            [
                NotificationRecipient(
                    notification=notification,
                    user=membership.user,
                    membership=membership,
                )
                for membership in memberships
            ]
        )

    delivery_result = send_push_notification(
        notification,
        requested_by=requested_by,
    )
    return {
        "alert": alert,
        "notification": notification,
        "delivery": delivery_result,
    }


def create_and_send_notifications(
    *,
    organizations,
    notification_type,
    title,
    message,
    priority=Alert.Priority.MEDIUM,
    data=None,
    requested_by=None,
    alert_type=Alert.Type.GENERAL,
    source_entity="",
    source_entity_id=None,
):
    organizations = list(organizations)
    active_organization_ids = set(
        Membership.objects.filter(
            organization__in=organizations,
            status=Membership.Status.ACTIVE,
            user__isnull=False,
        ).values_list("organization_id", flat=True)
    )
    organizations_without_members = [
        str(organization.id)
        for organization in organizations
        if organization.id not in active_organization_ids
    ]
    if organizations_without_members:
        raise ValueError(
            "As seguintes empresas não possuem membros ativos: "
            + ", ".join(organizations_without_members)
        )

    return [
        create_and_send_notification(
            organization=organization,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            data=data,
            requested_by=requested_by,
            alert_type=alert_type,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
        )
        for organization in organizations
    ]


def _mark_notification_failed(notification, recipients, detail):
    now = timezone.now()
    notification.status = Notification.Status.FAILED
    notification.save(update_fields=["status", "updated_at"])

    recipients.update(
        delivery_status=NotificationRecipient.DeliveryStatus.FAILED,
        failed_at=now,
        failure_detail=detail,
    )


def _mark_recipient_delivery(recipients, delivered_user_ids, failed_detail=""):
    now = timezone.now()
    for recipient in recipients:
        if recipient.user_id in delivered_user_ids:
            recipient.delivery_status = NotificationRecipient.DeliveryStatus.DELIVERED
            recipient.delivered_at = now
            recipient.failed_at = None
            recipient.failure_detail = ""
        else:
            recipient.delivery_status = NotificationRecipient.DeliveryStatus.FAILED
            recipient.failed_at = now
            recipient.failure_detail = failed_detail
        recipient.updated_at = now
    NotificationRecipient.objects.bulk_update(
        recipients,
        [
            "delivery_status",
            "delivered_at",
            "failed_at",
            "failure_detail",
            "updated_at",
        ],
        batch_size=FCM_MULTICAST_LIMIT,
    )


def _send_real_fcm(notification, devices):
    _get_firebase_app()
    from firebase_admin import messaging

    results = []
    delivered_user_ids = set()

    for start in range(0, len(devices), FCM_MULTICAST_LIMIT):
        device_batch = devices[start : start + FCM_MULTICAST_LIMIT]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=notification.title,
                body=notification.message,
            ),
            data={
                "notification_id": str(notification.id),
                "type": notification.type,
                "channel": notification.channel,
            },
            tokens=[device.token for device in device_batch],
        )
        try:
            batch_response = messaging.send_each_for_multicast(
                message,
                dry_run=settings.FCM_DRY_RUN,
            )
            for device, response in zip(device_batch, batch_response.responses):
                if response.success:
                    delivered_user_ids.add(device.user_id)
                    results.append(
                        {
                            "token": _mask_token(device.token),
                            "user_id": str(device.user_id),
                            "status": "sent",
                            "response": response.message_id,
                        }
                    )
                else:
                    results.append(
                        {
                            "token": _mask_token(device.token),
                            "user_id": str(device.user_id),
                            "status": "failed",
                            "error": str(response.exception),
                        }
                    )
        except Exception as error:
            for device in device_batch:
                results.append(
                    {
                        "token": _mask_token(device.token),
                        "user_id": str(device.user_id),
                        "status": "failed",
                        "error": str(error),
                    }
                )

    return delivered_user_ids, results


def send_push_notification(notification, *, requested_by=None):
    started_at = perf_counter()
    recipients = list(
        notification.recipients.select_related("user").filter(
            user__isnull=False,
        )
    )
    recipient_user_ids = [recipient.user_id for recipient in recipients]
    devices = list(
        PushDevice.objects.filter(
            user_id__in=recipient_user_ids,
            active=True,
        ).select_related("user")
    )
    request_payload = {
        "notification_id": str(notification.id),
        "dry_run": settings.FCM_DRY_RUN,
        "device_count": len(devices),
        "tokens": [_mask_token(device.token) for device in devices],
    }

    if not devices:
        detail = "Nenhum dispositivo ativo registrado."
        _mark_notification_failed(notification, notification.recipients.all(), detail)
        _log_fcm_call(
            organization=notification.organization,
            user=requested_by,
            status=ExternalServiceLog.Status.FAILURE,
            request_payload=request_payload,
            error_message=detail,
            duration_ms=_duration_ms(started_at),
        )
        return {"sent": 0, "failed": len(recipients), "dry_run": settings.FCM_DRY_RUN}

    try:
        delivered_user_ids, fcm_results = _send_real_fcm(notification, devices)
        response_payload = {
            "dry_run": settings.FCM_DRY_RUN,
            "results": fcm_results,
        }
    except FirebaseMessagingError as error:
        _mark_notification_failed(
            notification,
            notification.recipients.all(),
            str(error),
        )
        _log_fcm_call(
            organization=notification.organization,
            user=requested_by,
            status=ExternalServiceLog.Status.FAILURE,
            request_payload=request_payload,
            error_message=str(error),
            duration_ms=_duration_ms(started_at),
        )
        return {"sent": 0, "failed": len(recipients), "dry_run": settings.FCM_DRY_RUN}

    _mark_recipient_delivery(
        recipients,
        delivered_user_ids,
        failed_detail="Nenhum envio bem-sucedido para este usuário.",
    )

    notification.status = (
        Notification.Status.SENT if delivered_user_ids else Notification.Status.FAILED
    )
    notification.sent_at = timezone.now() if delivered_user_ids else None
    notification.save(update_fields=["status", "sent_at", "updated_at"])

    _log_fcm_call(
        organization=notification.organization,
        user=requested_by,
        status=(
            ExternalServiceLog.Status.SUCCESS
            if delivered_user_ids
            else ExternalServiceLog.Status.FAILURE
        ),
        request_payload=request_payload,
        response_payload=response_payload,
        duration_ms=_duration_ms(started_at),
    )

    return {
        "sent": len(delivered_user_ids),
        "failed": len(recipients) - len(delivered_user_ids),
        "dry_run": settings.FCM_DRY_RUN,
    }
