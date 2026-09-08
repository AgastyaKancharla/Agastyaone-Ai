// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Regenerate with:  npm run db:types
//
// Mirrors the live schema of the AgastyaOne Platform Supabase project. The
// Supabase clients are parameterised with this, so a query naming a column that
// does not exist is a compile error rather than a runtime surprise.

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
      account_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          ended_at: string | null
          id: string
          role: string
          staff_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          role?: string
          staff_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          role?: string
          staff_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          body: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          kind: string
          lead_id: string | null
          subject: string | null
          tenant_id: string
        }
        Insert: {
          body?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          subject?: string | null
          tenant_id: string
        }
        Update: {
          body?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          actor_id: string | null
          body: string | null
          contact_id: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: number
          is_client_visible: boolean
          location_id: string | null
          occurred_at: string
          service_code: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          contact_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: never
          is_client_visible?: boolean
          location_id?: string | null
          occurred_at?: string
          service_code?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          contact_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: never
          is_client_visible?: boolean
          location_id?: string | null
          occurred_at?: string
          service_code?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_configs: {
        Row: {
          business_hours_only: boolean
          channel_id: string | null
          created_at: string
          handoff_rules: Json
          id: string
          is_active: boolean
          knowledge: Json
          location_id: string | null
          name: string
          persona: string | null
          system_prompt: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          channel_id?: string | null
          created_at?: string
          handoff_rules?: Json
          id?: string
          is_active?: boolean
          knowledge?: Json
          location_id?: string | null
          name: string
          persona?: string | null
          system_prompt?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          channel_id?: string | null
          created_at?: string
          handoff_rules?: Json
          id?: string
          is_active?: boolean
          knowledge?: Json
          location_id?: string | null
          name?: string
          persona?: string | null
          system_prompt?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_configs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_by: string | null
          body: string | null
          code: string
          entity_id: string | null
          entity_type: string | null
          id: string
          location_id: string | null
          raised_at: string
          resolved_at: string | null
          service_code: string | null
          severity: string
          status: string
          tenant_id: string
          title: string
        }
        Insert: {
          acknowledged_by?: string | null
          body?: string | null
          code: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          location_id?: string | null
          raised_at?: string
          resolved_at?: string | null
          service_code?: string | null
          severity?: string
          status?: string
          tenant_id: string
          title: string
        }
        Update: {
          acknowledged_by?: string | null
          body?: string | null
          code?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          location_id?: string | null
          raised_at?: string
          resolved_at?: string | null
          service_code?: string | null
          severity?: string
          status?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: unknown
          occurred_at: string
          reason: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          occurred_at?: string
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          ip_address?: unknown
          occurred_at?: string
          reason?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attempt: number
          cost_units: number | null
          created_at: string
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          location_id: string | null
          output: Json | null
          service_code: string | null
          started_at: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          attempt?: number
          cost_units?: number | null
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: string
          location_id?: string | null
          output?: Json | null
          service_code?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          attempt?: number
          cost_units?: number | null
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          location_id?: string | null
          output?: Json | null
          service_code?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_to: string | null
          cancelled_reason: string | null
          confirmed_for: string | null
          contact_id: string | null
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          reference: string | null
          requested_for: string | null
          routed_by_rule_id: string | null
          service_requested: string | null
          source: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cancelled_reason?: string | null
          confirmed_for?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          reference?: string | null
          requested_for?: string | null
          routed_by_rule_id?: string | null
          service_requested?: string | null
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cancelled_reason?: string | null
          confirmed_for?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          reference?: string | null
          requested_for?: string | null
          routed_by_rule_id?: string | null
          service_requested?: string | null
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_routed_by_rule_id_fkey"
            columns: ["routed_by_rule_id"]
            isOneToOne: false
            referencedRelation: "routing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_calendars: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          timezone: string
          work_end: string
          work_start: string
          workdays: number[]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
          work_end?: string
          work_start?: string
          workdays?: number[]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          work_end?: string
          work_start?: string
          workdays?: number[]
        }
        Relationships: []
      }
      calendar_holidays: {
        Row: {
          calendar_id: string
          holiday_on: string
          id: string
          is_optional: boolean
          name: string
        }
        Insert: {
          calendar_id: string
          holiday_on: string
          id?: string
          is_optional?: boolean
          name: string
        }
        Update: {
          calendar_id?: string
          holiday_on?: string
          id?: string
          is_optional?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_holidays_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "business_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          contact_id: string | null
          created_at: string
          direction: string
          duration_seconds: number
          ended_at: string | null
          from_e164: string | null
          id: string
          is_first_time_caller: boolean | null
          is_missed: boolean
          location_id: string | null
          outcome: string | null
          provider: string | null
          provider_call_id: string | null
          recording_url: string | null
          started_at: string
          status: string
          tenant_id: string
          to_e164: string | null
          tracking_number_id: string | null
          transcript: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          from_e164?: string | null
          id?: string
          is_first_time_caller?: boolean | null
          is_missed?: boolean
          location_id?: string | null
          outcome?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          to_e164?: string | null
          tracking_number_id?: string | null
          transcript?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          from_e164?: string | null
          id?: string
          is_first_time_caller?: boolean | null
          is_missed?: boolean
          location_id?: string | null
          outcome?: string | null
          provider?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          to_e164?: string | null
          tracking_number_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_tracking_number_id_fkey"
            columns: ["tracking_number_id"]
            isOneToOne: false
            referencedRelation: "tracking_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_enrollments: {
        Row: {
          campaign_id: string
          completed_at: string | null
          contact_id: string
          enrolled_at: string
          id: string
          status: string
          suppression_reason: string | null
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          contact_id: string
          enrolled_at?: string
          id?: string
          status?: string
          suppression_reason?: string | null
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          contact_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          suppression_reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          created_at: string
          enrollment_id: string
          failure_reason: string | null
          id: string
          message_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          step_index: number
          template_name: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          failure_reason?: string | null
          id?: string
          message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          step_index?: number
          template_name?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          failure_reason?: string | null
          id?: string
          message_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          step_index?: number
          template_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_rules: Json
          channel: string
          created_at: string
          ends_on: string | null
          id: string
          kind: string
          location_id: string | null
          name: string
          schedule: Json
          service_instance_id: string | null
          starts_on: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          audience_rules?: Json
          channel?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          kind: string
          location_id?: string | null
          name: string
          schedule?: Json
          service_instance_id?: string | null
          starts_on?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          audience_rules?: Json
          channel?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          name?: string
          schedule?: Json
          service_instance_id?: string | null
          starts_on?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          display_name: string | null
          external_id: string | null
          id: string
          kind: string
          location_id: string | null
          provider: string | null
          service_instance_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          external_id?: string | null
          id?: string
          kind: string
          location_id?: string | null
          provider?: string | null
          service_instance_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          external_id?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          provider?: string | null
          service_instance_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          created_at: string
          directory_id: string
          id: string
          is_claimed: boolean | null
          last_verified_at: string | null
          listing_url: string | null
          location_id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          directory_id: string
          id?: string
          is_claimed?: boolean | null
          last_verified_at?: string | null
          listing_url?: string | null
          location_id: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          directory_id?: string
          id?: string
          is_claimed?: boolean | null
          last_verified_at?: string | null
          listing_url?: string | null
          location_id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "citations_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "directories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_action_items: {
        Row: {
          blocked_days: number | null
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_on: string | null
          engagement_id: string | null
          id: string
          location_id: string | null
          priority: string
          requested_at: string
          requested_by: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          blocked_days?: number | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          engagement_id?: string | null
          id?: string
          location_id?: string | null
          priority?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          blocked_days?: number | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          engagement_id?: string | null
          id?: string
          location_id?: string | null
          priority?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_action_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_action_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_action_items_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_action_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_identities: {
        Row: {
          contact_id: string
          first_seen_at: string
          id: string
          identity_type: string
          identity_value: string
          identity_value_raw: string | null
          is_verified: boolean
          last_seen_at: string
          source_service: string | null
          tenant_id: string
        }
        Insert: {
          contact_id: string
          first_seen_at?: string
          id?: string
          identity_type: string
          identity_value: string
          identity_value_raw?: string | null
          is_verified?: boolean
          last_seen_at?: string
          source_service?: string | null
          tenant_id: string
        }
        Update: {
          contact_id?: string
          first_seen_at?: string
          id?: string
          identity_type?: string
          identity_value?: string
          identity_value_raw?: string | null
          is_verified?: boolean
          last_seen_at?: string
          source_service?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_match_candidates: {
        Row: {
          contact_a_id: string
          contact_b_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          signals: Json
          status: string
          tenant_id: string
        }
        Insert: {
          contact_a_id: string
          contact_b_id: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score: number
          signals?: Json
          status?: string
          tenant_id: string
        }
        Update: {
          contact_a_id?: string
          contact_b_id?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          signals?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_match_candidates_contact_a_id_fkey"
            columns: ["contact_a_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_match_candidates_contact_b_id_fkey"
            columns: ["contact_b_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_match_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_match_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merges: {
        Row: {
          evidence: Json
          id: string
          loser_id: string
          merged_at: string
          merged_by: string | null
          reason: string | null
          reverted_at: string | null
          tenant_id: string
          winner_id: string
        }
        Insert: {
          evidence?: Json
          id?: string
          loser_id: string
          merged_at?: string
          merged_by?: string | null
          reason?: string | null
          reverted_at?: string | null
          tenant_id: string
          winner_id: string
        }
        Update: {
          evidence?: Json
          id?: string
          loser_id?: string
          merged_at?: string
          merged_by?: string | null
          reason?: string | null
          reverted_at?: string | null
          tenant_id?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_merges_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_merged_by_fkey"
            columns: ["merged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          canonical_contact_id: string | null
          consent_evidence: Json
          consent_source: string | null
          contact_kind: string
          created_at: string
          date_of_birth: string | null
          email_opt_in_at: string | null
          email_opt_out_at: string | null
          family_name: string | null
          first_seen_at: string
          full_name: string | null
          given_name: string | null
          id: string
          last_seen_at: string
          location_id: string | null
          merged_into_contact_id: string | null
          notes: string | null
          primary_email: string | null
          primary_phone_e164: string | null
          primary_phone_raw: string | null
          sms_opt_in_at: string | null
          sms_opt_out_at: string | null
          status: string
          tags: string[]
          tenant_id: string
          updated_at: string
          whatsapp_opt_in_at: string | null
          whatsapp_opt_out_at: string | null
        }
        Insert: {
          canonical_contact_id?: string | null
          consent_evidence?: Json
          consent_source?: string | null
          contact_kind?: string
          created_at?: string
          date_of_birth?: string | null
          email_opt_in_at?: string | null
          email_opt_out_at?: string | null
          family_name?: string | null
          first_seen_at?: string
          full_name?: string | null
          given_name?: string | null
          id?: string
          last_seen_at?: string
          location_id?: string | null
          merged_into_contact_id?: string | null
          notes?: string | null
          primary_email?: string | null
          primary_phone_e164?: string | null
          primary_phone_raw?: string | null
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          status?: string
          tags?: string[]
          tenant_id: string
          updated_at?: string
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_out_at?: string | null
        }
        Update: {
          canonical_contact_id?: string | null
          consent_evidence?: Json
          consent_source?: string | null
          contact_kind?: string
          created_at?: string
          date_of_birth?: string | null
          email_opt_in_at?: string | null
          email_opt_out_at?: string | null
          family_name?: string | null
          first_seen_at?: string
          full_name?: string | null
          given_name?: string | null
          id?: string
          last_seen_at?: string
          location_id?: string | null
          merged_into_contact_id?: string | null
          notes?: string | null
          primary_email?: string | null
          primary_phone_e164?: string | null
          primary_phone_raw?: string | null
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          status?: string
          tags?: string[]
          tenant_id?: string
          updated_at?: string
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_out_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_merged_into_contact_id_fkey"
            columns: ["merged_into_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_lines: {
        Row: {
          billing_cycle: string
          contract_id: string
          created_at: string
          description: string | null
          discount_pct: number
          ends_on: string | null
          gst_rate: number
          hsn_sac_code: string | null
          id: string
          quantity: number
          service_id: string
          starts_on: string | null
          status: string
          tenant_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          contract_id: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          ends_on?: string | null
          gst_rate?: number
          hsn_sac_code?: string | null
          id?: string
          quantity?: number
          service_id: string
          starts_on?: string | null
          status?: string
          tenant_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          contract_id?: string
          created_at?: string
          description?: string | null
          discount_pct?: number
          ends_on?: string | null
          gst_rate?: number
          hsn_sac_code?: string | null
          id?: string
          quantity?: number
          service_id?: string
          starts_on?: string | null
          status?: string
          tenant_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_lines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commercial_model: string
          created_at: string
          currency_code: string
          document_id: string | null
          ends_on: string | null
          id: string
          notes: string | null
          parent_contract_id: string | null
          reference: string | null
          signed_at: string | null
          starts_on: string | null
          status: string
          tenant_id: string
          title: string
          total_value: number | null
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commercial_model?: string
          created_at?: string
          currency_code?: string
          document_id?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          reference?: string | null
          signed_at?: string | null
          starts_on?: string | null
          status?: string
          tenant_id: string
          title: string
          total_value?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commercial_model?: string
          created_at?: string
          currency_code?: string
          document_id?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          reference?: string | null
          signed_at?: string | null
          starts_on?: string | null
          status?: string
          tenant_id?: string
          title?: string
          total_value?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assignee_staff_id: string | null
          channel_id: string
          contact_id: string | null
          created_at: string
          external_id: string | null
          handled_by: string
          id: string
          last_message_at: string | null
          location_id: string | null
          status: string
          subject: string | null
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assignee_staff_id?: string | null
          channel_id: string
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          handled_by?: string
          id?: string
          last_message_at?: string | null
          location_id?: string | null
          status?: string
          subject?: string | null
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assignee_staff_id?: string | null
          channel_id?: string
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          handled_by?: string
          id?: string
          last_message_at?: string | null
          location_id?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          cgst_amount: number
          created_at: string
          credit_note_number: string
          document_id: string | null
          id: string
          igst_amount: number
          invoice_id: string
          issue_date: string
          issued_at: string | null
          issuer_tenant_id: string
          reason: string
          sgst_amount: number
          status: string
          taxable_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cgst_amount?: number
          created_at?: string
          credit_note_number: string
          document_id?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          issue_date?: string
          issued_at?: string | null
          issuer_tenant_id: string
          reason: string
          sgst_amount?: number
          status?: string
          taxable_amount?: number
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cgst_amount?: number
          created_at?: string
          credit_note_number?: string
          document_id?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          issue_date?: string
          issued_at?: string | null
          issuer_tenant_id?: string
          reason?: string
          sgst_amount?: number
          status?: string
          taxable_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_issuer_tenant_id_fkey"
            columns: ["issuer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_processing_agreements: {
        Row: {
          created_at: string
          data_classes: string[]
          document_id: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          retention_months: number | null
          signed_at: string | null
          status: string
          sub_processors: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_classes?: string[]
          document_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          retention_months?: number | null
          signed_at?: string | null
          status?: string
          sub_processors?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_classes?: string[]
          document_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          retention_months?: number | null
          signed_at?: string | null
          status?: string
          sub_processors?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_processing_agreements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_processing_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          contact_id: string | null
          created_at: string
          currency_code: string
          expected_close_on: string | null
          id: string
          lead_id: string | null
          owner_staff_id: string | null
          pipeline_id: string
          stage_id: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency_code?: string
          expected_close_on?: string | null
          id?: string
          lead_id?: string | null
          owner_staff_id?: string | null
          pipeline_id: string
          stage_id: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency_code?: string
          expected_close_on?: string | null
          id?: string
          lead_id?: string | null
          owner_staff_id?: string | null
          pipeline_id?: string
          stage_id?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      directories: {
        Row: {
          code: string
          country: string
          created_at: string
          domain: string
          id: string
          is_enabled: boolean
          name: string
          sort_order: number
          verticals: string[]
          weight: number
        }
        Insert: {
          code: string
          country?: string
          created_at?: string
          domain: string
          id?: string
          is_enabled?: boolean
          name: string
          sort_order?: number
          verticals?: string[]
          weight?: number
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          domain?: string
          id?: string
          is_enabled?: boolean
          name?: string
          sort_order?: number
          verticals?: string[]
          weight?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_client_visible: boolean
          kind: string
          location_id: string | null
          mime_type: string | null
          sha256: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_client_visible?: boolean
          kind: string
          location_id?: string | null
          mime_type?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_client_visible?: boolean
          kind?: string
          location_id?: string | null
          mime_type?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_tasks: {
        Row: {
          assignee_staff_id: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_on: string | null
          engagement_id: string
          id: string
          phase: string
          playbook_step_id: string | null
          sort_order: number
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_staff_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          engagement_id: string
          id?: string
          phase?: string
          playbook_step_id?: string | null
          sort_order?: number
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_staff_id?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          engagement_id?: string
          id?: string
          phase?: string
          playbook_step_id?: string | null
          sort_order?: number
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_tasks_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_tasks_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_tasks_playbook_step_id_fkey"
            columns: ["playbook_step_id"]
            isOneToOne: false
            referencedRelation: "playbook_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          contract_id: string | null
          created_at: string
          health_status: string
          id: string
          kind: string
          name: string
          owner_staff_id: string | null
          planned_end: string | null
          planned_start: string | null
          playbook_id: string | null
          reference: string | null
          service_instance_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          contract_id?: string | null
          created_at?: string
          health_status?: string
          id?: string
          kind?: string
          name: string
          owner_staff_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          playbook_id?: string | null
          reference?: string | null
          service_instance_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          contract_id?: string | null
          created_at?: string
          health_status?: string
          id?: string
          kind?: string
          name?: string
          owner_staff_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          playbook_id?: string | null
          reference?: string | null
          service_instance_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_mentions: {
        Row: {
          cited_url: string | null
          entity_name: string
          id: string
          is_client: boolean
          position: number | null
          run_id: string
          sentiment: string | null
          tenant_id: string
        }
        Insert: {
          cited_url?: string | null
          entity_name: string
          id?: string
          is_client?: boolean
          position?: number | null
          run_id: string
          sentiment?: string | null
          tenant_id: string
        }
        Update: {
          cited_url?: string | null
          entity_name?: string
          id?: string
          is_client?: boolean
          position?: number | null
          run_id?: string
          sentiment?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_mentions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "geo_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_mentions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_prompts: {
        Row: {
          created_at: string
          id: string
          intent: string | null
          is_active: boolean
          location_id: string | null
          prompt: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean
          location_id?: string | null
          prompt: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean
          location_id?: string | null
          prompt?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_prompts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_runs: {
        Row: {
          engine: string
          error: string | null
          id: string
          location_id: string | null
          position: number | null
          prompt_id: string
          response_text: string | null
          run_at: string
          share_of_voice: number | null
          status: string
          tenant_id: string
          was_mentioned: boolean
        }
        Insert: {
          engine: string
          error?: string | null
          id?: string
          location_id?: string | null
          position?: number | null
          prompt_id: string
          response_text?: string | null
          run_at?: string
          share_of_voice?: number | null
          status?: string
          tenant_id: string
          was_mentioned?: boolean
        }
        Update: {
          engine?: string
          error?: string | null
          id?: string
          location_id?: string | null
          position?: number | null
          prompt_id?: string
          response_text?: string | null
          run_at?: string
          share_of_voice?: number | null
          status?: string
          tenant_id?: string
          was_mentioned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "geo_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "geo_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          operation: string
          profile_id: string | null
          request_hash: string | null
          response: Json | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          operation: string
          profile_id?: string | null
          request_hash?: string | null
          response?: Json | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          operation?: string
          profile_id?: string | null
          request_hash?: string | null
          response?: Json | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotency_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          display_name: string | null
          expires_at: string | null
          external_account_id: string | null
          id: string
          last_checked_at: string | null
          last_error: string | null
          last_refreshed_at: string | null
          location_id: string | null
          provider: string
          scopes: string[]
          status: string
          tenant_id: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          location_id?: string | null
          provider: string
          scopes?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_refreshed_at?: string | null
          location_id?: string | null
          provider?: string
          scopes?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          cgst_amount: number
          description: string
          discount_amount: number
          gst_rate: number
          hsn_sac_code: string | null
          id: string
          igst_amount: number
          invoice_id: string
          line_total: number
          period_end: string | null
          period_start: string | null
          quantity: number
          service_id: string | null
          sgst_amount: number
          sort_order: number
          subscription_id: string | null
          taxable_amount: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          cgst_amount?: number
          description: string
          discount_amount?: number
          gst_rate?: number
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          line_total?: number
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          service_id?: string | null
          sgst_amount?: number
          sort_order?: number
          subscription_id?: string | null
          taxable_amount?: number
          tenant_id: string
          unit_price?: number
        }
        Update: {
          cgst_amount?: number
          description?: string
          discount_amount?: number
          gst_rate?: number
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          line_total?: number
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          service_id?: string | null
          sgst_amount?: number
          sort_order?: number
          subscription_id?: string | null
          taxable_amount?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_received: number
          cgst_amount: number
          contract_id: string | null
          created_at: string
          currency_code: string
          customer_gstin: string | null
          discount_amount: number
          document_id: string | null
          due_date: string | null
          id: string
          igst_amount: number
          invoice_number: string
          is_interstate: boolean
          issue_date: string
          issued_at: string | null
          issuer_tenant_id: string
          notes: string | null
          place_of_supply: string
          round_off: number
          sgst_amount: number
          status: string
          supplier_gstin: string | null
          supplier_state_code: string
          taxable_amount: number
          tds_amount: number
          tenant_id: string
          total_amount: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          amount_received?: number
          cgst_amount?: number
          contract_id?: string | null
          created_at?: string
          currency_code?: string
          customer_gstin?: string | null
          discount_amount?: number
          document_id?: string | null
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_number: string
          is_interstate?: boolean
          issue_date?: string
          issued_at?: string | null
          issuer_tenant_id: string
          notes?: string | null
          place_of_supply: string
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_state_code: string
          taxable_amount?: number
          tds_amount?: number
          tenant_id: string
          total_amount?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          amount_received?: number
          cgst_amount?: number
          contract_id?: string | null
          created_at?: string
          currency_code?: string
          customer_gstin?: string | null
          discount_amount?: number
          document_id?: string | null
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_number?: string
          is_interstate?: boolean
          issue_date?: string
          issued_at?: string | null
          issuer_tenant_id?: string
          notes?: string | null
          place_of_supply?: string
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_state_code?: string
          taxable_amount?: number
          tds_amount?: number
          tenant_id?: string
          total_amount?: number
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issuer_tenant_id_fkey"
            columns: ["issuer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          contact_id: string
          converted_at: string | null
          created_at: string
          first_touch_at: string
          id: string
          location_id: string | null
          lost_reason: string | null
          owner_staff_id: string | null
          source: string
          source_detail: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          converted_at?: string | null
          created_at?: string
          first_touch_at?: string
          id?: string
          location_id?: string | null
          lost_reason?: string | null
          owner_staff_id?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          converted_at?: string | null
          created_at?: string
          first_touch_at?: string
          id?: string
          location_id?: string | null
          lost_reason?: string | null
          owner_staff_id?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          joined_at: string | null
          profile_id: string
          role: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          profile_id: string
          role?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          profile_id?: string
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          failure_reason: string | null
          id: string
          media: Json
          sender_staff_id: string | null
          sender_type: string
          sent_at: string
          status: string
          template_name: string | null
          tenant_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          media?: Json
          sender_staff_id?: string | null
          sender_type?: string
          sent_at?: string
          status?: string
          template_name?: string | null
          tenant_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          media?: Json
          sender_staff_id?: string | null
          sender_type?: string
          sent_at?: string
          status?: string
          template_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_staff_id_fkey"
            columns: ["sender_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_client_visible: boolean
          name: string
          service_code: string | null
          unit: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_client_visible?: boolean
          name: string
          service_code?: string | null
          unit?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_client_visible?: boolean
          name?: string
          service_code?: string | null
          unit?: string
          version?: number
        }
        Relationships: []
      }
      metric_snapshots: {
        Row: {
          computed_at: string
          definition_version: number
          granularity: string
          id: number
          location_id: string | null
          metric_code: string
          period_end: string
          period_start: string
          service_code: string | null
          tenant_id: string
          value: number
        }
        Insert: {
          computed_at?: string
          definition_version?: number
          granularity?: string
          id?: never
          location_id?: string | null
          metric_code: string
          period_end: string
          period_start: string
          service_code?: string | null
          tenant_id: string
          value: number
        }
        Update: {
          computed_at?: string
          definition_version?: number
          granularity?: string
          id?: never
          location_id?: string | null
          metric_code?: string
          period_end?: string
          period_start?: string
          service_code?: string | null
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nap_audit_results: {
        Row: {
          audit_id: string
          checked_at: string
          directory_code: string
          directory_id: string
          error_message: string | null
          found: boolean
          id: string
          is_claimed: boolean | null
          listing_url: string | null
          match_confidence: number | null
          overall_confidence: number | null
          rating: number | null
          raw: Json | null
          review_count: number | null
          runner_up_margin: number | null
          status: string
          tenant_id: string
        }
        Insert: {
          audit_id: string
          checked_at?: string
          directory_code: string
          directory_id: string
          error_message?: string | null
          found?: boolean
          id?: string
          is_claimed?: boolean | null
          listing_url?: string | null
          match_confidence?: number | null
          overall_confidence?: number | null
          rating?: number | null
          raw?: Json | null
          review_count?: number | null
          runner_up_margin?: number | null
          status: string
          tenant_id: string
        }
        Update: {
          audit_id?: string
          checked_at?: string
          directory_code?: string
          directory_id?: string
          error_message?: string | null
          found?: boolean
          id?: string
          is_claimed?: boolean | null
          listing_url?: string | null
          match_confidence?: number | null
          overall_confidence?: number | null
          rating?: number | null
          raw?: Json | null
          review_count?: number | null
          runner_up_margin?: number | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nap_audit_results_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "nap_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audit_results_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "directories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audit_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nap_audits: {
        Row: {
          ambiguous_count: number
          audit_score: number | null
          completed_at: string | null
          consistent_count: number
          coverage_pct: number | null
          created_at: string
          directories_checked: number
          directories_errored: number
          directories_requested: number
          drift_count: number
          error_message: string | null
          id: string
          inconsistent_count: number
          location_id: string
          not_found_count: number
          queued_at: string
          requested_by: string | null
          service_instance_id: string | null
          source_of_truth_id: string
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ambiguous_count?: number
          audit_score?: number | null
          completed_at?: string | null
          consistent_count?: number
          coverage_pct?: number | null
          created_at?: string
          directories_checked?: number
          directories_errored?: number
          directories_requested?: number
          drift_count?: number
          error_message?: string | null
          id?: string
          inconsistent_count?: number
          location_id: string
          not_found_count?: number
          queued_at?: string
          requested_by?: string | null
          service_instance_id?: string | null
          source_of_truth_id: string
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ambiguous_count?: number
          audit_score?: number | null
          completed_at?: string | null
          consistent_count?: number
          coverage_pct?: number | null
          created_at?: string
          directories_checked?: number
          directories_errored?: number
          directories_requested?: number
          drift_count?: number
          error_message?: string | null
          id?: string
          inconsistent_count?: number
          location_id?: string
          not_found_count?: number
          queued_at?: string
          requested_by?: string | null
          service_instance_id?: string | null
          source_of_truth_id?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nap_audits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audits_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audits_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audits_source_of_truth_id_fkey"
            columns: ["source_of_truth_id"]
            isOneToOne: false
            referencedRelation: "nap_source_of_truth"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nap_field_diffs: {
        Row: {
          field_name: string
          found_value: string | null
          id: string
          match_status: string
          notes: string | null
          result_id: string
          similarity_score: number | null
          source_value: string | null
          tenant_id: string
        }
        Insert: {
          field_name: string
          found_value?: string | null
          id?: string
          match_status: string
          notes?: string | null
          result_id: string
          similarity_score?: number | null
          source_value?: string | null
          tenant_id: string
        }
        Update: {
          field_name?: string
          found_value?: string | null
          id?: string
          match_status?: string
          notes?: string | null
          result_id?: string
          similarity_score?: number | null
          source_value?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nap_field_diffs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "nap_audit_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_field_diffs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nap_source_of_truth: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_name: string | null
          category: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          locality: string | null
          location_id: string
          phone_e164: string | null
          phone_raw: string | null
          pincode: string | null
          secondary_phone_raw: string | null
          state: string | null
          tenant_id: string
          valid_from: string
          valid_to: string | null
          version: number
          website: string | null
          working_hours: Json | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          locality?: string | null
          location_id: string
          phone_e164?: string | null
          phone_raw?: string | null
          pincode?: string | null
          secondary_phone_raw?: string | null
          state?: string | null
          tenant_id: string
          valid_from?: string
          valid_to?: string | null
          version?: number
          website?: string | null
          working_hours?: Json | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          locality?: string | null
          location_id?: string
          phone_e164?: string | null
          phone_raw?: string | null
          pincode?: string | null
          secondary_phone_raw?: string | null
          state?: string | null
          tenant_id?: string
          valid_from?: string
          valid_to?: string | null
          version?: number
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "nap_source_of_truth_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_source_of_truth_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_source_of_truth_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          code: string
          email: boolean
          in_app: boolean
          profile_id: string
          whatsapp: boolean
        }
        Insert: {
          code: string
          email?: boolean
          in_app?: boolean
          profile_id: string
          whatsapp?: boolean
        }
        Update: {
          code?: string
          email?: boolean
          in_app?: boolean
          profile_id?: string
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          code: string
          created_at: string
          id: string
          link_url: string | null
          profile_id: string
          read_at: string | null
          severity: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          code: string
          created_at?: string
          id?: string
          link_url?: string | null
          profile_id: string
          read_at?: string | null
          severity?: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          code?: string
          created_at?: string
          id?: string
          link_url?: string | null
          profile_id?: string
          read_at?: string | null
          severity?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          attempts: number
          available_at: string
          channel: string
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          recipient: string
          sent_at: string | null
          status: string
          template: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          channel: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          recipient: string
          sent_at?: string | null
          status?: string
          template?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          channel?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          received_on: string
          recorded_by: string | null
          reference: string | null
          tds_amount: number
          tds_certificate_ref: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          received_on?: string
          recorded_by?: string | null
          reference?: string | null
          tds_amount?: number
          tds_certificate_ref?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          received_on?: string
          recorded_by?: string | null
          reference?: string | null
          tds_amount?: number
          tds_certificate_ref?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          code: string
          description: string | null
          id: string
        }
        Insert: {
          category?: string | null
          code: string
          description?: string | null
          id?: string
        }
        Update: {
          category?: string | null
          code?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          probability: number
          sort_order: number
          tenant_id: string
        }
        Insert: {
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          probability?: number
          sort_order?: number
          tenant_id: string
        }
        Update: {
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          probability?: number
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_steps: {
        Row: {
          default_owner_role: string | null
          description: string | null
          id: string
          is_client_action: boolean
          name: string
          phase: string
          playbook_id: string
          sla_days: number | null
          sort_order: number
        }
        Insert: {
          default_owner_role?: string | null
          description?: string | null
          id?: string
          is_client_action?: boolean
          name: string
          phase?: string
          playbook_id: string
          sla_days?: number | null
          sort_order?: number
        }
        Update: {
          default_owner_role?: string | null
          description?: string | null
          id?: string
          is_client_action?: boolean
          name?: string
          phase?: string
          playbook_id?: string
          sla_days?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_steps_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          service_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          service_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          service_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          phone_e164: string | null
          status: string
          updated_at: string
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          last_seen_at?: string | null
          phone_e164?: string | null
          status?: string
          updated_at?: string
          user_type?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          phone_e164?: string | null
          status?: string
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      raw_events: {
        Row: {
          contact_id: string | null
          event_type: string
          external_id: string | null
          id: number
          location_id: string | null
          occurred_at: string
          payload: Json
          provider: string | null
          service_code: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          event_type: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          event_type?: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      raw_events_2026_09: {
        Row: {
          contact_id: string | null
          event_type: string
          external_id: string | null
          id: number
          location_id: string | null
          occurred_at: string
          payload: Json
          provider: string | null
          service_code: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          event_type: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          event_type?: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      raw_events_2026_10: {
        Row: {
          contact_id: string | null
          event_type: string
          external_id: string | null
          id: number
          location_id: string | null
          occurred_at: string
          payload: Json
          provider: string | null
          service_code: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          event_type: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          event_type?: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      raw_events_2026_11: {
        Row: {
          contact_id: string | null
          event_type: string
          external_id: string | null
          id: number
          location_id: string | null
          occurred_at: string
          payload: Json
          provider: string | null
          service_code: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          event_type: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          event_type?: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      raw_events_2026_12: {
        Row: {
          contact_id: string | null
          event_type: string
          external_id: string | null
          id: number
          location_id: string | null
          occurred_at: string
          payload: Json
          provider: string | null
          service_code: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          event_type: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          event_type?: string
          external_id?: string | null
          id?: never
          location_id?: string | null
          occurred_at?: string
          payload?: Json
          provider?: string | null
          service_code?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      reference_sequences: {
        Row: {
          created_at: string
          fy: string
          id: string
          kind: string
          next_value: number
          owner_tenant_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fy: string
          id?: string
          kind: string
          next_value?: number
          owner_tenant_id: string
          prefix?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fy?: string
          id?: string
          kind?: string
          next_value?: number
          owner_tenant_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_sequences_owner_tenant_id_fkey"
            columns: ["owner_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          cadence: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          service_code: string | null
          spec: Json
          tenant_id: string | null
        }
        Insert: {
          cadence?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          service_code?: string | null
          spec?: Json
          tenant_id?: string | null
        }
        Update: {
          cadence?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          service_code?: string | null
          spec?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          definition_id: string | null
          document_id: string | null
          error: string | null
          id: string
          period_end: string
          period_start: string
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          definition_id?: string | null
          document_id?: string | null
          error?: string | null
          id?: string
          period_end: string
          period_start: string
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          definition_id?: string | null
          document_id?: string | null
          error?: string | null
          id?: string
          period_end?: string
          period_start?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          channel: string
          clicked_at: string | null
          contact_id: string
          created_at: string
          failure_reason: string | null
          id: string
          location_id: string | null
          public_token: string | null
          review_id: string | null
          send_after: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          clicked_at?: string | null
          contact_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          public_token?: string | null
          review_id?: string | null
          send_after?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          contact_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          location_id?: string | null
          public_token?: string | null
          review_id?: string | null
          send_after?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string
          id: string
          is_ai_drafted: boolean
          published_at: string | null
          review_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string
          id?: string
          is_ai_drafted?: boolean
          published_at?: string | null
          review_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string
          id?: string
          is_ai_drafted?: boolean
          published_at?: string | null
          review_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_sources: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          location_id: string
          platform: string
          profile_url: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          location_id: string
          platform: string
          profile_url?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          location_id?: string
          platform?: string
          profile_url?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_sources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string | null
          body: string | null
          contact_id: string | null
          created_at: string
          external_id: string
          fetched_at: string
          id: string
          location_id: string
          needs_response: boolean
          posted_at: string | null
          rating: number | null
          sentiment: string | null
          source_id: string
          tenant_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          external_id: string
          fetched_at?: string
          id?: string
          location_id: string
          needs_response?: boolean
          posted_at?: string | null
          rating?: number | null
          sentiment?: string | null
          source_id: string
          tenant_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string
          fetched_at?: string
          id?: string
          location_id?: string
          needs_response?: boolean
          posted_at?: string | null
          rating?: number | null
          sentiment?: string | null
          source_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "review_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          scope: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          scope?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          scope?: string
        }
        Relationships: []
      }
      routing_rules: {
        Row: {
          action: Json
          created_at: string
          id: string
          is_active: boolean
          location_id: string | null
          match_on: Json
          name: string
          priority: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          match_on?: Json
          name: string
          priority?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          match_on?: Json
          name?: string
          priority?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          code: string
          created_at: string
          cron: string | null
          id: string
          is_active: boolean
          kind: string
          last_run_at: string | null
          next_run_at: string | null
          payload: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          cron?: string | null
          id?: string
          is_active?: boolean
          kind: string
          last_run_at?: string | null
          next_run_at?: string | null
          payload?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          cron?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          last_run_at?: string | null
          next_run_at?: string | null
          payload?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          billing_cycle: string
          category: string
          code: string
          created_at: string
          default_gst_rate: number
          default_hsn_sac: string | null
          default_price: number | null
          description: string | null
          id: string
          is_bundle: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          category: string
          code: string
          created_at?: string
          default_gst_rate?: number
          default_hsn_sac?: string | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_bundle?: boolean
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          category?: string
          code?: string
          created_at?: string
          default_gst_rate?: number
          default_hsn_sac?: string | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_bundle?: boolean
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_components: {
        Row: {
          child_service_id: string
          parent_service_id: string
          sort_order: number
        }
        Insert: {
          child_service_id: string
          parent_service_id: string
          sort_order?: number
        }
        Update: {
          child_service_id?: string
          parent_service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_components_child_service_id_fkey"
            columns: ["child_service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_components_parent_service_id_fkey"
            columns: ["parent_service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      service_deliverables: {
        Row: {
          cadence: string
          description: string | null
          id: string
          name: string
          service_id: string
          sort_order: number
        }
        Insert: {
          cadence?: string
          description?: string | null
          id?: string
          name: string
          service_id: string
          sort_order?: number
        }
        Update: {
          cadence?: string
          description?: string | null
          id?: string
          name?: string
          service_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_deliverables_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      service_instances: {
        Row: {
          activated_at: string | null
          billing_status: string
          config: Json
          contract_line_id: string | null
          created_at: string
          health_status: string
          id: string
          location_id: string | null
          service_code: string
          service_id: string
          status: string
          tenant_id: string
          terminated_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          billing_status?: string
          config?: Json
          contract_line_id?: string | null
          created_at?: string
          health_status?: string
          id?: string
          location_id?: string | null
          service_code: string
          service_id: string
          status?: string
          tenant_id: string
          terminated_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          billing_status?: string
          config?: Json
          contract_line_id?: string | null
          created_at?: string
          health_status?: string
          id?: string
          location_id?: string | null
          service_code?: string
          service_id?: string
          status?: string
          tenant_id?: string
          terminated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_instances_contract_line_id_fkey"
            columns: ["contract_line_id"]
            isOneToOne: false
            referencedRelation: "contract_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_instances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_instances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          code: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          code: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sla_definitions: {
        Row: {
          calendar_id: string | null
          code: string
          created_at: string
          id: string
          name: string
          priority: string
          resolve_within_minutes: number | null
          respond_within_minutes: number | null
          service_id: string | null
        }
        Insert: {
          calendar_id?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          priority?: string
          resolve_within_minutes?: number | null
          respond_within_minutes?: number | null
          service_id?: string | null
        }
        Update: {
          calendar_id?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          priority?: string
          resolve_within_minutes?: number | null
          respond_within_minutes?: number | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_definitions_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "business_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_definitions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_allocations: {
        Row: {
          allocation_pct: number
          created_at: string
          ends_on: string | null
          engagement_id: string
          id: string
          staff_id: string
          starts_on: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allocation_pct?: number
          created_at?: string
          ends_on?: string | null
          engagement_id: string
          id?: string
          staff_id: string
          starts_on: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allocation_pct?: number
          created_at?: string
          ends_on?: string | null
          engagement_id?: string
          id?: string
          staff_id?: string
          starts_on?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_allocations_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_allocations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          capacity_hours_per_week: number
          created_at: string
          department: string | null
          employee_code: string | null
          hourly_cost: number | null
          id: string
          job_title: string | null
          joined_at: string | null
          manager_id: string | null
          offboarded_at: string | null
          profile_id: string
          status: string
          tenant_scope: string
          updated_at: string
        }
        Insert: {
          capacity_hours_per_week?: number
          created_at?: string
          department?: string | null
          employee_code?: string | null
          hourly_cost?: number | null
          id?: string
          job_title?: string | null
          joined_at?: string | null
          manager_id?: string | null
          offboarded_at?: string | null
          profile_id: string
          status?: string
          tenant_scope?: string
          updated_at?: string
        }
        Update: {
          capacity_hours_per_week?: number
          created_at?: string
          department?: string | null
          employee_code?: string | null
          hourly_cost?: number | null
          id?: string
          job_title?: string | null
          joined_at?: string | null
          manager_id?: string | null
          offboarded_at?: string | null
          profile_id?: string
          status?: string
          tenant_scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_skills: {
        Row: {
          proficiency: number
          skill_id: string
          staff_id: string
        }
        Insert: {
          proficiency?: number
          skill_id: string
          staff_id: string
        }
        Update: {
          proficiency?: number
          skill_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_skills_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancellation_reason: string | null
          cancelled_at: string | null
          contract_line_id: string
          created_at: string
          id: string
          mrr: number
          next_invoice_on: string | null
          renews_on: string | null
          started_on: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_line_id: string
          created_at?: string
          id?: string
          mrr?: number
          next_invoice_on?: string | null
          renews_on?: string | null
          started_on?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_line_id?: string
          created_at?: string
          id?: string
          mrr?: number
          next_invoice_on?: string | null
          renews_on?: string | null
          started_on?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_contract_line_id_fkey"
            columns: ["contract_line_id"]
            isOneToOne: false
            referencedRelation: "contract_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_entitlements: {
        Row: {
          service_code: string
          source: string
          source_id: string | null
          state: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          service_code: string
          source: string
          source_id?: string | null
          state?: string
          tenant_id: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          service_code?: string
          source?: string
          source_id?: string | null
          state?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          gbp_place_id: string | null
          id: string
          is_primary: boolean
          latitude: number | null
          locality: string | null
          longitude: number | null
          name: string
          phone_e164: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          gbp_place_id?: string | null
          id?: string
          is_primary?: boolean
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          name: string
          phone_e164?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          gbp_place_id?: string | null
          id?: string
          is_primary?: boolean
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          name?: string
          phone_e164?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_email: string | null
          churned_at: string | null
          created_at: string
          gstin: string | null
          health_status: string
          id: string
          is_internal: boolean
          legal_name: string | null
          name: string
          onboarded_at: string | null
          pan: string | null
          place_of_supply: string | null
          slug: string
          status: string
          updated_at: string
          vertical: string
        }
        Insert: {
          billing_email?: string | null
          churned_at?: string | null
          created_at?: string
          gstin?: string | null
          health_status?: string
          id?: string
          is_internal?: boolean
          legal_name?: string | null
          name: string
          onboarded_at?: string | null
          pan?: string | null
          place_of_supply?: string | null
          slug: string
          status?: string
          updated_at?: string
          vertical?: string
        }
        Update: {
          billing_email?: string | null
          churned_at?: string | null
          created_at?: string
          gstin?: string | null
          health_status?: string
          id?: string
          is_internal?: boolean
          legal_name?: string | null
          name?: string
          onboarded_at?: string | null
          pan?: string | null
          place_of_supply?: string | null
          slug?: string
          status?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assignee_staff_id: string | null
          body: string | null
          closed_at: string | null
          created_at: string
          first_response_at: string | null
          id: string
          location_id: string | null
          opened_by: string | null
          priority: string
          reference: string | null
          resolved_at: string | null
          service_instance_id: string | null
          sla_definition_id: string | null
          status: string
          subject: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          assignee_staff_id?: string | null
          body?: string | null
          closed_at?: string | null
          created_at?: string
          first_response_at?: string | null
          id?: string
          location_id?: string | null
          opened_by?: string | null
          priority?: string
          reference?: string | null
          resolved_at?: string | null
          service_instance_id?: string | null
          sla_definition_id?: string | null
          status?: string
          subject: string
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          assignee_staff_id?: string | null
          body?: string | null
          closed_at?: string | null
          created_at?: string
          first_response_at?: string | null
          id?: string
          location_id?: string | null
          opened_by?: string | null
          priority?: string
          reference?: string | null
          resolved_at?: string | null
          service_instance_id?: string | null
          sla_definition_id?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_definition_id_fkey"
            columns: ["sla_definition_id"]
            isOneToOne: false
            referencedRelation: "sla_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          engagement_id: string | null
          entry_date: string
          hours: number
          id: string
          is_billable: boolean
          notes: string | null
          staff_id: string
          task_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          entry_date: string
          hours: number
          id?: string
          is_billable?: boolean
          notes?: string | null
          staff_id: string
          task_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          notes?: string | null
          staff_id?: string
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "engagement_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_numbers: {
        Row: {
          created_at: string
          forwards_to_e164: string | null
          id: string
          label: string | null
          location_id: string | null
          phone_e164: string
          provider: string
          provider_number_id: string | null
          provisioned_on: string | null
          released_on: string | null
          service_instance_id: string | null
          source: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          forwards_to_e164?: string | null
          id?: string
          label?: string | null
          location_id?: string | null
          phone_e164: string
          provider?: string
          provider_number_id?: string | null
          provisioned_on?: string | null
          released_on?: string | null
          service_instance_id?: string | null
          source?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          forwards_to_e164?: string | null
          id?: string
          label?: string | null
          location_id?: string | null
          phone_e164?: string
          provider?: string
          provider_number_id?: string | null
          provisioned_on?: string | null
          released_on?: string | null
          service_instance_id?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_numbers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_numbers_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          profile_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          profile_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          error: string | null
          event_type: string | null
          external_id: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature_ok: boolean | null
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          error?: string | null
          event_type?: string | null
          external_id: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_ok?: boolean | null
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          error?: string | null
          event_type?: string | null
          external_id?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_ok?: boolean | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_checks: {
        Row: {
          checked_at: string
          error: string | null
          http_status: number | null
          id: number
          is_up: boolean
          response_ms: number | null
          ssl_valid: boolean | null
          tenant_id: string
          website_id: string
        }
        Insert: {
          checked_at?: string
          error?: string | null
          http_status?: number | null
          id?: never
          is_up: boolean
          response_ms?: number | null
          ssl_valid?: boolean | null
          tenant_id: string
          website_id: string
        }
        Update: {
          checked_at?: string
          error?: string | null
          http_status?: number | null
          id?: never
          is_up?: boolean
          response_ms?: number | null
          ssl_valid?: boolean | null
          tenant_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_checks_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          created_at: string
          domain: string
          domain_expires_on: string | null
          id: string
          is_domain_client_owned: boolean
          live_url: string | null
          location_id: string | null
          platform: string | null
          registrar: string | null
          repo_url: string | null
          service_instance_id: string | null
          ssl_expires_on: string | null
          status: string
          tenant_id: string
          updated_at: string
          went_live_on: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          domain_expires_on?: string | null
          id?: string
          is_domain_client_owned?: boolean
          live_url?: string | null
          location_id?: string | null
          platform?: string | null
          registrar?: string | null
          repo_url?: string | null
          service_instance_id?: string | null
          ssl_expires_on?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          went_live_on?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          domain_expires_on?: string | null
          id?: string
          is_domain_client_owned?: boolean
          live_url?: string | null
          location_id?: string | null
          platform?: string | null
          registrar?: string | null
          repo_url?: string | null
          service_instance_id?: string | null
          ssl_expires_on?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          went_live_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "websites_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "tenant_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_service_instance_id_fkey"
            columns: ["service_instance_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_client_action_item: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      create_contact: {
        Args: {
          p_consent_evidence?: Json
          p_consent_source?: string
          p_email?: string
          p_full_name: string
          p_location_id?: string
          p_phone?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_review_source: {
        Args: {
          p_external_id?: string
          p_location_id: string
          p_platform?: string
          p_profile_url?: string
        }
        Returns: string
      }
      enqueue_nap_audit: { Args: { p_location_id: string }; Returns: string }
      import_contacts: {
        Args: {
          p_dry_run?: boolean
          p_location_id?: string
          p_rows: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      issue_review_request: {
        Args: { p_channel?: string; p_contact_id: string; p_source_id: string }
        Returns: Json
      }
      log_tenant_access: {
        Args: { p_reason?: string; p_tenant_id: string }
        Returns: boolean
      }
      nap_queue_archive: { Args: { p_msg_id: number }; Returns: boolean }
      nap_queue_delete: { Args: { p_msg_id: number }; Returns: boolean }
      nap_queue_read: {
        Args: { p_qty?: number; p_vt?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_review_click: { Args: { p_token: string }; Returns: string }
      set_contact_consent: {
        Args: {
          p_channel: string
          p_contact_id: string
          p_evidence?: Json
          p_opted_in: boolean
          p_source?: string
        }
        Returns: boolean
      }
      set_nap_source_of_truth: {
        Args: {
          p_address_line1?: string
          p_address_line2?: string
          p_business_name: string
          p_category?: string
          p_city?: string
          p_locality?: string
          p_location_id: string
          p_phone_raw?: string
          p_pincode?: string
          p_state?: string
          p_website?: string
        }
        Returns: string
      }
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
    Enums: {},
  },
} as const
