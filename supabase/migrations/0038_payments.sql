-- LEANR — 0038: Razorpay payments
--
-- One row per Razorpay order, covering both money-collecting client flows
-- (package purchase, demo/assessment session fee) that previously went
-- through StubPaymentModal's fake "always succeeds" checkout. This table is
-- the financial ledger -- subscriptions/bookings don't duplicate amount
-- fields, they just get a payment_id pointing back here once fulfilled.
--
-- status:
--   created          -- order created with Razorpay, payment not completed yet
--   paid             -- signature verified AND the subscription/booking was created successfully
--   failed           -- signature verification failed (or was never attempted -- e.g. abandoned checkout)
--   paid_unfulfilled -- signature verified (money captured) but creating the
--                       subscription/booking then failed (e.g. a slot got taken
--                       in the gap between order creation and payment, or the
--                       client already had an active plan by the time payment
--                       cleared) -- flagged for manual admin/support resolution,
--                       never silently dropped.
create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_profiles(id) on delete cascade,
  purpose text not null check (purpose in ('package_purchase', 'demo_session')),
  package_id uuid references package_tiers(id),
  demo_coach_id uuid references coach_profiles(id),
  demo_slot_start timestamptz,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'INR',
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  razorpay_signature text,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'paid_unfulfilled')),
  subscription_id uuid references subscriptions(id),
  booking_id uuid references bookings(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_client_idx on payments(client_id);
create index payments_status_idx on payments(status);

-- Financial records: no client insert/update policy at all -- every write
-- goes through payments.service.ts using supabaseAdmin, after the order's
-- Razorpay signature has been verified server-side. Clients can only ever
-- read their own rows (e.g. a future "payment history" screen); admins can
-- read everything for reconciliation/support.
alter table payments enable row level security;
create policy payments_admin_all on payments for all using (is_admin()) with check (is_admin());
create policy payments_select_own on payments for select using (client_id = my_client_id());
