import { describe, expect, test } from "bun:test";
import {
  contrast,
  countWords,
  excerptOf,
  formatCount,
  formatLongDate,
  granularityOf,
  isIsoDate,
  isOwnedMediaKey,
  mediaKeyFor,
  parseMediaKey,
  periodKeyFor,
  periodLabel,
  periodRange,
  periodRangeLabel,
  periodSpanLabel,
  SPINE_INK_DARK,
  SPINE_INK_LIGHT,
  SPINE_PALETTE,
  shiftPeriodKey,
  spineFaceFor,
  spineFoilFor,
  spineHeight,
  spineInkFor,
  spineThickness,
} from "./shared.ts";

describe("period keys", () => {
  test("year and month keys are prefixes of the date", () => {
    expect(periodKeyFor("2026-09-17", "year")).toBe("2026");
    expect(periodKeyFor("2026-09-17", "month")).toBe("2026-09");
  });

  test("week keys use ISO weeks, which do not follow the calendar year", () => {
    // 2026 starts on a Thursday, so 1 Jan is in ISO week 1 of 2026 ...
    expect(periodKeyFor("2026-01-01", "week")).toBe("2026-W01");
    // ... and the Monday before it belongs to the same week.
    expect(periodKeyFor("2025-12-29", "week")).toBe("2026-W01");
    // 2021 starts on a Friday, so 1-3 Jan belong to week 53 of 2020.
    expect(periodKeyFor("2021-01-01", "week")).toBe("2020-W53");
    expect(periodKeyFor("2021-01-04", "week")).toBe("2021-W01");
    // 2027 starts on a Friday: same shape.
    expect(periodKeyFor("2027-01-02", "week")).toBe("2026-W53");
    expect(periodKeyFor("2026-09-17", "week")).toBe("2026-W38");
  });

  test("periodSpanLabel names the stretch of a year standing on one plank", () => {
    expect(periodSpanLabel("2026-01", "2026-06")).toBe("Jan – Jun");
    expect(periodSpanLabel("2026-W01", "2026-W26")).toBe("W1 – W26");
    expect(periodSpanLabel("2019", "2026")).toBe("2019 – 2026");
    expect(periodSpanLabel("2026-03", "2026-03")).toBe("Mar");
  });

  test("periodRange inverts periodKeyFor at the boundaries", () => {
    expect(periodRange("2026")).toEqual({
      end: "2026-12-31",
      start: "2026-01-01",
    });
    expect(periodRange("2026-02")).toEqual({
      end: "2026-02-28",
      start: "2026-02-01",
    });
    expect(periodRange("2028-02")).toEqual({
      end: "2028-02-29",
      start: "2028-02-01",
    });
    expect(periodRange("2026-W01")).toEqual({
      end: "2026-01-04",
      start: "2025-12-29",
    });
    expect(periodRange("2020-W53")).toEqual({
      end: "2021-01-03",
      start: "2020-12-28",
    });
    expect(periodRange("2026-W38")).toEqual({
      end: "2026-09-20",
      start: "2026-09-14",
    });
  });

  test("every day of a range maps back to the same key", () => {
    for (const key of ["2026-W01", "2020-W53", "2026-W38", "2026-02", "2026"]) {
      const { start, end } = periodRange(key);
      const granularity = granularityOf(key);
      expect(periodKeyFor(start, granularity)).toBe(key);
      expect(periodKeyFor(end, granularity)).toBe(key);
    }
  });

  test("granularityOf rejects things that are not keys", () => {
    expect(granularityOf("2026-W38")).toBe("week");
    expect(() => granularityOf("2026-13")).toThrow();
    expect(() => granularityOf("2026-W54")).toThrow();
    expect(() => granularityOf("hello")).toThrow();
  });

  test("shiftPeriodKey walks across year ends", () => {
    expect(shiftPeriodKey("2026", 1)).toBe("2027");
    expect(shiftPeriodKey("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriodKey("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriodKey("2026-W01", -1)).toBe("2025-W52");
    expect(shiftPeriodKey("2020-W53", 1)).toBe("2021-W01");
  });

  test("labels read like a person wrote them", () => {
    expect(periodLabel("2026")).toBe("2026");
    expect(periodLabel("2026-09")).toBe("September 2026");
    expect(periodLabel("2026-W38")).toBe("Week 38, 2026");
    expect(periodRangeLabel("2026-W38")).toBe("14–20 September 2026");
    expect(periodRangeLabel("2026-W40")).toBe("28 September–4 October 2026");
    expect(periodRangeLabel("2026-W01")).toBe(
      "29 December 2025–4 January 2026"
    );
    expect(formatLongDate("2025-12-30")).toBe("Tuesday, 30 December 2025");
  });

  test("isIsoDate rejects days that do not exist", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-9-1")).toBe(false);
    expect(isIsoDate(20_260_917)).toBe(false);
  });
});

