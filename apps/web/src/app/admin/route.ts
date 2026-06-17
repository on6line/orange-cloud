import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAuthed } from "@/lib/admin/auth";
import { loadAdminStats } from "@/lib/admin/queries";
import { renderDashboardHTML } from "@/lib/admin/html";

// 后台账本 dashboard。未登录 -> /admin/login。route handler 直出 HTML（无 React 根布局）。
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const { env } = getCloudflareContext();
	if (!(await isAuthed(request, env.ADMIN_PASSWORD))) {
		return NextResponse.redirect(new URL("/admin/login", request.url));
	}
	const range = request.nextUrl.searchParams.get("range") === "month" ? "month" : "day";
	const stats = await loadAdminStats(env.IAP_DB, range);
	return new NextResponse(renderDashboardHTML(stats), {
		headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
	});
}
