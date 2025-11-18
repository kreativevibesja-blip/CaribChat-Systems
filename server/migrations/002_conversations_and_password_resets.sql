-- Conversations to support multi-agent inbox
CREATE TABLE IF NOT EXISTS public.conversations (
  id BIGSERIAL PRIMARY KEY,
  peer TEXT UNIQUE NOT NULL,
  assigned_user_id BIGINT,
  assigned_at TIMESTAMPTZ
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS public.password_resets (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_conversations_peer ON public.conversations(peer);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets(email);
