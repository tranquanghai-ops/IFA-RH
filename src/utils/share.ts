/**
 * IFA-RH — Share & URL Utilities for Conferences and AI Candidate Previews
 */

export function buildOpportunityShareUrl(opportunityId: string): string {
  const rawOrigin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://ifa-rh.web.app";
  const origin = rawOrigin.replace(/\/+$/, "");
  return `${origin}/?opportunity=${encodeURIComponent(opportunityId)}`;
}

export function buildCandidatePreviewUrl(previewId: string): string {
  const rawOrigin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://ifa-rh.web.app";
  const origin = rawOrigin.replace(/\/+$/, "");
  return `${origin}/?preview=${encodeURIComponent(previewId)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Try modern navigator.clipboard API first
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // Fallback using temporary textarea
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
