import { describe, expect, it } from "vitest";
import {
  normalizeNameForComparison,
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  stripDiacritics,
  findDiacriticStrippedMatch,
  duplicateWarningMessage,
} from "./duplicate-name-guard";

// Batch 1, item A, section A5: one test per normalisation step, each one
// failing if that specific step is removed from normalizeNameForComparison
// -- not a single test asserting the whole pipeline, which could stay green
// while any one step silently regresses.
describe("normalizeNameForComparison -- one assertion per step (section A5)", () => {
  const canonical = "Sữa yến mạch";

  it("trims a leading space", () => {
    expect(normalizeNameForComparison(" Sữa yến mạch")).toBe(normalizeNameForComparison(canonical));
  });

  it("trims a trailing space", () => {
    expect(normalizeNameForComparison("Sữa yến mạch ")).toBe(normalizeNameForComparison(canonical));
  });

  it("collapses a run of internal whitespace to one space", () => {
    expect(normalizeNameForComparison("Sữa  yến mạch")).toBe(normalizeNameForComparison(canonical));
  });

  it("case-folds", () => {
    expect(normalizeNameForComparison("SỮA YẾN MẠCH")).toBe(normalizeNameForComparison(canonical));
  });

  it("treats a leading non-breaking space as an ordinary (trimmable) space", () => {
    // Deliberately a LEADING nbsp, not an internal one: JS's own \s class
    // already includes a non-breaking space, so an internal one gets
    // cleaned up for free by the later whitespace-collapse step regardless
    // of whether the dedicated nbsp step ran. A leading one only gets
    // trimmed away if the nbsp-to-space conversion runs BEFORE the trim
    // step, same order as the SQL expression -- the case that actually
    // exercises the step this test is named for.
    const withLeadingNbsp = String.fromCharCode(160) + "Sữa yến mạch";
    expect(normalizeNameForComparison(withLeadingNbsp)).toBe(normalizeNameForComparison(canonical));
  });

  it("normalises Unicode composition -- ế typed decomposed compares equal to ế typed precomposed", () => {
    // Derived via .normalize("NFD") rather than hand-typed combining marks,
    // so the decomposed form is exactly whatever this JS engine's Unicode
    // tables say it is -- not a transcription guess.
    const decomposed = canonical.normalize("NFD");
    expect(decomposed).not.toBe(canonical); // sanity: the two forms really are different strings
    expect(normalizeNameForComparison(decomposed)).toBe(normalizeNameForComparison(canonical));
  });

  it("does NOT strip diacritics -- 'cà' and 'ca' stay different (section 9.2, both are real words)", () => {
    expect(normalizeNameForComparison("cà")).not.toBe(normalizeNameForComparison("ca"));
  });
});

describe("findDuplicateActiveName", () => {
  const rows = [
    { id: "A-1", name: "Sữa yến mạch", status: "ACTIVE" },
    { id: "A-2", name: "Sữa yến mạch cũ", status: "INACTIVE" },
    { id: "A-3", name: "Đường trắng", status: "ACTIVE" },
  ];

  it("finds an ACTIVE row whose name normalises the same, even with different casing/spacing", () => {
    const conflict = findDuplicateActiveName(rows, "  SỮA  YẾN MẠCH  ");
    expect(conflict?.id).toBe("A-1");
  });

  it("ignores an INACTIVE row with a colliding name -- retirement makes a name reusable (section A4)", () => {
    const conflict = findDuplicateActiveName(rows, "Đường trắng khác"); // not actually colliding, control
    expect(conflict).toBeNull();
  });

  it("excludes the row's own id -- editing a row without changing its name is not a self-collision", () => {
    const conflict = findDuplicateActiveName(rows, "Sữa yến mạch", "A-1");
    expect(conflict).toBeNull();
  });

  it("returns null when nothing collides", () => {
    expect(findDuplicateActiveName(rows, "Cà phê hạt")).toBeNull();
  });
});

