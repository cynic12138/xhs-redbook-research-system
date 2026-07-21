import { XhsClient } from "@lucasygu/redbook";
import { cookiesToString, extractCookies, parseCookieString } from "@lucasygu/redbook/cookies";
import type { NoteTypeFilter, SearchSort, UserSummary } from "../../shared/types.js";
import { asRecord, pickString } from "../../shared/utils.js";
import { resolveRuntimeCredentialVault } from "../runtime/runtimeCredentialVault.js";
import { COOKIE_CREDENTIAL_KEY } from "../storage/credentialKeys.js";
import { enrichWithWebUrl, parseNoteUrl } from "./url.js";

type RedbookSort = "general" | "popularity_descending" | "time_descending";
type RedbookNoteType = 0 | 1 | 2;

const sortMap: Record<SearchSort, RedbookSort> = {
  general: "general",
  popular: "popularity_descending",
  latest: "time_descending"
};

const typeMap: Record<NoteTypeFilter, RedbookNoteType> = {
  all: 0,
  video: 1,
  image: 2
};

export class RedbookService {
  async verifyCookie(cookieString?: string): Promise<UserSummary> {
    const client = await this.getClient(cookieString);
    const raw = await client.getSelfInfo();
    return summarizeUser(raw);
  }

  async extractChromeCookie(): Promise<{ cookieString: string; user: UserSummary }> {
    const cookies = await extractCookies("chrome");
    const cookieString = cookiesToString(cookies);
    const user = await this.verifyCookie(cookieString);
    return { cookieString, user };
  }

  async search(keyword: string, page: number, sort: SearchSort, noteType: NoteTypeFilter): Promise<unknown> {
    const client = await this.getClient();
    const result = await client.searchNotes(keyword, page, 20, sortMap[sort], typeMap[noteType]);
    return enrichWithWebUrl(result, "pc_search");
  }

