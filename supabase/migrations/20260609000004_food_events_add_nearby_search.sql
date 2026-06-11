-- food_events event_type 체크 제약에 nearby_search 추가
ALTER TABLE food_events DROP CONSTRAINT IF EXISTS food_events_event_type_check;
ALTER TABLE food_events ADD CONSTRAINT food_events_event_type_check
  CHECK (event_type IN ('search', 'restaurant_click', 'nearby_search'));
