-- Enforce §3 (immutability) and §2.2 (position lock) at the database layer,
-- not just in the service layer.

-- Frozen bet fields cannot change once locked_at is set (bet reached ACTIVE),
-- except through the amendment-approval path, which sets a session-local
-- escape hatch: SET LOCAL app.allow_amendment = 'on' inside the same
-- transaction that writes the new bet_versions row.
CREATE FUNCTION enforce_bet_immutability() RETURNS trigger AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL
     AND current_setting('app.allow_amendment', true) IS DISTINCT FROM 'on'
  THEN
    IF NEW.statement IS DISTINCT FROM OLD.statement
       OR NEW.terms IS DISTINCT FROM OLD.terms
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.resolution_date IS DISTINCT FROM OLD.resolution_date
       OR NEW.long_stop_date IS DISTINCT FROM OLD.long_stop_date
       OR NEW.resolution_criteria IS DISTINCT FROM OLD.resolution_criteria
       OR NEW.stake_note IS DISTINCT FROM OLD.stake_note
    THEN
      RAISE EXCEPTION 'bet % is locked (active since %); terms are frozen and can only change via an approved amendment', OLD.id, OLD.locked_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER bets_enforce_immutability
  BEFORE UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_bet_immutability();
--> statement-breakpoint

-- Positions are append-only: a side, once taken, is never edited or removed.
-- Withdrawing means voiding the whole bet while it is still DRAFT/PROPOSED,
-- not deleting a participant's row.
CREATE FUNCTION prevent_position_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'positions are immutable; cannot % row (bet_id=%, user_id=%)', TG_OP, OLD.bet_id, OLD.user_id;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER positions_no_update
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_position_mutation();
--> statement-breakpoint
CREATE TRIGGER positions_no_delete
  BEFORE DELETE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_position_mutation();
--> statement-breakpoint

-- A position can only be taken while the bet is still open to joiners.
CREATE FUNCTION enforce_position_insert_window() RETURNS trigger AS $$
DECLARE
  bet_current_status bet_status;
BEGIN
  SELECT status INTO bet_current_status FROM bets WHERE id = NEW.bet_id;
  IF bet_current_status NOT IN ('DRAFT', 'PROPOSED') THEN
    RAISE EXCEPTION 'cannot take a position on bet % in status %', NEW.bet_id, bet_current_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER positions_insert_window
  BEFORE INSERT ON positions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_position_insert_window();
