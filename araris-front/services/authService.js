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
      organization: {
        business_name: form.businessName.trim(),
        cnpj: onlyDigits(form.cnpj),
        business_category: form.companyCategory,
        postal_code: onlyDigits(form.cep),
        street: form.street.trim(),
        number: form.number.trim(),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        initial_balance: normalizeCurrency(form.initialBalance),
      },
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

export async function logout() {
  await clearTokens();
}
