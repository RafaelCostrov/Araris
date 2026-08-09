import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { clearTokens, getTokens, saveTokens } from "./tokenStorage";

const DEFAULT_API_URL = "http://127.0.0.1:8000/api";
const ANDROID_EMULATOR_API_URL = "http://10.0.2.2:8000/api";

function normalizeApiUrl(url) {
  return url?.replace(/\/$/, "") ?? "";
}

function getExpoDevServerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    Constants.manifest?.debuggerHost;

  return hostUri?.split(":")?.[0];
}

function getDevelopmentApiUrl() {
  if (Platform.OS === "android" && !Device.isDevice) {
    return ANDROID_EMULATOR_API_URL;
  }

  const devServerHost = getExpoDevServerHost();
  const isRemoteDevServerHost =
    devServerHost &&
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(devServerHost);

  if (isRemoteDevServerHost) {
    return `http://${devServerHost}:8000/api`;
  }

  return DEFAULT_API_URL;
}

function getConfiguredApiUrl() {
  const platformApiUrl =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_API_URL_IOS
      : Platform.OS === "android"
        ? process.env.EXPO_PUBLIC_API_URL_ANDROID
        : process.env.EXPO_PUBLIC_API_URL_WEB;

  if (platformApiUrl) {
    const isPhysicalAndroidUsingEmulatorHost =
      Platform.OS === "android" &&
      Device.isDevice &&
      /10\.0\.2\.2|localhost|127\.0\.0\.1/.test(platformApiUrl);
    if (isPhysicalAndroidUsingEmulatorHost) {
      return "";
    }
    return platformApiUrl;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "ios" && apiUrl?.includes("10.0.2.2")) {
    return "";
  }

  if (Platform.OS === "android" && /localhost|127\.0\.0\.1/.test(apiUrl ?? "")) {
    return "";
  }

  if (
    Platform.OS === "android" &&
    Device.isDevice &&
    apiUrl?.includes("10.0.2.2")
  ) {
    return "";
  }

  return apiUrl;
}

export const API_BASE_URL = normalizeApiUrl(
  getConfiguredApiUrl() || getDevelopmentApiUrl(),
);

function formatValidationError(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.detail) {
    return data.detail;
  }

  const [firstKey] = Object.keys(data);
  const firstValue = data[firstKey];

  if (Array.isArray(firstValue)) {
    return firstValue[0];
  }

  if (typeof firstValue === "string") {
    return firstValue;
  }

  if (firstValue && typeof firstValue === "object") {
    return formatValidationError(firstValue);
  }

  return null;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let refreshRequest = null;

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      formatValidationError(data) || "Não foi possível concluir a solicitação.";
    throw new ApiError(message, response.status, data);
  }

  return data;
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const tokens = await getTokens();

      if (!tokens?.refresh) {
        throw new ApiError("Sua sessão expirou. Acesse sua conta novamente.", 401);
      }

      const data = await apiRequest("/accounts/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      const nextTokens = {
        refresh: data.refresh ?? tokens.refresh,
        access: data.access,
      };
      await saveTokens(nextTokens);
      return nextTokens.access;
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

export async function authenticatedApiRequest(path, options = {}) {
  const tokens = await getTokens();

  if (!tokens?.access) {
    throw new ApiError("Sua sessão expirou. Acesse sua conta novamente.", 401);
  }

  function send(accessToken) {
    return apiRequest(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers ?? {}),
      },
    });
  }

  try {
    return await send(tokens.access);
  } catch (error) {
    if (error.status !== 401) {
      throw error;
    }
  }

  let accessToken;

  try {
    accessToken = await refreshAccessToken();
  } catch (error) {
    if (error.status === 401) {
      await clearTokens();
      throw new ApiError("Sua sessão expirou. Acesse sua conta novamente.", 401);
    }

    throw error;
  }

  try {
    return await send(accessToken);
  } catch (error) {
    if (error.status === 401) {
      await clearTokens();
      throw new ApiError("Sua sessão expirou. Acesse sua conta novamente.", 401);
    }

    throw error;
  }
}
