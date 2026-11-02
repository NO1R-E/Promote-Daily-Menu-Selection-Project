export type ForumPost = {
  recipe_forum_id: number;
  title: string;
  caption: string | null;
  hashtags: string[];
  likes_count: number;
  created_at: string;
  feed_score: number;
  is_liked?: boolean;
  is_saved?: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  recipes: {
    recipe_id: number;
    recipe_name: string | null;
    serving: number | null;
    img: string[];
    recipe_body: string | null;
    additional_info: string | null;
    status: string;
    recipe_ingredients: {
      weight_g: number | null;
      ingredients: { ingredient_id: number; norm_en: string } | null;
    }[];
  } | null;
};