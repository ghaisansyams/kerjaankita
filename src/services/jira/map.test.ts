import { describe, expect, it } from "vitest";
import { mapJiraIssue } from "@/services/jira/map";

/** Shaped like a real REST v3 payload, description in ADF. */
const issue = {
  key: "ONELITO-76",
  fields: {
    summary: "Redesain isian revisinya desain mencakup:",
    issuetype: { name: "Task" },
    status: { name: "Done" },
    priority: { name: "Medium" },
    assignee: { displayName: "Angga Ferdani", emailAddress: "angga@example.com" },
    duedate: "2026-08-20",
    resolution: { name: "Done" },
    description: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "tampilan layer tv -> gambar ikan potrait, " },
            { type: "text", text: "harga kelipatan bid (100.000, 500.000)" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "id ikan" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "usia ikan" }] }],
            },
          ],
        },
      ],
    },
  },
};

describe("mapJiraIssue", () => {
  it("flattens an ADF description into readable text", async () => {
    const t = mapJiraIssue(issue);
    expect(t.description).toContain("tampilan layer tv -> gambar ikan potrait");
    expect(t.description).toContain("harga kelipatan bid (100.000, 500.000)");
    expect(t.description).toContain("- id ikan");
    expect(t.description).toContain("- usia ikan");
    // No raw ADF should survive.
    expect(t.description).not.toContain("listItem");
    expect(t.description).not.toContain('"type"');
  });

  it("keeps the fields that matter as one trailing line", async () => {
    const t = mapJiraIssue(issue);
    expect(t.title).toBe("Redesain isian revisinya desain mencakup:");
    expect(t.description).toContain("Jira: ONELITO-76");
    expect(t.description).toContain("Status: Done");
    expect(t.description).toContain("PIC: Angga Ferdani");
    expect(t.description).toContain("Due: 2026-08-20");
  });

  it("records the parent for subtasks", async () => {
    const t = mapJiraIssue({
      key: "ONELITO-33",
      fields: {
        summary: "delete bid di panel kontrol",
        issuetype: { name: "Subtask" },
        parent: { key: "ONELITO-28", fields: { summary: "Panel Kontrol" } },
      },
    });
    expect(t.description).toContain("Parent: ONELITO-28 Panel Kontrol");
  });

  it("survives the null shapes Jira actually returns", async () => {
    const t = mapJiraIssue({
      key: "X-1",
      fields: {
        summary: "Tanpa apa-apa",
        description: null,
        assignee: null,
        priority: null,
        resolution: null,
        duedate: null,
      },
    });
    expect(t.title).toBe("Tanpa apa-apa");
    expect(t.description).toBe("Jira: X-1");
  });

  it("caps title and description", async () => {
    const t = mapJiraIssue({
      key: "X-2",
      fields: {
        summary: "a".repeat(500),
        description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "b".repeat(9000) }] }] },
      },
    });
    expect(t.title.length).toBe(200);
    expect(t.description.length).toBe(5000);
  });
});
