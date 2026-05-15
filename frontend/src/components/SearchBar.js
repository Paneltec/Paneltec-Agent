import { useState, useEffect, useRef } from "react";
import { Search, ArrowRight } from "lucide-react";

export default function SearchBar({
  initial = "",
  onSubmit,
  size = "hero",
  autoFocus = true,
  placeholder = "Search every manual, app, doc & line of code…",
}) {
  const [q, setQ] = useState(initial);
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  useEffect(() => setQ(initial), [initial]);

  const submit = (e) => {
    e?.preventDefault?.();
    const v = (q || "").trim();
    if (!v) return;
    onSubmit?.(v);
  };

  const isHero = size === "hero";

  return (
    <form
      onSubmit={submit}
      data-testid="search-bar-form"
      className={`group flex w-full items-center gap-3 border border-[var(--ptec-border)] bg-white transition-all duration-150 focus-within:border-[var(--ptec-blue)] focus-within:ring-2 focus-within:ring-[var(--ptec-blue)]/15 ${
        isHero ? "px-5 py-4" : "px-4 py-2.5"
      }`}
    >
      <Search
        className={`shrink-0 text-[var(--ptec-text-muted)] group-focus-within:text-[var(--ptec-blue)] ${
          isHero ? "h-6 w-6" : "h-4 w-4"
        }`}
        strokeWidth={1.75}
      />
      <input
        ref={ref}
        data-testid="search-bar-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 border-0 bg-transparent text-[var(--ptec-text)] placeholder:text-[var(--ptec-text-muted)] focus:outline-none ${
          isHero ? "text-xl md:text-2xl" : "text-base"
        }`}
      />
      <button
        type="submit"
        data-testid="search-bar-submit"
        className={`shrink-0 inline-flex items-center gap-2 bg-[var(--ptec-text)] font-medium text-white transition-colors duration-150 hover:bg-[var(--ptec-blue)] ${
          isHero ? "px-5 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
        }`}
      >
        Ask <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
