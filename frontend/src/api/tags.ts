// Tags and tag groups change rarely, so the app loads them ONCE and reuses them everywhere.
//
//   loadTags()        -> every tag + every tag group (from memory, else from the phone, else from the server)
//   useTags()         -> the same thing for a screen: { data, loading, error, reload }
//
// The copy is refreshed when it is older than MAX_AGE_MS. If the server can't be reached,
// the old copy is used instead of failing.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/config/supabase";

export type Tag = {
  tag_id: number;
  tag_name: string;
  description: string | null;
  group_id: number;
  is_active: boolean;
  sort_order: number;
};

export type TagGroup = {
  group_id: number;
  group_code: string; // food_group, flavor, texture, allergen, diet, cuisine, ...
  group_name: string;
  kind: string | null; // preference / filter / descriptive
  scope: string | null; // ingredient / recipe / both
  sort_order: number;
};

export type TagData = { tags: Tag[]; groups: TagGroup[]; fetchedAt: number };

const STORAGE_KEY = "tag-cache-v2";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

let memory: TagData | null = null;
let inflight: Promise<TagData> | null = null; // several screens asking at once share one request

const isFresh = (d: TagData) => Date.now() - d.fetchedAt < MAX_AGE_MS;

async function readStored(): Promise<TagData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as TagData;
    return Array.isArray(d?.tags) && Array.isArray(d?.groups) && typeof d.fetchedAt === "number" ? d : null;
  } catch {
    return null;
  }
}

async function fetchFromServer(): Promise<TagData> {
  const [tagRes, groupRes] = await Promise.all([
    supabase
      .from("tags")
      .select("tag_id, tag_name, description, group_id, is_active, sort_order")
      .order("tag_id", { ascending: true }),
    supabase
      .from("tag_groups")
      .select("group_id, group_code, group_name, kind, scope, sort_order")
      .order("group_id", { ascending: true }),
  ]);
  if (tagRes.error) throw tagRes.error;
  if (groupRes.error) throw groupRes.error;

  return {
    tags: (tagRes.data ?? [])
      .filter((t: any) => t.group_id != null)
      .map((t: any) => ({
      tag_id: Number(t.tag_id),
      tag_name: String(t.tag_name ?? ""),
      description: t.description ?? null,
      group_id: Number(t.group_id),
      is_active: t.is_active === true,
      sort_order: Number(t.sort_order ?? 0),
    })),
    groups: (groupRes.data ?? []).map((g: any) => ({
      group_id: Number(g.group_id),
      group_code: String(g.group_code ?? ""),
      group_name: String(g.group_name ?? ""),
      kind: g.kind ?? null,
      scope: g.scope ?? null,
      sort_order: Number(g.sort_order ?? g.group_id ?? 0),
    })),
    fetchedAt: Date.now(),
  };
}

export function loadTags(force = false): Promise<TagData> {
  if (!force && memory && isFresh(memory)) return Promise.resolve(memory);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // first use after the app starts: the copy saved on the phone
      if (!memory) memory = await readStored();
      if (!force && memory && isFresh(memory)) return memory;

      try {
        const data = await fetchFromServer();
        memory = data;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
        return data;
      } catch (err) {
        if (memory) return memory; // offline: an old copy is better than nothing
        throw err;
      }
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const groupByCode = (d: TagData, code: string) => d.groups.find((g) => g.group_code === code) ?? null;

export const tagsOfGroup = (d: TagData, code: string): Tag[] => {
  const g = groupByCode(d, code);
  return g ? d.tags.filter((t) => t.group_id === g.group_id) : [];
};

export const tagById = (d: TagData, tagId: number) => d.tags.find((t) => t.tag_id === Number(tagId)) ?? null;

export function useTags() {
  const [data, setData] = useState<TagData | null>(memory);
  const [loading, setLoading] = useState(!memory);
  const [error, setError] = useState(false);

  const run = useCallback((force: boolean) => {
    let cancelled = false;
    setError(false);
    if (!memory || force) setLoading(true);
    loadTags(force)
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        console.error("Error loading tags:", e?.message ?? e);
        if (!cancelled) setError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => run(false), [run]);

  return { data, loading, error, reload: () => run(true) };
}
