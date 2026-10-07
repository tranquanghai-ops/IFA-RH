/**
 * Normalize a text string for fuzzy deduplication comparison
 */
export function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove Vietnamese accents
    .replace(/[^a-z0-9]/g, " ") // Keep only alphanumeric
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if candidate matches existing opportunity or candidate
 */
export function isDuplicateOpportunity(
  candidate: {
    title: string;
    sourceUrl?: string;
    submissionUrl?: string;
    registrationUrl?: string;
    organizer?: string;
    deadline?: string;
    eventDate?: string;
  },
  existingList: Array<{
    title: string;
    sourceUrl?: string;
    submissionUrl?: string;
    registrationUrl?: string;
    organizer?: string;
    deadline?: string;
    eventDate?: string;
  }>
): { isDuplicate: boolean; matchedTitle?: string; matchReason?: string } {
  const normTitle = normalizeText(candidate.title);
  const normSourceUrl = (candidate.sourceUrl || "").trim().toLowerCase();
  const candSubUrl = (candidate.submissionUrl || candidate.registrationUrl || "").trim().toLowerCase();
  const normOrg = normalizeText(candidate.organizer);

  for (const existing of existingList) {
    const exTitle = normalizeText(existing.title);
    const exSourceUrl = (existing.sourceUrl || "").trim().toLowerCase();
    const exSubUrl = (existing.submissionUrl || existing.registrationUrl || "").trim().toLowerCase();
    const exOrg = normalizeText(existing.organizer);

    // Exact or high source url match
    if (normSourceUrl && exSourceUrl && normSourceUrl === exSourceUrl) {
      return {
        isDuplicate: true,
        matchedTitle: existing.title,
        matchReason: `Trùng link nguồn chính thức: ${normSourceUrl}`,
      };
    }

    // Exact submission url match (excluding generic mailto if any, but matching web portals)
    if (candSubUrl && exSubUrl && candSubUrl === exSubUrl && candSubUrl.length > 10) {
      return {
        isDuplicate: true,
        matchedTitle: existing.title,
        matchReason: `Trùng link nộp bài / đăng ký: ${candSubUrl}`,
      };
    }

    // Exact title match
    if (normTitle && exTitle && normTitle === exTitle) {
      return {
        isDuplicate: true,
        matchedTitle: existing.title,
        matchReason: `Trùng khớp tiêu đề: "${existing.title}"`,
      };
    }

    // High similarity: Same organizer + substantial title overlap
    if (normOrg && exOrg && normOrg === exOrg) {
      if (
        (normTitle.length > 10 && exTitle.includes(normTitle)) ||
        (exTitle.length > 10 && normTitle.includes(exTitle))
      ) {
        return {
          isDuplicate: true,
          matchedTitle: existing.title,
          matchReason: `Cùng đơn vị tổ chức và trùng phần lớn tiêu đề`,
        };
      }
    }
  }

  return { isDuplicate: false };
}
