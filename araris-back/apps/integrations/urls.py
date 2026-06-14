from django.urls import path

from apps.integrations.views import CepLookupView, CnpjLookupView


urlpatterns = [
    path("cep/<str:cep>/", CepLookupView.as_view(), name="cep-lookup"),
    path("cnpj/<str:cnpj>/", CnpjLookupView.as_view(), name="cnpj-lookup"),
]
