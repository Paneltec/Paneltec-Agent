const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "manual", label: "Manuals" },
  { key: "app", label: "Apps" },
  { key: "doc", label: "Docs" },
  { key: "code", label: "Code" },
  { key: "other", label: "Other" },
];

export default function CategoryChips({ value, onChange }) {
  return (
    <div
      data-testid="category-chips"
      className="flex flex-wrap items-center gap-2"
    >
      {CATEGORIES.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            data-testid={`category-chip-${c.key}`}
            className={`border px-3 py-1 text-xs font-medium tracking-wide uppercase transition-colors duration-150 ${
              active
                ? "border-[var(--ptec-text)] bg-[var(--ptec-text)] text-white"
                : "border-[var(--ptec-border)] bg-transparent text-[var(--ptec-text-secondary)] hover:border-[var(--ptec-text)] hover:text-[var(--ptec-text)]"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