describe("duplicateNameErrorMessage", () => {
  it("names the row and its id, in Vietnamese", () => {
    const message = duplicateNameErrorMessage({ id: "ING-033", name: "Sữa yến mạch" });
    expect(message).toContain("Sữa yến mạch");
    expect(message).toContain("ING-033");
    expect(message).toContain("Tên này đã có rồi");
  });
});

// Section A3b, owner decision 2026-08-19: level 2 warns on a
// diacritic-stripped-only match. đ/Đ (U+0111/U+0110) do not decompose
// under NFD -- verified directly against this JS engine before writing
// stripDiacritics (đ.normalize("NFD") stays one codepoint, unlike á which
// splits into a + combining acute) -- so they need the explicit
// replacement tested here on its own, separately from the ordinary
// NFD-decomposable diacritics.
describe("stripDiacritics", () => {
  it("strips an ordinary NFD-decomposable diacritic (cà -> ca)", () => {
    expect(stripDiacritics("cà")).toBe("ca");
  });

  it("strips đ specifically -- the case an NFD-only strip would miss (section A5)", () => {
    expect(stripDiacritics("đá")).toBe("da");
  });

  it("strips Đ (uppercase) specifically, case preserved -- this function alone does not fold case", () => {
    expect(stripDiacritics("Đá viên")).toBe("Da vien");
  });

  it("Da vien and stripDiacritics(normalizeNameForComparison('Đá viên')) match -- the exact section A5 case", () => {
    expect(stripDiacritics(normalizeNameForComparison("Da vien"))).toBe(
      stripDiacritics(normalizeNameForComparison("Đá viên")),
    );
  });

  it("collapses Dứa and Dừa to the same stripped form -- the measured cost that rules out a blanket strip (section A3b)", () => {
    expect(stripDiacritics("dứa")).toBe(stripDiacritics("dừa"));
  });
});

describe("findDiacriticStrippedMatch (section A3b, level 2)", () => {
  const rows = [
    { id: "ING-050", name: "Cà phê", status: "ACTIVE" },
    { id: "NNL-009", name: "Thạch dừa", status: "ACTIVE" },
    { id: "ING-001", name: "Đá viên", status: "ACTIVE" },
    { id: "ING-060", name: "Cam sành", status: "INACTIVE" },
  ];

  it("'Ca phe' warns against 'Cà phê'", () => {
    const warning = findDiacriticStrippedMatch(rows, "Ca phe");
    expect(warning?.conflict.id).toBe("ING-050");
  });

  it("'Da vien' warns against 'Đá viên' -- the đ case named explicitly in section A5", () => {
    const warning = findDiacriticStrippedMatch(rows, "Da vien");
    expect(warning?.conflict.id).toBe("ING-001");
  });

  it("'Thạch dứa' warns against 'Thạch dừa' (NNL-009) -- proves this stays a warning, not a silent refusal", () => {
    const warning = findDiacriticStrippedMatch(rows, "Thạch dứa");
    expect(warning?.conflict.id).toBe("NNL-009");
  });

  it("an exact match (level 1's territory) is never also reported as a level-2 warning", () => {
    const warning = findDiacriticStrippedMatch(rows, "cà phê"); // identical after normalisation to ING-050
    expect(warning).toBeNull();
  });

  it("ignores an INACTIVE row", () => {
    const warning = findDiacriticStrippedMatch(rows, "Cam sanh");
    expect(warning).toBeNull();
  });

  it("excludes the row's own id", () => {
    const warning = findDiacriticStrippedMatch(rows, "Ca phe", "ING-050");
    expect(warning).toBeNull();
  });

  it("returns null when nothing collides, even loosely", () => {
    expect(findDiacriticStrippedMatch(rows, "Trân châu")).toBeNull();
  });
});

describe("duplicateWarningMessage", () => {
  it("asks whether the near-match is a different item, naming the row", () => {
    const message = duplicateWarningMessage({ id: "NNL-009", name: "Thạch dừa" });
    expect(message).toContain("Thạch dừa");
    expect(message).toContain("NNL-009");
    expect(message).toContain("khác");
  });
});
