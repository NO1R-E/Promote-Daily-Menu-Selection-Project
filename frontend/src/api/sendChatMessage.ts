import { BASE_URL } from "../config/backend";
import { ChatResponse, UserMessagePayload } from "../types/ChatType";

const REQUEST_TIMEOUT_MS = 20_000;

export async function sendChatMessage(
  payload: UserMessagePayload,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server Error (${response.status})`);
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out — the server took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}