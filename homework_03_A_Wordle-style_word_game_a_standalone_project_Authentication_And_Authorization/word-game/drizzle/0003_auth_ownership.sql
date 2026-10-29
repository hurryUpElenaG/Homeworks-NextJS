CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "role" text NOT NULL DEFAULT 'player',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
DELETE FROM scores;
DELETE FROM games;
ALTER TABLE games
ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE scores
ADD COLUMN IF NOT EXISTS owner_id text;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_owner_id_user_id_fk;
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_owner_id_user_id_fk;
ALTER TABLE games
ADD CONSTRAINT games_owner_id_user_id_fk FOREIGN KEY (owner_id) REFERENCES "user"("id") ON DELETE CASCADE;
ALTER TABLE scores
ADD CONSTRAINT scores_owner_id_user_id_fk FOREIGN KEY (owner_id) REFERENCES "user"("id") ON DELETE CASCADE;
ALTER TABLE games
ALTER COLUMN owner_id
SET NOT NULL;
ALTER TABLE scores
ALTER COLUMN owner_id
SET NOT NULL;