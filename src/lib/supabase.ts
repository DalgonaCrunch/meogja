import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !url.startsWith("https://")) {
      throw new Error("Supabase 환경변수를 설정해주세요 (.env.local)");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export type Group = {
  id: string;
  name: string;
  is_private: boolean;
  password: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
};

export type FoodPreference = {
  id: string;
  member_id: string;
  food_name: string;
  preference_type: "like" | "dislike";
  created_at: string;
};
