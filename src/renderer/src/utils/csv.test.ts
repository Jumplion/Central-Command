import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportCsv } from "./csv";

describe("exportCsv", () => {
  let mockObjectUrl: string;
  let capturedHref: string;
  let capturedDownload: string;
  let clickCalled: boolean;
  let revokeTarget: string;

  beforeEach(() => {
    mockObjectUrl = "blob:mock-123";
    capturedHref = "";
    capturedDownload = "";
    clickCalled = false;
    revokeTarget = "";

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => mockObjectUrl),
      revokeObjectURL: vi.fn((url: string) => {
        revokeTarget = url;
      }),
    });

    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {
          clickCalled = true;
          capturedHref = (el as HTMLAnchorElement).href;
          capturedDownload = (el as HTMLAnchorElement).download;
        });
      }
      return el;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("triggers a download anchor click", () => {
    exportCsv(["Name", "Age"], [["Alice", "30"]], "people.csv");
    expect(clickCalled).toBe(true);
  });

  it("sets the download attribute to the provided filename", () => {
    exportCsv(["Name", "Age"], [["Alice", "30"]], "people.csv");
    expect(capturedDownload).toBe("people.csv");
  });

  it("revokes the object URL after clicking", () => {
    exportCsv(["Name"], [["Alice"]], "test.csv");
    expect(revokeTarget).toBe(mockObjectUrl);
  });

  it("calls URL.createObjectURL with a Blob", () => {
    exportCsv(["Col"], [["val"]], "out.csv");
    const createCall = vi.mocked(URL.createObjectURL).mock.calls[0];
    expect(createCall[0]).toBeInstanceOf(Blob);
  });

  it("passes the blob URL as the href", () => {
    exportCsv(["Col"], [["val"]], "out.csv");
    expect(capturedHref).toContain(mockObjectUrl);
  });

  it("creates the blob with text/csv MIME type", () => {
    let capturedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return mockObjectUrl;
    });
    exportCsv(["A"], [["1"]], "data.csv");
    expect(capturedBlob).not.toBeNull();
    expect((capturedBlob as unknown as Blob).type).toBe("text/csv");
  });

  it("includes the header row and data row in the blob content", async () => {
    let capturedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return mockObjectUrl;
    });

    exportCsv(["Name", "Score"], [["Alice", "95"], ["Bob", "88"]], "scores.csv");

    const text = await (capturedBlob as unknown as Blob).text();
    expect(text).toContain("Name,Score");
    expect(text).toContain('"Alice"');
    expect(text).toContain('"Bob"');
  });

  it("handles empty rows array (header only)", () => {
    exportCsv(["Id", "Title"], [], "empty.csv");
    expect(clickCalled).toBe(true);
  });
});
