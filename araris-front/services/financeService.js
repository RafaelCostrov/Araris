import { authenticatedApiRequest } from "./apiClient";

function createMovement(path, organizationId, payload) {
  return authenticatedApiRequest(path, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      ...payload,
    }),
  });
}

function listBusinessContacts(resource, organizationId) {
  const query = `organization_id=${encodeURIComponent(organizationId)}`;
  return authenticatedApiRequest(`/finance/${resource}/?${query}`);
}

function createBusinessContact(resource, organizationId, payload) {
  return authenticatedApiRequest(`/finance/${resource}/`, {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      ...payload,
    }),
  });
}

export function listCustomers(organizationId) {
  return listBusinessContacts("customers", organizationId);
}

export function createCustomer(organizationId, payload) {
  return createBusinessContact("customers", organizationId, payload);
}

export function listSuppliers(organizationId) {
  return listBusinessContacts("suppliers", organizationId);
}

export function createSupplier(organizationId, payload) {
  return createBusinessContact("suppliers", organizationId, payload);
}

export function updateCustomer(customerId, payload) {
  return authenticatedApiRequest(`/finance/customers/${customerId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deactivateCustomer(customerId) {
  return authenticatedApiRequest(`/finance/customers/${customerId}/`, {
    method: "DELETE",
  });
}

export function updateSupplier(supplierId, payload) {
  return authenticatedApiRequest(`/finance/suppliers/${supplierId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deactivateSupplier(supplierId) {
  return authenticatedApiRequest(`/finance/suppliers/${supplierId}/`, {
    method: "DELETE",
  });
}

export function createRevenue(organizationId, payload) {
  return createMovement("/finance/revenues/", organizationId, payload);
}

export function createExpense(organizationId, payload) {
  return createMovement("/finance/expenses/", organizationId, payload);
}

export function createPayable(organizationId, payload) {
  return createMovement("/finance/payables/", organizationId, payload);
}

export function createReceivable(organizationId, payload) {
  return createMovement("/finance/receivables/", organizationId, payload);
}

export function listRevenues(organizationId, month) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query = `organization_id=${encodeURIComponent(organizationId)}${monthQuery}`;
  return authenticatedApiRequest(`/finance/revenues/?${query}`);
}

export function listExpenses(organizationId, month) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query = `organization_id=${encodeURIComponent(organizationId)}${monthQuery}`;
  return authenticatedApiRequest(`/finance/expenses/?${query}`);
}

export function listPayables(organizationId, status = "all", month) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query = `organization_id=${encodeURIComponent(organizationId)}&status=${encodeURIComponent(status)}${monthQuery}`;
  return authenticatedApiRequest(`/finance/payables/?${query}`);
}

export function listReceivables(organizationId, status = "all", month) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query = `organization_id=${encodeURIComponent(organizationId)}&status=${encodeURIComponent(status)}${monthQuery}`;
  return authenticatedApiRequest(`/finance/receivables/?${query}`);
}

export async function listCommitments(organizationId, status = "all", month) {
  const [payables, receivables] = await Promise.all([
    listPayables(organizationId, status, month),
    listReceivables(organizationId, status, month),
  ]);

  return [
    ...payables.map((item) => ({ ...item, type: "payable" })),
    ...receivables.map((item) => ({ ...item, type: "receivable" })),
  ].sort((left, right) => left.due_date.localeCompare(right.due_date));
}

export function settlePayable(payableId, payload) {
  return authenticatedApiRequest(`/finance/payables/${payableId}/settle/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function settleReceivable(receivableId, payload) {
  return authenticatedApiRequest(`/finance/receivables/${receivableId}/settle/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function commitmentPath(type, commitmentId) {
  const resource = type === "payable" ? "payables" : "receivables";
  return `/finance/${resource}/${commitmentId}/`;
}

export function updateFinancialCommitment(type, commitmentId, payload) {
  return authenticatedApiRequest(commitmentPath(type, commitmentId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteFinancialCommitment(type, commitmentId) {
  return authenticatedApiRequest(commitmentPath(type, commitmentId), {
    method: "DELETE",
  });
}

export function getFinancialSummary(organizationId, month) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query = `organization_id=${encodeURIComponent(organizationId)}${monthQuery}`;
  return authenticatedApiRequest(`/finance/summary/?${query}`);
}

export function getFinancialDashboard(
  organizationId,
  month,
  historyMonths = 6,
) {
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const query =
    `organization_id=${encodeURIComponent(organizationId)}` +
    `${monthQuery}&history_months=${encodeURIComponent(historyMonths)}`;
  return authenticatedApiRequest(`/finance/dashboard/?${query}`);
}

function activityPath(type, activityId) {
  const resource = type === "revenue" ? "revenues" : "expenses";
  return `/finance/${resource}/${activityId}/`;
}

export function updateFinancialActivity(type, activityId, payload) {
  return authenticatedApiRequest(activityPath(type, activityId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteFinancialActivity(type, activityId) {
  return authenticatedApiRequest(activityPath(type, activityId), {
    method: "DELETE",
  });
}
