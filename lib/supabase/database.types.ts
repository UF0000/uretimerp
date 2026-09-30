// Bu dosya scripts/gen-db-types.mjs tarafından üretilir — elle düzenlemeyin.
// Yenilemek için: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          detail: string | null
          created_at: string | null
          table_name: string | null
          record_id: string | null
          record_label: string | null
          operation: string | null
          changes: Json | null
          txid: number | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          detail?: string | null
          created_at?: string | null
          table_name?: string | null
          record_id?: string | null
          record_label?: string | null
          operation?: string | null
          changes?: Json | null
          txid?: number | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          detail?: string | null
          created_at?: string | null
          table_name?: string | null
          record_id?: string | null
          record_label?: string | null
          operation?: string | null
          changes?: Json | null
          txid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_extrusion: {
        Row: {
          bom_id: string
          line_id: string | null
          kg_per_meter: number | null
          scrap_pct: number | null
          scrap_product_id: string | null
          target_m_per_hour: number | null
        }
        Insert: {
          bom_id: string
          line_id?: string | null
          kg_per_meter?: number | null
          scrap_pct?: number | null
          scrap_product_id?: string | null
          target_m_per_hour?: number | null
        }
        Update: {
          bom_id?: string
          line_id?: string | null
          kg_per_meter?: number | null
          scrap_pct?: number | null
          scrap_product_id?: string | null
          target_m_per_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_extrusion_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: true
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_extrusion_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_extrusion_scrap_product_id_fkey"
            columns: ["scrap_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_injection: {
        Row: {
          bom_id: string
          mold_id: string | null
          cavity_count: number | null
          cycle_time_sec: number | null
          parts_per_cycle: number | null
          runner_sprue_weight_g: number | null
          product_weight_g: number | null
          scrap_product_id: string | null
        }
        Insert: {
          bom_id: string
          mold_id?: string | null
          cavity_count?: number | null
          cycle_time_sec?: number | null
          parts_per_cycle?: number | null
          runner_sprue_weight_g?: number | null
          product_weight_g?: number | null
          scrap_product_id?: string | null
        }
        Update: {
          bom_id?: string
          mold_id?: string | null
          cavity_count?: number | null
          cycle_time_sec?: number | null
          parts_per_cycle?: number | null
          runner_sprue_weight_g?: number | null
          product_weight_g?: number | null
          scrap_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_injection_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: true
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_injection_mold_id_fkey"
            columns: ["mold_id"]
            isOneToOne: false
            referencedRelation: "molds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_injection_scrap_product_id_fkey"
            columns: ["scrap_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          id: string
          bom_id: string
          component_product_id: string
          quantity: number
          unit: Database["public"]["Enums"]["unit_type"]
          ratio_pct: number | null
        }
        Insert: {
          id?: string
          bom_id: string
          component_product_id: string
          quantity: number
          unit: Database["public"]["Enums"]["unit_type"]
          ratio_pct?: number | null
        }
        Update: {
          id?: string
          bom_id?: string
          component_product_id?: string
          quantity?: number
          unit?: Database["public"]["Enums"]["unit_type"]
          ratio_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_parameters: {
        Row: {
          id: string
          bom_id: string
          key: string
          value: string
        }
        Insert: {
          id?: string
          bom_id: string
          key: string
          value: string
        }
        Update: {
          id?: string
          bom_id?: string
          key?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_parameters_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
        ]
      }
      boms: {
        Row: {
          id: string
          product_id: string
          version: number
          active: boolean
          production_type: Database["public"]["Enums"]["production_type"]
          regrind_pct: number | null
          notes: string | null
          created_at: string | null
          code: string
          name: string
        }
        Insert: {
          id?: string
          product_id: string
          version?: number
          active?: boolean
          production_type: Database["public"]["Enums"]["production_type"]
          regrind_pct?: number | null
          notes?: string | null
          created_at?: string | null
          code: string
          name: string
        }
        Update: {
          id?: string
          product_id?: string
          version?: number
          active?: boolean
          production_type?: Database["public"]["Enums"]["production_type"]
          regrind_pct?: number | null
          notes?: string | null
          created_at?: string | null
          code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_holidays: {
        Row: {
          day: string
          name: string
          off_hours: number
          created_at: string | null
        }
        Insert: {
          day: string
          name: string
          off_hours?: number
          created_at?: string | null
        }
        Update: {
          day?: string
          name?: string
          off_hours?: number
          created_at?: string | null
        }
        Relationships: []
      }
      cost_parameters: {
        Row: {
          id: string
          labor_per_unit: number
          energy_per_unit: number
          overhead_pct: number
          usd_rate: number | null
          eur_rate: number | null
          shift_minutes: number
          target_scrap_pct: number
          overweight_tolerance_pct: number
          target_oee_pct: number
          weekly_off_days: number[]
          day_shift_start: string
          night_shift_start: string
        }
        Insert: {
          id?: string
          labor_per_unit?: number
          energy_per_unit?: number
          overhead_pct?: number
          usd_rate?: number | null
          eur_rate?: number | null
          shift_minutes?: number
          target_scrap_pct?: number
          overweight_tolerance_pct?: number
          target_oee_pct?: number
          weekly_off_days?: number[]
          day_shift_start?: string
          night_shift_start?: string
        }
        Update: {
          id?: string
          labor_per_unit?: number
          energy_per_unit?: number
          overhead_pct?: number
          usd_rate?: number | null
          eur_rate?: number | null
          shift_minutes?: number
          target_scrap_pct?: number
          overweight_tolerance_pct?: number
          target_oee_pct?: number
          weekly_off_days?: number[]
          day_shift_start?: string
          night_shift_start?: string
        }
        Relationships: []
      }
      line_capacities: {
        Row: {
          id: string
          line_id: string
          capacity_kg_per_hour: number
          valid_from: string
          valid_to: string | null
          note: string | null
          active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          line_id: string
          capacity_kg_per_hour: number
          valid_from: string
          valid_to?: string | null
          note?: string | null
          active?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          line_id?: string
          capacity_kg_per_hour?: number
          valid_from?: string
          valid_to?: string | null
          note?: string | null
          active?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_capacities_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          id: string
          lot_no: string
          product_id: string
          production_date: string
          work_order_id: string | null
          parent_lot_ids: string[] | null
        }
        Insert: {
          id?: string
          lot_no: string
          product_id: string
          production_date: string
          work_order_id?: string | null
          parent_lot_ids?: string[] | null
        }
        Update: {
          id?: string
          lot_no?: string
          product_id?: string
          production_date?: string
          work_order_id?: string | null
          parent_lot_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mold_maintenances: {
        Row: {
          id: string
          mold_id: string
          done_on: string
          kind: string
          shots_at: number
          description: string | null
          performed_by: string | null
          downtime_hours: number | null
          cost: number | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mold_id: string
          done_on?: string
          kind?: string
          shots_at?: number
          description?: string | null
          performed_by?: string | null
          downtime_hours?: number | null
          cost?: number | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mold_id?: string
          done_on?: string
          kind?: string
          shots_at?: number
          description?: string | null
          performed_by?: string | null
          downtime_hours?: number | null
          cost?: number | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mold_maintenances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mold_maintenances_mold_id_fkey"
            columns: ["mold_id"]
            isOneToOne: false
            referencedRelation: "molds"
            referencedColumns: ["id"]
          },
        ]
      }
      molds: {
        Row: {
          id: string
          code: string
          name: string
          product_id: string | null
          cavity_count: number
          cycle_time_sec: number
          total_shots: number
          maintenance_plan: string | null
          last_maintenance: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          product_weight_g: number | null
          sprue_weight_g: number | null
          operation_mode: string | null
          maintenance_interval_shots: number | null
          shots_at_last_maintenance: number
        }
        Insert: {
          id?: string
          code: string
          name: string
          product_id?: string | null
          cavity_count: number
          cycle_time_sec: number
          total_shots?: number
          maintenance_plan?: string | null
          last_maintenance?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          product_weight_g?: number | null
          sprue_weight_g?: number | null
          operation_mode?: string | null
          maintenance_interval_shots?: number | null
          shots_at_last_maintenance?: number
        }
        Update: {
          id?: string
          code?: string
          name?: string
          product_id?: string | null
          cavity_count?: number
          cycle_time_sec?: number
          total_shots?: number
          maintenance_plan?: string | null
          last_maintenance?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          product_weight_g?: number | null
          sprue_weight_g?: number | null
          operation_mode?: string | null
          maintenance_interval_shots?: number | null
          shots_at_last_maintenance?: number
        }
        Relationships: [
          {
            foreignKeyName: "molds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ncr: {
        Row: {
          id: string
          no: string
          product_id: string
          lot_no: string | null
          description: string
          quantity: number
          quarantine_warehouse_id: string | null
          root_cause: string | null
          corrective_action: string | null
          status: Database["public"]["Enums"]["ncr_status"]
          created_at: string | null
          source_warehouse_id: string | null
          quality_check_id: string | null
          disposition: string | null
          created_by: string | null
          closed_at: string | null
          closed_by: string | null
        }
        Insert: {
          id?: string
          no: string
          product_id: string
          lot_no?: string | null
          description: string
          quantity: number
          quarantine_warehouse_id?: string | null
          root_cause?: string | null
          corrective_action?: string | null
          status?: Database["public"]["Enums"]["ncr_status"]
          created_at?: string | null
          source_warehouse_id?: string | null
          quality_check_id?: string | null
          disposition?: string | null
          created_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
        }
        Update: {
          id?: string
          no?: string
          product_id?: string
          lot_no?: string | null
          description?: string
          quantity?: number
          quarantine_warehouse_id?: string | null
          root_cause?: string | null
          corrective_action?: string | null
          status?: Database["public"]["Enums"]["ncr_status"]
          created_at?: string | null
          source_warehouse_id?: string | null
          quality_check_id?: string | null
          disposition?: string | null
          created_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ncr_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_quality_check_id_fkey"
            columns: ["quality_check_id"]
            isOneToOne: false
            referencedRelation: "quality_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_quarantine_warehouse_id_fkey"
            columns: ["quarantine_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          id: string
          name: string
          active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          active?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          active?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          delivered_qty: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          delivered_qty?: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          delivered_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          id: string
          no: string
          partner_id: string
          order_date: string
          delivery_date: string | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          id?: string
          no: string
          partner_id: string
          order_date: string
          delivery_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          id?: string
          no?: string
          partner_id?: string
          order_date?: string
          delivery_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["partner_type"]
          phone: string | null
          address: string | null
          active: boolean
        }
        Insert: {
          id?: string
          name: string
          type: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          address?: string | null
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          address?: string | null
          active?: boolean
        }
        Relationships: []
      }
      product_documents: {
        Row: {
          id: string
          product_id: string
          category: string
          title: string
          file_path: string
          file_name: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          category?: string
          title: string
          file_path: string
          file_name: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          category?: string
          title?: string
          file_path?: string
          file_name?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          code: string
          name: string
          created_at: string | null
        }
        Insert: {
          code: string
          name: string
          created_at?: string | null
        }
        Update: {
          code?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      product_suppliers: {
        Row: {
          id: string
          product_id: string
          partner_id: string
          is_primary: boolean
          supplier_code: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          partner_id: string
          is_primary?: boolean
          supplier_code?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          partner_id?: string
          is_primary?: boolean
          supplier_code?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entries: {
        Row: {
          id: string
          work_order_id: string
          shift: Database["public"]["Enums"]["shift_type"]
          produced_qty: number
          scrap_qty: number
          scrap_reason_code_id: string | null
          downtime_min: number
          downtime_reason_code_id: string | null
          actual_cycle_time_sec: number | null
          operator: string | null
          entry_time: string | null
          total_used_kg: number
          lot_no: string | null
          user_id: string | null
          start_at: string | null
          end_at: string | null
          operator_id: string | null
          mold_id: string | null
          mold_shots: number
          cancelled_at: string | null
          cancelled_by: string | null
          cancel_note: string | null
          replaced_by_entry_id: string | null
        }
        Insert: {
          id?: string
          work_order_id: string
          shift: Database["public"]["Enums"]["shift_type"]
          produced_qty: number
          scrap_qty?: number
          scrap_reason_code_id?: string | null
          downtime_min?: number
          downtime_reason_code_id?: string | null
          actual_cycle_time_sec?: number | null
          operator?: string | null
          entry_time?: string | null
          total_used_kg?: number
          lot_no?: string | null
          user_id?: string | null
          start_at?: string | null
          end_at?: string | null
          operator_id?: string | null
          mold_id?: string | null
          mold_shots?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_note?: string | null
          replaced_by_entry_id?: string | null
        }
        Update: {
          id?: string
          work_order_id?: string
          shift?: Database["public"]["Enums"]["shift_type"]
          produced_qty?: number
          scrap_qty?: number
          scrap_reason_code_id?: string | null
          downtime_min?: number
          downtime_reason_code_id?: string | null
          actual_cycle_time_sec?: number | null
          operator?: string | null
          entry_time?: string | null
          total_used_kg?: number
          lot_no?: string | null
          user_id?: string | null
          start_at?: string | null
          end_at?: string | null
          operator_id?: string | null
          mold_id?: string | null
          mold_shots?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_note?: string | null
          replaced_by_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_downtime_reason_code_id_fkey"
            columns: ["downtime_reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_mold_id_fkey"
            columns: ["mold_id"]
            isOneToOne: false
            referencedRelation: "molds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_replaced_by_entry_id_fkey"
            columns: ["replaced_by_entry_id"]
            isOneToOne: false
            referencedRelation: "production_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_scrap_reason_code_id_fkey"
            columns: ["scrap_reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entry_downtimes: {
        Row: {
          id: string
          entry_id: string
          reason_code_id: string
          minutes: number
        }
        Insert: {
          id?: string
          entry_id: string
          reason_code_id: string
          minutes: number
        }
        Update: {
          id?: string
          entry_id?: string
          reason_code_id?: string
          minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_entry_downtimes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "production_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entry_downtimes_reason_code_id_fkey"
            columns: ["reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entry_scraps: {
        Row: {
          id: string
          entry_id: string
          reason_code_id: string
          kg: number
        }
        Insert: {
          id?: string
          entry_id: string
          reason_code_id: string
          kg: number
        }
        Update: {
          id?: string
          entry_id?: string
          reason_code_id?: string
          kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_entry_scraps_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "production_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entry_scraps_reason_code_id_fkey"
            columns: ["reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          id: string
          code: string
          name: string
          head_type: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          line_type: Database["public"]["Enums"]["production_type"] | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          head_type?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          line_type?: Database["public"]["Enums"]["production_type"] | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          head_type?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          line_type?: Database["public"]["Enums"]["production_type"] | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          code: string
          name: string
          type: Database["public"]["Enums"]["product_type"]
          unit: Database["public"]["Enums"]["unit_type"]
          category: string | null
          material_grade: string | null
          min_stock: number
          critical_stock: number
          image_url: string | null
          active: boolean
          unit_cost: number | null
          currency: string | null
          material_group: string | null
          diameter_mm: number | null
          sdr: number | null
          group_code: string | null
          variant_code: string | null
          wall_thickness_mm: number | null
          description: string | null
          package_type: string | null
          package_qty: number | null
          pallet_qty: number | null
          pipe_length_m: number | null
          package_weight_kg: number | null
          barcode: string | null
          package_note: string | null
          bag_type: string | null
          bag_qty: number | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          type: Database["public"]["Enums"]["product_type"]
          unit: Database["public"]["Enums"]["unit_type"]
          category?: string | null
          material_grade?: string | null
          min_stock?: number
          critical_stock?: number
          image_url?: string | null
          active?: boolean
          unit_cost?: number | null
          currency?: string | null
          material_group?: string | null
          diameter_mm?: number | null
          sdr?: number | null
          group_code?: string | null
          variant_code?: string | null
          wall_thickness_mm?: number | null
          description?: string | null
          package_type?: string | null
          package_qty?: number | null
          pallet_qty?: number | null
          pipe_length_m?: number | null
          package_weight_kg?: number | null
          barcode?: string | null
          package_note?: string | null
          bag_type?: string | null
          bag_qty?: number | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: Database["public"]["Enums"]["unit_type"]
          category?: string | null
          material_grade?: string | null
          min_stock?: number
          critical_stock?: number
          image_url?: string | null
          active?: boolean
          unit_cost?: number | null
          currency?: string | null
          material_group?: string | null
          diameter_mm?: number | null
          sdr?: number | null
          group_code?: string | null
          variant_code?: string | null
          wall_thickness_mm?: number | null
          description?: string | null
          package_type?: string | null
          package_qty?: number | null
          pallet_qty?: number | null
          pipe_length_m?: number | null
          package_weight_kg?: number | null
          barcode?: string | null
          package_note?: string | null
          bag_type?: string | null
          bag_qty?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role: Database["public"]["Enums"]["user_role"]
          active: boolean
        }
        Insert: {
          id: string
          name: string
          email: string
          role?: Database["public"]["Enums"]["user_role"]
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: Database["public"]["Enums"]["user_role"]
          active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          quantity: number
          unit_price: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          product_id: string
          quantity: number
          unit_price?: number | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          no: string
          partner_id: string
          status: string
          order_date: string
          expected_date: string | null
          currency: string
          note: string | null
          created_by: string | null
          created_at: string
          ordered_at: string | null
          closed_at: string | null
        }
        Insert: {
          id?: string
          no: string
          partner_id: string
          status?: string
          order_date?: string
          expected_date?: string | null
          currency?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
          ordered_at?: string | null
          closed_at?: string | null
        }
        Update: {
          id?: string
          no?: string
          partner_id?: string
          status?: string
          order_date?: string
          expected_date?: string | null
          currency?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
          ordered_at?: string | null
          closed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["qc_type"]
          product_id: string
          lot_no: string | null
          work_order_id: string | null
          standard: string | null
          measurements: Json | null
          result: Database["public"]["Enums"]["qc_result"]
          checked_by: string | null
          checked_at: string | null
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["qc_type"]
          product_id: string
          lot_no?: string | null
          work_order_id?: string | null
          standard?: string | null
          measurements?: Json | null
          result: Database["public"]["Enums"]["qc_result"]
          checked_by?: string | null
          checked_at?: string | null
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["qc_type"]
          product_id?: string
          lot_no?: string | null
          work_order_id?: string | null
          standard?: string | null
          measurements?: Json | null
          result?: Database["public"]["Enums"]["qc_result"]
          checked_by?: string | null
          checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reason_codes: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["reason_kind"]
          code: string
          label: string
          active: boolean
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["reason_kind"]
          code: string
          label: string
          active?: boolean
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["reason_kind"]
          code?: string
          label?: string
          active?: boolean
        }
        Relationships: []
      }
      reference_capacities: {
        Row: {
          id: string
          material_group: string
          diameter_mm: number
          sdr: number | null
          capacity_kg_per_hour: number
          year: number
          source: string | null
          approval: string
          active: boolean
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          material_group: string
          diameter_mm: number
          sdr?: number | null
          capacity_kg_per_hour: number
          year: number
          source?: string | null
          approval?: string
          active?: boolean
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          material_group?: string
          diameter_mm?: number
          sdr?: number | null
          capacity_kg_per_hour?: number
          year?: number
          source?: string | null
          approval?: string
          active?: boolean
          note?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      stock_documents: {
        Row: {
          id: string
          no: string
          type: Database["public"]["Enums"]["stock_document_type"]
          document_date: string
          source_warehouse_id: string | null
          target_warehouse_id: string | null
          note: string | null
          user_id: string | null
          created_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
        }
        Insert: {
          id?: string
          no: string
          type: Database["public"]["Enums"]["stock_document_type"]
          document_date: string
          source_warehouse_id?: string | null
          target_warehouse_id?: string | null
          note?: string | null
          user_id?: string | null
          created_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
        }
        Update: {
          id?: string
          no?: string
          type?: Database["public"]["Enums"]["stock_document_type"]
          document_date?: string
          source_warehouse_id?: string | null
          target_warehouse_id?: string | null
          note?: string | null
          user_id?: string | null
          created_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_documents_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_target_warehouse_id_fkey"
            columns: ["target_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string
          direction: Database["public"]["Enums"]["movement_direction"]
          quantity: number
          lot_no: string | null
          source_type: Database["public"]["Enums"]["movement_source_type"]
          source_id: string | null
          user_id: string | null
          created_at: string | null
          note: string | null
          document_id: string | null
          reverses_id: string | null
          production_entry_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id: string
          direction: Database["public"]["Enums"]["movement_direction"]
          quantity: number
          lot_no?: string | null
          source_type: Database["public"]["Enums"]["movement_source_type"]
          source_id?: string | null
          user_id?: string | null
          created_at?: string | null
          note?: string | null
          document_id?: string | null
          reverses_id?: string | null
          production_entry_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          warehouse_id?: string
          direction?: Database["public"]["Enums"]["movement_direction"]
          quantity?: number
          lot_no?: string | null
          source_type?: Database["public"]["Enums"]["movement_source_type"]
          source_id?: string | null
          user_id?: string | null
          created_at?: string | null
          note?: string | null
          document_id?: string | null
          reverses_id?: string | null
          production_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_production_entry_id_fkey"
            columns: ["production_entry_id"]
            isOneToOne: false
            referencedRelation: "production_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_prices: {
        Row: {
          id: string
          product_supplier_id: string
          price: number
          currency: string
          valid_from: string
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          product_supplier_id: string
          price: number
          currency?: string
          valid_from?: string
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          product_supplier_id?: string
          price?: number
          currency?: string
          valid_from?: string
          note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_prices_product_supplier_id_fkey"
            columns: ["product_supplier_id"]
            isOneToOne: false
            referencedRelation: "product_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["warehouse_type"]
        }
        Insert: {
          id?: string
          name: string
          type: Database["public"]["Enums"]["warehouse_type"]
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          id: string
          no: string
          product_id: string
          bom_id: string
          planned_qty: number
          line_id: string | null
          mold_id: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          started_at: string | null
          finished_at: string | null
          order_id: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopen_note: string | null
          reopen_count: number
        }
        Insert: {
          id?: string
          no: string
          product_id: string
          bom_id: string
          planned_qty: number
          line_id?: string | null
          mold_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          started_at?: string | null
          finished_at?: string | null
          order_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopen_note?: string | null
          reopen_count?: number
        }
        Update: {
          id?: string
          no?: string
          product_id?: string
          bom_id?: string
          planned_qty?: number
          line_id?: string | null
          mold_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          started_at?: string | null
          finished_at?: string | null
          order_id?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopen_note?: string | null
          reopen_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_mold_id_fkey"
            columns: ["mold_id"]
            isOneToOne: false
            referencedRelation: "molds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_mold_maintenance: {
        Row: {
          mold_id: string | null
          code: string | null
          name: string | null
          status: Database["public"]["Enums"]["equipment_status"] | null
          total_shots: number | null
          interval_shots: number | null
          last_maintenance: string | null
          shots_since: number | null
          used_pct: number | null
          state: string | null
        }
        Relationships: []
      }
      v_oee_entries: {
        Row: {
          entry_id: string | null
          work_order_id: string | null
          work_order_no: string | null
          product_id: string | null
          entry_time: string | null
          day: string | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          production_type: Database["public"]["Enums"]["production_type"] | null
          line_id: string | null
          mold_id: string | null
          planned_sec: number | null
          run_sec: number | null
          downtime_min: number | null
          downtime_reason_code_id: string | null
          scrap_kg: number | null
          scrap_reason_code_id: string | null
          produced_qty: number | null
          total_kg: number | null
          good_kg: number | null
          ideal_sec: number | null
        }
        Relationships: []
      }
      v_production_analytics: {
        Row: {
          entry_id: string | null
          entry_time: string | null
          day: string | null
          shift: Database["public"]["Enums"]["shift_type"] | null
          lot_no: string | null
          work_order_id: string | null
          work_order_no: string | null
          product_id: string | null
          product_code: string | null
          product_name: string | null
          product_unit: Database["public"]["Enums"]["unit_type"] | null
          bom_id: string | null
          bom_code: string | null
          production_type: Database["public"]["Enums"]["production_type"] | null
          line_id: string | null
          mold_id: string | null
          operator: string | null
          produced_qty: number | null
          used_kg: number | null
          scrap_kg: number | null
          good_kg: number | null
          scrap_reason_code_id: string | null
          downtime_min: number | null
          downtime_reason_code_id: string | null
          actual_cycle_time_sec: number | null
          nominal_kg: number | null
          planned_min: number | null
          run_min: number | null
          capacity_kg_per_hour: number | null
          material_group: string | null
          diameter_mm: number | null
          sdr: number | null
          reference_kg_per_hour: number | null
          runner_kg: number | null
        }
        Relationships: []
      }
      v_purchase_order_items: {
        Row: {
          id: string | null
          purchase_order_id: string | null
          product_id: string | null
          quantity: number | null
          unit_price: number | null
          note: string | null
          received_qty: number | null
          remaining_qty: number | null
        }
        Relationships: []
      }
      v_stock: {
        Row: {
          product_id: string | null
          warehouse_id: string | null
          qty: number | null
        }
        Relationships: []
      }
      v_stock_lot: {
        Row: {
          product_id: string | null
          warehouse_id: string | null
          lot_no: string | null
          qty: number | null
          first_in_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      available_hours: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: string[]
      }
      cancel_production_entry: {
        Args: {
          p_entry_id: string
          p_note?: string
        }
        Returns: undefined
      }
      cancel_stock_document: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      close_ncr: {
        Args: {
          p_id: string
          p_root_cause: string
          p_corrective_action: string
          p_disposition?: string
          p_release_warehouse_id?: string
        }
        Returns: undefined
      }
      close_work_order: {
        Args: {
          p_work_order_id: string
        }
        Returns: undefined
      }
      create_ncr: {
        Args: {
          p_product_id: string
          p_description: string
          p_quantity: number
          p_lot_no?: string
          p_quality_check_id?: string
          p_source_warehouse_id?: string
          p_quarantine_warehouse_id?: string
        }
        Returns: Json
      }
      delete_bom: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      pp_variant_base: {
        Args: {
          p_code: string
        }
        Returns: string
      }
      receive_purchase_order: {
        Args: {
          p_po_id: string
          p_warehouse_id: string
          p_date: string
          p_lines: Json
          p_note?: string
        }
        Returns: string
      }
      record_production_entry: {
        Args: {
          p_work_order_id: string
          p_shift: Database["public"]["Enums"]["shift_type"]
          p_produced_qty: number
          p_total_used_kg: number
          p_scrap_kg?: number
          p_scrap_product_id?: string
          p_scrap_reason_code_id?: string
          p_downtime_min?: number
          p_downtime_reason_code_id?: string
          p_actual_cycle_time_sec?: number
          p_target_warehouse_id?: string
          p_operator?: string
          p_close_work_order?: boolean
          p_raw_lots?: Json
        }
        Returns: Json
      }
      reopen_work_order: {
        Args: {
          p_work_order_id: string
          p_note?: string
        }
        Returns: undefined
      }
      reverse_stock_movements: {
        Args: {
          p_ids: string[]
          p_note?: string
        }
        Returns: number
      }
      save_bom: {
        Args: {
          p_bom: Json
        }
        Returns: Json
      }
      save_production_entry: {
        Args: {
          p: Json
        }
        Returns: Json
      }
    }
    Enums: {
      equipment_status: "active" | "maintenance" | "down"
      movement_direction: "in" | "out"
      movement_source_type: "production" | "sale" | "purchase" | "count" | "transfer" | "scrap"
      ncr_status: "open" | "closed"
      order_status: "open" | "in_production" | "done" | "cancelled"
      partner_type: "customer" | "supplier"
      product_type: "finished" | "raw" | "semi" | "regrind" | "scrap" | "trade" | "service"
      production_type: "extrusion" | "injection"
      qc_result: "accept" | "reject" | "conditional"
      qc_type: "incoming" | "process" | "final"
      reason_kind: "scrap" | "downtime"
      shift_type: "day" | "night"
      stock_document_type: "in_purchase" | "in_production" | "in_count" | "transfer" | "out_sale" | "out_consumption" | "out_scrap" | "out_count"
      unit_type: "adet" | "kg" | "metre"
      user_role: "operator" | "warehouse" | "quality" | "admin"
      warehouse_type: "raw" | "finished" | "quarantine" | "scrap" | "regrind"
      work_order_status: "planned" | "in_progress" | "done"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
