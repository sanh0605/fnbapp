import { describe, expect, it } from "vitest";
import { appendEntry, emptyFeedbackFile, parseFeedback, removeEntry, serializeFeedback } from "./ui-feedback-store";

const ENTRY_WITH_ELEMENT = {
  id: "abc123",
  createdAt: "2026-08-26T10:00:00.000Z",
  route: "/pos",
  viewportWidth: 390,
  selector: "div > section:nth-of-type(2) > button",
  className: "bg-primary text-white rounded-button",
  textSnippet: "TIỀN MẶT",
  sourceFile: "components/pos/CartPanel.tsx",
  sourceLine: 508,
  sourceColumn: 7,
  note: "Nút này bị che một phần trên iPhone SE.",
};

const GENERAL_COMMENT = {
  id: "def456",
  createdAt: "2026-08-26T11:00:00.000Z",
  route: "/admin/outlets",
  viewportWidth: 1440,
  selector: null,
  className: null,
  textSnippet: null,
  sourceFile: null,
  sourceLine: null,
  sourceColumn: null,
  note: "Trang này nói chung ổn, không có gì cụ thể.",
};

describe("serializeFeedback / parseFeedback round-trip", () => {
  it("round-trips a single entry with an attached element", () => {
    const content = serializeFeedback([ENTRY_WITH_ELEMENT]);
    const parsed = parseFeedback(content);
    expect(parsed).toEqual([ENTRY_WITH_ELEMENT]);
  });

  it("round-trips a general comment with no element attached", () => {
    const content = serializeFeedback([GENERAL_COMMENT]);
    const parsed = parseFeedback(content);
    expect(parsed).toEqual([GENERAL_COMMENT]);
  });

  it("round-trips multiple entries in the order given (newest last)", () => {
    const content = serializeFeedback([ENTRY_WITH_ELEMENT, GENERAL_COMMENT]);
    const parsed = parseFeedback(content);
    expect(parsed.map(e => e.id)).toEqual(["abc123", "def456"]);
  });

  it("round-trips a multi-line note", () => {
    const entry = { ...GENERAL_COMMENT, note: "Dòng một.\nDòng hai.\nDòng ba." };
    const parsed = parseFeedback(serializeFeedback([entry]));
    expect(parsed[0].note).toBe("Dòng một.\nDòng hai.\nDòng ba.");
  });

  it("parses an empty file as no entries", () => {
    expect(parseFeedback(emptyFeedbackFile())).toEqual([]);
  });

  it("tolerates CRLF line endings", () => {
    const content = serializeFeedback([ENTRY_WITH_ELEMENT]).replace(/\n/g, "\r\n");
    expect(parseFeedback(content)).toEqual([ENTRY_WITH_ELEMENT]);
  });
});

describe("appendEntry", () => {
  it("adds to an empty file", () => {
    const content = appendEntry(emptyFeedbackFile(), ENTRY_WITH_ELEMENT);
    expect(parseFeedback(content)).toEqual([ENTRY_WITH_ELEMENT]);
  });

  it("adds after existing entries without disturbing them", () => {
    const withFirst = appendEntry(emptyFeedbackFile(), ENTRY_WITH_ELEMENT);
    const withBoth = appendEntry(withFirst, GENERAL_COMMENT);
    expect(parseFeedback(withBoth)).toEqual([ENTRY_WITH_ELEMENT, GENERAL_COMMENT]);
  });
});

describe("removeEntry", () => {
  it("empties the queue only for the entry removed, not its neighbours", () => {
    const both = serializeFeedback([ENTRY_WITH_ELEMENT, GENERAL_COMMENT]);
    const afterRemoval = removeEntry(both, "abc123");
    expect(parseFeedback(afterRemoval)).toEqual([GENERAL_COMMENT]);
  });

  it("is a no-op when the id is not present", () => {
    const content = serializeFeedback([GENERAL_COMMENT]);
    expect(parseFeedback(removeEntry(content, "does-not-exist"))).toEqual([GENERAL_COMMENT]);
  });
});
