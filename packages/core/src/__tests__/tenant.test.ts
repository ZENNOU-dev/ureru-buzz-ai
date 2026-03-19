import { describe, it, expect } from "vitest";
import { validateTenantId, ensureTenantId } from "../utils/tenant.js";

describe("validateTenantId", () => {
  it("should accept valid UUID", () => {
    expect(() => validateTenantId("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
  });

  it("should reject empty string", () => {
    expect(() => validateTenantId("")).toThrow("tenant_id is required");
  });

  it("should reject invalid format", () => {
    expect(() => validateTenantId("not-a-uuid")).toThrow("Invalid tenant_id format");
  });

  it("should accept uppercase UUID", () => {
    expect(() => validateTenantId("550E8400-E29B-41D4-A716-446655440000")).not.toThrow();
  });
});

describe("ensureTenantId", () => {
  it("should return valid tenant id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(ensureTenantId(id)).toBe(id);
  });

  it("should throw on undefined", () => {
    expect(() => ensureTenantId(undefined)).toThrow("Tenant not found");
  });

  it("should throw on null", () => {
    expect(() => ensureTenantId(null)).toThrow("Tenant not found");
  });

  it("should throw on empty string", () => {
    expect(() => ensureTenantId("")).toThrow("Tenant not found");
  });
});
