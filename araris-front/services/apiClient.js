const DEFAULT_API_URL = "http://127.0.0.1:8000/api";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_API_URL;

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
