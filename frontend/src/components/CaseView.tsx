import { useMemo, useState } from "react";
import type { Classification, DuplicateIssue, EmailMessage, KbHit, TimelineEvent, Ticket } from "../api";
import { humanizeError } from "../errors";

const CONFIDENCE_THRESHOLD = 70;

function categoryLabel(category: string) {
  switch (category) {
    case "bug":
      return "Bug";
    case "billing":
      return "Billing";
    case "how_to":
      return "How-to";
    default:
      return "Other";
  }
}

interface Props {
  selected: EmailMessage | null;
  analyzing: boolean;
  classification: Classification | null;
  kbHits: KbHit[];
  kbStatus: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  escalateChecked: boolean;
  onEscalateChange: (checked: boolean) => void;
  overrideHold: boolean;
  onOverrideChange: (checked: boolean) => void;
  sending: boolean;
  ticket: Ticket | null;
  ticketError: string | null;
  duplicates: DuplicateIssue[];
  sendResult: { channel: string; status: string; error?: string } | null;
  timeline: TimelineEvent[];
  emailsLoaded: boolean;
  onRefreshInbox: () => void;
  onRerun: () => void;
  onApprove: () => void;
  onRetryTicket: () => void;
  onSkipTicket: () => void;
  onCopyReply: () => void;
  onPickNext: () => void;
}

type NextStep = {
  title: string;
  detail: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondary?: { label: string; onClick: () => void }[];
};

