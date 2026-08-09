import { useEffect, useState } from "react";
import { api, type ConnectionStatus } from "../api";

const LABELS: { key: keyof ConnectionStatus; label: string }[] = [
  { key: "gmail", label: "Gmail" },
  { key: "notion", label: "Notion" },
  { key: "jira", label: "Jira" },
  { key: "resend", label: "Resend" },
];

export default function TopBar() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="topbar-name">Support Agent</span>
        <span className="topbar-tagline">Resolve a customer email to reply + ticket, in one flow</span>
      </div>
      <div className="topbar-pills">
        {LABELS.map(({ key, label }) => (
          <span key={key} className={`pill ${status?.[key] ? "pill-on" : "pill-off"}`}>
            <span className="pill-dot" />
            {label}
          </span>
        ))}
      </div>
    </header>
  );
}
