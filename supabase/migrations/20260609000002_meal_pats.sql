-- 먹자팟: 같이 먹을 사람 구하기 기능
CREATE TABLE IF NOT EXISTS meal_pats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  creator_name text NOT NULL,
  menu text NOT NULL,
  title text NOT NULL,
  restaurant_name text,
  scheduled_at timestamptz,
  max_members int,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_pat_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pat_id uuid NOT NULL REFERENCES meal_pats(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pat_id, member_id)
);

ALTER TABLE meal_pats ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_pat_joins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_pats_all" ON meal_pats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "meal_pat_joins_all" ON meal_pat_joins FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE meal_pats;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_pat_joins;
