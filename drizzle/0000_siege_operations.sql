CREATE TABLE siege_records (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL,
 owner TEXT NOT NULL,
 state TEXT NOT NULL,
 created_at TEXT NOT NULL,
 body_json TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX siege_records_public_idx ON siege_records (kind, state, id);
--> statement-breakpoint
CREATE INDEX siege_records_owner_idx ON siege_records (kind, owner, id);
