import type { Case } from "../api";

function categoryLabel(category?: string) {
  switch (category) {
    case "bug":
      return "Bug";
    case "billing":
      return "Billing";
    case "how_to":
      return "How-to";
    case "other":
      return "Other";
    default:
      return "";
  }
}

export default function RecentCases({ cases }: { cases: Case[] }) {
  if (cases.length === 0) return null;

  return (
    <div className="recent-cases">
      <div className="recent-cases-label">Recent cases ({cases.length})</div>
      <ul>
        {cases.map((c) => (
          <li key={c.email_id}>
            <span className="case-subject">{c.subject || "(no subject)"}</span>
            <span className="case-tags">
              {c.category && <span className={`chip chip-${c.category}`}>{categoryLabel(c.category)}</span>}
              {c.ticket_key && <span className="chip chip-ticket">{c.ticket_key}</span>}
              {c.sent && <span className="chip chip-sent">Sent</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
