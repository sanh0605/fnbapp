import type { AuthActor } from "@/lib/auth/auth";

export interface AuditCreateColumns {
  created_by_id: string;
  created_by_name: string;
  updated_by_id: string;
  updated_by_name: string;
}

export interface AuditUpdateColumns {
  updated_by_id: string;
  updated_by_name: string;
}

// Timestamps are the database's job: created_at defaults to now(), and
// touch_updated_at() moves updated_at on every UPDATE. The *person* is this
// layer's job -- the server connects with one shared service key, so Postgres
// has no idea who is acting. Only the app, after checking the session, knows.
export function creationAudit(actor: AuthActor): AuditCreateColumns {
  return {
    created_by_id: actor.id,
    created_by_name: actor.name,
    updated_by_id: actor.id,
    updated_by_name: actor.name,
  };
}

export function updateAudit(actor: AuthActor): AuditUpdateColumns {
  return { updated_by_id: actor.id, updated_by_name: actor.name };
}
