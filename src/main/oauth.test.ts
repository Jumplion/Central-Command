import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthManager } from "./oauth";

const mockSecrets = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  has: vi.fn(),
};

vi.mock("./platform", () => ({
  IS_WSL: false,
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

let manager: OAuthManager;

beforeEach(() => {
  vi.clearAllMocks();
  manager = new OAuthManager(mockSecrets as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("OAuthManager", () => {
  describe("getToken", () => {
    it("should return null if no token is stored", async () => {
      mockSecrets.get.mockResolvedValue(null);
      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();
    });

    it("should return cached token if still valid", async () => {
      const now = Date.now();
      const tokens = {
        accessToken: "cached-token",
        expiresAt: now + 10000, // 10 seconds from now
      };
      mockSecrets.get.mockResolvedValue(JSON.stringify(tokens));

      const token1 = await manager.getToken("widget1", "gmail");
      expect(token1).toBe("cached-token");

      // Clear mock to verify it wasn't called again (cache hit)
      mockSecrets.get.mockClear();
      const token2 = await manager.getToken("widget1", "gmail");
      expect(token2).toBe("cached-token");
      expect(mockSecrets.get).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now - 1000, // Already expired
      };
      const storedCreds = {
        clientId: "test-client",
        clientSecret: "test-secret",
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(storedTokens))
        .mockResolvedValueOnce(JSON.stringify(storedCreds));

      global.fetch = vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "new-token",
              expires_in: 3600,
            }),
          }) as Response,
      );

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBe("new-token");

      // Should have called fetch to refresh
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("oauth2"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should delete token if refresh fails", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now - 1000,
      };
      const storedCreds = {
        clientId: "test-client",
        clientSecret: "test-secret",
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(storedTokens))
        .mockResolvedValueOnce(JSON.stringify(storedCreds));

      global.fetch = vi.fn(
        async () =>
          ({
            ok: false,
            status: 401,
          }) as Response,
      );

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();

      // Should have deleted the expired token
      expect(mockSecrets.del).toHaveBeenCalled();
    });

    it("should return null if token is corrupted", async () => {
      mockSecrets.get.mockResolvedValue("invalid-json-{]");

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();

      // Should clean up corrupted token
      expect(mockSecrets.del).toHaveBeenCalled();
    });

    it("should return null if refresh token is missing and token expired", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        // No refreshToken
        expiresAt: now - 1000,
      };

      mockSecrets.get.mockResolvedValue(JSON.stringify(storedTokens));

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();

      // Should clean up token without refresh capability
      expect(mockSecrets.del).toHaveBeenCalled();
    });

    it("should return null if credentials are missing for refresh", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now - 1000,
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(storedTokens))
        .mockResolvedValueOnce(null); // No creds

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();

      // Should clean up
      expect(mockSecrets.del).toHaveBeenCalled();
    });

    it("should handle corrupted credentials gracefully", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: now - 1000,
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(storedTokens))
        .mockResolvedValueOnce("invalid-json-{]");

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBeNull();

      expect(mockSecrets.del).toHaveBeenCalled();
    });

    it("should handle refresh token response with new refresh token", async () => {
      const now = Date.now();
      const storedTokens = {
        accessToken: "old-token",
        refreshToken: "old-refresh-token",
        expiresAt: now - 1000,
      };
      const storedCreds = {
        clientId: "test-client",
        clientSecret: "test-secret",
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(storedTokens))
        .mockResolvedValueOnce(JSON.stringify(storedCreds));

      global.fetch = vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "new-token",
              refresh_token: "new-refresh-token",
              expires_in: 3600,
            }),
          }) as Response,
      );

      const token = await manager.getToken("widget1", "gmail");
      expect(token).toBe("new-token");

      // Should have persisted the new refresh token
      expect(mockSecrets.set).toHaveBeenCalledWith(
        "widget1",
        expect.stringContaining("google"),
        expect.stringContaining("new-refresh-token"),
      );
    });
  });

  describe("disconnect", () => {
    it("should delete credentials and tokens", async () => {
      await manager.disconnect("widget1", "gmail");

      expect(mockSecrets.del).toHaveBeenCalledWith(
        "widget1",
        expect.stringContaining("google"),
      );
      expect(mockSecrets.del).toHaveBeenCalledTimes(2); // creds + tokens
    });

    it("should clear token cache", async () => {
      const now = Date.now();
      const tokens = {
        accessToken: "cached-token",
        expiresAt: now + 10000,
      };
      mockSecrets.get.mockResolvedValue(JSON.stringify(tokens));

      // Load token into cache
      await manager.getToken("widget1", "gmail");

      // Mock should have been called once for cache load
      const getCallsBeforeDisconnect = mockSecrets.get.mock.calls.length;

      // Disconnect to clear cache
      await manager.disconnect("widget1", "gmail");

      // Reset mocks
      mockSecrets.get.mockClear();

      // Try to get token again - should fetch from secrets, not cache
      mockSecrets.get.mockResolvedValue(JSON.stringify(tokens));
      await manager.getToken("widget1", "gmail");

      expect(mockSecrets.get).toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("should return true if token exists", async () => {
      mockSecrets.has.mockResolvedValue(true);
      const connected = await manager.isConnected("widget1", "gmail");
      expect(connected).toBe(true);
    });

    it("should return false if token does not exist", async () => {
      mockSecrets.has.mockResolvedValue(false);
      const connected = await manager.isConnected("widget1", "gmail");
      expect(connected).toBe(false);
    });
  });

  describe("multiple widgets", () => {
    it("should maintain separate tokens for different widgets", async () => {
      const now = Date.now();
      const tokens1 = {
        accessToken: "token1",
        expiresAt: now + 10000,
      };
      const tokens2 = {
        accessToken: "token2",
        expiresAt: now + 10000,
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(tokens1))
        .mockResolvedValueOnce(JSON.stringify(tokens2));

      const t1 = await manager.getToken("widget1", "gmail");
      const t2 = await manager.getToken("widget2", "gmail");

      expect(t1).toBe("token1");
      expect(t2).toBe("token2");
    });

    it("should maintain separate tokens for different services", async () => {
      const now = Date.now();
      const gmailTokens = {
        accessToken: "gmail-token",
        expiresAt: now + 10000,
      };
      const calendarTokens = {
        accessToken: "calendar-token",
        expiresAt: now + 10000,
      };

      mockSecrets.get
        .mockResolvedValueOnce(JSON.stringify(gmailTokens))
        .mockResolvedValueOnce(JSON.stringify(calendarTokens));

      const t1 = await manager.getToken("widget1", "gmail");
      const t2 = await manager.getToken("widget1", "calendar");

      expect(t1).toBe("gmail-token");
      expect(t2).toBe("calendar-token");
    });
  });
});
