// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate later with: supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row<T> = T;
type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  weight_kg: number | null;
  gender: "male" | "female" | "other" | null;
  side_preference: "left" | "right" | "either" | null;
  can_steer: boolean;
  can_drum: boolean;
  address: string | null;
  lat: number | null;
  lon: number | null;
  can_drive: boolean;
  car_seats: number | null;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
  created_at: string;
};

export type Membership = {
  org_id: string;
  user_id: string;
  role: "admin" | "member";
  created_at: string;
};

export type Announcement = {
  id: string;
  org_id: string;
  author_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

export type Practice = {
  id: string;
  org_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lon: number | null;
  notes: string | null;
  rsvp_deadline: string | null;
  created_by: string | null;
  created_at: string;
};

export type Rsvp = {
  practice_id: string;
  user_id: string;
  status: "yes" | "no" | "maybe";
  ride: "none" | "driver" | "needs_ride";
  seats: number | null;
  note: string | null;
  updated_at: string;
};

export type LineupRow = {
  id: string;
  org_id: string;
  practice_id: string | null;
  name: string;
  boat_type: "open" | "womens" | "mixed";
  data: Json;
  published: boolean;
  created_by: string | null;
  updated_at: string;
};

export type CarpoolRow = {
  id: string;
  org_id: string;
  practice_id: string;
  data: Json;
  published: boolean;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Row<Profile>;
        Insert: Insert<Profile, "phone" | "weight_kg" | "gender" | "side_preference" | "can_steer" | "can_drum" | "address" | "lat" | "lon" | "can_drive" | "car_seats" | "created_at" | "updated_at" | "full_name">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      organizations: {
        Row: Row<Organization>;
        Insert: Insert<Organization, "id" | "created_by" | "created_at">;
        Update: Partial<Organization>;
        Relationships: [];
      };
      memberships: {
        Row: Row<Membership>;
        Insert: Insert<Membership, "role" | "created_at">;
        Update: Partial<Membership>;
        Relationships: [
          { foreignKeyName: "memberships_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "memberships_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      announcements: {
        Row: Row<Announcement>;
        Insert: Insert<Announcement, "id" | "author_id" | "body" | "pinned" | "created_at">;
        Update: Partial<Announcement>;
        Relationships: [
          { foreignKeyName: "announcements_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "announcements_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      practices: {
        Row: Row<Practice>;
        Insert: Insert<Practice, "id" | "ends_at" | "location_name" | "location_lat" | "location_lon" | "notes" | "rsvp_deadline" | "created_by" | "created_at">;
        Update: Partial<Practice>;
        Relationships: [
          { foreignKeyName: "practices_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "practices_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      rsvps: {
        Row: Row<Rsvp>;
        Insert: Insert<Rsvp, "ride" | "seats" | "note" | "updated_at">;
        Update: Partial<Rsvp>;
        Relationships: [
          { foreignKeyName: "rsvps_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
          { foreignKeyName: "rsvps_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      lineups: {
        Row: Row<LineupRow>;
        Insert: Insert<LineupRow, "id" | "practice_id" | "boat_type" | "data" | "published" | "created_by" | "updated_at">;
        Update: Partial<LineupRow>;
        Relationships: [
          { foreignKeyName: "lineups_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "lineups_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
        ];
      };
      carpools: {
        Row: Row<CarpoolRow>;
        Insert: Insert<CarpoolRow, "id" | "data" | "published" | "updated_at">;
        Update: Partial<CarpoolRow>;
        Relationships: [
          { foreignKeyName: "carpools_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "carpools_practice_id_fkey"; columns: ["practice_id"]; isOneToOne: false; referencedRelation: "practices"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: string };
      join_organization: { Args: { code: string }; Returns: string };
      is_org_member: { Args: { org: string }; Returns: boolean };
      is_org_admin: { Args: { org: string }; Returns: boolean };
      shares_org_with: { Args: { other: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
