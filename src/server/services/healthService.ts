import type { HealthNoteDiagnostic, HealthReportRecord, NoteRecord } from "../../shared/types.js";
import { asRecord, createId, nowIso, pickString } from "../../shared/utils.js";
import { store } from "../storage/runtimeStorage.js";
import { redbook } from "./redbookService.js";

const sensitiveWords = ["最", "第一", "唯一", "永久", "保证", "包过", "私信", "微信", "VX", "加我", "返现", "引流"];

export async function buildHealthCheck(jobId: string): Promise<HealthReportRecord> {
  const notes = (await store.read("notes")).filter((note) => note.jobIds.includes(jobId));
  let creatorRaw: unknown[] = [];
  try {
    creatorRaw = await redbook.creatorNotes(0, 2);
  } catch {
    creatorRaw = [];
  }

  const creatorById = new Map<string, unknown>();
  for (const raw of creatorRaw) {
    const record = asRecord(raw);
    const id = pickString(record.note_id, record.noteId, record.id);
    if (id) {
      creatorById.set(id, raw);
    }
  }

  const diagnostics = notes.map((note) => diagnoseNote(note, creatorById.get(note.id)));
  const distribution = diagnostics.reduce<Record<string, number>>((acc, item) => {
    acc[item.levelLabel] = (acc[item.levelLabel] ?? 0) + 1;
    return acc;
  }, {});
  const report: HealthReportRecord = {
    id: createId("health"),
    jobId,
    generatedAt: nowIso(),
    totalNotes: diagnostics.length,
    notes: diagnostics,
    limitedNotes: diagnostics.filter((item) => item.level > 0 || item.levelColor === "red"),
    sensitiveNotes: diagnostics.filter((item) => item.sensitiveHits.length > 0),
    distribution
  };
  await store.update("healthReports", (reports) => [report, ...reports.filter((item) => item.jobId !== jobId)]);
  return report;
}

export function diagnoseNote(note: NoteRecord, creatorRaw?: unknown): HealthNoteDiagnostic {
  const raw = asRecord(creatorRaw ?? note.raw);
  const level = Number(raw.level ?? raw.note_level ?? raw.recommend_level ?? 0);
  const text = `${note.title} ${note.desc}`;
  const sensitiveHits = sensitiveWords.filter((word) => text.includes(word));
  const tagCount = (text.match(/#[\u4e00-\u9fa5A-Za-z0-9_-]+/g) ?? []).length;
  const meta = levelMeta(level);
  const tagWarning = tagCount > 8;
  return {
    noteId: note.id,
    title: note.title,
    level,
    levelLabel: meta.label,
    levelColor: sensitiveHits.length || tagWarning ? "yellow" : meta.color,
    sensitiveHits,
    tagCount,
    tagWarning
  };
}

function levelMeta(level: number): { label: string; color: HealthNoteDiagnostic["levelColor"] } {
  if (level <= 0) return { label: "正常/未知", color: "green" };
  if (level <= 2) return { label: "轻微限流", color: "yellow" };
  return { label: "高风险限流", color: "red" };
}
