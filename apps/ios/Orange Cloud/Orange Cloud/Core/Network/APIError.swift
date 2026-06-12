//
//  APIError.swift
//  Orange Cloud
//

import Foundation

nonisolated enum APIError: LocalizedError {
    case unauthorized                    // 401，需要重新登录
    case forbidden                       // 403，权限不足
    case notFound                        // 404
    case rateLimited                     // 429
    case serverError(statusCode: Int)    // 5xx
    case cloudflareError(code: Int, message: String)  // CF 业务错误
    case decodingError(Error)            // 解析失败
    case networkError(Error)             // 网络错误

    var errorDescription: String? {
        switch self {
        case .unauthorized:                return String(localized: "登录已过期，请重新登录")
        case .forbidden:                   return String(localized: "权限不足，请检查 OAuth Scope")
        case .notFound:                    return String(localized: "资源不存在")
        case .rateLimited:                 return String(localized: "请求太频繁，请稍后再试")
        case .serverError(let code):       return String(localized: "服务器错误（\(code)）")
        case .cloudflareError(_, let msg): return msg
        case .decodingError:               return String(localized: "数据解析失败")
        case .networkError(let e):         return String(localized: "网络错误：\(e.localizedDescription)")
        }
    }
}
