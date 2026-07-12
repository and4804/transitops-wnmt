import { badRequest, unprocessable } from "./errors";

export function requireField(body: any, field: string): any {
  const value = body?.[field];
  if (value === undefined || value === null || value === "") {
    throw unprocessable(`'${field}' is mandatory and cannot be null`);
  }
  return value;
}

export function requireNumber(body: any, field: string): number {
  const value = requireField(body, field);
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw badRequest(`'${field}' must be a number`);
  }
  return value;
}

export function requireEnum<T extends string>(body: any, field: string, allowed: readonly T[]): T {
  const value = requireField(body, field);
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`'${field}' must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function optionalString(body: any, field: string): string | undefined {
  const value = body?.[field];
  if (value === undefined || value === null) return undefined;
  return String(value);
}
