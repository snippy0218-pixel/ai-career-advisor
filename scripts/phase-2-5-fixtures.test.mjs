import { describe, expect, it } from "vitest";

import {
  buildPhase25FixtureManifest,
  loadPhase1Fixtures,
  PHASE2_FIXTURES,
  PHASE2_REQUIRED_COVERAGE,
  sha256,
} from "./phase-2-5-fixtures.mjs";

describe("Phase 2.5 frozen fixtures", () => {
  it("recovers every Phase 1 accepted input at its exact historic hash", () => {
    const fixtures = loadPhase1Fixtures();
    expect(fixtures).toHaveLength(10);
    expect(fixtures.map((item) => item.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `TC-${String(index + 1).padStart(2, "0")}`),
    );
    for (const fixture of fixtures) {
      expect(fixture.jdText).toHaveLength(fixture.expectedCharacters);
      expect(sha256(fixture.jdText)).toBe(fixture.expectedSha256);
    }
  });

  it("freezes 14 unique Phase 2 raw JD/Profile pairs with complete coverage", () => {
    expect(PHASE2_FIXTURES).toHaveLength(14);
    expect(new Set(PHASE2_FIXTURES.map((item) => item.id)).size).toBe(14);
    expect(
      new Set(
        PHASE2_FIXTURES.map(
          (item) => `${item.input.jdSha256}:${item.input.profileSha256}`,
        ),
      ).size,
    ).toBe(14);

    const coverage = new Set(PHASE2_FIXTURES.flatMap((item) => item.coverage));
    for (const requirement of PHASE2_REQUIRED_COVERAGE) {
      expect(coverage, `missing ${requirement}`).toContain(requirement);
    }
    for (const fixture of PHASE2_FIXTURES) {
      expect(fixture.jdText.length).toBeGreaterThanOrEqual(100);
      expect(fixture.jdText.length).toBeLessThanOrEqual(12_000);
      expect(fixture.profileText.length).toBeGreaterThanOrEqual(20);
      expect(fixture.profileText.length).toBeLessThanOrEqual(12_000);
      expect(fixture.input.jdSha256).toBe(sha256(fixture.jdText));
      expect(fixture.input.profileSha256).toBe(sha256(fixture.profileText));
      expect(fixture.rationale.length).toBeGreaterThan(20);
    }
  });

  it("produces a stable manifest identity", () => {
    const first = buildPhase25FixtureManifest();
    const second = buildPhase25FixtureManifest();
    expect(first.schemaVersion).toBe("phase-2-5-fixtures-v1");
    expect(first.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second.manifestSha256).toBe(first.manifestSha256);
  });
});
