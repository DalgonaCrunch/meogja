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
  owner_id: string | null;
  owner_guest_name: string | null;
  require_auth: boolean;
  description: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
};

export type GroupMembership = {
  id: string;
  group_id: string;
  user_id: string | null;
  guest_name: string | null;
  role: "owner" | "member";
  joined_at: string;
};

export type UserProfile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  group_id: string;
  participant_names: string[];
  created_at: string;
  picks?: SessionPick[];
};

export type SessionPick = {
  id: string;
  session_id: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_category: string;
  restaurant_link: string;
  map_provider: string;
  created_at: string;
};

export type Favorite = {
  id: string;
  group_id: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_category: string;
  restaurant_link: string;
  created_at: string;
};

export type Review = {
  id: string;
  group_id: string;
  member_id: string | null;
  restaurant_name: string;
  rating: number;
  comment: string;
  visited_at: string;
  created_at: string;
};

export type FoodPreference = {
  id: string;
  member_id: string;
  food_name: string;
  preference_type: "like" | "dislike";
  created_at: string;
};
