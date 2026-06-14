import json
import re
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from apps.common.http import get_external_ssl_context
from apps.integrations.models import ExternalServiceLog


REQUEST_TIMEOUT_SECONDS = 8


class IntegrationServiceError(Exception):
    def __init__(
        self,
        message,
        *,
        http_status=None,
        response_payload=None,
        duration_ms=None,
    ):
        super().__init__(message)
        self.http_status = http_status
        self.response_payload = response_payload
        self.duration_ms = duration_ms


class IntegrationNotFoundError(IntegrationServiceError):
    pass


def only_digits(value):
    return re.sub(r"\D", "", value or "")


def _duration_ms(start):
    return max(1, round((perf_counter() - start) * 1000))


def _decode_json(raw_body):
    if not raw_body:
        return {}

    text = raw_body.decode("utf-8")
    return json.loads(text)


def _request_json(endpoint):
    start = perf_counter()
    request = Request(
        endpoint,
        headers={
            "Accept": "application/json",
            "User-Agent": "Araris/1.0",
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
            context=get_external_ssl_context(),
        ) as response:
            data = _decode_json(response.read())
            return data, response.status, _duration_ms(start)
    except HTTPError as error:
        response_payload = None
        try:
            response_payload = _decode_json(error.read())
        except (json.JSONDecodeError, UnicodeDecodeError):
            response_payload = None

        raise IntegrationServiceError(
            "O serviço externo retornou uma resposta inválida.",
            http_status=error.code,
            response_payload=response_payload,
            duration_ms=_duration_ms(start),
        ) from error
    except (TimeoutError, URLError) as error:
        raise IntegrationServiceError(
            "Não foi possível conectar ao serviço externo.",
            duration_ms=_duration_ms(start),
        ) from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise IntegrationServiceError(
            "O serviço externo retornou dados em um formato inesperado.",
            duration_ms=_duration_ms(start),
        ) from error


def _log_external_call(
    *,
    service,
    endpoint,
    user=None,
    organization=None,
    status,
    http_status=None,
    request_payload=None,
    response_payload=None,
    error_message="",
    duration_ms=None,
):
    ExternalServiceLog.objects.create(
        service=service,
        http_method="GET",
        endpoint=endpoint,
        user=user if getattr(user, "is_authenticated", False) else None,
        organization=organization,
        status=status,
        http_status=http_status,
        request_payload=request_payload,
        response_payload=response_payload,
        error_message=error_message,
        duration_ms=duration_ms,
    )


def lookup_cep(cep, *, user=None, organization=None):
    cep_digits = only_digits(cep)
    endpoint = f"https://viacep.com.br/ws/{cep_digits}/json/"
    request_payload = {"cep": cep_digits}

    try:
        data, http_status, duration_ms = _request_json(endpoint)

        if data.get("erro"):
            raise IntegrationNotFoundError(
                "CEP não encontrado.",
                http_status=http_status,
                response_payload=data,
                duration_ms=duration_ms,
            )

        result = {
            "postal_code": only_digits(data.get("cep")),
            "street": data.get("logradouro", ""),
            "address_complement": data.get("complemento", ""),
            "neighborhood": data.get("bairro", ""),
            "city": data.get("localidade", ""),
            "state": data.get("uf", ""),
            "ibge_code": data.get("ibge", ""),
        }
        _log_external_call(
            service=ExternalServiceLog.Service.VIACEP,
            endpoint=endpoint,
            user=user,
            organization=organization,
            status=ExternalServiceLog.Status.SUCCESS,
            http_status=http_status,
            request_payload=request_payload,
            response_payload=result,
            duration_ms=duration_ms,
        )
        return result
    except IntegrationServiceError as error:
        _log_external_call(
            service=ExternalServiceLog.Service.VIACEP,
            endpoint=endpoint,
            user=user,
            organization=organization,
            status=ExternalServiceLog.Status.FAILURE,
            http_status=error.http_status,
            request_payload=request_payload,
            response_payload=error.response_payload,
            error_message=str(error),
            duration_ms=error.duration_ms,
        )
        raise


def _format_cnpj_street(data):
    street = (data.get("logradouro") or "").strip()
    street_type = (data.get("descricao_tipo_de_logradouro") or "").strip()

    if street and street_type and not street.upper().startswith(street_type.upper()):
        return f"{street_type} {street}".strip()

    return street


def lookup_cnpj(cnpj, *, user=None, organization=None):
    cnpj_digits = only_digits(cnpj)
    endpoint = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_digits}"
    request_payload = {"cnpj": cnpj_digits}

    try:
        data, http_status, duration_ms = _request_json(endpoint)
        result = {
            "cnpj": only_digits(data.get("cnpj")),
            "business_name": data.get("razao_social", ""),
            "trade_name": data.get("nome_fantasia", ""),
            "postal_code": only_digits(data.get("cep")),
            "street": _format_cnpj_street(data),
            "number": data.get("numero", ""),
            "address_complement": data.get("complemento", ""),
            "neighborhood": data.get("bairro", ""),
            "city": data.get("municipio", ""),
            "state": data.get("uf", ""),
            "ibge_code": str(data.get("codigo_municipio_ibge") or ""),
            "cnae_code": str(data.get("cnae_fiscal") or ""),
            "cnae_description": data.get("cnae_fiscal_descricao", ""),
            "mei_opt_in": data.get("opcao_pelo_mei"),
            "registration_status": data.get("descricao_situacao_cadastral", ""),
        }
        _log_external_call(
            service=ExternalServiceLog.Service.BRASIL_API_CNPJ,
            endpoint=endpoint,
            user=user,
            organization=organization,
            status=ExternalServiceLog.Status.SUCCESS,
            http_status=http_status,
            request_payload=request_payload,
            response_payload=result,
            duration_ms=duration_ms,
        )
        return result
    except IntegrationServiceError as error:
        if error.http_status == 404:
            error = IntegrationNotFoundError(
                "CNPJ não encontrado.",
                http_status=error.http_status,
                response_payload=error.response_payload,
                duration_ms=error.duration_ms,
            )

        _log_external_call(
            service=ExternalServiceLog.Service.BRASIL_API_CNPJ,
            endpoint=endpoint,
            user=user,
            organization=organization,
            status=ExternalServiceLog.Status.FAILURE,
            http_status=error.http_status,
            request_payload=request_payload,
            response_payload=error.response_payload,
            error_message=str(error),
            duration_ms=error.duration_ms,
        )
        raise error
