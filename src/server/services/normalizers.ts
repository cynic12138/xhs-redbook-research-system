import type { AuthorPostRecord, AuthorRecord, CommentRecord, NoteRecord } from "../../shared/types.js";
import { asRecord, hotScore, nowIso, parseCount, pickString } from "../../shared/utils.js";
import { buildWebUrl } from "./url.js";

export function normalizeSearchResults(raw: unknown, keyword: string, jobId: string): NoteRecord[] {
  const data = asRecord(raw);
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((item) => {
      const record = asRecord(item);
      return record.model_type === "note" || record.modelType === "note" || Boolean(record.note_card ?? record.noteCard);
    })
    .map((item) => normalizeNote(item, keyword, jobId))
    .filter((note): note is NoteRecord => Boolean(note));
}

export function normalizeNote(raw: unknown, keyword: string, jobId: string, existing?: NoteRecord): NoteRecord | undefined {
  const wrapper = asRecord(raw);
  const card = asRecord(wrapper.note_card ?? wrapper.noteCard ?? raw);
  const interact = asRecord(card.interact_info ?? card.interactInfo);
  const user = asRecord(card.user ?? card.user_info ?? card.userInfo);
  const noteId = pickString(card.note_id, card.noteId, card.id, wrapper.id);

  if (!noteId) {
    return undefined;
  }

  const title = pickString(card.title, card.display_title, card.displayTitle, existing?.title, "(无标题)");
  const desc = pickString(card.desc, card.description, card.content, existing?.desc);
  const xsecToken = pickString(card.xsec_token, card.xsecToken, wrapper.xsec_token, wrapper.xsecToken);
  const webUrl = pickString(card.webUrl, wrapper.webUrl, existing?.webUrl) || buildWebUrl(noteId, xsecToken, "pc_search");
  const noteUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
  const authorId = pickString(user.user_id, user.userId, card.user_id, card.userId, existing?.authorId);
  const authorName = pickString(user.nickname, card.nickname, existing?.authorName);
  const type = normalizeNoteType(pickString(card.type, card.note_type, existing?.type));
  const cover = asRecord(card.cover ?? card.image ?? card.cover_info);
  const imageUrls = normalizeImageUrls(card, existing);
  const videoUrl = pickUrl(
    normalizeVideoUrl(card),
    existing?.videoUrl
  );
  const likedCount = parseCount(interact.liked_count ?? interact.likedCount ?? card.liked_count ?? card.likedCount);
  const collectedCount = parseCount(
    interact.collected_count ?? interact.collectedCount ?? card.collected_count ?? card.collectedCount
  );
  const commentCount = parseCount(
    interact.comment_count ?? interact.commentCount ?? card.comment_count ?? card.commentCount
  );
  const shareCount = parseCount(interact.share_count ?? interact.shareCount ?? card.share_count ?? card.shareCount);

  const note: NoteRecord = {
    id: noteId,
    jobIds: mergeUnique(existing?.jobIds ?? [], [jobId]),
    keywords: mergeUnique(existing?.keywords ?? [], [keyword]),
    title,
    desc,
    type,
    webUrl,
    noteUrl,
    authorId,
    authorName,
    coverUrl: pickUrl(
      cover.url_default,
      cover.urlDefault,
      cover.url,
      card.cover_url,
      card.coverUrl,
      imageUrls[0],
      existing?.coverUrl
    ),
    imageUrls,
    videoUrl,
    likedCount: likedCount || existing?.likedCount || 0,
    collectedCount: collectedCount || existing?.collectedCount || 0,
    commentCount: commentCount || existing?.commentCount || 0,
    shareCount: shareCount || existing?.shareCount || 0,
    hotScore: 0,
    publishedAt: pickString(card.time, card.publish_time, card.publishTime, existing?.publishedAt) || undefined,
    raw,
    analysis: existing?.analysis,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };
  note.hotScore = hotScore(note);
  return note;
}

export function normalizeComments(raw: unknown, noteId: string): CommentRecord[] {
  const items = Array.isArray(raw) ? raw : Array.isArray(asRecord(raw).comments) ? (asRecord(raw).comments as unknown[]) : [];
  return items.map((item) => normalizeComment(item, noteId)).filter((comment): comment is CommentRecord => Boolean(comment));
}

export function normalizeComment(raw: unknown, noteId: string): CommentRecord | undefined {
  const record = asRecord(raw);
  const user = asRecord(record.user_info ?? record.userInfo ?? record.user);
  const id = pickString(record.id, record.comment_id, record.commentId);
  const content = pickString(record.content, record.text);
  if (!id || !content) {
    return undefined;
  }

  return {
    id,
    noteId,
    authorId: pickString(user.user_id, user.userId) || undefined,
    authorName: pickString(user.nickname, user.name) || undefined,
    content,
    likedCount: parseCount(record.like_count ?? record.likeCount ?? record.liked_count ?? record.likedCount),
    raw,
    createdAt: nowIso()
  };
}