describe("spines", () => {
  test("thickness grows with the square root and caps", () => {
    expect(spineThickness(0)).toBe(36);
    expect(spineThickness(1)).toBe(43);
    expect(spineThickness(100)).toBe(96);
    expect(spineThickness(1000)).toBe(96);
  });

  test("height is deterministic per volume and varies between volumes", () => {
    expect(spineHeight("2026-09")).toBe(spineHeight("2026-09"));
    const heights = new Set(
      ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map(
        spineHeight
      )
    );
    expect(heights.size).toBeGreaterThan(1);
  });

  test("every cloth colour clears 4.5:1 under the ink chosen for it", () => {
    for (const hex of SPINE_PALETTE) {
      expect(contrast(hex, spineInkFor(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("pale cloth is stamped in dark ink, dark cloth in cream", () => {
    expect(spineInkFor("#f1e6c8")).toBe(SPINE_INK_DARK);
    expect(spineInkFor("#3f5b52")).toBe(SPINE_INK_LIGHT);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  test("foil follows the cloth: gold where it reads, black or pewter between", () => {
    expect(spineFoilFor("#4a4a6a")).toBe("light");
    expect(spineFoilFor("#e8d5a8")).toBe("dark");
    // Mustard would take dark ink, so its stamp is black; a grey-blue
    // would take pale ink, so its stamp is pewter.
    expect(spineFoilFor("#c9973a")).toBe("black");
    expect(spineInkFor("#c9973a")).toBe(SPINE_INK_DARK);
    expect(spineFoilFor("#6f7f8e")).toBe("silver");
    expect(spineInkFor("#6f7f8e")).toBe(SPINE_INK_LIGHT);
    for (const hex of SPINE_PALETTE) {
      expect(["dark", "light"]).toContain(spineFoilFor(hex));
    }
  });

  test("the face splits a period into a short title and a foot", () => {
    expect(
      spineFaceFor({ named: false, periodKey: "2023-09", title: "" })
    ).toEqual({ foot: "2023", title: "September" });
    expect(
      spineFaceFor({ named: false, periodKey: "2026-W38", title: "" })
    ).toEqual({ foot: "2026", title: "Week 38" });
    expect(
      spineFaceFor({ named: false, periodKey: "2024", title: "" })
    ).toEqual({ foot: null, title: "2024" });
    expect(
      spineFaceFor({ named: true, periodKey: "2026-W02", title: "Snow" })
    ).toEqual({ foot: "W2 2026", title: "Snow" });
  });
});

describe("media keys", () => {
  test("keys carry the owner and the page", () => {
    const key = mediaKeyFor("user_1", "abc", "video/mp4", "uuid");
    expect(key).toBe("users/user_1/abc/uuid.mp4");
    expect(parseMediaKey(key)).toEqual({
      entryId: "abc",
      file: "uuid.mp4",
      userId: "user_1",
    });
  });

  test("ownership is decided by the user prefix alone", () => {
    const mine = mediaKeyFor("user_1", "abc", "image/png", "uuid");
    expect(isOwnedMediaKey(mine, "user_1")).toBe(true);
    expect(isOwnedMediaKey(mine, "user_2")).toBe(false);
    expect(isOwnedMediaKey(mine, null)).toBe(false);
    // A user id that happens to be a prefix of another must not match.
    expect(isOwnedMediaKey(mine, "user_")).toBe(false);
    expect(isOwnedMediaKey("users/user_10/abc/x.png", "user_1")).toBe(false);
    // Nothing outside the users/ tree, and no path games.
    expect(isOwnedMediaKey("other/user_1/abc/x.png", "user_1")).toBe(false);
    expect(isOwnedMediaKey("users/user_1/../user_2/x.png", "user_1")).toBe(
      false
    );
    expect(isOwnedMediaKey("users/user_1//x.png", "user_1")).toBe(false);
    expect(isOwnedMediaKey("users//abc/x.png", "")).toBe(false);
  });
});

describe("text", () => {
  test("countWords ignores markdown punctuation", () => {
    expect(countWords("# A *quiet* day\n\n- one\n- two")).toBe(5);
    expect(countWords("")).toBe(0);
    expect(countWords("don't stop-me")).toBe(2);
  });

  test("excerptOf strips markdown and cuts on a word", () => {
    expect(excerptOf("## Morning\n\nWalked the **river** path.")).toBe(
      "Morning Walked the river path."
    );
    expect(excerptOf("one two three four", 9)).toBe("one two…");
  });

  test("formatCount groups thousands without a locale", () => {
    expect(formatCount(9271)).toBe("9,271");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });
});
