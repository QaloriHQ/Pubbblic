export type ReleaseCategory =
  | "Product launch" | "Company news" | "Partnership" | "Milestone" | "Event" | "Other";
export type ReleaseDraft = {
  id: string;
  headline: string;
  summary: string;
  organization: string;
  dateline: string;
  body: string;
  quote: string;
  quoteAttribution: string;
  boilerplate: string;
  contactName: string;
  contactEmail: string;
  category: ReleaseCategory;
  updatedAt: string;
  createdAt: string;
};
export const DRAFTS_KEY = "pubbblic-preview-drafts-v1";
export const BLANK_DRAFT: Omit<ReleaseDraft, "id" | "updatedAt" | "createdAt"> = {
  headline: "",
  summary: "",
  organization: "",
  dateline: "",
  body: "",
  quote: "",
  quoteAttribution: "",
  boilerplate: "",
  contactName: "",
  contactEmail: "",
  category: "Product launch"
};
export const SAMPLE_DRAFT: ReleaseDraft = {
  ...BLANK_DRAFT,
  id: "sample-release",
  headline: "Northstar Labs introduces a new collaboration workspace",
  summary: "A fictional example demonstrating the Pubbblic press release editor and its preview workflow.",
  organization: "Northstar Labs (sample company)",
  dateline: "AUSTIN, Texas — November 8, 2026",
  body: "Northstar Labs, a fictional technology company used solely for this product preview, has introduced a sample collaboration workspace designed to illustrate how a press release could be prepared in Pubbblic.\n\nThe example includes a headline, summary, dateline, body, attributable quote, boilerplate and media contact. No actual product announcement, third-party publication or company endorsement is implied.\n\nPubbblic plans to use an approved source release to prepare publisher-specific versions while safeguarding dates, figures and quotations. Those distribution features are not active in this preview.",
  quote: "Good press releases should make the important facts easy to find.",
  quoteAttribution: "Sample spokesperson, Northstar Labs",
  boilerplate: "Northstar Labs is a fictional company created to demonstrate the Pubbblic release editor.",
  contactName: "Example media contact",
  contactEmail: "example@example.com",
  category: "Product launch",
  createdAt: "2026-11-08T00:00:00.000Z",
  updatedAt: "2026-11-08T00:00:00.000Z"
};
export function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
export type Validation = { label: string; valid: boolean; detail: string };
export function validateDraft(d: ReleaseDraft): Validation[] {
  return [
    { label: "Clear headline", valid: d.headline.trim().length >= 15 && d.headline.trim().length <= 140, detail: "15–140 characters" },
    { label: "Useful summary", valid: d.summary.trim().length >= 35 && d.summary.trim().length <= 320, detail: "35–320 characters" },
    { label: "Organization identified", valid: d.organization.trim().length >= 2, detail: "Company or issuer name" },
    { label: "Dateline provided", valid: d.dateline.trim().length >= 8, detail: "City and announcement date" },
    { label: "Substantive announcement", valid: wordCount(d.body) >= 60, detail: "At least 60 words of context" },
    { label: "Media contact", valid: d.contactName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail.trim()), detail: "Name and valid email" },
    { label: "Quote attribution", valid: !d.quote.trim() || d.quoteAttribution.trim().length >= 3, detail: "Required when a quote is present" }
  ];
}
export function createDraft(): ReleaseDraft {
  const date = new Date().toISOString();
  return { ...BLANK_DRAFT, id: crypto.randomUUID(), createdAt: date, updatedAt: date };
}
export function isReleaseDraft(obj: unknown): obj is ReleaseDraft {
  if (!obj || typeof obj !== "object") return false;
  const d = obj as Record<string, unknown>;
  return ["id", "headline", "summary", "organization", "dateline", "body", "createdAt", "updatedAt"].every(k => typeof d[k] === "string");
}
