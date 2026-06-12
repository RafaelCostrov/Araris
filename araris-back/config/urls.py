from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.common.urls")),
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/organizations/", include("apps.organizations.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/tax/", include("apps.tax.urls")),
    path("api/finance/", include("apps.finance.urls")),
]
