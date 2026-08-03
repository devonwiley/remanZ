// Vercel serverless function — the ONLY thing that touches Neon.
// Holds DATABASE_URL server-side (never sent to the browser) and exposes the
// Transfer Cases "Primary Location" overrides that all users share.
//
//   GET  /api/primary-locations         -> { locations:{sku:loc}, updated:{sku:{by,at}} }
//   POST /api/primary-locations {sku,location,editor}
//        - location non-empty -> upsert (everyone now sees it)
//        - location ""         -> delete the override (falls back to the frozen baseline)
//
// Env: DATABASE_URL is already set on the reman-z Vercel project (Neon integration).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sql`select sku, location, updated_by, updated_at
                             from primary_location order by sku`;
      const locations = {}, updated = {};
      for (const r of rows) {
        locations[r.sku] = r.location;
        updated[r.sku] = { by: r.updated_by, at: r.updated_at };
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ locations, updated });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const sku = String(body.sku || '').trim();
      const location = String(body.location || '').trim();
      const editor = String(body.editor || '').trim() || null;
      if (!sku) return res.status(400).json({ error: 'sku is required' });

      if (location === '') {
        await sql`delete from primary_location where sku = ${sku}`;
        return res.status(200).json({ ok: true, sku, location: '', deleted: true });
      }
      const rows = await sql`
        insert into primary_location (sku, location, updated_by, updated_at)
        values (${sku}, ${location}, ${editor}, now())
        on conflict (sku) do update
          set location = excluded.location,
              updated_by = excluded.updated_by,
              updated_at = now()
        returning updated_at`;
      return res.status(200).json({ ok: true, sku, location, updated_at: rows[0].updated_at });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
