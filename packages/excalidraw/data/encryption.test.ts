import { webcrypto } from "node:crypto";

import {
  IV_LENGTH_BYTES,
  createIV,
  decryptData,
  encryptData,
  generateEncryptionKey,
  getCryptoKey,
} from "./encryption";

/**
 * jsdom doesn't implement `crypto.subtle`, so we substitute node's
 * implementation of the Web Crypto API.
 *
 * @returns a cleanup function restoring the original `crypto` global
 */
const setupWebCrypto = () => {
  const originalCrypto = globalThis.crypto;
  const needsPolyfill = !globalThis.crypto?.subtle;

  if (needsPolyfill) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: webcrypto,
    });
    Object.defineProperty(window, "crypto", {
      configurable: true,
      writable: true,
      value: webcrypto,
    });
  }

  return () => {
    if (needsPolyfill) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        writable: true,
        value: originalCrypto,
      });
      Object.defineProperty(window, "crypto", {
        configurable: true,
        writable: true,
        value: originalCrypto,
      });
    }
  };
};

describe("encryption", () => {
  let restoreWebCrypto: () => void;

  beforeAll(() => {
    restoreWebCrypto = setupWebCrypto();
    expect(window.crypto.subtle).toBeTruthy();
    expect(typeof TextEncoder).toBe("function");
    expect(typeof TextDecoder).toBe("function");
  });

  afterAll(() => {
    restoreWebCrypto();
  });

  describe("generateEncryptionKey", () => {
    it("should return a JWK-style base64url string by default", async () => {
      const key = await generateEncryptionKey();

      expect(typeof key).toBe("string");
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
      // 128-bit key encoded as unpadded base64url
      expect(key).toHaveLength(22);
      expect(await generateEncryptionKey()).not.toBe(key);
    });

    it("should return a CryptoKey when asked for one", async () => {
      const key = await generateEncryptionKey("cryptoKey");

      expect(typeof key).toBe("object");
      expect(key.constructor.name).toBe("CryptoKey");
      expect(key.type).toBe("secret");
      expect(key.algorithm).toEqual({ name: "AES-GCM", length: 128 });
      expect(key.usages).toEqual(
        expect.arrayContaining(["encrypt", "decrypt"]),
      );
    });
  });

  describe("createIV", () => {
    it("should return a random Uint8Array of IV_LENGTH_BYTES", () => {
      const iv = createIV();

      expect(iv).toBeInstanceOf(Uint8Array);
      expect(IV_LENGTH_BYTES).toBe(12);
      expect(iv).toHaveLength(IV_LENGTH_BYTES);
      expect([...createIV()]).not.toEqual([...iv]);
    });
  });

  describe("encryptData/decryptData", () => {
    it("should round-trip a utf-8 string", async () => {
      const key = await generateEncryptionKey();
      const data = "Hello, Excalidraw! — ěščřž 🎉 日本語";

      const { encryptedBuffer, iv } = await encryptData(key, data);

      expect(iv).toHaveLength(IV_LENGTH_BYTES);
      expect(new Uint8Array(encryptedBuffer)).not.toEqual(
        new TextEncoder().encode(data),
      );

      const decrypted = await decryptData(iv, encryptedBuffer, key);

      expect(new TextDecoder().decode(decrypted)).toBe(data);
    });

    it("should round-trip a Uint8Array", async () => {
      const key = await generateEncryptionKey();
      const data = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);

      const { encryptedBuffer, iv } = await encryptData(key, data);
      const decrypted = await decryptData(iv, encryptedBuffer, key);

      expect(new Uint8Array(decrypted)).toEqual(data);
    });

    it("should round-trip an ArrayBuffer", async () => {
      const key = await generateEncryptionKey();
      const source = new Uint8Array([10, 20, 30, 40]);

      const { encryptedBuffer, iv } = await encryptData(key, source.buffer);
      const decrypted = await decryptData(iv, encryptedBuffer, key);

      expect(new Uint8Array(decrypted)).toEqual(source);
    });

    it("should decrypt from a Uint8Array view of the ciphertext", async () => {
      const key = await generateEncryptionKey();
      const data = "ciphertext as Uint8Array";

      const { encryptedBuffer, iv } = await encryptData(key, data);
      const decrypted = await decryptData(
        iv,
        new Uint8Array(encryptedBuffer),
        key,
      );

      expect(new TextDecoder().decode(decrypted)).toBe(data);
    });

    it("should accept a pre-imported CryptoKey", async () => {
      const stringKey = await generateEncryptionKey();
      const cryptoKey = await getCryptoKey(stringKey, "encrypt");
      const data = "encrypted with an imported CryptoKey";

      const { encryptedBuffer, iv } = await encryptData(cryptoKey, data);
      const decrypted = await decryptData(iv, encryptedBuffer, stringKey);

      expect(new TextDecoder().decode(decrypted)).toBe(data);
    });

    it("should accept a generated CryptoKey and decrypt with its exported string", async () => {
      const cryptoKey = await generateEncryptionKey("cryptoKey");
      const stringKey = (await window.crypto.subtle.exportKey("jwk", cryptoKey))
        .k!;
      const data = "encrypted with a generated CryptoKey";

      const { encryptedBuffer, iv } = await encryptData(cryptoKey, data);
      const decrypted = await decryptData(iv, encryptedBuffer, stringKey);

      expect(new TextDecoder().decode(decrypted)).toBe(data);
    });

    it("should reject decryption with a different key", async () => {
      const key = await generateEncryptionKey();
      const otherKey = await generateEncryptionKey();

      const { encryptedBuffer, iv } = await encryptData(key, "secret");

      await expect(
        decryptData(iv, encryptedBuffer, otherKey),
      ).rejects.toThrow();
    });

    it("should reject decryption of tampered ciphertext", async () => {
      const key = await generateEncryptionKey();

      const { encryptedBuffer, iv } = await encryptData(key, "secret");

      const tampered = new Uint8Array(encryptedBuffer);
      tampered[0] ^= 0xff;

      await expect(decryptData(iv, tampered, key)).rejects.toThrow();
    });

    it("should reject decryption with a tampered iv", async () => {
      const key = await generateEncryptionKey();

      const { encryptedBuffer, iv } = await encryptData(key, "secret");

      const tamperedIV = new Uint8Array(iv);
      tamperedIV[0] ^= 0xff;

      await expect(
        decryptData(tamperedIV, encryptedBuffer, key),
      ).rejects.toThrow();
    });
  });
});
