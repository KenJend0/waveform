-- Remove "discover" / saved-album events from the activity feed.
-- Saved albums remain a private list feature, but they should no longer fan out
-- or appear as social feed events.

DELETE FROM feed_events
WHERE type = 'discover';

ALTER TABLE feed_events
  DROP CONSTRAINT IF EXISTS feed_events_type_check;

ALTER TABLE feed_events
  ADD CONSTRAINT feed_events_type_check
  CHECK (type IN (
    'diary_entry',
    'like',
    'comment',
    'follow',
    'comment_reply',
    'track_diary_entry',
    'track_like',
    'track_comment'
  ));
