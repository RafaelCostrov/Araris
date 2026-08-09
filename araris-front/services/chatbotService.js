import { authenticatedApiRequest } from "./apiClient";


export function listChatConversations(organizationId, limit = 3) {
  const query =
    `organization_id=${encodeURIComponent(organizationId)}` +
    `&limit=${encodeURIComponent(limit)}`;
  return authenticatedApiRequest(`/chatbot/conversations/?${query}`);
}


export function getChatConversation(organizationId, conversationId) {
  const query = `organization_id=${encodeURIComponent(organizationId)}`;
  return authenticatedApiRequest(
    `/chatbot/conversations/${conversationId}/?${query}`,
  );
}


export function deleteChatConversation(organizationId, conversationId) {
  const query = `organization_id=${encodeURIComponent(organizationId)}`;
  return authenticatedApiRequest(
    `/chatbot/conversations/${conversationId}/?${query}`,
    { method: "DELETE" },
  );
}


export function sendChatMessage(organizationId, message, conversationId = null) {
  return authenticatedApiRequest("/chatbot/messages/", {
    method: "POST",
    body: JSON.stringify({
      organization_id: organizationId,
      conversation_id: conversationId,
      message,
    }),
  });
}


export function retryChatMessage(organizationId, userMessageId) {
  return authenticatedApiRequest(
    `/chatbot/messages/${userMessageId}/retry/`,
    {
      method: "POST",
      body: JSON.stringify({ organization_id: organizationId }),
    },
  );
}


function resolveChatAction(organizationId, actionId, operation) {
  return authenticatedApiRequest(`/chatbot/actions/${actionId}/${operation}/`, {
    method: "POST",
    body: JSON.stringify({ organization_id: organizationId }),
  });
}


export function confirmChatAction(organizationId, actionId) {
  return resolveChatAction(organizationId, actionId, "confirm");
}


export function cancelChatAction(organizationId, actionId) {
  return resolveChatAction(organizationId, actionId, "cancel");
}
