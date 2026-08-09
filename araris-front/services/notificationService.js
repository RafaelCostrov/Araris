import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { authenticatedApiRequest } from "./apiClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function listNotifications() {
  return authenticatedApiRequest("/notifications/");
}

export async function markNotificationAsRead(notificationId) {
  return authenticatedApiRequest(`/notifications/${notificationId}/read/`, {
    method: "POST",
  });
}

export function addNotificationReceivedListener(listener) {
  return Notifications.addNotificationReceivedListener(listener);
}

export async function getNotificationPermissionState() {
  if (Platform.OS === "web") {
    return {
      status: "unsupported",
      granted: false,
      canAskAgain: false,
    };
  }

  const permission = await Notifications.getPermissionsAsync();
  return {
    status: permission.status,
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
  };
}

export async function registerPushDevice(payload) {
  return authenticatedApiRequest("/notifications/push-devices/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getNotificationPermission() {
  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.granted) {
    return true;
  }

  const nextPermission = await Notifications.requestPermissionsAsync();
  return nextPermission.granted;
}

function logPushRegistrationIssue(message, error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[push-registration]", message, error ?? "");
  }
}

export async function registerCurrentDeviceForPush() {
  if (Platform.OS === "web" || (Platform.OS === "ios" && !Device.isDevice)) {
    logPushRegistrationIssue("Plataforma sem suporte para token push nativo.");
    return null;
  }

  const hasPermission = await getNotificationPermission();
  if (!hasPermission) {
    logPushRegistrationIssue("Permissão de notificação não concedida.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Alertas Araris",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();

    if (!deviceToken?.data) {
      logPushRegistrationIssue("Token push não retornado pelo sistema.");
      return null;
    }

    return registerPushDevice({
      platform: Platform.OS,
      token: String(deviceToken.data),
      device_name: Device.deviceName ?? "",
      app_version: Constants.expoConfig?.version ?? "",
    });
  } catch (error) {
    logPushRegistrationIssue("Falha ao registrar dispositivo push.", error);
    return null;
  }
}
