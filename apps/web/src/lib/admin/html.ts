// 后台账本 dashboard / 登录页的 HTML 渲染（route handler 直出，自包含内联 CSS）。
// 视觉照搬 Claude Design 的「收入账本」设计稿（Orange Cloud 设计系统 token）：
// 玻璃材质、品牌橙、侧栏 + KPI + 趋势图 + 环形 + 表格、深色随系统。
// 实时 / SSE 相关（实时入账推流、新行动效）按要求不做；图表为服务端静态 SVG。

import {
	abbrUSD,
	fmtCNY,
	fmtCNYk,
	fmtNative,
	fmtUSD,
} from "./money";
import {
	PRODUCT_NAMES,
	type AdminStats,
	type StatusSegment,
	type SubRow,
	type TxnRow,
} from "./queries";

export function escapeHtml(s: unknown): string {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ── inline icons (clean stroke glyphs, Lucide-ish) ──────────────
const ICONS: Record<string, string> = {
	grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
	swap: '<path d="M8 7h12"/><path d="M16 3l4 4-4 4"/><path d="M16 17H4"/><path d="M8 13l-4 4 4 4"/>',
	repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
	bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
	landmark: '<path d="M3 21h18"/><path d="M5 21V10M19 21V10M9.5 21V10M14.5 21V10"/><path d="M12 3l8 5H4l8-5Z"/>',
	dollar: '<path d="M12 1.5v21"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
	users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	undo: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.3-7.4L3 8"/>',
	infinity: '<path d="M12 12c-2-2.7-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"/>',
	receipt: '<path d="M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M8.5 7h7M8.5 11h7M8.5 15h4"/>',
	trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
	download: '<path d="M12 3v12"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M5 20h14"/>',
	refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/>',
	chevR: '<path d="M9 6l6 6-6 6"/>',
	chevUD: '<path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
};

function icon(name: string, size = 18, sw = 2): string {
	return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}

function cloudMark(size = 30): string {
	return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-hidden="true">
		<path d="M9.2 24.5h13.9a5.6 5.6 0 0 0 1.1-11.09 7.2 7.2 0 0 0-13.74-2.2A5.95 5.95 0 0 0 9.2 24.5Z" fill="var(--oc-orange)"/>
		<path d="M9.2 24.5h13.9a5.6 5.6 0 0 0 1.1-11.09 7.2 7.2 0 0 0-13.74-2.2A5.95 5.95 0 0 0 9.2 24.5Z" fill="url(#cm-g)" fill-opacity="0.35"/>
		<defs><linearGradient id="cm-g" x1="8" y1="6" x2="24" y2="25" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
	</svg>`;
}

function fmtTime(ms: number | null | undefined): string {
	if (!ms) return "—";
	const d = new Date(ms);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

function shortId(id: string): string {
	return id.length > 12 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id;
}
function productName(id: string | null): string {
	return id ? (PRODUCT_NAMES[id] ?? id) : "—";
}

// ── design-system tokens (light) + dark via prefers-color-scheme ──
const TOKENS_CSS = `
:root {
	--oc-orange:#F48120; --oc-orange-pressed:#D86F12; --oc-orange-tint:#FFF1E2; --oc-orange-tint-strong:#FCE0C6; --oc-orange-glow:rgba(244,129,32,0.28);
	--sys-red:#FF3B30; --sys-orange:#FF9500; --sys-yellow:#FFCC00; --sys-green:#34C759; --sys-blue:#007AFF; --sys-gray:#8E8E93;
	--label-primary:rgba(0,0,0,1); --label-secondary:rgba(60,60,67,0.60); --label-tertiary:rgba(60,60,67,0.30);
	--bg-primary:#FFFFFF; --bg-secondary:#F2F2F7;
	--fill-secondary:rgba(120,120,128,0.16); --fill-tertiary:rgba(118,118,128,0.12); --fill-quaternary:rgba(116,116,128,0.08);
	--separator:rgba(60,60,67,0.29);
	--material-regular:rgba(255,255,255,0.72); --material-thick:rgba(245,245,248,0.92); --material-chrome:rgba(255,255,255,0.80);
	--glass-edge-top:rgba(255,255,255,0.65); --glass-edge-bottom:rgba(255,255,255,0.10); --glass-border:rgba(255,255,255,0.50);
	--filter-regular:saturate(180%) blur(20px); --filter-chrome:saturate(180%) blur(28px); --filter-thick:saturate(150%) blur(30px);
	--shadow-card:0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06); --shadow-raised:0 4px 12px rgba(0,0,0,0.08),0 12px 32px rgba(0,0,0,0.10);
	--shadow-glass-edge:inset 0 1px 0 var(--glass-edge-top),inset 0 -1px 0 var(--glass-edge-bottom); --shadow-orange-glow:0 4px 16px var(--oc-orange-glow);
	--ease-standard:cubic-bezier(0.4,0,0.2,1); --ease-out:cubic-bezier(0.16,1,0.3,1); --dur-fast:150ms;
	--font-text:-apple-system,BlinkMacSystemFont,system-ui,"PingFang SC",sans-serif;
	--font-display:-apple-system,BlinkMacSystemFont,system-ui,"PingFang SC",sans-serif;
	--font-rounded:ui-rounded,-apple-system,system-ui,sans-serif;
	--font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;
	--page-bg:#e9e9ee;
	--bg-grad:radial-gradient(60% 42% at 8% 0%,rgba(244,129,32,0.13),transparent 60%),radial-gradient(48% 40% at 100% 4%,rgba(70,120,220,0.10),transparent 58%);
}
@media (prefers-color-scheme: dark) {
	:root {
		--oc-orange-tint:rgba(244,129,32,0.16); --oc-orange-tint-strong:rgba(244,129,32,0.28);
		--sys-red:#FF453A; --sys-yellow:#FFD60A; --sys-green:#30D158; --sys-gray:#98989D;
		--label-primary:rgba(255,255,255,1); --label-secondary:rgba(235,235,245,0.60); --label-tertiary:rgba(235,235,245,0.30);
		--bg-primary:#000000; --bg-secondary:#1C1C1E;
		--fill-secondary:rgba(120,120,128,0.32); --fill-tertiary:rgba(118,118,128,0.24); --fill-quaternary:rgba(118,118,128,0.18);
		--separator:rgba(84,84,88,0.60);
		--material-regular:rgba(40,40,43,0.72); --material-thick:rgba(28,28,30,0.94); --material-chrome:rgba(30,30,32,0.80);
		--glass-edge-top:rgba(255,255,255,0.18); --glass-edge-bottom:rgba(255,255,255,0.04); --glass-border:rgba(255,255,255,0.12);
		--page-bg:#0b0b0d;
		--bg-grad:radial-gradient(60% 42% at 8% 0%,rgba(244,129,32,0.16),transparent 60%),radial-gradient(48% 40% at 100% 4%,rgba(70,120,220,0.13),transparent 58%);
	}
}
* { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body { font-family:var(--font-text); background:var(--page-bg); color:var(--label-primary); -webkit-font-smoothing:antialiased; }
a { text-decoration:none; color:inherit; }
`;

const APP_CSS = `
.lg-app { position:relative; display:grid; grid-template-columns:252px minmax(0,1fr); min-width:1100px; min-height:100vh; background:var(--bg-secondary); }
.lg-bg { position:fixed; inset:0; z-index:0; pointer-events:none; background:var(--bg-grad); }
.lg-sidebar { position:sticky; top:0; z-index:5; height:100vh; align-self:start; display:flex; flex-direction:column; padding:22px 16px 18px; background:var(--material-chrome); backdrop-filter:var(--filter-chrome); -webkit-backdrop-filter:var(--filter-chrome); border-right:0.5px solid var(--separator); }
.lg-brand { display:flex; align-items:center; gap:11px; padding:4px 8px 22px; }
.lg-brand-mark { width:42px; height:42px; border-radius:11px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; background:var(--oc-orange-tint); border:0.5px solid var(--oc-orange-tint-strong); }
.lg-brand-name { font-family:var(--font-display); font-size:17px; font-weight:700; letter-spacing:-0.4px; }
.lg-brand-sub { font-size:12.5px; color:var(--label-secondary); margin-top:1px; }
.lg-nav { display:flex; flex-direction:column; gap:2px; }
.lg-nav-item { display:flex; align-items:center; gap:11px; width:100%; padding:9px 11px; border:none; background:none; cursor:pointer; border-radius:10px; text-align:left; font-family:var(--font-text); font-size:14.5px; font-weight:500; color:var(--label-secondary); letter-spacing:-0.2px; transition:background var(--dur-fast),color var(--dur-fast); }
.lg-nav-item:hover { background:var(--fill-quaternary); color:var(--label-primary); }
.lg-nav-item.on { background:var(--oc-orange-tint); color:var(--oc-orange-pressed); font-weight:600; }
.lg-nav-item.on svg { color:var(--oc-orange); }
@media (prefers-color-scheme: dark){ .lg-nav-item.on { color:var(--oc-orange); } }
.lg-nav-badge { margin-left:auto; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--sys-red); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
.lg-side-card { margin-top:auto; margin-bottom:12px; padding:12px 13px; border-radius:12px; background:var(--material-regular); backdrop-filter:var(--filter-regular); -webkit-backdrop-filter:var(--filter-regular); border:0.5px solid var(--glass-border); box-shadow:var(--shadow-glass-edge); }
.lg-side-card-row { display:flex; align-items:center; gap:7px; }
.lg-side-card-title { font-size:13px; font-weight:600; }
.lg-side-card-body { margin-top:6px; font-size:11.5px; line-height:1.55; color:var(--label-secondary); }
.lg-account { display:flex; align-items:center; gap:10px; padding:8px; border-radius:12px; cursor:pointer; transition:background var(--dur-fast); }
.lg-account:hover { background:var(--fill-quaternary); }
.lg-account-av { width:34px; height:34px; border-radius:50%; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(150deg,#F9A24B,#F48120); color:#fff; font-family:var(--font-rounded); font-weight:700; font-size:13px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.4); }
.lg-account-av-sm { width:32px; height:32px; font-size:12px; }
.lg-account-text { flex:1; min-width:0; }
.lg-account-name { font-size:13.5px; font-weight:600; }
.lg-account-mail { font-family:var(--font-mono); font-size:11px; color:var(--label-secondary); }
.lg-dot-live { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:var(--sys-green); position:relative; }
.lg-dot-live::after { content:""; position:absolute; inset:-3px; border-radius:50%; border:1.5px solid var(--sys-green); opacity:0.5; animation:lg-pulse 2s var(--ease-out) infinite; }
@keyframes lg-pulse { 0% { transform:scale(0.6); opacity:0.6; } 100% { transform:scale(1.8); opacity:0; } }
.lg-main { position:relative; z-index:1; min-width:0; }
.lg-topbar { position:sticky; top:0; z-index:6; display:flex; align-items:center; justify-content:space-between; padding:18px 28px; gap:20px; background:var(--material-chrome); backdrop-filter:var(--filter-chrome); -webkit-backdrop-filter:var(--filter-chrome); border-bottom:0.5px solid var(--separator); }
.lg-topbar-l { display:flex; align-items:baseline; gap:14px; }
.lg-page-title { margin:0; font-family:var(--font-display); font-size:26px; font-weight:700; letter-spacing:-0.7px; }
.lg-page-period { font-size:13px; color:var(--label-secondary); }
.lg-topbar-r { display:flex; align-items:center; gap:10px; }
.lg-pill { display:inline-flex; align-items:center; gap:7px; padding:7px 13px; border-radius:999px; background:rgba(52,199,89,0.12); font-size:12.5px; font-weight:600; letter-spacing:-0.1px; }
.lg-pill-sep { color:var(--label-tertiary); }
.lg-pill-time { color:var(--label-secondary); font-weight:500; }
.lg-icon-btn { width:36px; height:36px; border-radius:50%; border:0.5px solid var(--glass-border); background:var(--material-regular); backdrop-filter:var(--filter-regular); -webkit-backdrop-filter:var(--filter-regular); box-shadow:var(--shadow-glass-edge); color:var(--label-primary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:transform var(--dur-fast) var(--ease-standard); }
.lg-icon-btn:active { transform:scale(0.9); }
.lg-export-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 15px; border-radius:11px; border:none; cursor:pointer; background:var(--oc-orange); color:#fff; font-family:var(--font-text); font-size:14px; font-weight:600; letter-spacing:-0.2px; box-shadow:var(--shadow-orange-glow); transition:transform var(--dur-fast) var(--ease-standard); }
.lg-export-btn:active { transform:scale(0.96); }
.lg-content { padding:24px 28px 40px; display:flex; flex-direction:column; gap:18px; }
.lg-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.lg-kpi { position:relative; min-height:132px; padding:15px 16px 14px; border-radius:14px; display:flex; flex-direction:column; background:var(--material-regular); backdrop-filter:var(--filter-regular); -webkit-backdrop-filter:var(--filter-regular); border:0.5px solid var(--glass-border); box-shadow:var(--shadow-card),var(--shadow-glass-edge); }
.lg-kpi-hero { box-shadow:var(--shadow-card),var(--shadow-glass-edge),inset 0 0 0 1px var(--oc-orange-tint-strong); }
.lg-kpi-top { display:flex; align-items:center; justify-content:space-between; }
.lg-kpi-icon { width:34px; height:34px; border-radius:10px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; background:var(--oc-orange-tint); border:0.5px solid var(--oc-orange-tint-strong); color:var(--oc-orange); }
.lg-kpi-icon.red { background:rgba(255,59,48,0.12); border-color:rgba(255,59,48,0.2); color:var(--sys-red); }
.lg-chip { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:999px; background:rgba(52,199,89,0.14); color:#1B7F36; font-size:11.5px; font-weight:700; letter-spacing:-0.1px; font-variant-numeric:tabular-nums; }
.lg-chip.neg { background:rgba(255,59,48,0.12); color:var(--sys-red); }
@media (prefers-color-scheme: dark){ .lg-chip { color:#34C759; } }
.lg-kpi-val { margin-top:14px; font-family:var(--font-rounded); font-weight:700; font-size:30px; line-height:1; letter-spacing:-0.6px; font-variant-numeric:tabular-nums; }
.lg-kpi-val.hero { color:var(--oc-orange); }
.lg-kpi-val.neg { color:var(--sys-red); }
.lg-kpi-sub { margin-top:7px; font-size:12px; color:var(--label-secondary); font-variant-numeric:tabular-nums; letter-spacing:-0.1px; }
.lg-kpi-label { margin-top:auto; padding-top:9px; font-size:12.5px; font-weight:500; color:var(--label-secondary); letter-spacing:-0.2px; }
.lg-row-2 { display:grid; grid-template-columns:minmax(0,1.72fr) minmax(0,1fr); gap:16px; }
.lg-panel { border-radius:16px; padding:18px 20px; background:var(--material-regular); backdrop-filter:var(--filter-regular); -webkit-backdrop-filter:var(--filter-regular); border:0.5px solid var(--glass-border); box-shadow:var(--shadow-card),var(--shadow-glass-edge); }
.lg-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
.lg-panel-title { font-family:var(--font-display); font-size:18px; font-weight:700; letter-spacing:-0.4px; }
.lg-panel-sub { margin-top:3px; font-size:12.5px; color:var(--label-secondary); letter-spacing:-0.1px; }
.lg-panel-strong { color:var(--label-primary); font-weight:700; font-variant-numeric:tabular-nums; }
.lg-panel-cny { color:var(--label-tertiary); font-variant-numeric:tabular-nums; }
.lg-seg2 { display:inline-flex; padding:2px; border-radius:9px; background:var(--fill-tertiary); }
.lg-seg2 a { padding:5px 13px; border-radius:7px; font-size:13px; font-weight:600; color:var(--label-secondary); }
.lg-seg2 a.on { background:var(--bg-primary); color:var(--label-primary); box-shadow:0 1px 2px rgba(0,0,0,0.08); }
.lg-link-btn { display:inline-flex; align-items:center; gap:2px; border:none; background:none; cursor:pointer; font-family:var(--font-text); font-size:13.5px; font-weight:600; color:var(--oc-orange); padding:4px 2px; flex-shrink:0; }
.lg-chart-card { display:flex; flex-direction:column; }
.lg-chart-svg { width:100%; height:auto; display:block; overflow:visible; }
.lg-axis-y { fill:var(--label-tertiary); font-size:10px; font-family:var(--font-rounded); font-variant-numeric:tabular-nums; }
.lg-axis-x { fill:var(--label-tertiary); font-size:10px; font-family:var(--font-text); }
.lg-chart-legend { display:flex; gap:16px; margin-top:10px; padding-top:10px; border-top:0.5px solid var(--separator); }
.lg-leg-inline { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--label-secondary); }
.lg-leg-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.lg-donut { display:flex; flex-direction:column; align-items:center; gap:16px; padding-top:4px; }
.lg-donut-svg { position:relative; width:144px; height:144px; }
.lg-donut-svg svg { width:100%; height:100%; }
.lg-donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.lg-donut-num { font-family:var(--font-rounded); font-weight:700; font-size:28px; letter-spacing:-0.6px; font-variant-numeric:tabular-nums; line-height:1; }
.lg-donut-cap { font-size:11.5px; color:var(--label-secondary); margin-top:3px; }
.lg-donut-legend { width:100%; display:flex; flex-direction:column; gap:9px; }
.lg-leg-row { display:flex; align-items:center; gap:9px; }
.lg-leg-row .lg-leg-dot { width:9px; height:9px; border-radius:3px; }
.lg-leg-lbl { font-size:13px; letter-spacing:-0.2px; }
.lg-leg-val { margin-left:auto; font-family:var(--font-rounded); font-weight:600; font-size:13.5px; color:var(--label-secondary); font-variant-numeric:tabular-nums; }
.lg-table-panel { padding-bottom:8px; }
.lg-table-scroll { overflow-x:auto; }
.lg-table { width:100%; border-collapse:collapse; }
.lg-table thead th { text-align:left; padding:0 14px 9px; white-space:nowrap; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px; color:var(--label-tertiary); border-bottom:0.5px solid var(--separator); }
.lg-table th.lg-th-r { text-align:right; }
.lg-table tbody td { padding:11px 14px; border-bottom:0.5px solid var(--separator); vertical-align:middle; }
.lg-table tbody tr:last-child td { border-bottom:none; }
.lg-table tbody tr { transition:background var(--dur-fast); }
.lg-table tbody tr:hover { background:var(--fill-quaternary); }
.lg-td-time { white-space:nowrap; }
.lg-time-day { font-size:13px; font-weight:600; }
.lg-time-hm { font-family:var(--font-mono); font-size:11.5px; color:var(--label-tertiary); margin-top:1px; }
.lg-prod { font-size:13.5px; font-weight:500; letter-spacing:-0.2px; white-space:nowrap; }
.lg-prod-notif { font-family:var(--font-mono); font-size:10.5px; color:var(--label-tertiary); margin-top:2px; }
.lg-mono { font-family:var(--font-mono); }
.lg-oid { font-size:12px; color:var(--label-secondary); }
.lg-exp { font-size:12.5px; color:var(--label-secondary); }
.lg-cc { display:inline-flex; align-items:center; justify-content:center; min-width:30px; height:20px; padding:0 6px; border-radius:5px; background:var(--fill-tertiary); font-family:var(--font-mono); font-size:11px; font-weight:600; color:var(--label-secondary); }
.lg-td-amt,.lg-td-cny,.lg-td-r { text-align:right; }
.lg-amt { font-family:var(--font-rounded); font-weight:600; font-size:14px; font-variant-numeric:tabular-nums; }
.lg-amt.neg { color:var(--sys-red); }
.lg-cny { font-family:var(--font-rounded); font-size:12.5px; color:var(--label-tertiary); font-variant-numeric:tabular-nums; }
.lg-cny-inline { display:block; margin-top:1px; }
.lg-muted { color:var(--label-tertiary); }
.lg-tr-refund { background:rgba(255,59,48,0.05); }
.lg-tr-refund:hover { background:rgba(255,59,48,0.09); }
.lg-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; font-size:12px; font-weight:600; letter-spacing:-0.1px; white-space:nowrap; }
.lg-badge .lg-bdot { width:6px; height:6px; border-radius:50%; }
.lg-badge-blue { background:rgba(0,122,255,0.14); color:var(--sys-blue); }
.lg-badge-green { background:rgba(52,199,89,0.16); color:#1B7F36; }
.lg-badge-orange { background:var(--oc-orange-tint); color:var(--oc-orange-pressed); }
.lg-badge-red { background:rgba(255,59,48,0.12); color:var(--sys-red); }
.lg-badge-gray { background:var(--fill-tertiary); color:var(--label-secondary); }
@media (prefers-color-scheme: dark){ .lg-badge-green { color:#30D158; } .lg-badge-orange { color:var(--oc-orange); } }
.lg-foot { padding:8px 4px 0; font-size:12px; color:var(--label-tertiary); letter-spacing:-0.1px; }
.lg-foot .lg-mono { font-size:11.5px; }
.lg-empty { padding:46px 24px; text-align:center; }
.lg-empty-ic { width:64px; height:64px; margin:0 auto 14px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:var(--oc-orange-tint); color:var(--oc-orange); border:0.5px solid var(--oc-orange-tint-strong); }
.lg-empty-t { font-family:var(--font-display); font-size:17px; font-weight:700; }
.lg-empty-d { margin-top:6px; font-size:13px; color:var(--label-secondary); line-height:1.6; max-width:380px; margin-left:auto; margin-right:auto; }
@media (max-width:1140px){ .lg-app { min-width:0; grid-template-columns:1fr; } .lg-sidebar { display:none; } .lg-kpis { grid-template-columns:repeat(2,1fr); } .lg-row-2 { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce){ .lg-dot-live::after { animation:none; } }
`;

const LOGIN_CSS = `
.lg-login-wrap { min-height:100vh; position:relative; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg-secondary); }
.lg-login-bg { position:fixed; inset:0; z-index:0; pointer-events:none; background:var(--bg-grad); }
.lg-login { position:relative; z-index:1; width:100%; max-width:360px; padding:30px 28px; border-radius:20px; background:var(--material-regular); backdrop-filter:var(--filter-regular); -webkit-backdrop-filter:var(--filter-regular); border:0.5px solid var(--glass-border); box-shadow:var(--shadow-raised),var(--shadow-glass-edge); }
.lg-login-brand { display:flex; align-items:center; gap:11px; margin-bottom:20px; }
.lg-login-mark { width:42px; height:42px; border-radius:11px; display:inline-flex; align-items:center; justify-content:center; background:var(--oc-orange-tint); border:0.5px solid var(--oc-orange-tint-strong); }
.lg-login-name { font-family:var(--font-display); font-size:17px; font-weight:700; letter-spacing:-0.4px; }
.lg-login-sub { font-size:12.5px; color:var(--label-secondary); margin-top:1px; }
.lg-login label { display:block; font-size:13px; font-weight:600; color:var(--label-secondary); margin-bottom:7px; }
.lg-login input { width:100%; padding:11px 13px; border:0.5px solid var(--separator); border-radius:11px; font-size:15px; font-family:var(--font-text); background:var(--bg-primary); color:var(--label-primary); }
.lg-login input:focus { outline:none; border-color:var(--oc-orange); box-shadow:0 0 0 3px var(--oc-orange-tint); }
.lg-login button { width:100%; margin-top:18px; padding:12px; border:none; border-radius:11px; background:var(--oc-orange); color:#fff; font-size:15px; font-weight:600; cursor:pointer; box-shadow:var(--shadow-orange-glow); }
.lg-login button:active { transform:scale(0.98); }
.lg-login-err { background:rgba(255,59,48,0.12); color:var(--sys-red); font-size:13px; font-weight:500; padding:9px 11px; border-radius:9px; margin-bottom:14px; }
.lg-login-foot { margin-top:18px; font-size:11px; color:var(--label-tertiary); text-align:center; line-height:1.6; }
`;

function doc(title: string, css: string, body: string): string {
	return `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title><style>${TOKENS_CSS}${css}</style></head><body>${body}</body></html>`;
}

// ── login ───────────────────────────────────────────────────────
export function renderLoginHTML(opts: { error?: boolean } = {}): string {
	const err = opts.error ? `<div class="lg-login-err">口令不正确</div>` : "";
	return doc(
		"登录 · Orange Cloud 后台账本",
		LOGIN_CSS,
		`<div class="lg-login-wrap"><div class="lg-login-bg"></div>
		<form class="lg-login" method="post" action="/admin/login">
			<div class="lg-login-brand">
				<span class="lg-login-mark">${cloudMark(30)}</span>
				<div><div class="lg-login-name">Orange Cloud</div><div class="lg-login-sub">收入账本</div></div>
			</div>
			${err}
			<label for="password">管理口令</label>
			<input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
			<button type="submit">登录</button>
			<div class="lg-login-foot">App Store Server Notifications V2 · 仅 Production</div>
		</form></div>`,
	);
}

// ── sidebar ─────────────────────────────────────────────────────
function renderSidebar(stats: AdminStats): string {
	const nav = [
		{ id: "overview", label: "账本总览", icon: "grid", href: "#top", on: true },
		{ id: "txns", label: "财务流水", icon: "swap", href: "#lg-txns", on: false },
		{ id: "subs", label: "订阅", icon: "repeat", href: "#lg-subs", on: false },
		{ id: "notifs", label: "通知审计", icon: "bell", href: "#lg-txns", on: false, badge: stats.kpis.refundMonthCount || undefined },
	];
	return `<aside class="lg-sidebar">
		<div class="lg-brand"><span class="lg-brand-mark">${cloudMark(30)}</span>
			<div><div class="lg-brand-name">Orange Cloud</div><div class="lg-brand-sub">收入账本</div></div></div>
		<nav class="lg-nav">
			${nav
				.map(
					(n) => `<a class="lg-nav-item${n.on ? " on" : ""}" href="${n.href}">${icon(n.icon, 18, 2.1)}<span>${n.label}</span>${n.badge ? `<span class="lg-nav-badge">${n.badge}</span>` : ""}</a>`,
				)
				.join("")}
		</nav>
		<div class="lg-side-card">
			<div class="lg-side-card-row"><span class="lg-dot-live"></span><span class="lg-side-card-title">Webhook 已连接</span></div>
			<div class="lg-side-card-body">ASSN V2 · ES256 验签<br><span class="lg-mono">/api/apple/notifications</span></div>
		</div>
		<a class="lg-account" href="/admin/logout" title="退出登录">
			<span class="lg-account-av">OC</span>
			<div class="lg-account-text"><div class="lg-account-name">管理员</div><div class="lg-account-mail">退出登录</div></div>
			${icon("chevUD", 16, 2)}
		</a>
	</aside>`;
}

// ── topbar ──────────────────────────────────────────────────────
function renderTopbar(stats: AdminStats): string {
	return `<header class="lg-topbar" id="top">
		<div class="lg-topbar-l"><h1 class="lg-page-title">账本总览</h1><span class="lg-page-period">${escapeHtml(stats.periodLabel)}</span></div>
		<div class="lg-topbar-r">
			<span class="lg-pill"><span class="lg-dot-live"></span>仅 Production<span class="lg-pill-sep">·</span><span class="lg-pill-time">${fmtTime(stats.generatedAt)}</span></span>
			<a class="lg-icon-btn" href="/admin?range=${stats.range}" aria-label="刷新">${icon("refresh", 17, 2.1)}</a>
			<a class="lg-export-btn" href="/admin/export">${icon("download", 16, 2.2)}导出 CSV</a>
			<span class="lg-account-av lg-account-av-sm">OC</span>
		</div>
	</header>`;
}

// ── KPI tiles ───────────────────────────────────────────────────
interface Tile {
	icon: string;
	label: string;
	value: string;
	valClass?: string;
	sub: string;
	tone?: "red";
	chip?: { text: string; neg?: boolean };
	hero?: boolean;
}
function deltaChip(pct: number | null): { text: string; neg?: boolean } | undefined {
	if (pct == null) return undefined;
	const s = (pct >= 0 ? "+" : "−") + Math.abs(pct).toFixed(1) + "%";
	return { text: s, neg: pct < 0 };
}
function renderKpis(stats: AdminStats): string {
	const k = stats.kpis;
	const tiles: Tile[] = [
		{ icon: "dollar", label: "本月收入 · 净额", value: fmtUSD(k.monthNetUsd), valClass: "hero", hero: true, sub: `${fmtCNY(k.monthNetUsd)} · 已扣退款`, chip: deltaChip(k.monthDeltaPct) },
		{ icon: "sun", label: "今日收入", value: fmtUSD(k.todayNetUsd), sub: `${fmtCNY(k.todayNetUsd)} · 对比昨日`, chip: deltaChip(k.todayDeltaPct) },
		{ icon: "users", label: "活跃订阅", value: k.activeSubs.toLocaleString("en-US"), sub: `本月新增 +${k.newSubsThisMonth}`, chip: k.newSubsThisMonth > 0 ? { text: `+${k.newSubsThisMonth}` } : undefined },
		{ icon: "infinity", label: "买断收入 · 本月", value: fmtUSD(k.lifetimeMonthUsd), sub: `${fmtCNY(k.lifetimeMonthUsd)} · ${k.lifetimeMonthCount} 笔` },
		{ icon: "undo", label: "退款 · 本月", value: "−" + fmtUSD(k.refundMonthUsd).replace("−", ""), valClass: "neg", tone: "red", sub: `${fmtCNY(k.refundMonthUsd)} · ${k.refundMonthCount} 笔` },
		{ icon: "trend", label: "累计净收入", value: fmtUSD(k.cumulativeNetUsd, 0), sub: fmtCNYk(k.cumulativeNetUsd) },
		{ icon: "repeat", label: "订阅总数", value: k.totalSubs.toLocaleString("en-US"), sub: "全部状态" },
		{ icon: "bell", label: "通知总数", value: k.totalNotifications.toLocaleString("en-US"), sub: "已验签入库" },
	];
	return `<section class="lg-kpis">${tiles
		.map(
			(t) => `<div class="lg-kpi${t.hero ? " lg-kpi-hero" : ""}">
			<div class="lg-kpi-top">
				<span class="lg-kpi-icon${t.tone === "red" ? " red" : ""}">${icon(t.icon, 18, 2.2)}</span>
				${t.chip ? `<span class="lg-chip${t.chip.neg ? " neg" : ""}">${icon("trend", 12, 2.6)}${escapeHtml(t.chip.text)}</span>` : ""}
			</div>
			<div class="lg-kpi-val ${t.valClass ?? ""}">${escapeHtml(t.value)}</div>
			<div class="lg-kpi-sub">${escapeHtml(t.sub)}</div>
			<div class="lg-kpi-label">${escapeHtml(t.label)}</div>
		</div>`,
		)
		.join("")}</section>`;
}

// ── revenue chart (server-side SVG) ─────────────────────────────
function renderChart(stats: AdminStats): string {
	const data = stats.trend;
	const isMonth = stats.range === "month";
	const W = 760, H = 280, padL = 8, padR = 8, padT = 18, padB = 34;
	const innerW = W - padL - padR, innerH = H - padT - padB;
	const n = data.length || 1;
	const maxNet = Math.max(1, ...data.map((d) => d.netUsd));
	const yMax = Math.ceil(maxNet / 100) * 100 * 1.08 || 108;
	const xFor = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
	const bandW = innerW / n;
	const yFor = (v: number) => padT + innerH - (v / yMax) * innerH;
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
	const labelEvery = isMonth ? 1 : 5;

	let line = "";
	data.forEach((d, i) => {
		line += (i === 0 ? "M" : "L") + xFor(i).toFixed(1) + " " + yFor(d.netUsd).toFixed(1) + " ";
	});
	const area = line + `L${xFor(n - 1).toFixed(1)} ${padT + innerH} L${xFor(0).toFixed(1)} ${padT + innerH} Z`;

	const grid = ticks
		.map((t, i) => {
			const y = yFor(t);
			return `<line x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--separator)" stroke-width="0.5" ${i === 0 ? 'opacity="0.8"' : 'stroke-dasharray="2 4" opacity="0.5"'}/><text x="${W - padR}" y="${(y - 4).toFixed(1)}" text-anchor="end" class="lg-axis-y">${abbrUSD(t)}</text>`;
		})
		.join("");

	let series = "";
	if (isMonth) {
		series = data
			.map((d, i) => {
				const bw = Math.min(34, bandW * 0.5);
				const x = padL + i * bandW + bandW / 2 - bw / 2;
				const y = yFor(d.netUsd);
				const h = Math.max(1, padT + innerH - y);
				return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="var(--oc-orange)" opacity="0.85"/>`;
			})
			.join("");
	} else {
		const markers = data
			.map((d, i) => (d.refundUsd > 0 ? `<circle cx="${xFor(i).toFixed(1)}" cy="${padT + innerH - 3}" r="2.6" fill="var(--sys-red)" opacity="0.8"/>` : ""))
			.join("");
		series = `<path d="${area}" fill="url(#lg-area)"/><path d="${line}" fill="none" stroke="var(--oc-orange)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${markers}`;
	}

	const xLabels = data
		.map((d, i) => (i % labelEvery === 0 || i === n - 1 ? `<text x="${xFor(i).toFixed(1)}" y="${H - 12}" text-anchor="middle" class="lg-axis-x">${escapeHtml(d.label)}</text>` : ""))
		.join("");

	const seg = (r: string, label: string) =>
		`<a class="${stats.range === r ? "on" : ""}" href="/admin?range=${r}">${label}</a>`;

	return `<section class="lg-panel lg-chart-card">
		<div class="lg-panel-head">
			<div><div class="lg-panel-title">收入趋势</div>
				<div class="lg-panel-sub">${isMonth ? "近 12 个月净收入" : "近 30 天净收入"} · <span class="lg-panel-strong">${fmtUSD(stats.trendNetUsd, 0)}</span> <span class="lg-panel-cny">${fmtCNYk(stats.trendNetUsd)}</span></div></div>
			<div class="lg-seg2">${seg("day", "按天")}${seg("month", "按月")}</div>
		</div>
		<svg viewBox="0 0 ${W} ${H}" class="lg-chart-svg" preserveAspectRatio="none">
			<defs><linearGradient id="lg-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--oc-orange)" stop-opacity="0.30"/><stop offset="100%" stop-color="var(--oc-orange)" stop-opacity="0.02"/></linearGradient></defs>
			${grid}${series}${xLabels}
		</svg>
		<div class="lg-chart-legend">
			<span class="lg-leg-inline"><span class="lg-leg-dot" style="background:var(--oc-orange)"></span>净收入</span>
			<span class="lg-leg-inline"><span class="lg-leg-dot" style="background:var(--sys-red)"></span>退款日</span>
		</div>
	</section>`;
}

// ── status donut (server-side SVG) ──────────────────────────────
function renderDonut(segments: StatusSegment[]): string {
	const R = 54, SW = 18, C = 2 * Math.PI * R;
	const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
	const active = segments.find((s) => s.key === "active")?.value ?? 0;
	let offset = 0;
	const arcs = segments
		.map((s) => {
			const len = (s.value / sum) * C;
			const seg = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="${SW}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
			offset += len;
			return seg;
		})
		.join("");
	const legend = segments
		.map(
			(s) => `<div class="lg-leg-row"><span class="lg-leg-dot" style="background:${s.color}"></span><span class="lg-leg-lbl">${escapeHtml(s.label)}</span><span class="lg-leg-val">${s.value.toLocaleString("en-US")}</span></div>`,
		)
		.join("");
	const body = segments.length
		? `<div class="lg-donut">
			<div class="lg-donut-svg"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--fill-tertiary)" stroke-width="${SW}"/>${arcs}</svg>
				<div class="lg-donut-center"><div class="lg-donut-num">${active.toLocaleString("en-US")}</div><div class="lg-donut-cap">活跃订阅</div></div></div>
			<div class="lg-donut-legend">${legend}</div></div>`
		: `<div class="lg-empty"><div class="lg-empty-d">暂无订阅</div></div>`;
	return `<section class="lg-panel"><div class="lg-panel-head"><div><div class="lg-panel-title">订阅状态</div><div class="lg-panel-sub">按 original_transaction_id</div></div></div>${body}</section>`;
}

// ── transactions table ──────────────────────────────────────────
const TXN_TYPE: Record<string, { label: string; tone: string }> = {
	SUBSCRIBED: { label: "首购", tone: "blue" },
	DID_RENEW: { label: "续订", tone: "green" },
	ONE_TIME_CHARGE: { label: "买断", tone: "orange" },
	OFFER_REDEEMED: { label: "兑换", tone: "blue" },
	REFUND: { label: "退款", tone: "red" },
};
function txnBadge(tx: TxnRow): string {
	const meta = tx.revoked
		? { label: "退款", tone: "red" }
		: (TXN_TYPE[tx.notification_type ?? ""] ?? { label: tx.notification_type ?? "—", tone: "gray" });
	return `<span class="lg-badge lg-badge-${meta.tone}">${escapeHtml(meta.label)}</span>`;
}
function renderTxns(stats: AdminStats): string {
	const head = `<div class="lg-panel-head"><div><div class="lg-panel-title">财务流水</div><div class="lg-panel-sub">每笔首购 / 续订 / 退款一行 · transactions 表</div></div></div>`;
	if (stats.transactions.length === 0) {
		return `<section class="lg-panel lg-table-panel" id="lg-txns">${head}
			<div class="lg-empty"><div class="lg-empty-ic">${icon("receipt", 30, 1.6)}</div><div class="lg-empty-t">还没有任何交易</div>
			<div class="lg-empty-d">Apple 的购买通知到达后会经 ES256 验签实时写入账本，并在这里逐笔显示。</div></div></section>`;
	}
	const rows = stats.transactions
		.map((tx) => {
			const usdNeg = tx.revoked;
			const native = fmtNative(tx.price_millis, tx.currency);
			const d = tx.purchase_date ? new Date(tx.purchase_date) : null;
			const day = d ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : "—";
			const hm = d ? d.toISOString().slice(11, 16) : "";
			return `<tr class="${tx.revoked ? "lg-tr-refund" : ""}">
				<td class="lg-td-time"><div class="lg-time-day">${day}</div><div class="lg-time-hm">${hm}</div></td>
				<td>${txnBadge(tx)}</td>
				<td><div class="lg-prod">${escapeHtml(productName(tx.product_id))}</div><div class="lg-prod-notif">${escapeHtml(tx.notification_type ?? "")}</div></td>
				<td><span class="lg-mono lg-oid">${escapeHtml(shortId(tx.transaction_id))}</span></td>
				<td><span class="lg-cc">${escapeHtml(tx.currency ?? "—")}</span></td>
				<td class="lg-td-amt"><span class="lg-amt${usdNeg ? " neg" : ""}">${usdNeg ? "−" : ""}${escapeHtml(native.replace("−", ""))}</span></td>
			</tr>`;
		})
		.join("");
	return `<section class="lg-panel lg-table-panel" id="lg-txns">${head}
		<div class="lg-table-scroll"><table class="lg-table"><thead><tr>
			<th>时间</th><th>类型</th><th>产品</th><th>交易 ID</th><th>币种</th><th class="lg-th-r">金额</th>
		</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// ── subscriptions table ─────────────────────────────────────────
const SUB_STATUS: Record<string, { label: string; tone: string }> = {
	active: { label: "活跃", tone: "green" },
	grace: { label: "宽限期", tone: "orange" },
	billing_retry: { label: "扣款重试", tone: "red" },
	expired: { label: "已过期", tone: "gray" },
	refunded: { label: "已退款", tone: "red" },
	revoked: { label: "已撤销", tone: "red" },
};
function subRow(s: SubRow): string {
	const meta = s.is_lifetime ? { label: "已买断", tone: "orange" } : (SUB_STATUS[s.status] ?? { label: s.status, tone: "gray" });
	const ar = s.is_lifetime
		? '<span class="lg-muted">—</span>'
		: s.auto_renew_status == null
			? '<span class="lg-muted">—</span>'
			: `<span class="lg-badge lg-badge-${s.auto_renew_status ? "green" : "gray"}"><span class="lg-bdot" style="background:${s.auto_renew_status ? "var(--sys-green)" : "var(--sys-gray)"}"></span>${s.auto_renew_status ? "开" : "关"}</span>`;
	const expires = s.is_lifetime ? "永久" : s.expires_date ? new Date(s.expires_date).toISOString().slice(0, 10) : "—";
	return `<tr>
		<td><span class="lg-mono lg-oid">${escapeHtml(shortId(s.original_transaction_id))}</span></td>
		<td><div class="lg-prod">${escapeHtml(productName(s.product_id))}</div></td>
		<td><span class="lg-badge lg-badge-${meta.tone}">${escapeHtml(meta.label)}</span></td>
		<td>${ar}</td>
		<td><span class="lg-mono lg-exp">${expires}</span></td>
		<td class="lg-td-r"><span class="lg-amt">${escapeHtml(fmtNative(s.price_millis, s.currency))}</span><span class="lg-cny lg-cny-inline">${escapeHtml(s.currency ?? "")}</span></td>
	</tr>`;
}
function renderSubs(stats: AdminStats): string {
	const head = `<div class="lg-panel-head"><div><div class="lg-panel-title">订阅</div><div class="lg-panel-sub">每个订阅 / 买断的当前状态 · subscriptions 表</div></div></div>`;
	if (stats.subscriptions.length === 0) {
		return `<section class="lg-panel lg-table-panel" id="lg-subs">${head}<div class="lg-empty"><div class="lg-empty-d">暂无订阅</div></div></section>`;
	}
	return `<section class="lg-panel lg-table-panel" id="lg-subs">${head}
		<div class="lg-table-scroll"><table class="lg-table"><thead><tr>
			<th>订阅者 ID</th><th>产品</th><th>状态</th><th>自动续订</th><th>到期 / 续费</th><th class="lg-th-r">价格</th>
		</tr></thead><tbody>${stats.subscriptions.map(subRow).join("")}</tbody></table></div></section>`;
}

// ── dashboard ───────────────────────────────────────────────────
export function renderDashboardHTML(stats: AdminStats): string {
	const body = `<div class="lg-app"><div class="lg-bg"></div>
		${renderSidebar(stats)}
		<main class="lg-main">
			${renderTopbar(stats)}
			<div class="lg-content">
				${renderKpis(stats)}
				<div class="lg-row-2">${renderChart(stats)}${renderDonut(stats.statusBreakdown)}</div>
				${renderTxns(stats)}
				${renderSubs(stats)}
				<footer class="lg-foot">App Store Server Notifications V2 · ES256 / Apple Root CA G3 验签 · 数据写入 D1 <span class="lg-mono">IAP_DB</span> · 金额按近似汇率折算（估算口径）</footer>
			</div>
		</main></div>`;
	return doc("Orange Cloud · 收入账本", APP_CSS, body);
}
