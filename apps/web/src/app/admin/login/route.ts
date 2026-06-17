import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	SESSION_COOKIE,
	cookieSecure,
	createSessionToken,
	isAuthed,
	passwordMatches,
	sessionCookieOptions,
} from "@/lib/admin/auth";
import { renderLoginHTML } from "@/lib/admin/html";

export const dynamic = "force-dynamic";

// GET：渲染登录表单（已登录则跳 dashboard）
export async function GET(request: NextRequest): Promise<NextResponse> {
	const { env } = getCloudflareContext();
	if (await isAuthed(request, env.ADMIN_PASSWORD)) {
		return NextResponse.redirect(new URL("/admin", request.url));
	}
	const error = request.nextUrl.searchParams.get("error") === "1";
	return new NextResponse(renderLoginHTML({ error }), {
		headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
	});
}

// POST：校验口令，成功则下发签名会话 cookie 并 303 回 dashboard
export async function POST(request: NextRequest): Promise<NextResponse> {
	const { env } = getCloudflareContext();
	const secret = env.ADMIN_PASSWORD ?? "";
	const form = await request.formData();
	const password = String(form.get("password") ?? "");

	if (!(await passwordMatches(password, secret))) {
		return NextResponse.redirect(new URL("/admin/login?error=1", request.url), { status: 303 });
	}

	const res = NextResponse.redirect(new URL("/admin", request.url), { status: 303 });
	const token = await createSessionToken(secret);
	res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(cookieSecure(request)));
	return res;
}
