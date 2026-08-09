import { useState } from "react";
import "./App.css";
import {
  api,
  type Classification,
  type DuplicateIssue,
  type EmailMessage,
  type KbHit,
  type Ticket,
  type TimelineEvent,
} from "./api";
import { humanizeError } from "./errors";
import TopBar from "./components/TopBar";
import EmailQueue from "./components/EmailQueue";
import CaseView from "./components/CaseView";

function replySubject(subject: string): string {
  const stripped = subject.replace(/^(re:\s*)+/i, "").trim();
  return `Re: ${stripped}`;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [kbHits, setKbHits] = useState<KbHit[]>([]);
  const [kbStatus, setKbStatus] = useState("");
  const [draftText, setDraftText] = useState("");

  const [escalateChecked, setEscalateChecked] = useState(false);
  const [overrideHold, setOverrideHold] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateIssue[]>([]);
  const [sendResult, setSendResult] = useState<{ channel: string; status: string; error?: string } | null>(null);

  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  async function refreshEmails() {
    setLoadingInbox(true);
    setInboxError(null);
    try {
      setEmails(await api.inbox(query));
      setEmailsLoaded(true);
    } catch (e) {
      setInboxError(humanizeError((e as Error).message));
      setEmailsLoaded(false);
    } finally {
      setLoadingInbox(false);
    }
  }

  async function runAgent(email: EmailMessage) {
    setAnalyzing(true);
    setToast(null);
    try {
      const cls = await api.classify(email.id, email.subject, email.body);
      setClassification(cls);
      if (cls.category === "bug") setEscalateChecked(true);

      const kb = await api.kbSearch(email.id, cls.entities.summary || email.subject);
      setKbHits(kb.hits);
      setKbStatus(kb.status);

      const draft = await api.draft(email.id, email.subject, email.body, kb.hits);
      setDraftText(draft.reply);

      setTimeline(await api.timeline(email.id));
    } catch (e) {
      setToast(humanizeError((e as Error).message));
    } finally {
      setAnalyzing(false);
    }
  }

  function resetCaseFields() {
    setClassification(null);
    setKbHits([]);
    setKbStatus("");
    setDraftText("");
    setEscalateChecked(false);
    setOverrideHold(false);
    setTicket(null);
    setTicketError(null);
    setDuplicates([]);
    setSendResult(null);
    setTimeline([]);
    setToast(null);
  }

  function selectEmail(email: EmailMessage) {
    if (email.load_error) return;
    setSelected(email);
    resetCaseFields();
    runAgent(email);
  }

  function pickNext() {
    setSelected(null);
    resetCaseFields();
  }

  async function createTicketOnly() {
    if (!selected || !classification) return;
    setSending(true);
    setToast(null);
    try {
      const result = await api.escalate(
        selected.id,
        classification.entities.summary || selected.subject,
        `${selected.subject}\n\n${selected.body}`,
        classification.entities,
      );
      setTicket(result.ticket);
      setDuplicates(result.duplicates);
      if (result.error) {
        setTicketError(result.error);
        setToast(humanizeError(result.error, "Jira"));
      } else {
        setTicketError(null);
      }
      setTimeline(await api.timeline(selected.id));
    } catch (e) {
      const msg = (e as Error).message;
      setTicketError(msg);
      setToast(humanizeError(msg, "Jira"));
    } finally {
      setSending(false);
    }
  }

  async function approveAndResolve() {
    if (!selected || !classification) return;
    setSending(true);
    setToast(null);
    try {
      if (escalateChecked) {
        const result = await api.escalate(
          selected.id,
          classification.entities.summary || selected.subject,
          `${selected.subject}\n\n${selected.body}`,
          classification.entities,
        );
        setTicket(result.ticket);
        setDuplicates(result.duplicates);
        if (result.error) {
          setTicketError(result.error);
          setToast(humanizeError(result.error, "Jira"));
        } else {
          setTicketError(null);
        }
      }

      const replyTo = selected.from.match(/<(.+)>/)?.[1] || selected.from;
      const result = await api.send(selected.id, replyTo, replySubject(selected.subject), draftText);
      setSendResult(result);
      if (result.status !== "sent") {
        setToast(humanizeError(result.error || "Couldn't send the reply.", "Gmail/Resend"));
      }

      setTimeline(await api.timeline(selected.id));
    } catch (e) {
      setToast(humanizeError((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  function skipTicket() {
    setEscalateChecked(false);
    setTicketError(null);
    setToast("Ticket skipped. Reply still counts as sent if it already went out.");
  }

  async function copyReply() {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setToast("Reply copied — paste into Gmail if send is blocked.");
    } catch {
      setToast("Couldn't copy automatically — select the draft and copy manually.");
    }
  }

  return (
    <div className="app">
      <TopBar />

      <div className="how-strip" aria-label="How this works">
        <span className={!emailsLoaded ? "how-on" : undefined}>1 Pick email</span>
        <span className="how-arrow">→</span>
        <span className={selected && (analyzing || !draftText) ? "how-on" : undefined}>2 AI drafts</span>
        <span className="how-arrow">→</span>
        <span className={draftText && !sendResult ? "how-on" : undefined}>3 You approve</span>
        <span className="how-arrow">→</span>
        <span className={sendResult ? "how-on" : undefined}>4 Send (+ ticket if bug)</span>
      </div>

      {toast && (
        <div className="toast">
          {toast}
          <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <main className="workspace">
        <EmailQueue
          query={query}
          onQueryChange={setQuery}
          emails={emails}
          selectedId={selected?.id ?? null}
          loading={loadingInbox}
          error={inboxError}
          onRefresh={refreshEmails}
          onSelect={selectEmail}
        />
        <CaseView
          selected={selected}
          analyzing={analyzing}
          classification={classification}
          kbHits={kbHits}
          kbStatus={kbStatus}
          draftText={draftText}
          onDraftChange={setDraftText}
          escalateChecked={escalateChecked}
          onEscalateChange={setEscalateChecked}
          overrideHold={overrideHold}
          onOverrideChange={setOverrideHold}
          sending={sending}
          ticket={ticket}
          ticketError={ticketError}
          duplicates={duplicates}
          sendResult={sendResult}
          timeline={timeline}
          emailsLoaded={emailsLoaded}
          onRefreshInbox={refreshEmails}
          onRerun={() => selected && runAgent(selected)}
          onApprove={approveAndResolve}
          onRetryTicket={createTicketOnly}
          onSkipTicket={skipTicket}
          onCopyReply={copyReply}
          onPickNext={pickNext}
        />
      </main>
    </div>
  );
}
