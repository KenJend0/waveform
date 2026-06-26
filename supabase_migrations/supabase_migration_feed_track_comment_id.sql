-- Store track diary comment references explicitly in feed_events.
-- The existing comment_id column references diary_comments only.

ALTER TABLE feed_events
  ADD COLUMN IF NOT EXISTS track_comment_id uuid
    REFERENCES track_diary_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feed_events_track_comment_id
  ON feed_events(track_comment_id)
  WHERE track_comment_id IS NOT NULL;

UPDATE feed_events AS event
SET track_comment_id = (event.payload->>'commentId')::uuid
FROM track_diary_comments AS comment
WHERE event.type = 'track_comment'
  AND event.track_comment_id IS NULL
  AND event.payload ? 'commentId'
  AND event.payload->>'commentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND comment.id = (event.payload->>'commentId')::uuid;
