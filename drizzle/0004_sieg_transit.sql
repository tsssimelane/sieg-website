CREATE TABLE transit_profiles(owner TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('driver','commuter')),plate TEXT UNIQUE);
--> statement-breakpoint
CREATE TABLE transit_routes(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,name TEXT NOT NULL,stops_json TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE transit_positions(owner TEXT PRIMARY KEY NOT NULL,route_id TEXT NOT NULL,lat REAL NOT NULL,lon REAL NOT NULL,accuracy REAL NOT NULL,speed REAL,next_stop INTEGER NOT NULL,updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX transit_positions_route ON transit_positions(route_id,updated_at);
--> statement-breakpoint
CREATE TABLE transit_waiting(owner TEXT PRIMARY KEY NOT NULL,route_id TEXT NOT NULL,stop_id TEXT NOT NULL,destination TEXT NOT NULL,expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX transit_waiting_route ON transit_waiting(route_id,expires_at);