  async read(url: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId, xsecToken } = parseNoteUrl(url);
    if (xsecToken) {
      try {
        const feedResult = asRecord(await client.getNoteById(noteId, xsecToken));
        const items = Array.isArray(feedResult.items) ? feedResult.items : [];
        const first = asRecord(items[0]);
        return enrichWithWebUrl(first.note_card ?? feedResult, "pc_share");
      } catch {
        return enrichWithWebUrl(await client.getNoteFromHtml(noteId, xsecToken), "pc_share");
      }
    }
    return enrichWithWebUrl(await client.getNoteFromHtml(noteId, ""), "pc_share");
  }

  async comments(url: string, maxPages = 3): Promise<unknown[]> {
    const client = await this.getClient();
    const { noteId, xsecToken } = parseNoteUrl(url);
    const comments: unknown[] = [];
    let cursor = "";

    for (let page = 0; page < Math.max(1, maxPages); page += 1) {
      const result = asRecord(await client.getComments(noteId, cursor, xsecToken ?? ""));
      if (Array.isArray(result.comments)) {
        comments.push(...result.comments);
      }
      if (!result.has_more || !result.cursor) {
        break;
      }
      cursor = String(result.cursor);
    }
    return comments;
  }

  async user(userId: string): Promise<unknown> {
    try {
      return await this.getClient().then((client) => client.getUserInfo(userId));
    } catch (error) {
      const fallback = await this.userProfileFromHtml(userId);
      if (fallback) {
        return fallback;
      }
      throw error;
    }
  }

  async userPosts(userId: string): Promise<unknown> {
    try {
      const client = await this.getClient();
      return enrichWithWebUrl(await client.getUserNotes(userId, ""), "pc_user");
    } catch (error) {
      const fallback = await this.userProfileFromHtml(userId, true);
      const notes = extractProfileNotes(fallback);
      if (notes.length) {
        return { notes, total: notes.length, source: "profile-html" };
      }
      throw error;
    }
  }

  async feed(category = "homefeed_recommend"): Promise<unknown> {
    const client = await this.getClient();
    return enrichWithWebUrl(await client.getHomeFeed(category), "pc_feed");
  }

  async topics(keyword: string): Promise<unknown> {
    const client = await this.getClient();
    return client.searchTopics(keyword);
  }

  async favorites(userId?: string, all = false): Promise<unknown> {
    const client = await this.getClient();
    const targetUserId = userId || (await this.currentUserId());
    const notes: unknown[] = [];
    let cursor = "";

    do {
      const result = asRecord(await client.getUserCollectedNotes(targetUserId, 20, cursor));
      const pageNotes = Array.isArray(result.notes) ? result.notes : [];
      notes.push(...pageNotes);
      cursor = pickString(result.cursor);
      if (!all || !result.has_more || !cursor) {
        break;
      }
    } while (true);

    return enrichWithWebUrl({ notes, total: notes.length }, "pc_user");
  }

  async followers(userId: string, all = false): Promise<unknown> {
    const client = await this.getClient();
    const users: unknown[] = [];
    let cursor = "";

    do {
      const result = asRecord(await client.getUserFollowers(userId, cursor));
      const items = Array.isArray(result.users) ? result.users : Array.isArray(result.followers) ? result.followers : [];
      users.push(...items);
      cursor = pickString(result.cursor);
      if (!all || !result.has_more || !cursor) {
        break;
      }
    } while (true);

    return { users, total: users.length };
  }

  async following(userId: string, all = false): Promise<unknown> {
    const client = await this.getClient();
    const users: unknown[] = [];
    let cursor = "";

    do {
      const result = asRecord(await client.getUserFollowing(userId, cursor));
      const items = Array.isArray(result.users) ? result.users : Array.isArray(result.following) ? result.following : [];
      users.push(...items);
      cursor = pickString(result.cursor);
      if (!all || !result.has_more || !cursor) {
        break;
      }
    } while (true);

    return { users, total: users.length };
  }

  async boards(userId?: string): Promise<unknown> {
    const client = await this.getClient();
    const targetUserId = userId || (await this.currentUserId());
    return client.getUserBoards(targetUserId);
  }

  async board(boardIdOrUrl: string): Promise<unknown> {
    const client = await this.getClient();
    const boardId = boardIdOrUrl.includes("xiaohongshu.com/board/")
      ? new URL(boardIdOrUrl).pathname.split("/").filter(Boolean).at(-1) ?? boardIdOrUrl
      : boardIdOrUrl;
    return enrichWithWebUrl(await client.getBoardNotes(boardId), "pc_board");
  }

  async creatorNotes(tab = 0, pages = 1): Promise<unknown[]> {
    const client = await this.getClient();
    const notes: unknown[] = [];
    for (let page = 1; page <= Math.max(1, pages); page += 1) {
      const result = asRecord(await client.getCreatorNoteList(tab, page));
      const items = Array.isArray(result.notes)
        ? result.notes
        : Array.isArray(result.list)
          ? result.list
          : Array.isArray(result.items)
            ? result.items
            : [];
      notes.push(...items);
    }
    return notes;
  }

  async comment(url: string, content: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return client.postComment(noteId, content);
  }

  async reply(url: string, commentId: string, content: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return client.replyComment(noteId, commentId, content);
  }

  async collect(url: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return client.collectNote(noteId);
  }

  async uncollect(url: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return client.uncollectNote(noteId);
  }

  async like(url: string, undo = false): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return undo ? client.unlikeNote(noteId) : client.likeNote(noteId);
  }

  async delete(url: string): Promise<unknown> {
    const client = await this.getClient();
    const { noteId } = parseNoteUrl(url);
    return client.deleteNote(noteId);
  }

  private async currentUserId(): Promise<string> {
    const summary = await this.verifyCookie();
    if (!summary.id) {
      throw new Error("Current user id is unavailable.");
    }
    return summary.id;
  }

  private async userProfileFromHtml(userId: string, includeNotes = false): Promise<unknown | undefined> {
    const cookie = await (await resolveRuntimeCredentialVault()).get(COOKIE_CREDENTIAL_KEY);
    if (!cookie) {
      return undefined;
    }

    const response = await fetch(`https://www.xiaohongshu.com/user/profile/${encodeURIComponent(userId)}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        cookie,
        referer: "https://www.xiaohongshu.com/"
      }
    });
    const html = await response.text();
    const marker = "<script>window.__INITIAL_STATE__=";
    const start = html.indexOf(marker);
    if (!response.ok || start < 0) {
      return undefined;
    }
    const jsonStart = start + marker.length;
    const end = html.indexOf("</script>", jsonStart);
    if (end < 0) {
      return undefined;
    }
    try {
      const state = asRecord(JSON.parse(html.slice(jsonStart, end).replace(/\bundefined\b/g, "null")));
      const user = asRecord(state.user);
      const profile = asRecord(user.userPageData);
      return includeNotes ? { ...profile, notes: user.notes } : profile;
    } catch {
      return undefined;
    }
  }

  private async getClient(cookieString?: string): Promise<XhsClient> {
    const cookie = cookieString ?? (await (await resolveRuntimeCredentialVault()).get(COOKIE_CREDENTIAL_KEY));
    if (!cookie) {
      throw new Error("Missing XHS_COOKIE_STRING. Paste cookies in the login panel first.");
    }
    return new XhsClient(parseCookieString(cookie));
  }
}

export const redbook = new RedbookService();

function extractProfileNotes(profile: unknown): unknown[] {
  const state = asRecord(profile);
  const notes = state.notes;
  if (Array.isArray(notes)) {
    return notes.flatMap((item) => (Array.isArray(item) ? item : [item])).filter(Boolean);
  }
  return [];
}

export function summarizeUser(raw: unknown): UserSummary {
  const record = asRecord(raw);
  const basic = asRecord(record.basic_info ?? record.basicInfo ?? record.user_info ?? record.userInfo ?? record);
  return {
    id: pickString(basic.user_id, basic.userId, basic.id, record.user_id, record.userId),
    nickname: pickString(basic.nickname, basic.name, record.nickname),
    avatar: pickString(basic.image, basic.avatar, basic.avatar_url, basic.avatarUrl),
    raw
  };
}