export function normalizeAuthor(raw: unknown, fallbackId: string): AuthorRecord {
  const record = asRecord(raw);
  const basic = asRecord(record.basic_info ?? record.basicInfo ?? record.user_info ?? record.userInfo ?? record);
  const interactions = Array.isArray(record.interactions) ? record.interactions.map(asRecord) : [];
  const findInteraction = (type: string) => interactions.find((item) => item.type === type || item.name === type);

  return {
    id: pickString(basic.user_id, basic.userId, basic.id, fallbackId) || fallbackId,
    nickname: pickString(basic.nickname, basic.name, basic.nickName, fallbackId),
    avatar: pickString(basic.image, basic.images, basic.imageb, basic.avatar, basic.avatar_url, basic.avatarUrl) || undefined,
    desc: pickString(basic.desc, basic.description, basic.intro) || undefined,
    fansCount: parseCount(findInteraction("fans")?.count ?? record.fans_count ?? record.fansCount),
    followingCount: parseCount(findInteraction("follows")?.count ?? record.following_count ?? record.followingCount),
    likedCount: parseCount(findInteraction("interaction")?.count ?? record.liked_count ?? record.likedCount),
    noteCount: parseCount(record.note_count ?? record.noteCount),
    raw,
    updatedAt: nowIso()
  };
}

export function normalizeAuthorPosts(raw: unknown, authorId: string): AuthorPostRecord[] {
  const data = asRecord(raw);
  const items = Array.isArray(data.notes) ? data.notes : Array.isArray(raw) ? raw : [];
  return items
    .map((item): AuthorPostRecord | undefined => {
      const wrapper = asRecord(item);
      const record = asRecord(wrapper.note_card ?? wrapper.noteCard ?? item);
      const interact = asRecord(record.interact_info ?? record.interactInfo ?? wrapper.interact_info ?? wrapper.interactInfo);
      const id = pickString(record.note_id, record.noteId, record.id, wrapper.note_id, wrapper.noteId, wrapper.id);
      if (!id) {
        return undefined;
      }
      const xsecToken = pickString(record.xsec_token, record.xsecToken, wrapper.xsec_token, wrapper.xsecToken);
      const webUrl = pickString(record.webUrl, wrapper.webUrl) || buildWebUrl(id, xsecToken, "pc_user");
      const post: AuthorPostRecord = {
        id,
        authorId,
        title: pickString(record.display_title, record.displayTitle, record.title, "(无标题)"),
        type: normalizeNoteType(pickString(record.type)),
        likedCount: parseCount(interact.liked_count ?? interact.likedCount ?? record.liked_count ?? record.likedCount),
        collectedCount: parseCount(
          interact.collected_count ?? interact.collectedCount ?? record.collected_count ?? record.collectedCount
        ),
        commentCount: parseCount(interact.comment_count ?? interact.commentCount ?? record.comment_count ?? record.commentCount),
        raw: item
      };
      if (webUrl) {
        post.webUrl = webUrl;
      }
      return post;
    })
    .filter((post): post is AuthorPostRecord => Boolean(post));
}

export function normalizeNoteType(value: string): "normal" | "video" | "unknown" {
  if (value === "normal" || value === "image") {
    return "normal";
  }
  if (value === "video") {
    return "video";
  }
  return "unknown";
}

function normalizeImageUrls(card: Record<string, unknown>, existing?: NoteRecord): string[] {
  const urls: string[] = [];
  collectUrls(card.cover, urls);
  collectUrls(card.cover_info, urls);
  collectUrls(card.coverInfo, urls);
  collectUrls(card.image_list, urls);
  collectUrls(card.imageList, urls);
  collectUrls(card.images, urls);
  collectUrls(card.image, urls);
  collectUrls(card.image_info, urls);
  collectUrls(card.imageInfo, urls);
  return mergeUnique(urls, existing?.imageUrls ?? []).filter((url) => !isVideoUrl(url));
}

function normalizeVideoUrl(card: Record<string, unknown>): string {
  const video = asRecord(card.video ?? card.video_info ?? card.videoInfo);
  const media = asRecord(video.media);
  const direct = pickVideoUrl(
      video.url,
      video.video_url,
      video.videoUrl,
      video.master_url,
      video.masterUrl,
      video.stream_url,
      video.streamUrl,
      video.h264_url,
      video.h264Url,
      media.stream_url,
      media.streamUrl
  );
  if (direct) {
    return direct;
  }

  const urls: string[] = [];
  collectUrls(video, urls);
  if (normalizeNoteType(pickString(card.type, card.note_type, card.noteType)) === "video") {
    collectUrls(card.image_list, urls);
    collectUrls(card.imageList, urls);
  }
  return urls.find(isVideoUrl) ?? "";
}

function firstUrl(value: unknown): string {
  const urls: string[] = [];
  collectUrls(value, urls);
  return urls[0] ?? "";
}

function collectUrls(value: unknown, urls: string[], depth = 0): void {
  if (depth > 5 || value === undefined || value === null) {
    return;
  }
  const url = normalizeUrl(value);
  if (url) {
    urls.push(url);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, urls, depth + 1);
    }
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectUrls(item, urls, depth + 1);
    }
  }
}

function pickUrl(...values: unknown[]): string {
  for (const value of values) {
    const url = normalizeUrl(value);
    if (url) {
      return url;
    }
  }
  return "";
}

function pickVideoUrl(...values: unknown[]): string {
  for (const value of values) {
    const url = normalizeUrl(value);
    if (url && isVideoUrl(url)) {
      return url;
    }
  }
  return "";
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|m3u8|mov)(\?|#|$)/i.test(url) || /\/stream\//i.test(url);
}

function mergeUnique<T>(a: T[], b: T[]): T[] {
  return [...new Set([...a, ...b].filter(Boolean))];
}
