create table if not exists group_decisions (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  food_name text not null,
  restaurant_name text,
  restaurant_address text,
  restaurant_link text,
  decided_by_name text,
  decided_at timestamptz default now(),
  vote_id uuid references menu_votes(id) on delete set null
);

create index if not exists group_decisions_group_id_idx on group_decisions(group_id);
create index if not exists group_decisions_decided_at_idx on group_decisions(decided_at desc);

alter table group_decisions enable row level security;
create policy "group_decisions_select" on group_decisions for select using (true);
create policy "group_decisions_insert" on group_decisions for insert with check (true);
create policy "group_decisions_delete" on group_decisions for delete using (true);
