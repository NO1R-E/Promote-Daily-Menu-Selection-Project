import { useEffect, useState } from "react";
import { supabase } from "@/src/config/supabase";

const cache = new Map<number, string | null>();
const DEFAULT_IMAGE_URL = "https://nftcalendar.io/storage/uploads/2022/02/21/image-not-found_0221202211372462137974b6c1a.png";

export function firstImage(img: unknown, defaultUrl = DEFAULT_IMAGE_URL): string {
  let value = img;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      value = JSON.parse(value);
    } catch {
      console.warn("[firstImage] failed to parse JSON:", value);
    }
  }
  
  let result: string | null = null;
  if (Array.isArray(value)) {
    result = value.find((u) => typeof u === "string" && u.length > 0) ?? null;
  } else if (typeof value === "string" && value.length > 0) {
    result = value;
  }
  return result ?? defaultUrl;
}

export function useRecipeImages(ids: number[]): Record<number, string | null> {
  const [, bump] = useState(0);
  const key = Array.from(new Set(ids.filter((n) => Number.isFinite(n)))).sort().join(",");

  useEffect(() => {
    const missing = key
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((id) => !cache.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("recipe_id, img")
        .in("recipe_id", missing);
      if (error) {
        console.error("[useRecipeImages]", error.message);
        return;
      }
      const found = new Set<number>();
      (data ?? []).forEach((r: any) => {
        cache.set(Number(r.recipe_id), firstImage(r.img));
        found.add(Number(r.recipe_id));
      });
      missing.forEach((id) => {
        if (!found.has(id)) cache.set(id, null);
      });
      if (!cancelled) bump((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const out: Record<number, string | null> = {};
  key
    .split(",")
    .filter(Boolean)
    .map(Number)
    .forEach((id) => {
      if (cache.has(id)) out[id] = cache.get(id)!;
    });
  return out;
}