import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const { mockEncrypt, mockDecrypt } = vi.hoisted(() => {
  // safeStorage.encryptString returns a Buffer, which gets converted to base64 by the store
  // So our mock should return a buffer that when base64 encoded can be decoded back
  const mockEncrypt = vi.fn((value: string) => {
    // Return a buffer that encodes the value with a prefix so we can decrypt it
    return Buffer.from(`encrypted:${value}`);
  });

  // safeStorage.decryptString takes a buffer and returns a string
  const mockDecrypt = vi.fn((buf: Buffer) => {
    const str = buf.toString("utf-8");
    // Remove the prefix we added in encrypt
    return str.replace(/^encrypted:/, "");
  });

  return { mockEncrypt, mockDecrypt };
});

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: mockEncrypt,
    decryptString: mockDecrypt,
  },
}));

import { SecretsStore } from "./secrets";

let root: string;
let store: SecretsStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cc-secrets-"));
  vi.clearAllMocks();
  store = new SecretsStore(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("SecretsStore", () => {
  describe("set / get", () => {
    it("should store and retrieve a secret", async () => {
      await store.set("widget1", "apiKey", "secret-value");
      const value = await store.get("widget1", "apiKey");
      expect(value).toBe("secret-value");
    });

    it("should encrypt values using safeStorage", async () => {
      await store.set("widget1", "password", "my-password");

      // Should have used the mock encrypt function
      expect(mockEncrypt).toHaveBeenCalledWith("my-password");

      // Verify decryption works on retrieval
      const value = await store.get("widget1", "password");
      expect(value).toBe("my-password");
    });

    it("should return null for missing key", async () => {
      const value = await store.get("widget1", "missing");
      expect(value).toBeNull();
    });

    it("should return null for corrupted encrypted value", async () => {
      // Set a valid secret first
      await store.set("widget1", "valid", "works");

      // Mock decrypt to throw, simulating corrupted data
      mockDecrypt.mockImplementationOnce(() => {
        throw new Error("Decrypt failed");
      });

      // Clear cache to force reload
      const store2 = new SecretsStore(root);
      const value = await store2.get("widget1", "valid");
      expect(value).toBeNull();
    });

    it("should handle missing widget file gracefully", async () => {
      const value = await store.get("nonexistent-widget", "key");
      expect(value).toBeNull();
    });
  });

  describe("del", () => {
    it("should delete a key", async () => {
      await store.set("widget1", "key", "value");
      await store.del("widget1", "key");
      const value = await store.get("widget1", "key");
      expect(value).toBeNull();
    });

    it("should be idempotent for missing keys", async () => {
      await expect(
        store.del("widget1", "nonexistent")
      ).resolves.toBeUndefined();
    });

    it("should persist deletion to disk after debounce", async () => {
      await store.set("widget1", "key1", "value1");
      await store.del("widget1", "key1");

      // Wait for debounce (200ms)
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Create new store instance to verify persistence
      const store2 = new SecretsStore(root);
      const value = await store2.get("widget1", "key1");
      expect(value).toBeNull();
    });
  });

  describe("has", () => {
    it("should return true if key exists", async () => {
      await store.set("widget1", "key", "value");
      const has = await store.has("widget1", "key");
      expect(has).toBe(true);
    });

    it("should return false if key does not exist", async () => {
      const has = await store.has("widget1", "missing");
      expect(has).toBe(false);
    });

    it("should return false for missing widget file", async () => {
      const has = await store.has("nonexistent-widget", "key");
      expect(has).toBe(false);
    });
  });


  describe("widget ID validation", () => {
    it("should reject invalid widget IDs", async () => {
      // Widget IDs must be lowercase alphanumeric with hyphens
      await expect(store.set("Invalid-ID", "key", "value")).rejects.toThrow();
      await expect(store.get("UPPERCASE", "key")).rejects.toThrow();
      await expect(store.set("has spaces", "key", "value")).rejects.toThrow();
    });

    it("should accept valid widget IDs", async () => {
      await expect(
        store.set("valid-widget-id", "key", "value")
      ).resolves.toBeUndefined();
    });
  });


  describe("encryption methods", () => {
    it("should use safeStorage.encryptString when storing", async () => {
      await store.set("widget1", "secret", "sensitive-data");

      // Verify encryption was used
      expect(mockEncrypt).toHaveBeenCalledWith("sensitive-data");
    });

    it("should use safeStorage.decryptString when retrieving", async () => {
      await store.set("widget1", "key", "value");
      mockDecrypt.mockClear();

      await store.get("widget1", "key");

      expect(mockDecrypt).toHaveBeenCalled();
    });

    it("should successfully store and retrieve encrypted values", async () => {
      const secret = "my-secret-password";
      await store.set("widget1", "password", secret);

      // Should use the mock encrypt
      expect(mockEncrypt).toHaveBeenCalledWith(secret);

      // Should be able to retrieve it
      const retrieved = await store.get("widget1", "password");
      expect(retrieved).toBe(secret);
    });
  });

  describe("error handling", () => {
    it("should handle non-object values in secrets file", async () => {
      const filePath = path.join(root, "secrets");
      await fs.mkdir(filePath, { recursive: true });
      await fs.writeFile(path.join(filePath, "widget1.json"), '["array", "instead", "of", "object"]');

      const store2 = new SecretsStore(root);
      const value = await store2.get("widget1", "key");
      expect(value).toBeNull();
    });

    it("should handle null values in secrets file", async () => {
      const filePath = path.join(root, "secrets");
      await fs.mkdir(filePath, { recursive: true });
      await fs.writeFile(path.join(filePath, "widget1.json"), 'null');

      const store2 = new SecretsStore(root);
      const value = await store2.get("widget1", "key");
      expect(value).toBeNull();
    });
  });

  describe("key naming", () => {
    it("should support colons and double-colons in key names", async () => {
      // Keys with instance prefixes like "instance1::key" are valid
      const key = "instance1::config";
      await store.set("widget1", key, "data");

      const value = await store.get("widget1", key);
      expect(value).toBe("data");
    });

    it("should treat different key names as different secrets", async () => {
      await store.set("widget1", "key1", "value1");
      await store.set("widget1", "key2", "value2");

      const v1 = await store.get("widget1", "key1");
      const v2 = await store.get("widget1", "key2");

      expect(v1).toBe("value1");
      expect(v2).toBe("value2");
    });
  });
});
