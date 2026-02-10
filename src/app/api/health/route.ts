/**
 * Lightweight health endpoint for keep-alive pings (e.g. cron-job.org).
 * Returns 200 and { ok: true } so external services can hit this URL
 * instead of the full page to keep the frontend warm on Render.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
