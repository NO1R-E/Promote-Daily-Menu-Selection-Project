import { supabase } from "@/src/config/supabase";
import { ForumPost } from "@/src/types/ForumType";

const BASE_SELECT = `
  recipe_forum_id, user_id, title, caption, hashtags, likes_count, created_at, feed_score,
  profiles ( username, display_name, avatar_url ),
  recipes (
    recipe_id, recipe_name, serving, img, recipe_body, additional_info, status,
    recipe_ingredients ( weight_g, ingredients ( ingredient_id, norm_en ) )
  )
`;

// ผู้ใช้ที่ล็อกอินอยู่ ดึงสถานะไลก์/เซฟของตัวเองมาด้วย
export function forumSelect(userId?: string | null): string {
  return userId
    ? `${BASE_SELECT}, recipe_forum_likes!left ( user_id ), recipe_forum_saved!left ( user_id )`
    : BASE_SELECT;
}

export function normalizePost(p: any, userId?: string | null): ForumPost {
  return {
    ...p,
    is_liked:
      !!userId &&
      Array.isArray(p.recipe_forum_likes) &&
      p.recipe_forum_likes.length > 0,
    is_saved:
      !!userId &&
      Array.isArray(p.recipe_forum_saved) &&
      p.recipe_forum_saved.length > 0,
  } as ForumPost;
}

export async function fetchForumPost(
  postId: number,
  userId?: string | null,
): Promise<ForumPost | null> {
  let q = supabase
    .from("recipe_forum")
    .select(forumSelect(userId))
    .eq("recipe_forum_id", postId)
    .eq("is_hidden", false);

  if (userId) {
    q = q.eq("recipe_forum_likes.user_id", userId);
    q = q.eq("recipe_forum_saved.user_id", userId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data || !(data as any).recipes) return null;
  return normalizePost(data, userId);
}

export async function setLike(userId: string, postId: number, liked: boolean) {
  const table = supabase.from("recipe_forum_likes");
  const { error } = liked
    ? await table.insert({ user_id: userId, forum_id: postId })
    : await table.delete().eq("user_id", userId).eq("forum_id", postId);
  if (error) throw error;
}

export async function setSaved(userId: string, postId: number, saved: boolean) {
  const table = supabase.from("recipe_forum_saved");
  const { error } = saved
    ? await table.insert({ user_id: userId, forum_id: postId })
    : await table.delete().eq("user_id", userId).eq("forum_id", postId);
  if (error) throw error;
}

export async function reportPost(userId: string, postId: number, reason: string) {
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: userId, forum_id: postId, reason });
  if (error) throw error;
}

export async function searchForumIds(query: string): Promise<number[]> {
  const { data, error } = await supabase.rpc("search_forum_ids", {
    p_query: query,
    p_limit: 200,
  });
  if (error) throw error;
  return (data as number[] | null) ?? [];
}

export async function deletePost(postId: number): Promise<void> {
  const { error } = await supabase.rpc("delete_my_post", { p_forum_id: postId });
  if (error) throw error;
}

let dirty = false;
export const markForumDirty = () => {
  dirty = true;
};
export const consumeForumDirty = () => {
  const d = dirty;
  dirty = false;
  return d;
};
export async function adminDeletePost(id: number, reason?: string) {
  const { error } = await supabase.rpc("admin_delete_post", { p_forum_id: id, p_reason: reason ?? null });
  if (error) throw error;
}