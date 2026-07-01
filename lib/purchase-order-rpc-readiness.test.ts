import { describe, expect, it } from "vitest";
import { classifyPurchaseOrderRpcProbe } from "@/lib/purchase-order-rpc-readiness";

describe("classifyPurchaseOrderRpcProbe", () => {
  it("recognizes the guarded RPC without accepting the payload", () => {
    expect(
      classifyPurchaseOrderRpcProbe({
        message: "p_order must be a JSON object",
      }),
    ).toEqual({ status: "READY", detail: "Guard rejected probe payload" });
  });

  it("recognizes an undeployed migration", () => {
    expect(
      classifyPurchaseOrderRpcProbe({
        message:
          "Could not find the function public.save_purchase_order_atomic in the schema cache",
      }),
    ).toEqual({
      status: "NOT_DEPLOYED",
      detail: "RPC is absent from the schema cache",
    });
  });

  it("treats an accepted malformed payload as unsafe", () => {
    expect(classifyPurchaseOrderRpcProbe(null)).toEqual({
      status: "UNSAFE",
      detail: "Malformed probe payload was accepted",
    });
  });

  it("preserves unexpected errors for diagnosis", () => {
    expect(
      classifyPurchaseOrderRpcProbe({ message: "permission denied" }),
    ).toEqual({
      status: "ERROR",
      detail: "permission denied",
    });
  });
});
