import { describe, expect, it, vi } from "vitest";
import {
  parseJobStatus,
  parseCompany,
  parseRole,
  parseReqNumber,
  buildSuggestion,
  fetchJobEmails,
} from "./gmail";
import type { Application, ParsedJobEmail } from "./types";
import { Buffer } from "buffer";

function makeMockApi(overrides: Partial<Record<"all" | "run", unknown>> = {}) {
  const sql = {
    all: vi.fn(),
    run: vi.fn(),
    ...overrides,
  } as unknown;

  const net = {
    fetch: vi.fn(),
  };

  return {
    net,
    sql,
  } as unknown;
}

function encodeBase64(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("job-tracker gmail parsers", () => {
  it("detects Offer before other status hints", () => {
    expect(
      parseJobStatus(
        "We are excited to offer you a role",
        "Interview scheduled",
      ),
    ).toBe("Offer");
  });

  it("detects Rejected phrases", () => {
    expect(
      parseJobStatus(
        "Thank you",
        "Unfortunately we will not be moving forward",
      ),
    ).toBe("Rejected");
  });

  it("detects Onsite interview language", () => {
    expect(
      parseJobStatus(
        "Interview Invitation",
        "Your onsite interview is scheduled",
      ),
    ).toBe("Onsite");
  });

  it("detects Phone interview language", () => {
    expect(parseJobStatus("Next steps", "Please schedule a phone screen")).toBe(
      "Phone",
    );
  });

  it("defaults to Applied when no other status matches", () => {
    expect(parseJobStatus("Hello", "Thanks for your application")).toBe(
      "Applied",
    );
  });

  it("parses company from ATS display name and ignores ATS domain", () => {
    const subject = "Your application at Acme Corp";
    const from = "Acme Corp <noreply@greenhouse.io>";
    const body = "Thanks for applying.";
    expect(parseCompany(subject, from, body)).toBe("Acme Corp");
  });

  it("parses company from plain sender address using main domain", () => {
    const subject = "Application received";
    const from = "noreply@acme.com";
    const body = "Your application is under review";
    expect(parseCompany(subject, from, body)).toBe("Acme");
  });

  it("parses role from explicit title patterns", () => {
    expect(parseRole("Position: Senior Software Engineer", "")).toBe(
      "Senior Software Engineer",
    );
  });

  it('parses role from "for the ... position" patterns', () => {
    expect(
      parseRole(
        "Hello",
        "We would like to invite you for the Backend Engineer position",
      ),
    ).toBe("Backend Engineer");
  });

  it("returns empty string when no role pattern matches", () => {
    expect(parseRole("Hello", "This email does not include a role")).toBe("");
  });

  it("parses requisition numbers from common text patterns", () => {
    expect(parseReqNumber("Requisition #12345", "")).toBe("12345");
    expect(parseReqNumber("Ref no. 9876", "")).toBe("9876");
    expect(parseReqNumber("JR-1234", "")).toBe("1234");
    expect(parseReqNumber("REQ_5678", "")).toBe("5678");
  });

  it("returns empty string when no requisition number is present", () => {
    expect(parseReqNumber("Hello", "No job ID here")).toBe("");
  });

  it("suggests update when company matches existing applications", () => {
    const email = {
      id: 1,
      gmail_id: "m1",
      thread_id: "t1",
      subject: "Your application at Acme",
      from_address: "Acme <noreply@acme.com>",
      received_at: "2025-01-01",
      snippet: "",
      parsed_company: "Acme",
      parsed_role: "Frontend Engineer",
      parsed_status: "Phone",
      parsed_req_number: "",
      application_id: null,
      dismissed: 0,
      fetched_at: Date.now(),
    } as ParsedJobEmail;

    const apps: Application[] = [
      {
        id: 1,
        company: "Acme, Inc.",
        role: "Frontend Engineer",
        status: "Applied",
        applied_at: "2025-01-01",
        location: "",
        source: "",
        link: "",
        notes: "",
        req_number: "",
        last_updated: Date.now(),
      },
    ];

    const suggestion = buildSuggestion(email, apps);
    expect(suggestion.kind).toBe("update");
    if (suggestion.kind === "update") {
      expect(suggestion.app.id).toBe(1);
      expect(suggestion.newStatus).toBe("Phone");
    }
  });

  it("suggests add when there is no matching company", () => {
    const email = {
      id: 2,
      gmail_id: "m2",
      thread_id: "t2",
      subject: "Hello from Example",
      from_address: "Example <noreply@example.com>",
      received_at: "2025-01-02",
      snippet: "",
      parsed_company: "Example",
      parsed_role: "Product Manager",
      parsed_status: "Applied",
      parsed_req_number: "REQ-100",
      application_id: null,
      dismissed: 0,
      fetched_at: Date.now(),
    } as ParsedJobEmail;

    const apps: Application[] = [];
    const suggestion = buildSuggestion(email, apps);
    expect(suggestion.kind).toBe("add");
    if (suggestion.kind === "add") {
      expect(suggestion.prefill.company).toBe("Example");
      expect(suggestion.prefill.role).toBe("Product Manager");
      expect(suggestion.prefill.req_number).toBe("REQ-100");
    }
  });
});

describe("fetchJobEmails", () => {
  it("fetches new messages, inserts parsed rows, and returns stored emails", async () => {
    const api = makeMockApi() as any;
    const listPayload = { messages: [{ id: "msg-1", threadId: "thread-1" }] };
    const bodyText = "Hello, thank you for applying to Example Co.";

    api.net.fetch
      .mockResolvedValueOnce({ ok: true, body: JSON.stringify(listPayload) })
      .mockResolvedValueOnce({
        ok: true,
        body: JSON.stringify({
          id: "msg-1",
          threadId: "thread-1",
          snippet: "Snippet text",
          payload: {
            headers: [
              { name: "Subject", value: "Application received" },
              { name: "From", value: "Example <noreply@example.com>" },
              { name: "Date", value: "Mon, 01 Jan 2024 12:00:00 GMT" },
            ],
            mimeType: "text/plain",
            body: { data: encodeBase64(bodyText) },
          },
        }),
      });

    api.sql.all.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 1,
        gmail_id: "msg-1",
        thread_id: "thread-1",
        subject: "Application received",
        from_address: "Example <noreply@example.com>",
        received_at: new Date("Mon, 01 Jan 2024 12:00:00 GMT").toISOString(),
        snippet: "Snippet text",
        parsed_company: "Example",
        parsed_role: "",
        parsed_status: "Applied",
        parsed_req_number: "",
        application_id: null,
        dismissed: 0,
        fetched_at: expect.any(Number),
      },
    ]);

    const result = await fetchJobEmails(api, "token-abc");

    expect(api.net.fetch).toHaveBeenCalledTimes(2);
    expect(api.sql.all).toHaveBeenCalledTimes(2);
    expect(api.sql.run).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        gmail_id: "msg-1",
        thread_id: "thread-1",
        parsed_company: "Example",
        parsed_status: "Applied",
      }),
    ]);
  });

  it("skips already known gmail ids and does not fetch details again", async () => {
    const api = makeMockApi() as any;
    api.net.fetch.mockResolvedValueOnce({
      ok: true,
      body: JSON.stringify({ messages: [{ id: "existing", threadId: "t1" }] }),
    });
    api.sql.all.mockResolvedValueOnce([{ gmail_id: "existing" }]);
    api.sql.all.mockResolvedValueOnce([]);

    const result = await fetchJobEmails(api, "token-abc");

    expect(api.net.fetch).toHaveBeenCalledTimes(1);
    expect(api.sql.all).toHaveBeenCalledTimes(2);
    expect(api.sql.run).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("throws when the Gmail list endpoint returns a failure", async () => {
    const api = makeMockApi() as any;
    api.net.fetch.mockResolvedValueOnce({ ok: false, status: 401, body: "" });

    await expect(fetchJobEmails(api, "token-abc")).rejects.toThrow(
      "Gmail list failed: 401",
    );
  });

  it("continues when an individual message fetch fails", async () => {
    const api = makeMockApi() as any;
    api.net.fetch
      .mockResolvedValueOnce({
        ok: true,
        body: JSON.stringify({
          messages: [{ id: "msg-1", threadId: "thread-1" }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, body: "" });
    api.sql.all.mockResolvedValueOnce([]);
    api.sql.all.mockResolvedValueOnce([]);

    const result = await fetchJobEmails(api, "token-abc");

    expect(api.net.fetch).toHaveBeenCalledTimes(2);
    expect(api.sql.run).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
