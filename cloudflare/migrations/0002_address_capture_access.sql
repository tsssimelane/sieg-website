CREATE TABLE address_devices (
 id TEXT PRIMARY KEY NOT NULL,
 owner TEXT NOT NULL,
 token_hash TEXT UNIQUE NOT NULL,
 created_at TEXT NOT NULL,
 free_used INTEGER NOT NULL DEFAULT 0 CHECK(free_used BETWEEN 0 AND 3),
 purchased INTEGER NOT NULL DEFAULT 0 CHECK(purchased >= 0),
 paid_used INTEGER NOT NULL DEFAULT 0 CHECK(paid_used BETWEEN 0 AND purchased)
);
--> statement-breakpoint
CREATE INDEX address_devices_owner_idx ON address_devices(owner);
--> statement-breakpoint
CREATE TABLE address_phone_verifications (
 owner TEXT PRIMARY KEY NOT NULL,
 phone TEXT NOT NULL,
 verified_until INTEGER NOT NULL DEFAULT 0,
 sent_at INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 day TEXT NOT NULL,
 sends INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE address_credit_grants (
 order_id TEXT NOT NULL,
 device_id TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 credited INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(order_id, device_id)
);