export default function CaseView({
  selected,
  analyzing,
  classification,
  kbHits,
  kbStatus,
  draftText,
  onDraftChange,
  escalateChecked,
  onEscalateChange,
  overrideHold,
  onOverrideChange,
  sending,
  ticket,
  ticketError,
  duplicates,
  sendResult,
  timeline,
  emailsLoaded,
  onRefreshInbox,
  onRerun,
  onApprove,
  onRetryTicket,
  onSkipTicket,
  onCopyReply,
  onPickNext,
}: Props) {
  const [activityOpen, setActivityOpen] = useState(true);

  const holdForHuman =
    !!classification &&
    classification.confidence < CONFIDENCE_THRESHOLD &&
    kbHits.length === 0 &&
    classification.category !== "bug";

  const ticketOk = !!ticket?.key;
  const ticketAttempted = ticket !== null || !!ticketError;
  const ticketFailed = ticketAttempted && !ticketOk;
  const sent = sendResult?.status === "sent";
  const sendFailed = !!sendResult && sendResult.status !== "sent";
  const draftReady = !!draftText && !!classification && !analyzing;
  const caseDone = sent && (!escalateChecked || ticketOk || ticketFailed);

  const statusPill = !selected
    ? null
    : analyzing
      ? "Working"
      : caseDone
        ? "Resolved"
        : draftReady
          ? "Draft ready"
          : "Needs AI";

  const nextStep: NextStep = useMemo(() => {
    if (!emailsLoaded) {
      return {
        title: "Load your inbox",
        detail: "Pull recent Gmail messages, then pick a customer email.",
        primaryLabel: "Refresh emails",
        onPrimary: onRefreshInbox,
      };
    }
    if (!selected) {
      return {
        title: "Choose a customer email",
        detail: "Pick one on the left (skip lunch invites and system mail).",
        primaryLabel: "Waiting for selection…",
        onPrimary: () => {},
        primaryDisabled: true,
      };
    }
    if (analyzing) {
      return {
        title: "AI is working on this email",
        detail: "Classifying, searching knowledge, drafting a reply…",
        primaryLabel: "Working…",
        onPrimary: () => {},
        primaryDisabled: true,
      };
    }
    if (!classification || !draftText) {
      return {
        title: "Let AI analyze + draft",
        detail: "Classify the issue, search Notion, and write a reply.",
        primaryLabel: "Run AI",
        onPrimary: onRerun,
      };
    }
    if (sent && ticketFailed) {
      return {
        title: "Reply sent — ticket failed",
        detail: humanizeError(ticketError, "Jira") + " You can retry Jira or move on.",
        primaryLabel: "Retry ticket",
        onPrimary: onRetryTicket,
        secondary: [
          { label: "Skip ticket", onClick: onSkipTicket },
          { label: "Pick next email", onClick: onPickNext },
        ],
      };
    }
    if (caseDone) {
      return {
        title: "Case resolved",
        detail: ticketOk
          ? `Reply sent and ticket ${ticket?.key} created.`
          : "Reply sent. Pick another email when ready.",
        primaryLabel: "Pick next email",
        onPrimary: onPickNext,
        secondary: ticketFailed ? [{ label: "Retry ticket", onClick: onRetryTicket }] : undefined,
      };
    }
    if (sendFailed) {
      return {
        title: "Couldn't send the reply",
        detail: humanizeError(sendResult?.error, "Gmail/Resend") + " Copy the draft or try again.",
        primaryLabel: "Try send again",
        onPrimary: onApprove,
        secondary: [
          { label: "Copy reply", onClick: onCopyReply },
          { label: "Re-run AI", onClick: onRerun },
        ],
      };
    }
    if (holdForHuman && !overrideHold) {
      return {
        title: "Review before sending",
        detail: "Low confidence and no KB match. Check the draft, tick Send anyway, then approve.",
        primaryLabel: "Approve & send reply",
        onPrimary: onApprove,
        primaryDisabled: true,
        secondary: [{ label: "Re-run AI", onClick: onRerun }],
      };
    }
    return {
      title: escalateChecked ? "Review draft, then create ticket & send" : "Review draft, then send",
      detail: escalateChecked
        ? "Edits the reply if needed. Jira ticket will be created on approve."
        : "Edits the reply if needed, then send to the customer.",
      primaryLabel: sending
        ? "Resolving…"
        : escalateChecked
          ? "Approve, create ticket & send"
          : "Approve & send reply",
      onPrimary: onApprove,
      primaryDisabled: sending,
      secondary: [
        { label: "Re-run AI", onClick: onRerun },
        { label: "Copy reply", onClick: onCopyReply },
      ],
    };
  }, [
    emailsLoaded,
    selected,
    analyzing,
    classification,
    draftText,
    sent,
    ticketFailed,
    ticketError,
    caseDone,
    ticketOk,
    ticket?.key,
    sendFailed,
    sendResult?.error,
    holdForHuman,
    overrideHold,
    escalateChecked,
    sending,
    onRefreshInbox,
    onRerun,
    onRetryTicket,
    onSkipTicket,
    onPickNext,
    onApprove,
    onCopyReply,
  ]);

  const aiChecklist = [
    { label: "Read customer email", state: selected ? "done" : "wait" },
    {
      label: "Classify issue",
      state: analyzing && !classification ? "run" : classification ? "done" : "wait",
    },
    {
      label: "Find help article in Notion",
      state:
        kbStatus === "found"
          ? "done"
          : kbStatus === "not_found"
            ? "miss"
            : kbStatus === "error"
              ? "fail"
              : analyzing
                ? "run"
                : "wait",
    },
    {
      label: "Draft reply",
      state: draftText ? "done" : analyzing ? "run" : "wait",
    },
    {
      label: "Create Jira ticket",
      state: ticketOk ? "done" : ticketFailed ? "fail" : escalateChecked && sending ? "run" : escalateChecked ? "wait" : "skip",
    },
    {
      label: "Send customer update",
      state: sent ? "done" : sendFailed ? "fail" : sending ? "run" : "wait",
    },
  ] as const;

  if (!selected) {
    return (
      <div className="case case-empty-wrap">
        <NextStepCard step={nextStep} />
        <div className="case case-empty">
          <p className="case-empty-title">Select a customer email</p>
          <p className="case-empty-body">
            {emailsLoaded
              ? "Then AI will classify it, search knowledge, and draft a reply."
              : "Start by refreshing your inbox on the left."}
          </p>
          <AiChecklist items={aiChecklist} />
        </div>
      </div>
    );
  }

  return (
    <div className="case">
      <NextStepCard step={nextStep} />

      <div className="case-header">
        <div className="case-header-top">
          <h2>{selected.subject || "(no subject)"}</h2>
          {statusPill && <span className={`status-pill status-${statusPill.toLowerCase().replace(/\s+/g, "-")}`}>{statusPill}</span>}
        </div>
        <div className="case-meta">
          <span>{selected.from}</span>
          {classification && (
            <span className={`chip chip-${classification.category}`}>
              {categoryLabel(classification.category)} · {classification.confidence}%
            </span>
          )}
          {classification && (
            <span className={`chip chip-urgency-${classification.urgency}`}>{classification.urgency} urgency</span>
          )}
        </div>
        <p className="case-next-line">Next: {nextStep.title}</p>
      </div>

      <AiChecklist items={aiChecklist} />

      <div className="action-bar">
        <span className="action-bar-label">What you can do</span>
        <div className="action-bar-btns">
          <button type="button" className="ghost" onClick={onRefreshInbox}>
            Refresh emails
          </button>
          <button type="button" className="ghost" onClick={onRerun} disabled={analyzing || sending}>
            {draftText ? "Re-run AI" : "Run AI"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => document.getElementById("reply-draft")?.focus()}
            disabled={!draftText}
            title={!draftText ? "Wait for a draft first" : undefined}
          >
            Edit draft
          </button>
          <button type="button" className="ghost" onClick={onCopyReply} disabled={!draftText}>
            Copy reply
          </button>
          {ticketFailed && (
            <button type="button" className="ghost" onClick={onRetryTicket} disabled={sending}>
              Retry ticket
            </button>
          )}
          {ticketFailed && (
            <button type="button" className="ghost" onClick={onSkipTicket}>
              Skip ticket
            </button>
          )}
          <button type="button" className="ghost" onClick={onPickNext}>
            Start over
          </button>
        </div>
      </div>

      <section className="case-section">
        <h3>Customer wrote</h3>
        <p className="case-body-text">{selected.body || selected.snippet}</p>
        {selected.attachments && selected.attachments.length > 0 && (
          <p className="case-attachments">📎 {selected.attachments.join(", ")}</p>
        )}
      </section>

      {analyzing && !classification && (
        <section className="case-section case-loading">
          <div className="spinner" /> Reading the email…
        </section>
      )}

      {classification && (
        <section className="case-section">
          <h3>Agent found</h3>
          <p className="case-why">{classification.reasoning}</p>
          {holdForHuman && (
            <div className="notice notice-warn">
              Confidence is low and nothing matched in the knowledge base — review before sending.
              <label className="notice-checkbox">
                <input type="checkbox" checked={overrideHold} onChange={(e) => onOverrideChange(e.target.checked)} />
                Send anyway
              </label>
            </div>
          )}

          <div className="kb-block">
            <h4>Matching help articles</h4>
            {kbStatus === "not_found" && (
              <p className="notice notice-muted">No help article found. Draft is a safe fallback — edit before sending.</p>
            )}
            {kbHits.map((hit) => (
              <a key={hit.url} className="kb-hit" href={hit.url} target="_blank" rel="noreferrer">
                <span className="kb-hit-title-row">
                  <span className="kb-hit-title">{hit.title}</span>
                  <span className="kb-hit-confidence">{hit.confidence}% match</span>
                </span>
                <span className="kb-hit-excerpt">{hit.excerpt}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {classification && !draftText && analyzing && (
        <section className="case-section case-loading">
          <div className="spinner" /> Writing a reply from what was found…
        </section>
      )}

      {draftText && (
        <section className="case-section">
          <div className="case-section-head">
            <h3>Reply</h3>
            <button type="button" className="link-button" onClick={onRerun} disabled={analyzing}>
              Re-run AI
            </button>
          </div>
          <textarea id="reply-draft" value={draftText} onChange={(e) => onDraftChange(e.target.value)} rows={7} />
        </section>
      )}

      {draftReady && !sent && (
        <section className="case-section case-resolve">
          <label className="notice-checkbox">
            <input type="checkbox" checked={escalateChecked} onChange={(e) => onEscalateChange(e.target.checked)} />
            Create a Jira ticket for this (recommended for bugs)
          </label>
          <button
            type="button"
            className="primary primary-lg"
            onClick={onApprove}
            disabled={!classification || analyzing || sending || (holdForHuman && !overrideHold)}
          >
            {nextStep.primaryLabel}
          </button>
        </section>
      )}

      {(ticketAttempted || sendResult) && (
        <section className="case-section case-result">
          {ticketOk && (
            <div className="result-row ok">
              Ticket created{ticket?.via === "github" ? " (via GitHub — Jira was unavailable)" : ""}:{" "}
              {ticket?.url ? (
                <a href={ticket.url} target="_blank" rel="noreferrer">
                  {ticket.key}
                </a>
              ) : (
                ticket?.key
              )}
            </div>
          )}
          {ticketFailed && (
            <div className="result-row warn">
              <div>{humanizeError(ticketError, "Jira")}</div>
              <div className="result-actions">
                <button type="button" className="primary" onClick={onRetryTicket} disabled={sending}>
                  Retry ticket
                </button>
                <button type="button" className="ghost" onClick={onSkipTicket}>
                  Skip ticket
                </button>
              </div>
            </div>
          )}
          {duplicates.length > 0 && (
            <div className="result-row">
              Might be the same as:{" "}
              {duplicates.map((d) => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="dup-link">
                  #{d.number}
                </a>
              ))}
            </div>
          )}
          {sent && (
            <div className="result-row ok">
              {sendResult?.channel === "resend" && "Reply sent"}
              {sendResult?.channel === "gmail_fallback" && "Reply sent via Gmail (Resend wasn’t available)"}
              {sendResult?.channel === "none" && "Couldn't send — use Copy reply"}
            </div>
          )}
          {sendFailed && (
            <div className="result-row warn">
              {humanizeError(sendResult?.error, "Gmail/Resend")}
              <div className="result-actions">
                <button type="button" className="primary" onClick={onApprove}>
                  Try send again
                </button>
                <button type="button" className="ghost" onClick={onCopyReply}>
                  Copy reply
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section className="case-activity">
          <button type="button" className="link-button" onClick={() => setActivityOpen(!activityOpen)}>
            Activity checklist {activityOpen ? "▲" : "▼"}
          </button>
          {activityOpen && (
            <ol className="activity-checklist">
              {humanTimeline(timeline, ticketFailed, ticketError, onRetryTicket).map((row, i) => (
                <li key={i} className={`activity-item activity-${row.tone}`}>
                  <span>
                    {row.label} — <strong>{row.status}</strong>
                  </span>
                  {row.retry && (
                    <button type="button" className="link-button" onClick={onRetryTicket}>
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function NextStepCard({ step }: { step: NextStep }) {
  return (
    <div className="next-step">
      <div className="next-step-kicker">Next step</div>
      <div className="next-step-title">{step.title}</div>
      <p className="next-step-detail">{step.detail}</p>
      <button type="button" className="primary primary-lg" onClick={step.onPrimary} disabled={step.primaryDisabled}>
        {step.primaryLabel}
      </button>
      {step.secondary && step.secondary.length > 0 && (
        <div className="next-step-secondary">
          {step.secondary.map((s) => (
            <button type="button" key={s.label} className="link-button" onClick={s.onClick}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AiChecklist({
  items,
}: {
  items: readonly { label: string; state: "done" | "run" | "wait" | "fail" | "miss" | "skip" }[];
}) {
  const icon = (state: string) => {
    switch (state) {
      case "done":
        return "✓";
      case "run":
        return "…";
      case "fail":
        return "!";
      case "miss":
        return "–";
      case "skip":
        return "·";
      default:
        return "○";
    }
  };
  return (
    <div className="ai-check">
      <div className="ai-check-label">What AI can do</div>
      <ul>
        {items.map((item) => (
          <li key={item.label} className={`ai-check-${item.state}`}>
            <span className="ai-check-icon">{icon(item.state)}</span>
            {item.label}
            {item.state === "miss" && <span className="ai-check-note">none found</span>}
            {item.state === "fail" && <span className="ai-check-note">failed</span>}
            {item.state === "skip" && <span className="ai-check-note">not requested</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function humanTimeline(
  timeline: TimelineEvent[],
  ticketFailed: boolean,
  ticketError: string | null,
  _onRetry: () => void,
) {
  const latestByStep = new Map<string, TimelineEvent>();
  for (const event of timeline) {
    latestByStep.set(event.step, event);
  }

  const rows: { label: string; status: string; tone: string; retry?: boolean }[] = [];
  const classify = latestByStep.get("classify");
  if (classify) rows.push({ label: "Understood the email", status: "Done", tone: "ok" });

  const kb = latestByStep.get("kb_search");
  if (kb) {
    if (kb.status === "found") rows.push({ label: "Searched knowledge", status: "Article found", tone: "ok" });
    else if (kb.status === "not_found") rows.push({ label: "Searched knowledge", status: "No article found", tone: "warn" });
    else rows.push({ label: "Searched knowledge", status: "Failed", tone: "bad", retry: false });
  }

  const draft = latestByStep.get("draft");
  if (draft) rows.push({ label: "Drafted reply", status: "Done", tone: "ok" });

  const escalate = latestByStep.get("escalate");
  if (escalate || ticketFailed) {
    if (escalate?.status === "done") rows.push({ label: "Created ticket", status: "Done", tone: "ok" });
    else rows.push({ label: "Created ticket", status: humanizeError(ticketError || "Failed", "Jira"), tone: "bad", retry: true });
  }

  const send = latestByStep.get("send");
  if (send) {
    if (send.status === "sent") rows.push({ label: "Sent update", status: "Sent", tone: "ok" });
    else rows.push({ label: "Sent update", status: "Not sent", tone: "bad" });
  }

  return rows;
}
