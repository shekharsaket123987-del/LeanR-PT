-- LEANR — 0043: backfill conversations for clients who already qualified
-- (paid + coach assigned) before the chat feature (0042) existed --
-- ensureConversationForCoachAssignment() only fires on NEW assignment
-- events going forward, so without this, every pre-existing client/coach
-- pair would see an empty "My Chats" despite already meeting the bar.
-- Idempotent (ON CONFLICT + NOT EXISTS guard), safe to re-run.

insert into conversations (client_id, coach_id, status)
select c.id, coalesce(rs.coach_id, lb.coach_id), 'active'
from client_profiles c
left join lateral (
  select coach_id from recurring_slots where client_id = c.id and status = 'active' limit 1
) rs on true
left join lateral (
  select coach_id from bookings where client_id = c.id order by scheduled_start desc limit 1
) lb on true
where exists (select 1 from subscriptions s where s.client_id = c.id)
  and coalesce(rs.coach_id, lb.coach_id) is not null
  and not exists (select 1 from conversations conv where conv.client_id = c.id and conv.status = 'active')
on conflict (client_id) where status = 'active' do nothing;
