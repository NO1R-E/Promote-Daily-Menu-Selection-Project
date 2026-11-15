import { BASE_URL } from "../config/backend";

const TIPS_TIMEOUT_MS = 20_000;

export async function getCookTips(
  recipeId: number,
): Promise<Record<number, string>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIPS_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/api/cook/tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipeId }),
      signal: controller.signal,
    });
    if (!response.ok) return {};
    const data = await response.json();
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(data?.tips ?? {})) {
      if (typeof v === "string" && v.trim()) out[Number(k)] = v.trim();
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}
