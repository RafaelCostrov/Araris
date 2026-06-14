from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    EmailAvailabilityView,
    GoogleLoginView,
    GoogleRegisterView,
    LoginView,
    MeView,
    RegisterView,
)


urlpatterns = [
    path("register/", RegisterView.as_view(), name="account-register"),
    path("register/google/", GoogleRegisterView.as_view(), name="account-google-register"),
    path("login/", LoginView.as_view(), name="account-login"),
    path("login/google/", GoogleLoginView.as_view(), name="account-google-login"),
    path("check-email/", EmailAvailabilityView.as_view(), name="account-check-email"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="account-me"),
]
