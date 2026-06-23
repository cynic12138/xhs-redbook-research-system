export function parseNoteUrl(url: string): { noteId: string; xsecToken?: string | null } {
  if (url.includes("xiaohongshu.com")) {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      noteId: parts.at(-1) ?? url,
      xsecToken: parsed.searchParams.get("xsec_token")
    };
  }
  return { noteId: url };
}

export function buildWebUrl(noteId: string, xsecToken?: string | null, source = "pc_search"): string {
  const base = `https://www.xiaohongshu.com/explore/${encodeURIComponent(noteId)}`;
  if (!xsecToken) {
    return base;
  }
  const params = new URLSearchParams({
    xsec_token: xsecToken,
    xsec_source: source
  });
  return `${base}?${params.toString()}`;
}

export function enrichWithWebUrl<T>(value: T, source = "pc_search"): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      enrichWithWebUrl(item, source);
    }
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const noteId = firstString(record.note_id, record.noteId, record.id);
  const token = firstString(record.xsec_token, record.xsecToken);
  if (noteId && token && !record.webUrl) {
    record.webUrl = buildWebUrl(noteId, token, source);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      enrichWithWebUrl(nested, source);
    }
  }

  return value;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return "";
}
