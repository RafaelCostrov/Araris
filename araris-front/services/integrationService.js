import { apiRequest } from "./apiClient";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function lookupCep(cep) {
  return apiRequest(`/integrations/cep/${onlyDigits(cep)}/`);
}

export async function lookupCnpj(cnpj) {
  return apiRequest(`/integrations/cnpj/${onlyDigits(cnpj)}/`);
}
