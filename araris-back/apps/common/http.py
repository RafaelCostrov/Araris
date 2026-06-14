import ssl

from django.conf import settings


def get_external_ssl_context():
    if not settings.EXTERNAL_SERVICES_VERIFY_SSL:
        return ssl._create_unverified_context()

    try:
        import certifi
    except ImportError:
        return None

    return ssl.create_default_context(cafile=certifi.where())
