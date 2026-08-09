from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.serializers import (
    EmailTokenObtainPairSerializer,
    EmailAvailabilitySerializer,
    GoogleLoginResponseSerializer,
    GoogleLoginSerializer,
    GoogleRegisterSerializer,
    MeSerializer,
    RegisterResponseSerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)


User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        response_serializer = RegisterResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = EmailTokenObtainPairSerializer


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        response_serializer = GoogleLoginResponseSerializer(result)
        return Response(response_serializer.data)


class GoogleRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        response_serializer = RegisterResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class EmailAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = EmailAvailabilitySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        return Response({"available": not User.objects.filter(email=email).exists()})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = (
            request.user.memberships.select_related("organization")
            .filter(status="active")
            .order_by("created_at")
        )
        serializer = MeSerializer({"user": request.user, "memberships": memberships})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({"user": UserSerializer(user).data})
