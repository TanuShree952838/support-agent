import { useState } from "react";
import type { TraceEntry } from "../api";

export default function TechnicalTrace({ entries }: { entries: TraceEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div className="technical-trace">
      <button type="button" className="link-button" onClick={() => setOpen(!open)}>
        Technical trace ({entries.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul>
          {entries.map((e, i) => (
            <li key={i} className={e.status === "error" ? "trace-error" : "trace-ok"}>
              <code>{e.canonical_id}</code>
              <span className="trace-status">{e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
