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
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          detail?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          detail?: string | null
          created_at?: string | null
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
        }
        Insert: {
          bom_id: string
          line_id?: string | null
          kg_per_meter?: number | null
          scrap_pct?: number | null
          scrap_product_id?: string | null
        }
        Update: {
          bom_id?: string
          line_id?: string | null
          kg_per_meter?: number | null
          scrap_pct?: number | null
          scrap_product_id?: string | null
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
      cost_parameters: {
        Row: {
          id: string
          labor_per_unit: number
          energy_per_unit: number
          overhead_pct: number
          usd_rate: number | null
          eur_rate: number | null
        }
        Insert: {
          id?: string
          labor_per_unit?: number
          energy_per_unit?: number
          overhead_pct?: number
          usd_rate?: number | null
          eur_rate?: number | null
        }
        Update: {
          id?: string
          labor_per_unit?: number
          energy_per_unit?: number
          overhead_pct?: number
          usd_rate?: number | null
          eur_rate?: number | null
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "ncr_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_quarantine_warehouse_id_fkey"
            columns: ["quarantine_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_downtime_reason_code_id_fkey"
            columns: ["downtime_reason_code_id"]
            isOneToOne: false
            referencedRelation: "reason_codes"
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
      production_lines: {
        Row: {
          id: string
          code: string
          name: string
          head_type: string | null
          status: Database["public"]["Enums"]["equipment_status"]
        }
        Insert: {
          id?: string
          code: string
          name: string
          head_type?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
        }
        Update: {
          id?: string
          code?: string
          name?: string
          head_type?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
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
        ]
      }
    }
    Views: {
      v_stock: {
        Row: {
          product_id: string | null
          warehouse_id: string | null
          qty: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      cancel_stock_document: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      close_work_order: {
        Args: {
          p_work_order_id: string
        }
        Returns: undefined
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
        }
        Returns: Json
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
    }
    Enums: {
      equipment_status: "active" | "maintenance" | "down"
      movement_direction: "in" | "out"
      movement_source_type: "production" | "sale" | "purchase" | "count" | "transfer" | "scrap"
      ncr_status: "open" | "closed"
      order_status: "open" | "in_production" | "done" | "cancelled"
      partner_type: "customer" | "supplier"
      product_type: "finished" | "raw" | "semi" | "regrind" | "scrap"
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
