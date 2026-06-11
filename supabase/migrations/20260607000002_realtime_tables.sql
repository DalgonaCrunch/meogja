-- Supabase Realtime postgres_changes 구독을 위해 테이블을 publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
