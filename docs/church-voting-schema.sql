-- Church voting schema (PostgreSQL)
-- Goals: anonymous ballots + one-time QR token login + auditable admin actions

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  position_type VARCHAR(20) NOT NULL CHECK (position_type IN ('elder', 'deacon')),
  seats INTEGER NOT NULL CHECK (seats > 0),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_at < end_at)
);

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, name)
);

CREATE TABLE voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_no VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token table stores only hash to reduce leakage risk.
CREATE TABLE voting_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES voters(id) ON DELETE RESTRICT,
  token_hash CHAR(64) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (election_id, voter_id),
  UNIQUE (token_hash)
);

-- Ballot does not include voter_id/token_id to enforce anonymity.
CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ballot_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  UNIQUE (ballot_id, candidate_id)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_election_id ON candidates(election_id);
CREATE INDEX idx_tokens_election_id ON voting_tokens(election_id);
CREATE INDEX idx_tokens_voter_id ON voting_tokens(voter_id);
CREATE INDEX idx_tokens_status ON voting_tokens(election_id, used_at, revoked_at, expires_at);
CREATE INDEX idx_ballots_election_id ON ballots(election_id);
CREATE INDEX idx_ballot_choices_ballot_id ON ballot_choices(ballot_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Prevent selecting candidate from another election.
CREATE OR REPLACE FUNCTION check_ballot_choice_election() RETURNS TRIGGER AS $$
DECLARE
  ballot_election UUID;
  candidate_election UUID;
BEGIN
  SELECT election_id INTO ballot_election FROM ballots WHERE id = NEW.ballot_id;
  SELECT election_id INTO candidate_election FROM candidates WHERE id = NEW.candidate_id;

  IF ballot_election IS NULL OR candidate_election IS NULL OR ballot_election <> candidate_election THEN
    RAISE EXCEPTION 'ballot and candidate election mismatch';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_ballot_choice_election
  BEFORE INSERT ON ballot_choices
  FOR EACH ROW EXECUTE FUNCTION check_ballot_choice_election();

-- Helpful tally view.
CREATE VIEW election_candidate_tally AS
SELECT
  c.election_id,
  c.id AS candidate_id,
  c.name AS candidate_name,
  COUNT(bc.id)::INT AS votes
FROM candidates c
LEFT JOIN ballot_choices bc ON bc.candidate_id = c.id
GROUP BY c.election_id, c.id, c.name;
