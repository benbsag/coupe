import { NextRequest, NextResponse } from "next/server";
import { runNotificationCron } from "@/lib/notifications/cron";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runNotificationCron();
  return NextResponse.json(summary);
}
