from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class UserProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner@araris.local",
            email="owner@araris.local",
            password="safe-password-123",
            first_name="Nome",
            last_name="Antigo",
            phone="11999999999",
        )
        self.url = reverse("account-me")
        self.client.force_authenticate(self.user)

    def test_authenticated_user_can_update_name_and_phone(self):
        response = self.client.patch(
            self.url,
            {
                "name": "  Rafael   Costrov  ",
                "phone": "(11) 98888-7777",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["name"], "Rafael Costrov")
        self.assertEqual(response.data["user"]["phone"], "11988887777")

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Rafael")
        self.assertEqual(self.user.last_name, "Costrov")
        self.assertEqual(self.user.email, "owner@araris.local")

    def test_invalid_phone_is_rejected_without_changing_profile(self):
        response = self.client.patch(
            self.url,
            {"name": "Nome Antigo", "phone": "123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "11999999999")

    def test_profile_update_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            {"name": "Outro Nome", "phone": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
