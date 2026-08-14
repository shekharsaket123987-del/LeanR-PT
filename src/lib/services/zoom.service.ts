/** Thin wrapper around Zoom's Server-to-Server OAuth API -- one business
 * Zoom account hosts every meeting (not per-coach OAuth, which would need
 * each coach to individually authorize the app and manage their own token
 * refresh -- far more setup for no real benefit here, since the coach never
 * needs their own Zoom login, just a start link).
 *
 * Requires three env vars, from a Server-to-Server OAuth app created in the
 * Zoom App Marketplace (https://marketplace.zoom.us -> Developer -> Build App
 * -> Server-to-Server OAuth):
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 * Plus the email of a licensed Zoom user under that account to host
 * meetings as:
 *   ZOOM_HOST_EMAIL
 * Grant the app the meeting read + write scopes (labelled meeting:write:admin
 * / meeting:read:admin or meeting:write:meeting:admin / meeting:read:meeting:admin
 * depending on account age), then activate it. */

interface ZoomMeeting {
  id: string;
  joinUrl: string;
  startUrl: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function requireZoomEnv() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const hostEmail = process.env.ZOOM_HOST_EMAIL;
  if (!accountId || !clientId || !clientSecret || !hostEmail) {
    throw new Error(
      "Zoom isn't configured yet -- set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_HOST_EMAIL."
    );
  }
  return { accountId, clientId, clientSecret, hostEmail };
}

async function getZoomAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const { accountId, clientId, clientSecret } = requireZoomEnv();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) throw new Error(`Zoom auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export async function createZoomMeeting(topic: string, startTimeIso: string, durationMinutes: number): Promise<ZoomMeeting> {
  const { hostEmail } = requireZoomEnv();
  const token = await getZoomAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostEmail)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      type: 2, // scheduled
      start_time: startTimeIso,
      duration: durationMinutes,
      timezone: "Asia/Kolkata",
      settings: { join_before_host: true, waiting_room: false, approval_type: 2, mute_upon_entry: true },
    }),
  });
  if (!res.ok) throw new Error(`Zoom meeting creation failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { id: String(data.id), joinUrl: data.join_url, startUrl: data.start_url };
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const token = await getZoomAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Zoom meeting deletion failed (${res.status}): ${await res.text()}`);
}
