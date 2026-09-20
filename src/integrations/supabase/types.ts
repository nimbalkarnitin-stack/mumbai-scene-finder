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
      affiliate_clicks: {
        Row: {
          campaign: string | null
          city_id: string | null
          commission_model:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at: string
          dedupe_key: string | null
          destination_url: string
          disclosure_shown: boolean
          expected_commission_rate: number | null
          id: string
          is_sponsored: boolean
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          link_kind: string
          merchant_partnership_id: string | null
          metadata: Json
          offer_id: string | null
          partner_id: string | null
          placement: string | null
          recommendation_id: string | null
          session_id: string | null
          sponsored_listing_id: string | null
          subid: string
          tracked_url: string
          user_id: string | null
        }
        Insert: {
          campaign?: string | null
          city_id?: string | null
          commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at?: string
          dedupe_key?: string | null
          destination_url: string
          disclosure_shown?: boolean
          expected_commission_rate?: number | null
          id?: string
          is_sponsored?: boolean
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          link_kind?: string
          merchant_partnership_id?: string | null
          metadata?: Json
          offer_id?: string | null
          partner_id?: string | null
          placement?: string | null
          recommendation_id?: string | null
          session_id?: string | null
          sponsored_listing_id?: string | null
          subid: string
          tracked_url: string
          user_id?: string | null
        }
        Update: {
          campaign?: string | null
          city_id?: string | null
          commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at?: string
          dedupe_key?: string | null
          destination_url?: string
          disclosure_shown?: boolean
          expected_commission_rate?: number | null
          id?: string
          is_sponsored?: boolean
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          link_kind?: string
          merchant_partnership_id?: string | null
          metadata?: Json
          offer_id?: string | null
          partner_id?: string | null
          placement?: string | null
          recommendation_id?: string | null
          session_id?: string | null
          sponsored_listing_id?: string | null
          subid?: string
          tracked_url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_merchant_partnership_id_fkey"
            columns: ["merchant_partnership_id"]
            isOneToOne: false
            referencedRelation: "merchant_partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "affiliate_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_sponsored_listing_id_fkey"
            columns: ["sponsored_listing_id"]
            isOneToOne: false
            referencedRelation: "sponsored_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          approved_at: string | null
          click_id: string | null
          commission_amount: number | null
          commission_model:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at: string
          currency: string
          external_conversion_id: string
          id: string
          import_batch: string | null
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          merchant_partnership_id: string | null
          notes: string | null
          occurred_at: string | null
          offer_id: string | null
          order_value: number | null
          paid_at: string | null
          partner_id: string | null
          payout_reference: string | null
          raw_payload: Json
          reconciled_at: string | null
          reconciliation_status: string
          rejected_at: string | null
          rejection_reason: string | null
          reported_at: string
          status: Database["public"]["Enums"]["conversion_status"]
          subid: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          click_id?: string | null
          commission_amount?: number | null
          commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at?: string
          currency?: string
          external_conversion_id: string
          id?: string
          import_batch?: string | null
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          merchant_partnership_id?: string | null
          notes?: string | null
          occurred_at?: string | null
          offer_id?: string | null
          order_value?: number | null
          paid_at?: string | null
          partner_id?: string | null
          payout_reference?: string | null
          raw_payload?: Json
          reconciled_at?: string | null
          reconciliation_status?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          reported_at?: string
          status?: Database["public"]["Enums"]["conversion_status"]
          subid?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          click_id?: string | null
          commission_amount?: number | null
          commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          created_at?: string
          currency?: string
          external_conversion_id?: string
          id?: string
          import_batch?: string | null
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          merchant_partnership_id?: string | null
          notes?: string | null
          occurred_at?: string | null
          offer_id?: string | null
          order_value?: number | null
          paid_at?: string | null
          partner_id?: string | null
          payout_reference?: string | null
          raw_payload?: Json
          reconciled_at?: string | null
          reconciliation_status?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          reported_at?: string
          status?: Database["public"]["Enums"]["conversion_status"]
          subid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_merchant_partnership_id_fkey"
            columns: ["merchant_partnership_id"]
            isOneToOne: false
            referencedRelation: "merchant_partnerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "affiliate_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
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
      affiliate_offers: {
        Row: {
          city_id: string | null
          commission_flat: number | null
          commission_model: Database["public"]["Enums"]["commission_model"]
          commission_rate: number | null
          created_at: string
          currency: string
          deep_link_template: string | null
          description: string | null
          destination_url: string | null
          disclosure_required: boolean
          ends_at: string | null
          external_id: string | null
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          partner_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          terms_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          commission_flat?: number | null
          commission_model?: Database["public"]["Enums"]["commission_model"]
          commission_rate?: number | null
          created_at?: string
          currency?: string
          deep_link_template?: string | null
          description?: string | null
          destination_url?: string | null
          disclosure_required?: boolean
          ends_at?: string | null
          external_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          partner_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          terms_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          commission_flat?: number | null
          commission_model?: Database["public"]["Enums"]["commission_model"]
          commission_rate?: number | null
          created_at?: string
          currency?: string
          deep_link_template?: string | null
          description?: string | null
          destination_url?: string | null
          disclosure_required?: boolean
          ends_at?: string | null
          external_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          partner_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          terms_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_offers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_offers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_partners: {
        Row: {
          adapter_key: string
          base_url: string | null
          capabilities: Json
          config: Json
          created_at: string
          credential_env_keys: string[]
          currency: string
          dashboard_url: string | null
          default_commission_model:
            | Database["public"]["Enums"]["commission_model"]
            | null
          default_commission_rate: number | null
          disclosure_text: string | null
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["partner_kind"]
          last_error: string | null
          last_sync_at: string | null
          name: string
          notes: string | null
          slug: string
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
        }
        Insert: {
          adapter_key: string
          base_url?: string | null
          capabilities?: Json
          config?: Json
          created_at?: string
          credential_env_keys?: string[]
          currency?: string
          dashboard_url?: string | null
          default_commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          default_commission_rate?: number | null
          disclosure_text?: string | null
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["partner_kind"]
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          notes?: string | null
          slug: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          base_url?: string | null
          capabilities?: Json
          config?: Json
          created_at?: string
          credential_env_keys?: string[]
          currency?: string
          dashboard_url?: string | null
          default_commission_model?:
            | Database["public"]["Enums"]["commission_model"]
            | null
          default_commission_rate?: number | null
          disclosure_text?: string | null
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["partner_kind"]
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          notes?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
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
      discovery_candidates: {
        Row: {
          area: string | null
          category: string | null
          city_id: string | null
          confidence: number
          created_at: string
          discovered_at: string
          discovery_method: string
          discovery_query: string | null
          domain: string | null
          entity_type: Database["public"]["Enums"]["item_type"]
          events_page_url: string | null
          evidence: Json
          external_ref: string | null
          google_maps_uri: string | null
          google_place_id: string | null
          id: string
          last_checked_at: string | null
          last_error: string | null
          linked_entity_id: string | null
          linked_entity_type: Database["public"]["Enums"]["item_type"] | null
          linked_source_id: string | null
          name: string
          next_check_at: string | null
          notes: string | null
          official_website_url: string | null
          provenance: Json
          source_url: string | null
          status: Database["public"]["Enums"]["discovery_status"]
          updated_at: string
        }
        Insert: {
          area?: string | null
          category?: string | null
          city_id?: string | null
          confidence?: number
          created_at?: string
          discovered_at?: string
          discovery_method: string
          discovery_query?: string | null
          domain?: string | null
          entity_type?: Database["public"]["Enums"]["item_type"]
          events_page_url?: string | null
          evidence?: Json
          external_ref?: string | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: Database["public"]["Enums"]["item_type"] | null
          linked_source_id?: string | null
          name: string
          next_check_at?: string | null
          notes?: string | null
          official_website_url?: string | null
          provenance?: Json
          source_url?: string | null
          status?: Database["public"]["Enums"]["discovery_status"]
          updated_at?: string
        }
        Update: {
          area?: string | null
          category?: string | null
          city_id?: string | null
          confidence?: number
          created_at?: string
          discovered_at?: string
          discovery_method?: string
          discovery_query?: string | null
          domain?: string | null
          entity_type?: Database["public"]["Enums"]["item_type"]
          events_page_url?: string | null
          evidence?: Json
          external_ref?: string | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: Database["public"]["Enums"]["item_type"] | null
          linked_source_id?: string | null
          name?: string
          next_check_at?: string | null
          notes?: string | null
          official_website_url?: string | null
          provenance?: Json
          source_url?: string | null
          status?: Database["public"]["Enums"]["discovery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidates_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidates_linked_source_id_fkey"
            columns: ["linked_source_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_source_candidates: {
        Row: {
          candidate_id: string
          confidence: number
          created_at: string
          domain: string | null
          has_structured_data: boolean
          http_status: number | null
          id: string
          kind: string
          last_checked_at: string | null
          status: string
          structured_kinds: string[]
          url: string
          validation_notes: string | null
        }
        Insert: {
          candidate_id: string
          confidence?: number
          created_at?: string
          domain?: string | null
          has_structured_data?: boolean
          http_status?: number | null
          id?: string
          kind: string
          last_checked_at?: string | null
          status?: string
          structured_kinds?: string[]
          url: string
          validation_notes?: string | null
        }
        Update: {
          candidate_id?: string
          confidence?: number
          created_at?: string
          domain?: string | null
          has_structured_data?: boolean
          http_status?: number | null
          id?: string
          kind?: string
          last_checked_at?: string | null
          status?: string
          structured_kinds?: string[]
          url?: string
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_source_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
        ]
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
          organiser: string | null
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
          organiser?: string | null
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
          organiser?: string | null
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
      field_conflicts: {
        Row: {
          conflicting_values: Json
          detected_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["item_type"]
          field: string
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          conflicting_values?: Json
          detected_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["item_type"]
          field: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          conflicting_values?: Json
          detected_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["item_type"]
          field?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      field_provenance: {
        Row: {
          authority_level: number | null
          confidence: number
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["item_type"]
          field: string
          id: string
          observed_at: string
          source_name: string | null
          source_record_id: string | null
          source_type:
            | Database["public"]["Enums"]["ingestion_source_type"]
            | null
          source_url: string | null
          value_text: string | null
        }
        Insert: {
          authority_level?: number | null
          confidence?: number
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["item_type"]
          field: string
          id?: string
          observed_at?: string
          source_name?: string | null
          source_record_id?: string | null
          source_type?:
            | Database["public"]["Enums"]["ingestion_source_type"]
            | null
          source_url?: string | null
          value_text?: string | null
        }
        Update: {
          authority_level?: number | null
          confidence?: number
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["item_type"]
          field?: string
          id?: string
          observed_at?: string
          source_name?: string | null
          source_record_id?: string | null
          source_type?:
            | Database["public"]["Enums"]["ingestion_source_type"]
            | null
          source_url?: string | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_provenance_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      google_api_requests: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          http_status: number | null
          id: string
          place_count: number
          query_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          http_status?: number | null
          id?: string
          place_count?: number
          query_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          http_status?: number | null
          id?: string
          place_count?: number
          query_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_api_requests_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "google_discovery_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      google_discovery_queries: {
        Row: {
          area: string
          category: string
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_result_count: number | null
          last_run_at: string | null
          priority: number
          query_text: string
          updated_at: string
        }
        Insert: {
          area: string
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_result_count?: number | null
          last_run_at?: string | null
          priority?: number
          query_text: string
          updated_at?: string
        }
        Update: {
          area?: string
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_result_count?: number | null
          last_run_at?: string | null
          priority?: number
          query_text?: string
          updated_at?: string
        }
        Relationships: []
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
      merchant_partnerships: {
        Row: {
          booking_fee: number | null
          city_id: string | null
          commission_rate: number | null
          contact_email: string | null
          contact_name: string | null
          contract_ends_at: string | null
          contract_starts_at: string | null
          created_at: string
          currency: string
          flat_fee: number | null
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          merchant_name: string
          model: Database["public"]["Enums"]["commission_model"]
          notes: string | null
          partner_id: string | null
          payout_terms: string | null
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
        }
        Insert: {
          booking_fee?: number | null
          city_id?: string | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contract_ends_at?: string | null
          contract_starts_at?: string | null
          created_at?: string
          currency?: string
          flat_fee?: number | null
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          merchant_name: string
          model?: Database["public"]["Enums"]["commission_model"]
          notes?: string | null
          partner_id?: string | null
          payout_terms?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Update: {
          booking_fee?: number | null
          city_id?: string | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contract_ends_at?: string | null
          contract_starts_at?: string | null
          created_at?: string
          currency?: string
          flat_fee?: number | null
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          merchant_name?: string
          model?: Database["public"]["Enums"]["commission_model"]
          notes?: string | null
          partner_id?: string | null
          payout_terms?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_partnerships_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_partnerships_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      monetisation_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
      social_profiles: {
        Row: {
          authorised_api: boolean
          candidate_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["item_type"] | null
          evidence: Json
          handle: string | null
          id: string
          last_checked_at: string | null
          platform: string
          profile_url: string
          source_type: Database["public"]["Enums"]["ingestion_source_type"]
          verification_state: Database["public"]["Enums"]["verification_state"]
        }
        Insert: {
          authorised_api?: boolean
          candidate_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["item_type"] | null
          evidence?: Json
          handle?: string | null
          id?: string
          last_checked_at?: string | null
          platform: string
          profile_url: string
          source_type?: Database["public"]["Enums"]["ingestion_source_type"]
          verification_state?: Database["public"]["Enums"]["verification_state"]
        }
        Update: {
          authorised_api?: boolean
          candidate_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["item_type"] | null
          evidence?: Json
          handle?: string | null
          id?: string
          last_checked_at?: string | null
          platform?: string
          profile_url?: string
          source_type?: Database["public"]["Enums"]["ingestion_source_type"]
          verification_state?: Database["public"]["Enums"]["verification_state"]
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
        ]
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
      sponsored_listings: {
        Row: {
          budget_amount: number | null
          campaign_name: string
          city_id: string | null
          clicks: number
          created_at: string
          currency: string
          disclosure_label: string
          ends_at: string | null
          fee_amount: number | null
          id: string
          impressions: number
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          notes: string | null
          partner_id: string | null
          placement: string
          priority: number
          sponsor_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          campaign_name: string
          city_id?: string | null
          clicks?: number
          created_at?: string
          currency?: string
          disclosure_label?: string
          ends_at?: string | null
          fee_amount?: number | null
          id?: string
          impressions?: number
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          notes?: string | null
          partner_id?: string | null
          placement?: string
          priority?: number
          sponsor_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          campaign_name?: string
          city_id?: string | null
          clicks?: number
          created_at?: string
          currency?: string
          disclosure_label?: string
          ends_at?: string | null
          fee_amount?: number | null
          id?: string
          impressions?: number
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          notes?: string | null
          partner_id?: string | null
          placement?: string
          priority?: number
          sponsor_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_listings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_listings_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
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
      swiggy_call_metrics: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_class: string | null
          http_status: number | null
          id: string
          outcome: string
          retries: number
          server: string
          tool: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_class?: string | null
          http_status?: number | null
          id?: string
          outcome: string
          retries?: number
          server: string
          tool: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_class?: string | null
          http_status?: number | null
          id?: string
          outcome?: string
          retries?: number
          server?: string
          tool?: string
          user_id?: string | null
        }
        Relationships: []
      }
      swiggy_clients: {
        Row: {
          authorization_endpoint: string
          client_id: string
          client_secret: string | null
          created_at: string
          id: string
          issuer: string
          redirect_uri: string
          registration_client_uri: string | null
          scope: string | null
          token_endpoint: string
          updated_at: string
        }
        Insert: {
          authorization_endpoint: string
          client_id: string
          client_secret?: string | null
          created_at?: string
          id?: string
          issuer: string
          redirect_uri: string
          registration_client_uri?: string | null
          scope?: string | null
          token_endpoint: string
          updated_at?: string
        }
        Update: {
          authorization_endpoint?: string
          client_id?: string
          client_secret?: string | null
          created_at?: string
          id?: string
          issuer?: string
          redirect_uri?: string
          registration_client_uri?: string | null
          scope?: string | null
          token_endpoint?: string
          updated_at?: string
        }
        Relationships: []
      }
      swiggy_connections: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string
          expires_at: string
          id: string
          last_error_class: string | null
          last_used_at: string | null
          revoked_at: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string
          expires_at: string
          id?: string
          last_error_class?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_error_class?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      swiggy_oauth_states: {
        Row: {
          client_row_id: string | null
          code_verifier: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          return_path: string | null
          state: string
          user_id: string
        }
        Insert: {
          client_row_id?: string | null
          code_verifier: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri: string
          return_path?: string | null
          state: string
          user_id: string
        }
        Update: {
          client_row_id?: string | null
          code_verifier?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          return_path?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swiggy_oauth_states_client_row_id_fkey"
            columns: ["client_row_id"]
            isOneToOne: false
            referencedRelation: "swiggy_clients"
            referencedColumns: ["id"]
          },
        ]
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
          accessibility: string | null
          address: string | null
          affiliate_link_id: string | null
          age_restriction: string | null
          amenities: string[]
          area_id: string | null
          best_times: string[]
          booking_provider: string | null
          booking_url: string | null
          category_id: string | null
          city_id: string
          completeness_score: number | null
          contact_url: string | null
          cover_charge: string | null
          created_at: string
          cuisines: string[]
          currency: string
          description: string | null
          dietary_options: string[]
          dress_code: string | null
          email: string | null
          events_url: string | null
          first_seen_at: string
          geo_notes: string | null
          geo_status: string
          group_types: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_sponsored: boolean
          is_verified: boolean
          last_seen_at: string | null
          last_verified_at: string | null
          lat: number | null
          lng: number | null
          locality: string | null
          map_url: string | null
          menu_url: string | null
          missing_fields: string[]
          moods: string[]
          name: string
          next_refresh_at: string | null
          opening_hours: Json | null
          parking: string | null
          pet_policy: string | null
          phone: string | null
          popularity_score: number
          price_band: string | null
          price_max: number | null
          price_min: number | null
          quality_score: number | null
          quarantine_reason: string | null
          quarantined_at: string | null
          reservation_url: string | null
          reservations_available: boolean | null
          service_type: string | null
          slug: string
          social_urls: Json
          source_last_checked_at: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          special_hours: Json | null
          sponsor_id: string | null
          tags: string[]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_state"]
          website_url: string | null
        }
        Insert: {
          accessibility?: string | null
          address?: string | null
          affiliate_link_id?: string | null
          age_restriction?: string | null
          amenities?: string[]
          area_id?: string | null
          best_times?: string[]
          booking_provider?: string | null
          booking_url?: string | null
          category_id?: string | null
          city_id: string
          completeness_score?: number | null
          contact_url?: string | null
          cover_charge?: string | null
          created_at?: string
          cuisines?: string[]
          currency?: string
          description?: string | null
          dietary_options?: string[]
          dress_code?: string | null
          email?: string | null
          events_url?: string | null
          first_seen_at?: string
          geo_notes?: string | null
          geo_status?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          locality?: string | null
          map_url?: string | null
          menu_url?: string | null
          missing_fields?: string[]
          moods?: string[]
          name: string
          next_refresh_at?: string | null
          opening_hours?: Json | null
          parking?: string | null
          pet_policy?: string | null
          phone?: string | null
          popularity_score?: number
          price_band?: string | null
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          reservation_url?: string | null
          reservations_available?: boolean | null
          service_type?: string | null
          slug: string
          social_urls?: Json
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          special_hours?: Json | null
          sponsor_id?: string | null
          tags?: string[]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_state"]
          website_url?: string | null
        }
        Update: {
          accessibility?: string | null
          address?: string | null
          affiliate_link_id?: string | null
          age_restriction?: string | null
          amenities?: string[]
          area_id?: string | null
          best_times?: string[]
          booking_provider?: string | null
          booking_url?: string | null
          category_id?: string | null
          city_id?: string
          completeness_score?: number | null
          contact_url?: string | null
          cover_charge?: string | null
          created_at?: string
          cuisines?: string[]
          currency?: string
          description?: string | null
          dietary_options?: string[]
          dress_code?: string | null
          email?: string | null
          events_url?: string | null
          first_seen_at?: string
          geo_notes?: string | null
          geo_status?: string
          group_types?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_sponsored?: boolean
          is_verified?: boolean
          last_seen_at?: string | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          locality?: string | null
          map_url?: string | null
          menu_url?: string | null
          missing_fields?: string[]
          moods?: string[]
          name?: string
          next_refresh_at?: string | null
          opening_hours?: Json | null
          parking?: string | null
          pet_policy?: string | null
          phone?: string | null
          popularity_score?: number
          price_band?: string | null
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          reservation_url?: string | null
          reservations_available?: boolean | null
          service_type?: string | null
          slug?: string
          social_urls?: Json
          source_last_checked_at?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          special_hours?: Json | null
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
      campaign_status: "draft" | "scheduled" | "active" | "paused" | "ended"
      commission_model:
        | "CPA"
        | "CPL"
        | "CPS"
        | "REVENUE_SHARE"
        | "BOOKING_FEE"
        | "FIXED_SPONSORSHIP"
      conversion_status: "pending" | "approved" | "rejected" | "paid"
      discovery_status:
        | "DISCOVERED"
        | "SOURCE_FOUND"
        | "VALIDATED"
        | "INGESTED"
        | "REJECTED"
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
        | "discovery"
      item_type: "venue" | "event" | "experience"
      partner_kind:
        | "affiliate_network"
        | "direct_merchant"
        | "venue"
        | "sponsor"
      partner_status:
        | "unconfigured"
        | "configured"
        | "active"
        | "paused"
        | "disabled"
      verification_state:
        | "VERIFIED"
        | "REVIEW_REQUIRED"
        | "STALE"
        | "UNVERIFIED"
        | "PARTIALLY_VERIFIED"
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
      campaign_status: ["draft", "scheduled", "active", "paused", "ended"],
      commission_model: [
        "CPA",
        "CPL",
        "CPS",
        "REVENUE_SHARE",
        "BOOKING_FEE",
        "FIXED_SPONSORSHIP",
      ],
      conversion_status: ["pending", "approved", "rejected", "paid"],
      discovery_status: [
        "DISCOVERED",
        "SOURCE_FOUND",
        "VALIDATED",
        "INGESTED",
        "REJECTED",
      ],
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
        "discovery",
      ],
      item_type: ["venue", "event", "experience"],
      partner_kind: [
        "affiliate_network",
        "direct_merchant",
        "venue",
        "sponsor",
      ],
      partner_status: [
        "unconfigured",
        "configured",
        "active",
        "paused",
        "disabled",
      ],
      verification_state: [
        "VERIFIED",
        "REVIEW_REQUIRED",
        "STALE",
        "UNVERIFIED",
        "PARTIALLY_VERIFIED",
      ],
    },
  },
} as const
