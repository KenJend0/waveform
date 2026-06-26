export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stringOrNumberValue(value: unknown): string | number | null {
  return stringValue(value) ?? numberValue(value);
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function recordValue(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

export function logInvalidExternalResponse(context: string, details?: string): void {
  console.error(`[external:${context}] invalid response${details ? ` (${details})` : ""}`);
}
