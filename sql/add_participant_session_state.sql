-- Persist participant quiz progress for name + email sessions.
ALTER TABLE participants
  ADD COLUMN session_state JSON NULL AFTER device_fingerprint;
