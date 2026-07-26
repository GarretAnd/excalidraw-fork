import { webcrypto } from "node:crypto";

import { compressData, decompressData, encode, decode } from "./encode";
import { generateEncryptionKey } from "./encryption";

let originalCrypto: Crypto | undefined;
let cryptoOverridden = false;

beforeAll(() => {
  if (typeof TextEncoder === "undefined") {
    (globalThis as any).TextEncoder = require("util").TextEncoder;
  }
  if (typeof TextDecoder === "undefined") {
    (globalThis as any).TextDecoder = require("util").TextDecoder;
  }

  // jsdom does not expose a real `window.crypto.subtle`, so swap in Node's
  // real Web Crypto implementation for the duration of these tests.
  if (!window.crypto?.subtle) {
    originalCrypto = window.crypto;
    cryptoOverridden = true;
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
});

afterAll(() => {
  if (cryptoOverridden) {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  }
});

describe("compressData / decompressData", () => {
  it("round-trips data together with metadata", async () => {
    const encryptionKey = await generateEncryptionKey();
    const payload = "Hello, Excalidraw! 日本語 🎨";
    const dataBuffer = new TextEncoder().encode(payload);
    const metadata = {
      name: "scene.excalidraw",
      elements: 3,
      nested: { a: 1 },
    };

    const compressed = await compressData(dataBuffer, {
      encryptionKey,
      metadata,
    });

    expect(compressed).toBeInstanceOf(Uint8Array);

    const result = await decompressData(compressed, {
      decryptionKey: encryptionKey,
    });

    expect(result.metadata).toEqual(metadata);
    expect(new TextDecoder().decode(result.data)).toBe(payload);
  });

  it("round-trips binary data", async () => {
    const encryptionKey = await generateEncryptionKey();
    const dataBuffer = new Uint8Array([
      0, 1, 2, 3, 250, 251, 252, 253, 254, 255,
    ]);
    const metadata = { kind: "binary" };

    const compressed = await compressData(dataBuffer, {
      encryptionKey,
      metadata,
    });

    const result = await decompressData(compressed, {
      decryptionKey: encryptionKey,
    });

    expect(result.metadata).toEqual(metadata);
    expect(Array.from(result.data)).toEqual(Array.from(dataBuffer));
  });

  it("defaults metadata to null when not provided", async () => {
    const encryptionKey = await generateEncryptionKey();
    const payload = "no metadata here";
    const dataBuffer = new TextEncoder().encode(payload);

    const compressed = await compressData(dataBuffer, { encryptionKey });

    const result = await decompressData(compressed, {
      decryptionKey: encryptionKey,
    });

    expect(result.metadata).toBeNull();
    expect(new TextDecoder().decode(result.data)).toBe(payload);
  });

  it("fails to decompress with a wrong decryption key", async () => {
    const encryptionKey = await generateEncryptionKey();
    const wrongKey = await generateEncryptionKey();
    const dataBuffer = new TextEncoder().encode("secret contents");

    const compressed = await compressData(dataBuffer, {
      encryptionKey,
      metadata: { secret: true },
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      decompressData(compressed, { decryptionKey: wrongKey }),
    ).rejects.toBeDefined();

    consoleErrorSpy.mockRestore();
  });
});

describe("encode / decode", () => {
  it("round-trips text with compression enabled (default)", () => {
    const text = "The quick brown fox jumps over the lazy dog. 日本語 🎨";

    const encoded = encode({ text });

    expect(encoded.encoding).toBe("bstring");
    expect(encoded.compressed).toBe(true);
    expect(decode(encoded)).toBe(text);
  });

  it("round-trips text with compression disabled", () => {
    const text = "The quick brown fox jumps over the lazy dog. 日本語 🎨";

    const encoded = encode({ text, compress: false });

    expect(encoded.encoding).toBe("bstring");
    expect(encoded.compressed).toBe(false);
    expect(decode(encoded)).toBe(text);
  });
});
