import { BASE_URL } from "../config/backend";
import { ChatResponse, UserMessagePayload } from "../types/ChatType";

export async function sendChatMessage(
  payload: UserMessagePayload,
): Promise<ChatResponse> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server Error (${response.status})`);
  }

  return response.json();
}
