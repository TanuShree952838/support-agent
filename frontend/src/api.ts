const BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  category?: string;
  constructor(message: string, category?: string) {
    super(message);
    this.category = category;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail?.error || body?.detail || `Request failed: ${res.status}`;
    throw new ApiError(message, body?.detail?.category);
  }
  return res.json();
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  load_error?: boolean;
  rfc_message_id?: string;
  attachments?: string[];
}

export type ConnectionStatus = Record<"gmail" | "notion" | "jira" | "resend" | "github", boolean>;

export interface Classification {
  category: "bug" | "billing" | "how_to" | "other";
  confidence: number;
  urgency: "low" | "medium" | "high";
  reasoning: string;
  entities: {
    summary: string;
    error_code?: string | null;
    product_area?: string | null;
  };
}

export interface KbHit {
  page_id: string;
  title: string;
  url: string;
  excerpt: string;
  score: number;
}

export interface Ticket {
  key: string | null;
  url: string | null;
  self: string | null;
}

export interface DuplicateIssue {
  number: number;
  title: string;
  url: string;
  state: string;
}

export interface TimelineEvent {
  timestamp: string;
  email_id: string;
  step: string;
  status: string;
  detail: Record<string, unknown>;
}

export interface Case {
  email_id: string;
  subject?: string;
  category?: string;
  confidence?: number;
  urgency?: string;
  ticket_key?: string | null;
  sent?: boolean;
  channel?: string;
  updated_at: string;
}

export const api = {
  inbox: (query: string) => request<EmailMessage[]>(`/inbox?query=${encodeURIComponent(query)}`),

  status: () => request<ConnectionStatus>("/status"),

  classify: (email_id: string, subject: string, body: string, thread_id?: string, attachments?: string[]) =>
    request<Classification>("/classify", {
      method: "POST",
      body: JSON.stringify({ email_id, subject, body, thread_id, attachments }),
    }),

  kbSearch: (email_id: string, query_text: string) =>
    request<{ hits: KbHit[]; status: string; duplicates: DuplicateIssue[] }>("/kb-search", {
      method: "POST",
      body: JSON.stringify({ email_id, query_text }),
    }),

  draft: (email_id: string, subject: string, body: string, kb_hits: KbHit[]) =>
    request<{ reply: string }>("/draft", {
      method: "POST",
      body: JSON.stringify({ email_id, subject, body, kb_hits }),
    }),

  escalate: (
    email_id: string,
    summary: string,
    description: string,
    entities: Record<string, unknown>,
    urgency?: string,
  ) =>
    request<{ ticket: Ticket; duplicates: DuplicateIssue[]; reused: boolean; error?: string; error_category?: string }>("/escalate", {
      method: "POST",
      body: JSON.stringify({ email_id, summary, description, entities, urgency }),
    }),

  send: (
    email_id: string,
    to: string,
    subject: string,
    body: string,
    thread_id?: string,
    reply_to_message_id?: string,
    kb_page_id?: string,
  ) =>
    request<{ channel: string; status: string; id?: string; error?: string }>("/send", {
      method: "POST",
      body: JSON.stringify({ email_id, to, subject, body, thread_id, reply_to_message_id, kb_page_id }),
    }),

  timeline: (email_id: string) => request<TimelineEvent[]>(`/timeline?email_id=${encodeURIComponent(email_id)}`),

  cases: () => request<Case[]>("/cases"),
};
