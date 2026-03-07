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
      album_metadata: {
        Row: {
          album_id: string
          description: string | null
          description_src: string | null
          fetched_at: string
          lastfm_listeners: number | null
          lastfm_playcount: number | null
          lastfm_url: string | null
          spotify_url: string | null
        }
        Insert: {
          album_id: string
          description?: string | null
          description_src?: string | null
          fetched_at?: string
          lastfm_listeners?: number | null
          lastfm_playcount?: number | null
          lastfm_url?: string | null
          spotify_url?: string | null
        }
        Update: {
          album_id?: string
          description?: string | null
          description_src?: string | null
          fetched_at?: string
          lastfm_listeners?: number | null
          lastfm_playcount?: number | null
          lastfm_url?: string | null
          spotify_url?: string | null
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
          cover_url: string | null
          created_at: string
          id: string
          mbid: string | null
          release_date: string | null
          search_vector: unknown
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          mbid?: string | null
          release_date?: string | null
          search_vector?: unknown
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          mbid?: string | null
          release_date?: string | null
          search_vector?: unknown
          title?: string
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
      diary_comments: {
        Row: {
          body: string
          created_at: string
          entry_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          entry_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_id?: string
          id?: string
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
        ]
      }
      diary_entries: {
        Row: {
          album_id: string
          created_at: string
          id: string
          is_public: boolean
          listened_at: string
          rating: number | null
          re_listen: boolean
          review_body: string | null
          review_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          is_public?: boolean
          listened_at?: string
          rating?: number | null
          re_listen?: boolean
          review_body?: string | null
          review_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          is_public?: boolean
          listened_at?: string
          rating?: number | null
          re_listen?: boolean
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
      external_ids: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          source: string
          value: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          source: string
          value: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          source?: string
          value?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
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
          updated_at?: string | null
          username?: string | null
          username_changed?: boolean | null
        }
        Relationships: []
      }
      saved_albums: {
        Row: {
          album_id: string
          id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          id?: string
          saved_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_albums_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
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
      tracks: {
        Row: {
          album_id: string
          artist_id: string
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
      diary_entry_stats: {
        Row: {
          comments_count: number | null
          entry_id: string | null
          likes_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
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
