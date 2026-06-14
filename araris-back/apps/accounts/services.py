import json
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from apps.common.http import get_external_ssl_context
from apps.integrations.models import ExternalServiceLog


class GoogleAuthError(Exception):
    pass


def _duration_ms(start):
    return max(1, round((perf_counter() - start) * 1000))


def _mask_email(email):
    if not email or "@" not in email:
        return ""

    username, domain = email.split("@", 1)
    if len(username) <= 2:
        masked_username = f"{username[:1]}***"
    else:
        masked_username = f"{username[:2]}***"
    return f"{masked_username}@{domain}"


def _sanitize_google_payload(payload):
    return {
        "aud": payload.get("aud", ""),
        "email": _mask_email(payload.get("email", "")),
        "email_verified": payload.get("email_verified", ""),
        "hosted_domain": payload.get("hd", ""),
        "issuer": payload.get("iss", ""),
        "google_id_suffix": (payload.get("sub") or "")[-6:],
    }


def _log_google_oauth_call(
    *,
    status,
    http_status=None,
    request_payload=None,
    response_payload=None,
    error_message="",
    duration_ms=None,
):
    ExternalServiceLog.objects.create(
        service=ExternalServiceLog.Service.GOOGLE_OAUTH,
        http_method="GET",
        endpoint=settings.GOOGLE_TOKENINFO_ENDPOINT,
        status=status,
        http_status=http_status,
        request_payload=request_payload,
        response_payload=response_payload,
        error_message=error_message,
        duration_ms=duration_ms,
    )


def _request_google_tokeninfo(id_token):
    query = urlencode({"id_token": id_token})
    request = Request(
        f"{settings.GOOGLE_TOKENINFO_ENDPOINT}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "Araris/1.0",
        },
        method="GET",
    )
    started_at = perf_counter()
    request_payload = {"id_token_present": bool(id_token)}

    try:
        with urlopen(request, timeout=8, context=get_external_ssl_context()) as response:
            payload = json.loads(response.read().decode("utf-8"))
            _log_google_oauth_call(
                status=ExternalServiceLog.Status.SUCCESS,
                http_status=response.status,
                request_payload=request_payload,
                response_payload=_sanitize_google_payload(payload),
                duration_ms=_duration_ms(started_at),
            )
            return payload
    except HTTPError as error:
        response_payload = None
        try:
            data = json.loads(error.read().decode("utf-8"))
            message = data.get("error_description") or data.get("error")
            response_payload = {
                "error": data.get("error", ""),
                "error_description": data.get("error_description", ""),
            }
        except (json.JSONDecodeError, UnicodeDecodeError):
            message = None
        _log_google_oauth_call(
            status=ExternalServiceLog.Status.FAILURE,
            http_status=error.code,
            request_payload=request_payload,
            response_payload=response_payload,
            error_message=message or "Token do Google inválido.",
            duration_ms=_duration_ms(started_at),
        )
        raise GoogleAuthError(message or "Token do Google inválido.") from error
    except (TimeoutError, URLError, json.JSONDecodeError, UnicodeDecodeError) as error:
        _log_google_oauth_call(
            status=ExternalServiceLog.Status.FAILURE,
            request_payload=request_payload,
            error_message="Não foi possível validar o token do Google.",
            duration_ms=_duration_ms(started_at),
        )
        raise GoogleAuthError("Não foi possível validar o token do Google.") from error


def validate_google_id_token(id_token):
    if not settings.GOOGLE_OAUTH_CLIENT_IDS:
        raise GoogleAuthError("Google OAuth não está configurado no backend.")

    payload = _request_google_tokeninfo(id_token)

    if payload.get("aud") not in settings.GOOGLE_OAUTH_CLIENT_IDS:
        raise GoogleAuthError("Token do Google emitido para um client ID inválido.")

    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleAuthError("Emissor do token do Google inválido.")

    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise GoogleAuthError("A conta Google não retornou um e-mail.")

    if settings.GOOGLE_OAUTH_REQUIRE_VERIFIED_EMAIL:
        email_verified = str(payload.get("email_verified")).lower() == "true"
        if not email_verified:
            raise GoogleAuthError("A conta Google não possui e-mail verificado.")

    if settings.GOOGLE_OAUTH_HD_DOMAIN:
        hosted_domain = (payload.get("hd") or "").lower().strip()
        if hosted_domain != settings.GOOGLE_OAUTH_HD_DOMAIN.lower():
            raise GoogleAuthError("Esta conta Google não pertence ao domínio permitido.")

    return {
        "google_id": payload.get("sub", ""),
        "email": email,
        "name": payload.get("name", ""),
        "given_name": payload.get("given_name", ""),
        "family_name": payload.get("family_name", ""),
        "picture": payload.get("picture", ""),
        "email_verified": str(payload.get("email_verified")).lower() == "true",
        "hosted_domain": payload.get("hd", ""),
    }
