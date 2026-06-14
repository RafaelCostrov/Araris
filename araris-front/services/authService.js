import { apiRequest } from "./apiClient";
import { clearTokens, getTokens, saveTokens } from "./tokenStorage";

function normalizeCurrency(value) {
  return String(value || "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildOrganizationPayload(form) {
  return {
    business_name: form.businessName.trim(),
    trade_name: form.tradeName?.trim() ?? "",
    cnpj: onlyDigits(form.cnpj),
    business_category: form.companyCategory,
    postal_code: onlyDigits(form.cep),
    street: form.street.trim(),
    number: form.number.trim(),
    address_complement: form.addressComplement?.trim() ?? "",
    neighborhood: form.neighborhood.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    cnae_code: form.cnaeCode?.trim() ?? "",
    cnae_description: form.cnaeDescription?.trim() ?? "",
    mei_opt_in: form.meiOptIn,
    registration_status: form.registrationStatus?.trim() ?? "",
    initial_balance: normalizeCurrency(form.initialBalance),
  };
}

export async function login({ email, password }) {
  const data = await apiRequest("/accounts/login/", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  await saveTokens({
    access: data.access,
    refresh: data.refresh,
  });

  return data;
}

export async function register(form) {
  const data = await apiRequest("/accounts/register/", {
    method: "POST",
    body: JSON.stringify({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      password_confirm: form.passwordConfirm,
      phone: onlyDigits(form.phone),
      lgpd_consent_given: true,
      organization: buildOrganizationPayload(form),
    }),
  });

  await saveTokens({
    access: data.access,
    refresh: data.refresh,
  });

  return data;
}

export async function googleLogin(idToken) {
  const data = await apiRequest("/accounts/login/google/", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
    }),
  });

  await saveTokens({
    access: data.access,
    refresh: data.refresh,
  });

  return data;
}

export async function googleRegister(form) {
  const data = await apiRequest("/accounts/register/google/", {
    method: "POST",
    body: JSON.stringify({
      id_token: form.googleIdToken,
      lgpd_consent_given: true,
      organization: buildOrganizationPayload(form),
    }),
  });

  await saveTokens({
    access: data.access,
    refresh: data.refresh,
  });

  return data;
}

export async function checkEmailAvailability(email) {
  const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
  return apiRequest(`/accounts/check-email/?email=${encodedEmail}`);
}

export async function checkCnpjAvailability(cnpj) {
  const encodedCnpj = encodeURIComponent(onlyDigits(cnpj));
  return apiRequest(`/organizations/check-cnpj/?cnpj=${encodedCnpj}`);
}

export async function refreshSession() {
  const tokens = await getTokens();

  if (!tokens?.refresh) {
    return null;
  }

  try {
    const data = await apiRequest("/accounts/token/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: tokens.refresh }),
    });

    const nextTokens = {
      refresh: data.refresh ?? tokens.refresh,
      access: data.access,
    };

    await saveTokens(nextTokens);
    return nextTokens;
  } catch (error) {
    await clearTokens();
    throw error;
  }
}

export async function getMe() {
  const tokens = await getTokens();

  if (!tokens?.access) {
    return null;
  }

  return apiRequest("/accounts/me/", {
    headers: {
      Authorization: `Bearer ${tokens.access}`,
    },
  });
}

export async function logout() {
  await clearTokens();
}
