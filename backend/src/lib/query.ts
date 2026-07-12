export function parseSort(
  query: Record<string, unknown>,
  allowedFields: readonly string[],
  defaultField: string
): Record<string, "asc" | "desc"> {
  const sortBy = typeof query.sortBy === "string" && allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const sortDir = query.sortDir === "desc" ? "desc" : "asc";
  return { [sortBy]: sortDir };
}

export function containsFilter(value: unknown, fields: readonly string[]) {
  if (typeof value !== "string" || value.trim() === "") return {};
  const q = value.trim();
  return { OR: fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" as const } })) };
}
