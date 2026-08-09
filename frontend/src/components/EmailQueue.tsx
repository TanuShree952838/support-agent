import type { EmailMessage } from "../api";

function relativeTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  emails: EmailMessage[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelect: (email: EmailMessage) => void;
}

export default function EmailQueue({
  query,
  onQueryChange,
  emails,
  selectedId,
  loading,
  error,
  onRefresh,
  onSelect,
}: Props) {
  return (
    <div className="queue">
      <div className="queue-head">
        <h2>Customer emails</h2>
        <p className="queue-tip">Pick a real support email — skip lunch invites and system notifications.</p>
      </div>
      <div className="queue-search">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search emails"
          onKeyDown={(e) => e.key === "Enter" && onRefresh()}
        />
        <button type="button" className="primary" onClick={onRefresh} disabled={loading} title="Refresh emails">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="queue-error">
          Couldn&apos;t reach Gmail — {error}
          <button type="button" className="link-button" onClick={onRefresh}>
            Try again
          </button>
        </div>
      )}

      <div className="queue-list">
        {emails.map((email) =>
          email.load_error ? (
            <div key={email.id} className="queue-card queue-card-broken" title={email.snippet}>
              <div className="queue-card-subject">Couldn&apos;t open this message</div>
              <div className="queue-card-snippet">Try another email.</div>
            </div>
          ) : (
            <button
              type="button"
              key={email.id}
              className={`queue-card ${selectedId === email.id ? "selected" : ""}`}
              onClick={() => onSelect(email)}
            >
              <div className="queue-card-top">
                <span className="queue-card-from">{email.from.replace(/<.*>/, "").trim() || email.from}</span>
                <span className="queue-card-time">{relativeTime(email.date)}</span>
              </div>
              <div className="queue-card-subject">{email.subject || "(no subject)"}</div>
              <div className="queue-card-snippet">{email.snippet}</div>
            </button>
          ),
        )}

        {emails.length === 0 && !loading && !error && (
          <div className="queue-empty">
            <p>No emails yet. Hit Refresh to pull from Gmail.</p>
            <button type="button" className="primary" onClick={onRefresh}>
              Refresh emails
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
