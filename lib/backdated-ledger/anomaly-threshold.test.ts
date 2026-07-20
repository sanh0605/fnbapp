import { describe, expect, it } from "vitest";
import { classifyBackdatedEventPlan } from "./anomaly-threshold";

describe("classifyBackdatedEventPlan", () => {
  it("treats an empty change set as routine", () => {
    expect(classifyBackdatedEventPlan([])).toEqual({ isAnomalous: false, reason: null });
  });

  it("treats tonight's actual largest accepted event (19 lines, 6,819 VND total) as routine", () => {
    const changes = Array.from({ length: 19 }, (_, i) => ({
      line_id: `line-${i}`,
      old_cost_at_sale: 4591,
      new_cost_at_sale: 4640,
    }));
    const result = classifyBackdatedEventPlan(changes);
    expect(result.isAnomalous).toBe(false);
  });

  it("flags an event affecting more than 20 lines", () => {
    const changes = Array.from({ length: 21 }, (_, i) => ({
      line_id: `line-${i}`,
      old_cost_at_sale: 1000,
      new_cost_at_sale: 1001,
    }));
    const result = classifyBackdatedEventPlan(changes);
    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/21 lines/);
  });

  it("flags an event whose total delta exceeds 20,000 VND", () => {
    const changes = [{ line_id: "line-1", old_cost_at_sale: 10000, new_cost_at_sale: 35000 }];
    const result = classifyBackdatedEventPlan(changes);
    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/25000 VND/);
  });

  it("flags a single line whose cost changed by more than 20%", () => {
    const changes = [{ line_id: "line-1", old_cost_at_sale: 10000, new_cost_at_sale: 13000 }];
    const result = classifyBackdatedEventPlan(changes);
    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/line-1/);
  });

  it("does not divide by zero when a line's old cost was 0", () => {
    const changes = [{ line_id: "line-1", old_cost_at_sale: 0, new_cost_at_sale: 500 }];
    const result = classifyBackdatedEventPlan(changes);
    expect(result.isAnomalous).toBe(false);
  });
});
