/** Turn raw API / Swytchcode errors into short next-step copy for the UI. */

export function humanizeError(raw: string | null | undefined, provider?: string): string {
  if (!raw) return "Something went wrong. Try again.";
  const text = raw.toLowerCase();

  if (text.includes("authenticated") || text.includes("unauthorized") || text.includes("401") || text.includes("403") || text.includes("auth")) {
    const who = provider || "This provider";
    return `${who} isn't logged in on this machine. Reconnect with Swytchcode, then click Retry.`;
  }
  if (text.includes("not valid json") || text.includes("unexpected response")) {
    return "The service returned an unexpected response (often an auth problem). Retry, or Skip ticket and still send the reply.";
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return "That took too long. Check Wi‑Fi and try again.";
  }
  if (text.includes("notion")) {
    return "Couldn't reach Notion knowledge base. Check connection, or continue — the draft will say no article was found.";
  }
  if (text.includes("gmail") || text.includes("mailbox")) {
    return "Couldn't reach Gmail. Click Refresh emails after reconnecting.";
  }
  if (text.includes("resend")) {
    return "Resend isn't available — the app will try Gmail instead.";
  }

  // Keep short; never dump huge JSON
  const clipped = raw.replace(/\s+/g, " ").trim();
  return clipped.length > 160 ? `${clipped.slice(0, 157)}…` : clipped;
}
