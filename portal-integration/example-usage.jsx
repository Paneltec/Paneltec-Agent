/**
 * Example: wiring PaneltecAiSearch into the existing portal's Search page.
 *
 * This assumes your portal uses React Router. If it doesn't, just drop the
 * `navigate` prop and the widget will use window.location.assign() instead.
 */
import { useNavigate } from "react-router-dom";
import PaneltecAiSearch from "./paneltec-ai-search/PaneltecAiSearch";

export default function SearchPage() {
  const navigate = useNavigate();

  return (
    <main style={{ padding: "32px 24px", minHeight: "100vh", background: "#FAFAFA" }}>
      <header style={{ maxWidth: 980, margin: "0 auto 20px" }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>
          Portal Search
        </h1>
        <p style={{ margin: "6px 0 0", color: "#666" }}>
          Ask a question or describe what you want to do — the agent will route
          you to the right page.
        </p>
      </header>

      {/* The widget. Pass navigate so AI action cards route inside the SPA. */}
      <PaneltecAiSearch
        navigate={navigate}
        height={760}
        // Optional: pre-fill a query when the page opens
        // defaultQuery="make a PIN for the gate"

        // Optional: take full control over navigation. If provided, this
        // overrides the default behaviour.
        // onNavigate={(msg) => {
        //   // msg = { path, url, label, confidence }
        //   if (msg.path.startsWith("/admin")) return; // guard etc.
        //   navigate(msg.path);
        // }}
      />
    </main>
  );
}
