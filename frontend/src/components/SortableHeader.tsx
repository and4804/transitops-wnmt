export interface SortState {
  sortBy: string;
  sortDir: "asc" | "desc";
}

export default function SortableHeader({
  field,
  label,
  sort,
  onChange,
}: {
  field: string;
  label: string;
  sort: SortState;
  onChange: (sort: SortState) => void;
}) {
  const active = sort.sortBy === field;

  function handleClick() {
    if (active) {
      onChange({ sortBy: field, sortDir: sort.sortDir === "asc" ? "desc" : "asc" });
    } else {
      onChange({ sortBy: field, sortDir: "asc" });
    }
  }

  return (
    <th onClick={handleClick} style={{ cursor: "pointer", userSelect: "none" }}>
      {label}
      {active ? (sort.sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
