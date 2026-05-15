import { Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/", label: "Search", testId: "nav-search" },
  { to: "/library", label: "Library", testId: "nav-library" },
  { to: "/dashboard", label: "Indexing", testId: "nav-dashboard" },
  { to: "/admin", label: "Admin", testId: "nav-admin" },
];

export default function TopBar() {
  const loc = useLocation();
  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-40 w-full border-b border-[var(--ptec-border)] bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        <Link
          to="/"
          data-testid="brand-link"
          className="flex items-center gap-2 text-[var(--ptec-text)]"
        >
          <span className="inline-block h-6 w-6 bg-[var(--ptec-blue)]" />
          <span className="font-display text-lg tracking-tight">
            PANELTEC<span className="text-[var(--ptec-text-muted)]"> / </span>
            <span className="font-mono-ptec text-sm">portal-ai</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const active =
              n.to === "/"
                ? loc.pathname === "/" || loc.pathname.startsWith("/search")
                : loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                data-testid={n.testId}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-[var(--ptec-text)] text-white"
                    : "text-[var(--ptec-text-secondary)] hover:text-[var(--ptec-text)] hover:bg-[var(--ptec-surface)]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
