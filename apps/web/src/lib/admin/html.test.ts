// 后台 HTML 渲染的确定性单测：内容、空状态、HTML 转义（防注入）。

import { describe, expect, it } from "vitest";
import type { AdminStats } from "./queries";
import { renderDashboardHTML, renderLoginHTML } from "./html";

function baseStats(): AdminStats {
	return {
		generatedAt: 1_781_827_200_000,
		range: "day",
		periodLabel: "2026 年 6 月 · 截至 6/17（UTC）",
		kpis: {
			monthNetUsd: 9243.18, monthDeltaPct: 18.4, todayNetUsd: 342.91, todayDeltaPct: 12,
			activeSubs: 1284, newSubsThisMonth: 104, lifetimeMonthUsd: 1679.79, lifetimeMonthCount: 21,
			refundMonthUsd: 213.47, refundMonthCount: 7, cumulativeNetUsd: 84210, totalSubs: 1649, totalNotifications: 5120,
		},
		trend: Array.from({ length: 30 }, (_, i) => ({ label: `6/${i + 1}`, netUsd: 100 + i * 5, refundUsd: i % 6 === 0 ? 20 : 0 })),
		trendNetUsd: 6500,
		statusBreakdown: [
			{ key: "active", label: "活跃 Active", value: 1284, color: "var(--sys-green)" },
			{ key: "expired", label: "已过期 Expired", value: 286, color: "var(--sys-gray)" },
		],
		transactions: [
			{ purchase_date: 1_781_827_200_000, notification_type: "DID_RENEW", product_id: "jiamin.chen.orange_cloud.pro.yearly", transaction_id: "2000000000048821", currency: "USD", price_millis: 19990, revoked: false },
			{ purchase_date: 1_781_800_000_000, notification_type: "REFUND", product_id: "jiamin.chen.orange_cloud.pro.monthly", transaction_id: "2000000000048817", currency: "USD", price_millis: 2990, revoked: true },
		],
		subscriptions: [
			{ original_transaction_id: "2000000000011204", product_id: "jiamin.chen.orange_cloud.pro.yearly", status: "active", auto_renew_status: 1, is_lifetime: 0, expires_date: 1_813_363_200_000, price_millis: 19990, currency: "USD", purchase_date: 1_755_000_000_000 },
		],
		hasData: true,
	};
}

describe("renderDashboardHTML", () => {
	it("渲染账本壳 / KPI / 图表 / 表格", () => {
		const html = renderDashboardHTML(baseStats());
		expect(html).toContain("收入账本");
		expect(html).toContain("账本总览");
		expect(html).toContain("Pro 年度会员"); // product_id 映射
		expect(html).toContain("8821"); // 交易 ID 短形
		expect(html).toContain("退款"); // 退款徽章
		expect(html).toContain("导出 CSV");
		expect(html).toContain('href="/admin/logout"');
		expect(html).toContain("收入趋势");
		expect(html).toContain("订阅状态");
	});

	it("空交易 -> 空状态文案", () => {
		const s = baseStats();
		s.transactions = [];
		expect(renderDashboardHTML(s)).toContain("还没有任何交易");
	});

	it("转义恶意字段，杜绝 HTML 注入", () => {
		const s = baseStats();
		s.transactions[0].product_id = "<script>alert(1)</script>";
		const html = renderDashboardHTML(s);
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;");
	});
});

describe("renderLoginHTML", () => {
	it("含口令表单，error 时显示提示", () => {
		const html = renderLoginHTML({ error: true });
		expect(html).toContain('name="password"');
		expect(html).toContain("管理口令");
		expect(html).toContain("口令不正确");
		expect(html).toContain('action="/admin/login"');
	});
	it("无 error 时不显示提示", () => {
		expect(renderLoginHTML({})).not.toContain("口令不正确");
	});
});
