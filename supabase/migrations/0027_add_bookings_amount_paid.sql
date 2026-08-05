-- LEANR — 0027: Track what a client actually paid for a booking (currently
-- only meaningful for demo/assessment sessions, which charge a fee even
-- though the DB's session_type enum has no separate "demo" value). Without
-- this, a paid demo session had zero trace of the payment anywhere in the
-- data model and was indistinguishable from a genuinely free one.
alter table bookings add column amount_paid numeric(10,2);
comment on column bookings.amount_paid is 'Amount actually charged for this session (e.g. the demo/assessment fee), in rupees. Null means no payment was collected.';
