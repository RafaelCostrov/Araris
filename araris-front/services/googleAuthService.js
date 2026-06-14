import Constants from "expo-constants";
import { Platform } from "react-native";

let isConfigured = false;
let googleSigninModule = null;

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "";

function assertGoogleConfig() {
  if (Constants.appOwnership === "expo") {
    throw new Error(
      "Login com Google exige um development build. Ele não funciona no Expo Go.",
    );
  }

  if (Platform.OS === "web") {
    throw new Error("Login com Google ainda não está disponível na versão web.");
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no frontend.");
  }

  if (Platform.OS === "ios" && !GOOGLE_IOS_CLIENT_ID) {
    throw new Error("Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID no frontend.");
  }

  if (Platform.OS === "android" && !GOOGLE_ANDROID_CLIENT_ID) {
    throw new Error("Configure o Client ID Android e o SHA-1 antes de usar Google no Android.");
  }

  return {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  };
}

async function getGoogleSigninModule() {
  if (Constants.appOwnership === "expo") {
    throw new Error(
      "Login com Google exige um development build. Ele não funciona no Expo Go.",
    );
  }

  if (googleSigninModule) {
    return googleSigninModule;
  }

  try {
    googleSigninModule = await import("@react-native-google-signin/google-signin");
    return googleSigninModule;
  } catch {
    throw new Error(
      "Login com Google exige um development build. Ele não funciona no Expo Go.",
    );
  }
}

async function configureGoogleSignin() {
  if (isConfigured) {
    return;
  }

  const { GoogleSignin } = await getGoogleSigninModule();

  GoogleSignin.configure({
    ...assertGoogleConfig(),
    scopes: ["profile", "email"],
  });
  isConfigured = true;
}

export async function getGoogleIdentity() {
  await configureGoogleSignin();
  const { GoogleSignin, statusCodes } = await getGoogleSigninModule();

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
  }

  try {
    const response = await GoogleSignin.signIn();

    if (response.type === "cancelled") {
      return null;
    }

    if (!response.data?.idToken) {
      throw new Error("O Google não retornou um token de identidade.");
    }

    return {
      idToken: response.data.idToken,
      user: response.data.user,
    };
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services não está disponível neste dispositivo.");
    }

    throw error;
  }
}
