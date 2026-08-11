import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path):
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name, default):
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def unique_env_items(*items):
    seen = set()
    result = []
    ignored_values = {"web-client-id", "android-client-id", "ios-client-id"}

    for item in items:
        if not item or item in ignored_values or item in seen:
            continue
        seen.add(item)
        result.append(item)

    return result


load_env_file(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-secret-key")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "apps.common",
    "apps.accounts",
    "apps.organizations",
    "apps.integrations",
    "apps.notifications",
    "apps.tax",
    "apps.finance",
    "apps.chatbot",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB"),
        "USER": os.getenv("POSTGRES_USER"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD"),
        "HOST": os.getenv("POSTGRES_HOST"),
        "PORT": os.getenv("POSTGRES_PORT"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8081,http://127.0.0.1:8081",
)

EXTERNAL_SERVICES_VERIFY_SSL = env_bool("EXTERNAL_SERVICES_VERIFY_SSL", not DEBUG)

GOOGLE_CLIENT_ID_WEB = os.getenv("GOOGLE_CLIENT_ID_WEB", "")
GOOGLE_CLIENT_ID_ANDROID = os.getenv("GOOGLE_CLIENT_ID_ANDROID", "")
GOOGLE_CLIENT_ID_IOS = os.getenv("GOOGLE_CLIENT_ID_IOS", "")
GOOGLE_OAUTH_CLIENT_IDS = unique_env_items(
    *env_list("GOOGLE_OAUTH_CLIENT_IDS"),
    GOOGLE_CLIENT_ID_WEB,
    GOOGLE_CLIENT_ID_ANDROID,
    GOOGLE_CLIENT_ID_IOS,
)
GOOGLE_OAUTH_REQUIRE_VERIFIED_EMAIL = env_bool(
    "GOOGLE_OAUTH_REQUIRE_VERIFIED_EMAIL",
    True,
)
GOOGLE_OAUTH_HD_DOMAIN = os.getenv("GOOGLE_OAUTH_HD_DOMAIN", "").strip()
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "").strip()
FIREBASE_SERVICE_ACCOUNT_FILE = os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE", "").strip()
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
    "",
).strip()
FCM_DRY_RUN = env_bool("FCM_DRY_RUN", True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
GEMINI_REQUEST_TIMEOUT = env_int("GEMINI_REQUEST_TIMEOUT", 30)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.6-27b").strip()
GROQ_FALLBACK_MODEL = os.getenv(
    "GROQ_FALLBACK_MODEL",
    "openai/gpt-oss-20b",
).strip()
GROQ_REQUEST_TIMEOUT = env_int("GROQ_REQUEST_TIMEOUT", 30)
GROQ_MAX_OUTPUT_TOKENS = max(
    200,
    min(env_int("GROQ_MAX_OUTPUT_TOKENS", 800), 2000),
)
CHATBOT_HISTORY_MESSAGES = env_int("CHATBOT_HISTORY_MESSAGES", 6)
CHATBOT_ACTION_EXPIRATION_MINUTES = max(
    1,
    min(env_int("CHATBOT_ACTION_EXPIRATION_MINUTES", 15), 1440),
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}
