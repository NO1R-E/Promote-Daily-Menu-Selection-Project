import { BASE_URL } from "../config/backend";
import { Plan, PlanMeal, Slot } from "../types/PlanType";

const TIMEOUT_MS = 25_000;

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Server error (${res.status})`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    // Expo's fetch words an abort as "Fetch request has been canceled" (name is not always AbortError)
    if (err.name === "AbortError" || /cancel|abort/i.test(String(err.message))) {
      throw new Error("The server took too long to respond. Try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function generatePlan(userId: string, preferences: string[] = []): Promise<Plan> {
  return postJson<{ plan: Plan }>("/api/plan/generate", {
    user_id: userId,
    preferences,
  }).then((r) => r.plan);
}

export function rerollSlot(args: {
  userId: string;
  slot: Slot;
  current: Record<string, number>;
  seenIds: number[];
  preferences?: string[];
}): Promise<PlanMeal | null> {
  return postJson<{ meal: PlanMeal | null }>("/api/plan/reroll", {
    user_id: args.userId,
    slot: args.slot,
    current: args.current,
    seen_ids: args.seenIds,
    preferences: args.preferences ?? [],
  }).then((r) => r.meal);
}