from django.urls import path

from apps.organizations.views import CnpjAvailabilityView, CurrentOrganizationView


urlpatterns = [
    path("check-cnpj/", CnpjAvailabilityView.as_view(), name="organization-check-cnpj"),
    path("current/", CurrentOrganizationView.as_view(), name="current-organization"),
]
