export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      album_featured_artists: {
        Row: {
          album_id: string
          artist_id: string
          created_at: string
          id: string
          joinphrase: string | null
          position: number
        }
        Insert: {
          album_id: string
          artist_id: string
          created_at?: string
          id?: string
          joinphrase?: string | null
          position?: number
        }
        Update: {
          album_id?: string
          artist_id?: string
          created_at?: string
          id?: string
          joinphrase?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "album_featured_artists_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_featured_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      album_genre_votes: {
        Row: {
          album_id: string
          created_at: string
          genre_id: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          genre_id: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          genre_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_genre_votes_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_genre_votes_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      album_genres: {
        Row: {
          album_id: string
          genre_id: string
          source: string
          weight: number
        }
        Insert: {
          album_id: string
          genre_id: string
          source: string
          weight?: number
        }
        Update: {
          album_id?: string
          genre_id?: string
          source?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "album_genres_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      album_metadata: {
        Row: {
          album_id: string
          apple_music_url: string | null
          deezer_url: string | null
          description: string | null
          description_src: string | null
          fetched_at: string
          lastfm_listeners: number | null
          lastfm_playcount: number | null
          lastfm_url: string | null
          spotify_url: string | null
          streaming_attempts: number
          tag_attempts: number
          tags_checked_at: string | null
        }
        Insert: {
          album_id: string
          apple_music_url?: string | null
          deezer_url?: string | null
          description?: string | null
          description_src?: string | null
          fetched_at?: string
          lastfm_listeners?: number | null
          lastfm_playcount?: number | null
          lastfm_url?: string | null
          spotify_url?: string | null
          streaming_attempts?: number
          tag_attempts?: number
          tags_checked_at?: string | null
        }
        Update: {
          album_id?: string
          apple_music_url?: string | null
          deezer_url?: string | null
          description?: string | null
          description_src?: string | null
          fetched_at?: string
          lastfm_listeners?: number | null
          lastfm_playcount?: number | null
          lastfm_url?: string | null
          spotify_url?: string | null
          streaming_attempts?: number
          tag_attempts?: number
          tags_checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "album_metadata_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: true
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          artist_id: string
          canonical_key: string | null
          cover_url: string | null
          created_at: string
          id: string
          mbid: string | null
          release_date: string | null
          search_vector: unknown
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          canonical_key?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          mbid?: string | null
          release_date?: string | null
          search_vector?: unknown
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          canonical_key?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          mbid?: string | null
          release_date?: string | null
          search_vector?: unknown
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          image_url: string | null
          mbid: string | null
          name: string
          search_vector: unknown
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          mbid?: string | null
          name: string
          search_vector?: unknown
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          mbid?: string | null
          name?: string
          search_vector?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: []
      }
      cron_health: {
        Row: {
          detail: string | null
          job_name: string
          last_run_at: string
          status: string
        }
        Insert: {
          detail?: string | null
          job_name: string
          last_run_at?: string
          status: string
        }
        Update: {
          detail?: string | null
          job_name?: string
          last_run_at?: string
          status?: string
        }
        Relationships: []
      }
      curator_picks: {
        Row: {
          album_id: string
          created_at: string
          curator_id: string
          id: string
          note: string
        }
        Insert: {
          album_id: string
          created_at?: string
          curator_id: string
          id?: string
          note: string
        }
        Update: {
          album_id?: string
          created_at?: string
          curator_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_picks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curator_picks_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_comments: {
        Row: {
          body: string
          created_at: string
          entry_id: string
          id: string
          parent_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          entry_id: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_id?: string
          id?: string
          parent_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entry_stats"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "diary_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "diary_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          album_id: string
          comments_count: number
          created_at: string
          id: string
          is_public: boolean
          likes_count: number
          listened_at: string
          rating: number | null
          re_listen: boolean
          rec_source: string | null
          review_body: string | null
          review_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          comments_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          listened_at?: string
          rating?: number | null
          re_listen?: boolean
          rec_source?: string | null
          review_body?: string | null
          review_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          comments_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          listened_at?: string
          rating?: number | null
          re_listen?: boolean
          rec_source?: string | null
          review_body?: string | null
          review_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_likes: {
        Row: {
          created_at: string
          entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entry_stats"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      external_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          failed_count: number
          id: string
          last_processed_at: string | null
          list_id: string | null
          matched_count: number
          processed_count: number
          raw_items: Json
          skipped_count: number
          source: string
          source_label: string
          status: string
          total_items: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          last_processed_at?: string | null
          list_id?: string | null
          matched_count?: number
          processed_count?: number
          raw_items?: Json
          skipped_count?: number
          source: string
          source_label: string
          status?: string
          total_items?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          last_processed_at?: string | null
          list_id?: string | null
          matched_count?: number
          processed_count?: number
          raw_items?: Json
          skipped_count?: number
          source?: string
          source_label?: string
          status?: string
          total_items?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_imports_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events: {
        Row: {
          actor_id: string
          album_id: string | null
          comment_id: string | null
          created_at: string | null
          entry_id: string | null
          followee_id: string | null
          id: string
          payload: Json | null
          track_comment_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          album_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          entry_id?: string | null
          followee_id?: string | null
          id?: string
          payload?: Json | null
          track_comment_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          album_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          entry_id?: string | null
          followee_id?: string | null
          id?: string
          payload?: Json | null
          track_comment_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "diary_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entry_stats"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "feed_events_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_track_comment_id_fkey"
            columns: ["track_comment_id"]
            isOneToOne: false
            referencedRelation: "track_diary_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      import_requests: {
        Row: {
          artist_id: string | null
          artist_mbid: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          artist_mbid?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          artist_id?: string | null
          artist_mbid?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          added_at: string
          album_id: string | null
          id: string
          list_id: string
          position: number | null
          track_id: string | null
        }
        Insert: {
          added_at?: string
          album_id?: string | null
          id?: string
          list_id: string
          position?: number | null
          track_id?: string | null
        }
        Update: {
          added_at?: string
          album_id?: string | null
          id?: string
          list_id?: string
          position?: number | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      list_likes: {
        Row: {
          created_at: string
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_likes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          session_id: string | null
          surface: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          session_id?: string | null
          surface?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          session_id?: string | null
          surface?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          last_seen_activity_at: string | null
          updated_at: string | null
          username: string | null
          username_changed: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          last_seen_activity_at?: string | null
          updated_at?: string | null
          username?: string | null
          username_changed?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          last_seen_activity_at?: string | null
          updated_at?: string | null
          username?: string | null
          username_changed?: boolean | null
        }
        Relationships: []
      }
      recommendation_feedback: {
        Row: {
          album_id: string | null
          created_at: string
          id: string
          track_id: string | null
          user_id: string
        }
        Insert: {
          album_id?: string | null
          created_at?: string
          id?: string
          track_id?: string | null
          user_id: string
        }
        Update: {
          album_id?: string | null
          created_at?: string
          id?: string
          track_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_feedback_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_metrics: {
        Row: {
          computed_at: string
          id: string
          k: number
          method: string
          n_users: number | null
          ndcg_at_k: number | null
          precision_at_k: number | null
          recall_at_k: number | null
        }
        Insert: {
          computed_at?: string
          id?: string
          k: number
          method: string
          n_users?: number | null
          ndcg_at_k?: number | null
          precision_at_k?: number | null
          recall_at_k?: number | null
        }
        Update: {
          computed_at?: string
          id?: string
          k?: number
          method?: string
          n_users?: number | null
          ndcg_at_k?: number | null
          precision_at_k?: number | null
          recall_at_k?: number | null
        }
        Relationships: []
      }
      saved_lists: {
        Row: {
          id: string
          list_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          list_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          list_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_lists_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_cache: {
        Row: {
          created_at: string | null
          data: Json
          expires_at: string
          key: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          expires_at: string
          key: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      similar_albums_cache: {
        Row: {
          album_id: string
          computed_at: string
          similar_albums: Json
        }
        Insert: {
          album_id: string
          computed_at?: string
          similar_albums?: Json
        }
        Update: {
          album_id?: string
          computed_at?: string
          similar_albums?: Json
        }
        Relationships: [
          {
            foreignKeyName: "similar_albums_cache_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: true
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      track_diary_comments: {
        Row: {
          body: string
          created_at: string
          entry_id: string
          id: string
          parent_comment_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          entry_id: string
          id?: string
          parent_comment_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_id?: string
          id?: string
          parent_comment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_diary_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "track_diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_diary_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "track_diary_entry_stats"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "track_diary_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "track_diary_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      track_diary_entries: {
        Row: {
          album_id: string
          artist_id: string
          comments_count: number
          created_at: string
          id: string
          is_public: boolean
          likes_count: number
          listened_at: string
          rating: number | null
          rec_source: string | null
          review_body: string | null
          review_title: string | null
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          artist_id: string
          comments_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          listened_at?: string
          rating?: number | null
          rec_source?: string | null
          review_body?: string | null
          review_title?: string | null
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          artist_id?: string
          comments_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          listened_at?: string
          rating?: number | null
          rec_source?: string | null
          review_body?: string | null
          review_title?: string | null
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_diary_entries_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_diary_entries_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_diary_entries_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_diary_likes: {
        Row: {
          created_at: string
          entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_diary_likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "track_diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_diary_likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "track_diary_entry_stats"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      track_featured_artists: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          joinphrase: string | null
          position: number
          track_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          joinphrase?: string | null
          position?: number
          track_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          joinphrase?: string | null
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_featured_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_featured_artists_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_metadata: {
        Row: {
          apple_music_url: string | null
          deezer_url: string | null
          fetched_at: string
          spotify_url: string | null
          track_id: string
        }
        Insert: {
          apple_music_url?: string | null
          deezer_url?: string | null
          fetched_at?: string
          spotify_url?: string | null
          track_id: string
        }
        Update: {
          apple_music_url?: string | null
          deezer_url?: string | null
          fetched_at?: string
          spotify_url?: string | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_metadata_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album_id: string
          artist_id: string
          canonical_title: string | null
          created_at: string
          disc_no: number | null
          duration_ms: number | null
          id: string
          mbid: string | null
          title: string
          track_no: number | null
          updated_at: string
        }
        Insert: {
          album_id: string
          artist_id: string
          canonical_title?: string | null
          created_at?: string
          disc_no?: number | null
          duration_ms?: number | null
          id?: string
          mbid?: string | null
          title: string
          track_no?: number | null
          updated_at?: string
        }
        Update: {
          album_id?: string
          artist_id?: string
          canonical_title?: string | null
          created_at?: string
          disc_no?: number | null
          duration_ms?: number | null
          id?: string
          mbid?: string | null
          title?: string
          track_no?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_favorite_albums: {
        Row: {
          album_id: string
          created_at: string
          id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_albums_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          is_public: boolean
          likes_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          likes_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_public?: boolean
          likes_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recommendations: {
        Row: {
          album_id: string
          computed_at: string
          method: string
          rank: number
          score: number
          user_id: string
        }
        Insert: {
          album_id: string
          computed_at?: string
          method: string
          rank: number
          score: number
          user_id: string
        }
        Update: {
          album_id?: string
          computed_at?: string
          method?: string
          rank?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recommendations_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_similarity: {
        Row: {
          computed_at: string
          score: number
          user_a: string
          user_b: string
        }
        Insert: {
          computed_at?: string
          score: number
          user_a: string
          user_b: string
        }
        Update: {
          computed_at?: string
          score?: number
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_similarity_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_similarity_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_taste_vectors: {
        Row: {
          album_index: Json
          computed_at: string
          n_ratings: number
          user_id: string
          vector: number[]
        }
        Insert: {
          album_index: Json
          computed_at?: string
          n_ratings?: number
          user_id: string
          vector: number[]
        }
        Update: {
          album_index?: Json
          computed_at?: string
          n_ratings?: number
          user_id?: string
          vector?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "user_taste_vectors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_track_recommendations: {
        Row: {
          computed_at: string
          method: string
          rank: number
          score: number
          track_id: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          method: string
          rank: number
          score: number
          track_id: string
          user_id: string
        }
        Update: {
          computed_at?: string
          method?: string
          rank?: number
          score?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_track_recommendations_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_track_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      album_stats: {
        Row: {
          album_id: string | null
          avg_rating: number | null
          listeners_count: number | null
          reviews_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      album_stats_mat: {
        Row: {
          album_id: string | null
          avg_rating: number | null
          listeners_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entry_stats: {
        Row: {
          comments_count: number | null
          entry_id: string | null
          likes_count: number | null
        }
        Relationships: []
      }
      track_diary_entry_stats: {
        Row: {
          comments_count: number | null
          entry_id: string | null
          likes_count: number | null
        }
        Insert: {
          comments_count?: never
          entry_id?: string | null
          likes_count?: never
        }
        Update: {
          comments_count?: never
          entry_id?: string | null
          likes_count?: never
        }
        Relationships: []
      }
      track_stats: {
        Row: {
          avg_rating: number | null
          listeners_count: number | null
          ratings_count: number | null
          reviews_count: number | null
          track_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_diary_entries_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_user_account: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      fuzzy_search_albums: {
        Args: { query_text: string; result_limit?: number }
        Returns: {
          artist_name: string
          cover_url: string
          id: string
          release_date: string
          title: string
        }[]
      }
      fuzzy_search_artists: {
        Args: { query_text: string; result_limit?: number }
        Returns: {
          id: string
          image_url: string
          name: string
        }[]
      }
      fuzzy_search_tracks: {
        Args: { query_text: string; result_limit?: number }
        Returns: {
          album_cover: string
          album_id: string
          album_title: string
          artist_id: string
          artist_name: string
          id: string
          title: string
        }[]
      }
      get_trending_albums: {
        Args: { result_limit?: number }
        Returns: {
          activity_count: number
          album_id: string
          album_title: string
          artist_name: string
          cover_url: string
          delta: number
          recent_unique_users: number
          reviews_count: number
          trend_score: number
          unique_users: number
        }[]
      }
      get_trending_tracks: {
        Args: { result_limit?: number }
        Returns: {
          activity_count: number
          album_id: string
          album_title: string
          artist_id: string
          artist_name: string
          avg_rating: number
          cover_url: string
          delta: number
          recent_unique_users: number
          reviews_count: number
          track_id: string
          track_title: string
          trend_score: number
          unique_users: number
        }[]
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      refresh_album_stats_mat: { Args: never; Returns: undefined }
      replace_favorite_albums: { Args: { p_albums: Json }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
