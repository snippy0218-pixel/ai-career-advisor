// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CANDIDATE_PROFILE_STORAGE_KEY,
  CANDIDATE_PROFILE_STORAGE_VERSION,
  candidateProfileStorageSchema,
  clearProfile,
  getProfileStorageSnapshot,
  invalidateProfileStorageSnapshot,
  loadProfile,
  saveProfile,
  sha256Hex,
  subscribeToProfileStorage,
} from "./candidate-profile-storage";

const validText =
  "教育背景：统计学本科\n技能：日常使用 SQL\n项目经历：课程项目中使用 SQL 分析电商数据\n求职目标：数据分析方向";

function storedJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: CANDIDATE_PROFILE_STORAGE_VERSION,
    updatedAt: "2026-08-16T00:00:00.000Z",
    rawText: validText,
    rawTextSha256: sha256Hex(validText),
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("sha256Hex", () => {
  it("matches the standard empty-string vector", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches the standard abc vector", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the standard two-block vector", () => {
    expect(
      sha256Hex(
        "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("produces stable 64-hex hashes for Chinese text", () => {
    const first = sha256Hex(validText);
    const second = sha256Hex(validText);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(sha256Hex("候选人资料")).not.toBe(first);
  });
});

describe("candidateProfileStorageSchema", () => {
  it("accepts a valid stored profile", () => {
    const result = candidateProfileStorageSchema.safeParse(
      JSON.parse(storedJson()),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(CANDIDATE_PROFILE_STORAGE_VERSION);
      expect(result.data.rawText).toBe(validText);
    }
  });

  it("rejects unknown extra fields (strict)", () => {
    const result = candidateProfileStorageSchema.safeParse(
      JSON.parse(storedJson({ lastAnalysis: { generatedAt: "2026-01-01T00:00:00Z" } })),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a wrong schema version", () => {
    const result = candidateProfileStorageSchema.safeParse(
      JSON.parse(storedJson({ schemaVersion: "candidate-profile-storage-v2" })),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid updatedAt", () => {
    const result = candidateProfileStorageSchema.safeParse(
      JSON.parse(storedJson({ updatedAt: "not-a-date" })),
    );
    expect(result.success).toBe(false);
  });

  it("rejects raw text outside the validated length bounds", () => {
    const short = candidateProfileStorageSchema.safeParse(
      JSON.parse(
        storedJson({ rawText: "太短", rawTextSha256: sha256Hex("太短") }),
      ),
    );
    expect(short.success).toBe(false);

    const long = candidateProfileStorageSchema.safeParse(
      JSON.parse(
        storedJson({
          rawText: "长".repeat(12_001),
          rawTextSha256: sha256Hex("长".repeat(12_001)),
        }),
      ),
    );
    expect(long.success).toBe(false);
  });
});

describe("loadProfile", () => {
  it("returns empty when no profile is stored", () => {
    expect(loadProfile()).toEqual({ status: "empty" });
  });

  it("loads a valid stored profile", () => {
    localStorage.setItem(CANDIDATE_PROFILE_STORAGE_KEY, storedJson());
    const result = loadProfile();
    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.profile.rawText).toBe(validText);
      expect(result.profile.rawTextSha256).toBe(sha256Hex(validText));
    }
  });

  it("returns invalid for corrupt JSON and does not overwrite the key", () => {
    localStorage.setItem(CANDIDATE_PROFILE_STORAGE_KEY, "{not-json");
    expect(loadProfile().status).toBe("invalid");
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).toBe("{not-json");
  });

  it("returns invalid for a tampered sha and does not overwrite the key", () => {
    const tampered = storedJson({ rawTextSha256: "a".repeat(64) });
    localStorage.setItem(CANDIDATE_PROFILE_STORAGE_KEY, tampered);
    expect(loadProfile().status).toBe("invalid");
    expect(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY)).toBe(tampered);
  });

  it("returns invalid for an unknown schema version", () => {
    localStorage.setItem(
      CANDIDATE_PROFILE_STORAGE_KEY,
      storedJson({ schemaVersion: "candidate-profile-storage-v9" }),
    );
    expect(loadProfile().status).toBe("invalid");
  });

  it("returns unavailable when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    expect(loadProfile().status).toBe("unavailable");
  });
});

describe("saveProfile / clearProfile", () => {
  it("saves and reloads the trimmed raw text", () => {
    const result = saveProfile(`  ${validText}  `);
    expect(result.status).toBe("saved");
    const loaded = loadProfile();
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.profile.rawText).toBe(validText);
      expect(loaded.profile.updatedAt).toBe(
        result.status === "saved" ? result.updatedAt : loaded.profile.updatedAt,
      );
    }
  });

  it("rejects text that is too short, too long, or contains control chars", () => {
    expect(saveProfile("太短").status).toBe("invalid");
    expect(saveProfile("长".repeat(12_001)).status).toBe("invalid");
    expect(saveProfile(`${validText}\u0000`).status).toBe("invalid");
  });

  it("returns unavailable when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(saveProfile(validText).status).toBe("unavailable");
  });

  it("clears the stored profile", () => {
    saveProfile(validText);
    expect(loadProfile().status).toBe("loaded");
    expect(clearProfile()).toEqual({ status: "cleared" });
    expect(loadProfile().status).toBe("empty");
  });

  it("returns unavailable when clearing while storage is denied", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    expect(clearProfile().status).toBe("unavailable");
  });
});

describe("profile storage snapshot", () => {
  it("returns a stable reference for unchanged storage", () => {
    saveProfile(validText);
    const first = getProfileStorageSnapshot();
    const second = getProfileStorageSnapshot();
    expect(first).toBe(second);
    expect(first.status).toBe("loaded");
    if (first.status === "loaded") expect(first.rawText).toBe(validText);
  });

  it("reflects clear after invalidation", () => {
    saveProfile(validText);
    expect(getProfileStorageSnapshot().status).toBe("loaded");
    clearProfile();
    invalidateProfileStorageSnapshot();
    expect(getProfileStorageSnapshot().status).toBe("empty");
  });

  it("reports invalid for corrupt storage", () => {
    localStorage.setItem(CANDIDATE_PROFILE_STORAGE_KEY, "{broken");
    invalidateProfileStorageSnapshot();
    expect(getProfileStorageSnapshot().status).toBe("invalid");
  });

  it("subscribes and unsubscribes the storage event", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToProfileStorage(listener);
    window.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    window.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
