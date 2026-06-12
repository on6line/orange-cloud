//
//  TokenStore.swift
//  Orange Cloud
//
//  OAuth Token 只存 Keychain，绝不写 UserDefaults 或内存以外的地方。
//  多登录身份：每个身份（UUID）一个 Keychain 条目；旧版单条目在首次启动时迁移。
//

import Foundation
import Security

nonisolated enum TokenStore {

    struct StoredToken: Codable, Sendable {
        var accessToken:  String
        var refreshToken: String?
        var expiresAt:    Date
        var scope:        String
    }

    private static let service = "app.orangecloud.oauth"
    private static let legacyAccount = "default"

    /// 共享钥匙串组（主 App 与 Widget 共用；Widget 只读 access_token，不做刷新）
    static let sharedAccessGroup = "6G78MMY657.jiamin.chen.orange-cloud.shared"

    /// iCloud 钥匙串同步开关（设置页控制，按设备生效）
    static var iCloudSyncEnabled: Bool {
        UserDefaults.standard.bool(forKey: "iCloudSyncEnabled")
    }

    // MARK: - 按身份读写

    @discardableResult
    static func save(_ token: StoredToken, sessionId: UUID) -> Bool {
        save(token, account: sessionId.uuidString)
    }

    static func load(sessionId: UUID) -> StoredToken? {
        load(account: sessionId.uuidString)
    }

    static func clear(sessionId: UUID) {
        SecItemDelete(baseQuery(account: sessionId.uuidString) as CFDictionary)
    }

    // MARK: - 旧版单 token（迁移用）

    static func loadLegacy() -> StoredToken? {
        load(account: legacyAccount)
    }

    static func clearLegacy() {
        SecItemDelete(baseQuery(account: legacyAccount) as CFDictionary)
    }

    /// 切换 iCloud 同步：把所有身份 token 在本机条目与可同步条目之间迁移。
    /// 注意：关闭同步会删除可同步条目（即从 iCloud 移除），改存本机。
    static func setSynchronizable(_ sync: Bool, sessionIds: [UUID]) {
        for id in sessionIds {
            guard let token = load(sessionId: id) else { continue }
            SecItemDelete(anyQuery(account: id.uuidString) as CFDictionary)
            save(token, account: id.uuidString, synchronizable: sync)
        }
    }

    // MARK: - 内部实现

    @discardableResult
    private static func save(_ token: StoredToken, account: String) -> Bool {
        save(token, account: account, synchronizable: iCloudSyncEnabled)
    }

    @discardableResult
    private static func save(_ token: StoredToken, account: String, synchronizable: Bool) -> Bool {
        guard let data = try? JSONEncoder().encode(token) else { return false }

        // 删除时匹配两种形态，避免本机/同步条目并存
        SecItemDelete(anyQuery(account: account) as CFDictionary)

        var query = baseQuery(account: account)
        query[kSecValueData as String] = data
        // 同步条目不能用 ThisDeviceOnly 可见性
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        query[kSecAttrSynchronizable as String] = synchronizable
        // 写入共享组让 Widget 可读；entitlement 缺失时回退默认组，保证 token 不丢
        query[kSecAttrAccessGroup as String] = sharedAccessGroup
        if SecItemAdd(query as CFDictionary, nil) == errSecSuccess {
            return true
        }
        query.removeValue(forKey: kSecAttrAccessGroup as String)
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    private static func load(account: String) -> StoredToken? {
        var query = anyQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(StoredToken.self, from: data)
    }

    private static func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    /// 读/删用：同时匹配本机与可同步条目
    private static func anyQuery(account: String) -> [String: Any] {
        var query = baseQuery(account: account)
        query[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny
        return query
    }
}
