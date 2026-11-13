
import { supabase } from "@/src/config/supabase";
import { loadTags } from "@/src/api/tags";

export type ParsedSearch = {
  hashtag: string | null;
  tagIds: number[];
  terms: string[];
};

const EMPTY: ParsedSearch = { hashtag: null, tagIds: [], terms: [] };

// "#" or blank = no search
export const isEmptySearch = (q: string) => q.trim().replace(/^#+/, "").trim() === "";

export async function parseSearch(query: string): Promise<ParsedSearch> {
  const q = query.trim();
  if (isEmptySearch(q)) return EMPTY;

  if (q.startsWith("#")) {
    return { hashtag: q.replace(/^#+/, "").trim(), tagIds: [], terms: [] };
  }

  // ดึง tag
  const tagIdByName = new Map<string, number>();
  try {
    const { tags } = await loadTags();
    tags.forEach((t) => {
      if (t.is_active) tagIdByName.set(t.tag_name.trim().toLowerCase(), t.tag_id);
    });
  } catch {
    console.warn("Failed to load tags for search");
  }

  const tagIds: number[] = [];
  const terms: string[] = [];
  q.split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .forEach((w) => {
      const id = tagIdByName.get(w.toLowerCase());
      if (id !== undefined) {
        if (!tagIds.includes(id)) tagIds.push(id);
      } else {
        terms.push(w);
      }
    });
  return { hashtag: null, tagIds, terms };
}

const toParams = (s: ParsedSearch, limit: number) => ({
  p_hashtag: s.hashtag,
  p_tag_ids: s.tagIds,
  p_terms: s.terms,
  p_limit: limit,
});

export async function searchRecipeIds(query: string, limit = 200): Promise<number[]> {
  if (isEmptySearch(query)) return [];
  const { data, error } = await supabase.rpc("search_recipe_ids", toParams(await parseSearch(query), limit));
  if (error) throw error;
  return ((data as (number | string)[] | null) ?? []).map(Number);
}
