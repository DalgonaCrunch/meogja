-- 식당 한 곳에 대한 사람별 좋아요/싫어요.
--
-- 모임이 아니라 **계정**에 남긴다. 모임마다 닉네임이 달라도, 모임을 옮겨도
-- 내가 그 가게를 어떻게 봤는지는 나를 따라와야 한다.
create table if not exists user_place_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 이름 표기가 갈린 같은 집을 하나로 보기 위해 다듬은 이름을 키로 쓴다
  place_key text not null,
  place_name text not null,
  place_address text,
  -- 1 = 좋아요(👍), -1 = 싫어요(👎). 한 사람이 한 가게에 하나만 남긴다
  pref smallint not null check (pref in (1, -1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_key)
);

create index if not exists user_place_prefs_key_idx on user_place_prefs(place_key);
create index if not exists user_place_prefs_user_idx on user_place_prefs(user_id);

alter table user_place_prefs enable row level security;

-- 읽기는 모두에게 (모임 화면이 "우리 중 3명이 좋아요" 를 세어 보여준다)
drop policy if exists "user_place_prefs_select" on user_place_prefs;
create policy "user_place_prefs_select" on user_place_prefs for select using (true);

-- 쓰기는 본인 것만. 남의 표를 만들거나 지울 수 없다.
drop policy if exists "user_place_prefs_insert" on user_place_prefs;
create policy "user_place_prefs_insert" on user_place_prefs for insert with check (auth.uid() = user_id);

drop policy if exists "user_place_prefs_update" on user_place_prefs;
create policy "user_place_prefs_update" on user_place_prefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_place_prefs_delete" on user_place_prefs;
create policy "user_place_prefs_delete" on user_place_prefs for delete using (auth.uid() = user_id);
