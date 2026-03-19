import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotionSkill } from "../../notion/client.js";
import { clearAllLimiters } from "@ureru-buzz-ai/core";

// Mock @notionhq/client
vi.mock("@notionhq/client", () => {
  const mockQuery = vi.fn();
  const mockRetrieve = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();

  return {
    Client: vi.fn().mockImplementation(() => ({
      databases: { query: mockQuery },
      pages: {
        retrieve: mockRetrieve,
        create: mockCreate,
        update: mockUpdate,
      },
    })),
    isFullPage: vi.fn().mockReturnValue(true),
    __mocks: { mockQuery, mockRetrieve, mockCreate, mockUpdate },
  };
});

const { __mocks } = await import("@notionhq/client") as any;

describe("NotionSkill", () => {
  let skill: NotionSkill;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllLimiters();
    skill = new NotionSkill("test-api-key");
  });

  describe("queryDatabase", () => {
    it("returns pages from database query", async () => {
      const mockPage = {
        id: "page-1",
        object: "page",
        properties: {},
        parent: { type: "database_id", database_id: "db-1" },
        created_time: "2024-01-01",
        last_edited_time: "2024-01-01",
        archived: false,
        url: "https://notion.so/page-1",
      };

      __mocks.mockQuery.mockResolvedValueOnce({
        results: [mockPage],
        has_more: false,
        next_cursor: null,
      });

      const results = await skill.queryDatabase({ databaseId: "db-1" });
      expect(results).toHaveLength(1);
      expect(__mocks.mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ database_id: "db-1" }),
      );
    });

    it("handles pagination automatically", async () => {
      const mockPage1 = { id: "page-1", object: "page", properties: {}, parent: { type: "database_id", database_id: "db-1" }, created_time: "", last_edited_time: "", archived: false, url: "" };
      const mockPage2 = { id: "page-2", object: "page", properties: {}, parent: { type: "database_id", database_id: "db-1" }, created_time: "", last_edited_time: "", archived: false, url: "" };

      __mocks.mockQuery
        .mockResolvedValueOnce({
          results: [mockPage1],
          has_more: true,
          next_cursor: "cursor-1",
        })
        .mockResolvedValueOnce({
          results: [mockPage2],
          has_more: false,
          next_cursor: null,
        });

      const results = await skill.queryDatabase({ databaseId: "db-1" });
      expect(results).toHaveLength(2);
      expect(__mocks.mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe("getPage", () => {
    it("retrieves a page by id", async () => {
      const mockPage = {
        id: "page-1",
        object: "page",
        properties: {},
        parent: { type: "database_id", database_id: "db-1" },
        created_time: "",
        last_edited_time: "",
        archived: false,
        url: "",
      };

      __mocks.mockRetrieve.mockResolvedValueOnce(mockPage);
      const result = await skill.getPage("page-1");
      expect(result.id).toBe("page-1");
    });
  });

  describe("createPage", () => {
    it("creates page and returns page id", async () => {
      __mocks.mockCreate.mockResolvedValueOnce({ id: "new-page-1" });

      const pageId = await skill.createPage({
        databaseId: "db-1",
        properties: { title: { title: [{ text: { content: "Test" } }] } },
      });

      expect(pageId).toBe("new-page-1");
    });
  });

  describe("updatePage", () => {
    it("updates page properties", async () => {
      __mocks.mockUpdate.mockResolvedValueOnce({ id: "page-1" });

      await skill.updatePage({
        pageId: "page-1",
        properties: { status: { select: { name: "完了" } } },
      });

      expect(__mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ page_id: "page-1" }),
      );
    });
  });
});
