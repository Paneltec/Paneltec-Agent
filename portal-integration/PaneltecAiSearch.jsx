/**
 * PaneltecAiSearch — drop-in React widget for the Paneltec Group Portal.
 *
 * Renders the agent inside an <iframe> and intercepts the postMessage
 * navigation events so clicks on AI action cards route inside the portal
 * (or to any URL of your choice).
 *
 * Usage
 * -----
 *   import PaneltecAiSearch from "./paneltec-ai-search/PaneltecAiSearch";
 *   // ...inside your Search page:
 *   <PaneltecAiSearch height={760} />
 *
 * Props
 * -----
 *   src        Full URL of the embed page.
 *              Defaults to the production deployment.
 *   height     Iframe height (px or CSS string). Default 720.
 *   maxWidth   Container max-width (px or CSS string). Default 980.
 *   onNavigate (msg) => void
 *              Override navigation. msg = {path, url, label, confidence}.
 *              Default: if msg.path starts with "/", calls react-router's
 *              navigate(); otherwise window.location.assign(msg.url).
 *   navigate   Optional react-router useNavigate() result, used as the
 *              default for SPA navigation. Pass this if your portal uses
 *              React Router and you want clicks to stay in-app.
 *   defaultQuery Optional initial query to push into the iframe on mount.
 *
 * Cross-frame protocol
 * --------------------
 * The iframe posts:
 *   { type: "paneltec-navigate", path, url, label, confidence }
 * You may post into the iframe (after it loads):
 *   { type: "paneltec-query", q: "make a PIN for the gate" }
 */
import { useEffect, useRef } from "react";

const DEFAULT_SRC = ""; // Set via prop, env, or fall back to current origin

export default function PaneltecAiSearch({
  src,
  height = 720,
  maxWidth = 980,
  onNavigate,
  navigate, // react-router's useNavigate() result (optional)
  defaultQuery,
}) {
  const resolvedSrc =
    src ||
    process.env.REACT_APP_PANELTEC_AI_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/embed` : "/embed");
  const iframeRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const msg = e && e.data;
      if (!msg || msg.type !== "paneltec-navigate") return;

      if (onNavigate) {
        onNavigate(msg);
        return;
      }

      // Default: SPA route if we have a react-router navigate fn,
      // else hard navigate.
      if (msg.path && msg.path.startsWith("/") && typeof navigate === "function") {
        navigate(msg.path);
      } else if (msg.url) {
        window.location.assign(msg.url);
      } else if (msg.path) {
        window.location.assign(msg.path);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onNavigate, navigate]);

  useEffect(() => {
    if (!defaultQuery || !iframeRef.current) return;
    const el = iframeRef.current;
    const send = () => {
      try {
        el.contentWindow?.postMessage(
          { type: "paneltec-query", q: defaultQuery },
          "*"
        );
      } catch {
        /* ignore */
      }
    };
    // Iframe may not be ready yet; try both load and a short retry.
    el.addEventListener("load", send);
    const t = setTimeout(send, 1500);
    return () => {
      el.removeEventListener("load", send);
      clearTimeout(t);
    };
  }, [defaultQuery, resolvedSrc]);

  const h = typeof height === "number" ? `${height}px` : height;
  const mw = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return (
    <div
      data-testid="paneltec-ai-search-widget"
      style={{ width: "100%", maxWidth: mw, margin: "0 auto" }}
    >
      <iframe
        ref={iframeRef}
        src={resolvedSrc}
        title="Paneltec AI Search"
        allow="clipboard-write"
        style={{
          width: "100%",
          height: h,
          border: "1px solid #E5E5E5",
          background: "#fff",
          display: "block",
        }}
      />
    </div>
  );
}
