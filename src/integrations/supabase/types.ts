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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_links: {
        Row: {
          base_url: string
          commission_rate: number
          created_at: string
          id: string
          is_active: boolean
          partner_name: string
          tracking_param: string | null
        }
        Insert: {
          base_url: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          partner_name: string
          tracking_param?: string | null
        }
        Update: {
          base_url?: string
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          partner_name?: string
          tracking_param?: string | null
        }
        Relationships: []
      }
      areas: {
        Row: {
          city_id: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          slug: string
          zone: string | null
        }
        Insert: {
          city_id: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          slug: string
          zone?: string | null
        }
        Update: {
          city_id?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          slug?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cities: {
        Row: {
          country: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      digital_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          price: number
          purchase_url: string | null
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          purchase_url?: string | null
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          purchase_url?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      duplicate_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          entity_type: Database["public"]["Enums"]["item_type"]
          id: string
          match_score: number
          primary_id: string
          resolved_at: string | null
          resolved_by: string | null
          signals: Json
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          entity_type: Database["public"]["Enums"]["item_type"]
          id?: string
          match_score?: number
          primary_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          signals?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          entity_type?: Database["public"]["Enums"]["item_type"]
          id?: string
          match_score?: number
          primary_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          signals?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          affiliate_link_id: string | null
          age_min: number | null
          area_id: string | null
          booking_url: string | null
          category_id: string | null
          city_id: string
          created_at: string
          currency: string
          description: string | null
          ends_at: string | null
          first_seen_at: string
          group_types: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_sponsored: boolean
          is_verified: boolean
          language: string | null
          last_seen_at: string | null
          lifecycle_status: Database["public"]["Enums"]["event_lifecycle"]
          moods: string[]
          name: string
          next_refresh_at: string | null
          occasion_tags: string[]
          popularity_score: number
          price_max: number | null
          price_min: number | null
          quality_score: number | null
          slug: string
          source_last_checked_at: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          sponsor_id: string | null
          starts_at: string
          tags: string[]
          timezone: string
          updated_at: string
          venue_id: string | null
          verification_status: Database["public"]["Enums"]["verification_state"]
          website_url: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          age_min?: number | null
          area_id?: string | null
          booking_url?: string | null
          category_id?: string | null
          city_id: string
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          language?: string | null
          last_seen_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["event_lifecycle"]
          moods?: string[]
          name: string
          next_refresh_at?: string | null
          occasion_tags?: string[]
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          slug: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          starts_at: string
          tags?: string[]
          timezone?: string
          updated_at?: string
          venue_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_state"]
          website_url?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          age_min?: number | null
          area_id?: string | null
          booking_url?: string | null
          category_id?: string | null
          city_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          language?: string | null
          last_seen_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["event_lifecycle"]
          moods?: string[]
          name?: string
          next_refresh_at?: string | null
          occasion_tags?: string[]
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          slug?: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          starts_at?: string
          tags?: string[]
          timezone?: string
          updated_at?: string
          venue_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_state"]
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          affiliate_link_id: string | null
          area_id: string | null
          best_times: string[]
          booking_url: string | null
          category_id: string | null
          city_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          first_seen_at: string
          group_types: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_sponsored: boolean
          is_verified: boolean
          last_seen_at: string | null
          moods: string[]
          name: string
          next_refresh_at: string | null
          popularity_score: number
          price_max: number | null
          price_min: number | null
          quality_score: number | null
          schedule_note: string | null
          slug: string
          source_last_checked_at: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          sponsor_id: string | null
          tags: string[]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          affiliate_link_id?: string | null
          area_id?: string | null
          best_times?: string[]
          booking_url?: string | null
          category_id?: string | null
          city_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          moods?: string[]
          name: string
          next_refresh_at?: string | null
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          schedule_note?: string | null
          slug: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          affiliate_link_id?: string | null
          area_id?: string | null
          best_times?: string[]
          booking_url?: string | null
          category_id?: string | null
          city_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          moods?: string[]
          name?: string
          next_refresh_at?: string | null
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          schedule_note?: string | null
          slug?: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: [
          {
            foreignKeyName: "experiences_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          body: string | null
          city_id: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          city_id: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          city_id?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guides_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_cron_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          token_sha256: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          token_sha256: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          token_sha256?: string
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          created_at: string
          details: Json
          error_summary: string | null
          finished_at: string | null
          id: string
          job_type: string
          records_created: number
          records_failed: number
          records_fetched: number
          records_skipped: number
          records_updated: number
          source_id: string | null
          source_name: string | null
          started_at: string
          status: Database["public"]["Enums"]["ingestion_job_status"]
        }
        Insert: {
          created_at?: string
          details?: Json
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          records_created?: number
          records_failed?: number
          records_fetched?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          source_name?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_job_status"]
        }
        Update: {
          created_at?: string
          details?: Json
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          records_created?: number
          records_failed?: number
          records_fetched?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          source_name?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      ingestion_sources: {
        Row: {
          adapter_key: string
          authority_level: number
          base_url: string | null
          city_id: string | null
          config: Json
          created_at: string
          credential_env_keys: string[]
          enabled: boolean
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status:
            | Database["public"]["Enums"]["ingestion_job_status"]
            | null
          name: string
          next_run_at: string | null
          notes: string | null
          refresh_interval_minutes: number
          requires_credentials: boolean
          slug: string
          source_type: Database["public"]["Enums"]["ingestion_source_type"]
          updated_at: string
        }
        Insert: {
          adapter_key: string
          authority_level?: number
          base_url?: string | null
          city_id?: string | null
          config?: Json
          created_at?: string
          credential_env_keys?: string[]
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?:
            | Database["public"]["Enums"]["ingestion_job_status"]
            | null
          name: string
          next_run_at?: string | null
          notes?: string | null
          refresh_interval_minutes?: number
          requires_credentials?: boolean
          slug: string
          source_type: Database["public"]["Enums"]["ingestion_source_type"]
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          authority_level?: number
          base_url?: string | null
          city_id?: string | null
          config?: Json
          created_at?: string
          credential_env_keys?: string[]
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?:
            | Database["public"]["Enums"]["ingestion_job_status"]
            | null
          name?: string
          next_run_at?: string | null
          notes?: string | null
          refresh_interval_minutes?: number
          requires_credentials?: boolean
          slug?: string
          source_type?: Database["public"]["Enums"]["ingestion_source_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_sources_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          city_id: string | null
          created_at: string
          event_type: string
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          metadata: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          city_id: string | null
          created_at: string
          id: string
          items: Json
          messages: Json
          params: Json
          session_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          messages?: Json
          params?: Json
          session_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          messages?: Json
          params?: Json
          session_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          city_id: string
          created_at: string
          description: string | null
          discount_text: string | null
          id: string
          is_active: boolean
          is_members_only: boolean
          is_sponsored: boolean
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          next_refresh_at: string | null
          promo_code: string | null
          quality_score: number | null
          source_last_checked_at: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          sponsor_id: string | null
          title: string
          url: string | null
          valid_from: string | null
          valid_until: string | null
          verification_status: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          city_id: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          id?: string
          is_active?: boolean
          is_members_only?: boolean
          is_sponsored?: boolean
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          next_refresh_at?: string | null
          promo_code?: string | null
          quality_score?: number | null
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          title: string
          url?: string | null
          valid_from?: string | null
          valid_until?: string | null
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          city_id?: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          id?: string
          is_active?: boolean
          is_members_only?: boolean
          is_sponsored?: boolean
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          next_refresh_at?: string | null
          promo_code?: string | null
          quality_score?: number | null
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          title?: string
          url?: string | null
          valid_from?: string | null
          valid_until?: string | null
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: [
          {
            foreignKeyName: "offers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          home_city_id: string | null
          id: string
          membership_expires_at: string | null
          membership_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          home_city_id?: string | null
          id: string
          membership_expires_at?: string | null
          membership_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          home_city_id?: string | null
          id?: string
          membership_expires_at?: string | null
          membership_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_events: {
        Row: {
          affiliate_link_id: string | null
          amount: number
          currency: string
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          metadata: Json
          occurred_at: string
          source: string
          sponsor_id: string | null
          user_id: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          amount?: number
          currency?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          metadata?: Json
          occurred_at?: string
          source: string
          sponsor_id?: string | null
          user_id?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          amount?: number
          currency?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          metadata?: Json
          occurred_at?: string
          source?: string
          sponsor_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          user_id?: string
        }
        Relationships: []
      }
      source_records: {
        Row: {
          content_hash: string
          created_at: string
          error_message: string | null
          external_id: string
          fetch_status: string
          first_seen_at: string
          id: string
          last_checked_at: string
          last_seen_at: string
          linked_entity_id: string | null
          linked_entity_type: Database["public"]["Enums"]["item_type"] | null
          normalised: Json | null
          parse_status: string
          quality_score: number | null
          raw_payload: Json
          review_status: string
          source_confidence: number
          source_id: string | null
          source_last_modified_at: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["ingestion_source_type"]
          source_url: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          content_hash: string
          created_at?: string
          error_message?: string | null
          external_id: string
          fetch_status?: string
          first_seen_at?: string
          id?: string
          last_checked_at?: string
          last_seen_at?: string
          linked_entity_id?: string | null
          linked_entity_type?: Database["public"]["Enums"]["item_type"] | null
          normalised?: Json | null
          parse_status?: string
          quality_score?: number | null
          raw_payload?: Json
          review_status?: string
          source_confidence?: number
          source_id?: string | null
          source_last_modified_at?: string | null
          source_name: string
          source_type: Database["public"]["Enums"]["ingestion_source_type"]
          source_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          content_hash?: string
          created_at?: string
          error_message?: string | null
          external_id?: string
          fetch_status?: string
          first_seen_at?: string
          id?: string
          last_checked_at?: string
          last_seen_at?: string
          linked_entity_id?: string | null
          linked_entity_type?: Database["public"]["Enums"]["item_type"] | null
          normalised?: Json | null
          parse_status?: string
          quality_score?: number | null
          raw_payload?: Json
          review_status?: string
          source_confidence?: number
          source_id?: string | null
          source_last_modified_at?: string | null
          source_name?: string
          source_type?: Database["public"]["Enums"]["ingestion_source_type"]
          source_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: [
          {
            foreignKeyName: "source_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          budget_max: number | null
          group_types: string[]
          id: string
          moods: string[]
          preferred_area_ids: string[]
          preferred_timings: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_max?: number | null
          group_types?: string[]
          id?: string
          moods?: string[]
          preferred_area_ids?: string[]
          preferred_timings?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_max?: number | null
          group_types?: string[]
          id?: string
          moods?: string[]
          preferred_area_ids?: string[]
          preferred_timings?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          affiliate_link_id: string | null
          area_id: string | null
          best_times: string[]
          booking_url: string | null
          category_id: string | null
          city_id: string
          created_at: string
          description: string | null
          first_seen_at: string
          group_types: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_sponsored: boolean
          is_verified: boolean
          last_seen_at: string | null
          lat: number | null
          lng: number | null
          moods: string[]
          name: string
          next_refresh_at: string | null
          opening_hours: Json | null
          popularity_score: number
          price_max: number | null
          price_min: number | null
          quality_score: number | null
          slug: string
          source_last_checked_at: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          sponsor_id: string | null
          tags: string[]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
          website_url: string | null
        }
        Insert: {
          address?: string | null
          affiliate_link_id?: string | null
          area_id?: string | null
          best_times?: string[]
          booking_url?: string | null
          category_id?: string | null
          city_id: string
          created_at?: string
          description?: string | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          moods?: string[]
          name: string
          next_refresh_at?: string | null
          opening_hours?: Json | null
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          slug: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
          website_url?: string | null
        }
        Update: {
          address?: string | null
          affiliate_link_id?: string | null
          area_id?: string | null
          best_times?: string[]
          booking_url?: string | null
          category_id?: string | null
          city_id?: string
          created_at?: string
          description?: string | null
          first_seen_at?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          lat?: number | null
          lng?: number | null
          moods?: string[]
          name?: string
          next_refresh_at?: string | null
          opening_hours?: Json | null
          popularity_score?: number
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          slug?: string
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      trigger_ingestion: {
        Args: { _body?: Json; _task: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      event_lifecycle:
        | "DRAFT"
        | "PENDING_REVIEW"
        | "ACTIVE"
        | "SOLD_OUT"
        | "POSTPONED"
        | "CANCELLED"
        | "EXPIRED"
      ingestion_job_status: "running" | "success" | "partial" | "failed"
      ingestion_source_type:
        | "official_site"
        | "organiser_submission"
        | "partner_feed"
        | "ticketing_api"
        | "social_api"
      item_type: "venue" | "event" | "experience"
      verification_state:
        | "VERIFIED"
        | "REVIEW_REQUIRED"
        | "STALE"
        | "UNVERIFIED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      event_lifecycle: [
        "DRAFT",
        "PENDING_REVIEW",
        "ACTIVE",
        "SOLD_OUT",
        "POSTPONED",
        "CANCELLED",
        "EXPIRED",
      ],
      ingestion_job_status: ["running", "success", "partial", "failed"],
      ingestion_source_type: [
        "official_site",
        "organiser_submission",
        "partner_feed",
        "ticketing_api",
        "social_api",
      ],
      item_type: ["venue", "event", "experience"],
      verification_state: [
        "VERIFIED",
        "REVIEW_REQUIRED",
        "STALE",
        "UNVERIFIED",
      ],
    },
  },
} as const
