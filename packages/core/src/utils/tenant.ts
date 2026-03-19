import { TenantNotFoundError, ValidationError } from "../errors/index.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * テナントIDのバリデーション
 */
export function validateTenantId(tenantId: string): void {
  if (!tenantId) {
    throw new ValidationError("tenant_id is required");
  }
  if (!UUID_REGEX.test(tenantId)) {
    throw new ValidationError(`Invalid tenant_id format: ${tenantId}`);
  }
}

/**
 * テナントIDが必須であることを保証するガード関数
 * Notion/Supabaseクエリ前に必ず呼ぶ
 */
export function ensureTenantId(tenantId: string | undefined | null): string {
  if (!tenantId) {
    throw new TenantNotFoundError("undefined");
  }
  validateTenantId(tenantId);
  return tenantId;
}
