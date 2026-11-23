ALTER TABLE users
  ADD CONSTRAINT users_email_normalized CHECK (email = lower(email)),
  ADD CONSTRAINT users_password_digest_format CHECK (password_digest ~ '^[0-9a-f]{32}$');
