CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_digest text NOT NULL,
  role text NOT NULL CHECK (role IN ('cliente', 'organizador', 'portero'))
);
