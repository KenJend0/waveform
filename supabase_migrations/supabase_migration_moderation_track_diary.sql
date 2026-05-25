-- ============================================================
-- Migration: étendre content_reports pour les track-diary
-- Extend CHECK constraint on content_type to include track_diary_entry / track_diary_comment
-- Apply in Supabase SQL Editor before deploying the code change
-- ============================================================

ALTER TABLE content_reports
  DROP CONSTRAINT IF EXISTS content_reports_content_type_check;

ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('diary_entry', 'diary_comment', 'track_diary_entry', 'track_diary_comment'));
