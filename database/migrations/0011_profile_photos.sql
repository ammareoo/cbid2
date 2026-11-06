CREATE TABLE user_profile_photos (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  image bytea NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 2097152),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_photos FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profile_photos TO cbid_app;
CREATE POLICY profile_photo_owner ON user_profile_photos FOR ALL TO cbid_app
  USING (user_id = app.uid()) WITH CHECK (user_id = app.uid());
