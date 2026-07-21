import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("built-in SQLite runtime", () => {
  it("creates, writes, reads and closes an in-memory database", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("CREATE TABLE smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    database.prepare("INSERT INTO smoke (value) VALUES (?)").run("ok");

    expect(database.prepare("SELECT value FROM smoke WHERE id = 1").get()).toEqual({ value: "ok" });
    database.close();
  });
});
