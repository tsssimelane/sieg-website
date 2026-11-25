-- One-time owner-requested removal of all logged SIEG Address cards.
-- Retain daily code sequences, browser allowances, paid credits and other services.
DELETE FROM siege_records WHERE kind = 'entrance_address';
