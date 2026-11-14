import { BASE_URL } from "../config/backend";

const TIP_TIMEOUT_MS = 15_000;

// Optional tip for the cooking step the user was just shown. Resolves to null when the step needs no tip,
// and on any error: a missing tip must never get in the way of cooking.
export async function getCookTip(
  recipeId: number,
  step: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIP_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/api/cook/tip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipeId, step }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.tip === "string" && data.tip.trim() ? data.tip.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
