import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
	// 排除 OAuth 回调（/oauth/callback 必须原样直达 route handler）、
	// 后台账本（/admin 直出 HTML，不走 i18n）、
	// API、Next 内部路径与所有带扩展名的静态资源。
	matcher: ["/((?!api|oauth|admin|_next|_vercel|.*\\..*).*)"],
};
