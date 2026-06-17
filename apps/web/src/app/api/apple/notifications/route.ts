import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NotificationVerifyError, verifyNotification } from "@/lib/appstore/verify";
import { processNotification } from "@/lib/appstore/store";
import type { DecodedNotification } from "@/lib/appstore/types";

// App Store Server Notifications V2 入口 —— Apple 服务器在购买 / 续订 / 退款 / 流失时
// 秒级推送的签名 webhook。POST body: { "signedPayload": "<JWS>" }。
//
// 安全边界 = JWS 验签（Apple 公钥链，无需任何 secret）。返回码约定：
//   400 缺 signedPayload；401 验签失败 / bundleId 不符；
//   200 处理成功（含未知类型、重复通知）；5xx 仅存储 / 瞬时错误（让 Apple 重试）。
//
// 配置：App Store Connect → App 信息 → App Store Server Notifications（Version 2），
//   Production / Sandbox URL 都填 https://orange-cloud.chatiro.app/api/apple/notifications

export const dynamic = "force-dynamic";

const EXPECTED_BUNDLE_ID = "jiamin.chen.orange-cloud";

export async function POST(request: NextRequest): Promise<NextResponse> {
	// 1) 取出 signedPayload
	let signedPayload: string | undefined;
	try {
		const body = (await request.json()) as { signedPayload?: unknown };
		if (typeof body.signedPayload === "string") signedPayload = body.signedPayload;
	} catch {
		// 非 JSON 体 —— 落到下面的 400
	}
	if (!signedPayload) {
		return NextResponse.json({ error: "missing signedPayload" }, { status: 400 });
	}

	// 2) 验签 + 解码（外层通知 + 内层交易 / 续订）。任何验签失败一律 401，
	//    避免对伪造请求触发 5xx 重试风暴（真 Apple 通知不会走到这）。
	let decoded: DecodedNotification;
	try {
		decoded = await verifyNotification(signedPayload);
	} catch (err) {
		if (!(err instanceof NotificationVerifyError)) {
			console.error("[apple-notifications] unexpected verify error", err);
		}
		return NextResponse.json({ error: "invalid signature" }, { status: 401 });
	}

	// 3) bundleId 校验：拒绝非本 App 的通知
	const bundleId = decoded.payload.data?.bundleId ?? decoded.transaction?.bundleId;
	if (bundleId && bundleId !== EXPECTED_BUNDLE_ID) {
		return NextResponse.json({ error: "unexpected bundleId" }, { status: 401 });
	}

	// 4) 入库。存储失败返回 5xx —— Apple 会在数日的重试窗口内重发（幂等安全）。
	try {
		const { env } = getCloudflareContext();
		const result = await processNotification(env.IAP_DB, decoded);
		return NextResponse.json(
			{ ok: true, duplicate: result.duplicate, type: result.notificationType },
			{ status: 200 },
		);
	} catch (err) {
		console.error("[apple-notifications] store error", err);
		return NextResponse.json({ error: "storage error" }, { status: 500 });
	}
}
