import { BASE_URL } from "../config/backend";

export type IngredientEstimate = {
  is_ingredient: boolean;
  name: string;
  nutrients: Record<string, number>;
  tag_ids: number[];
  units: { name_en: string; name_th: string | null; grams: number }[];
  note: string;
};

const TIMEOUT_MS = 20000;

export async function estimateIngredient(payload: {
  userId: string;
  description: string;
  nutrients: { name: string; unit: string | null }[];
  tags: {
    id: number;
    name: string;
    group: string | null;
    description?: string | null;
  }[];
}): Promise<IngredientEstimate> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/ingredient/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        user_id: payload.userId,
        description: payload.description,
        nutrients: payload.nutrients,
        tags: payload.tags,
      }),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("The server took too long to answer. Please fill the form manually or try again later.");
    }
    throw new Error("Can't reach the server. Please fill the form manually or try again later.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server Error (${res.status})`);
  }
  return res.json();
}