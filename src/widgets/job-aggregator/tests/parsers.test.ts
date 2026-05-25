import { describe, expect, it } from "vitest";
import { parseGreenhouseJSON, parseLeverXML, parseRSSXML } from "../parsers";

describe("parseLeverXML", () => {
  it("parses lever jobs and falls back apply URL", () => {
    const xml = `
      <jobs>
        <job>
          <title>Frontend Engineer</title>
          <hostedUrl>https://example.com/jobs/1</hostedUrl>
          <categories>
            <location>Remote</location>
          </categories>
          <createdAt>1704067200000</createdAt>
          <descriptionBody><![CDATA[<p>Build <strong>UIs</strong></p>]]></descriptionBody>
        </job>
      </jobs>
    `;

    expect(parseLeverXML(xml, "Acme")).toEqual([
      {
        ext_id: "https://example.com/jobs/1",
        title: "Frontend Engineer",
        company: "Acme",
        location: "Remote",
        date_posted: "2024-01-01",
        apply_link: "https://example.com/jobs/1",
        description: "Build UIs",
      },
    ]);
  });

  it("throws on invalid xml", () => {
    expect(() => parseLeverXML("<jobs>", "Acme")).toThrow(
      "Invalid XML from Lever feed",
    );
  });
});

describe("parseRSSXML", () => {
  it("parses RSS items", () => {
    const xml = `
      <rss>
        <channel>
          <item>
            <title>Platform Engineer</title>
            <link>https://example.com/jobs/2</link>
            <description><![CDATA[<p>Maintain systems</p>]]></description>
            <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
            <company>ExampleCo</company>
            <location>NYC</location>
          </item>
        </channel>
      </rss>
    `;

    expect(parseRSSXML(xml, "FallbackCo")).toEqual([
      {
        ext_id: "https://example.com/jobs/2",
        title: "Platform Engineer",
        company: "ExampleCo",
        location: "NYC",
        date_posted: "2024-01-02",
        apply_link: "https://example.com/jobs/2",
        description: "Maintain systems",
      },
    ]);
  });

  it("parses atom items", () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Data Engineer</title>
          <link href="https://example.com/jobs/3"/>
          <summary><![CDATA[<p>Own data pipelines</p>]]></summary>
          <updated>2024-03-05T00:00:00Z</updated>
        </entry>
      </feed>
    `;

    expect(parseRSSXML(xml, "FallbackCo")).toEqual([
      {
        ext_id: "https://example.com/jobs/3",
        title: "Data Engineer",
        company: "FallbackCo",
        location: "",
        date_posted: "2024-03-05",
        apply_link: "https://example.com/jobs/3",
        description: "Own data pipelines",
      },
    ]);
  });

  it("throws on invalid xml", () => {
    expect(() => parseRSSXML("<rss>", "Acme")).toThrow("Invalid XML feed");
  });
});

describe("parseGreenhouseJSON", () => {
  it("maps greenhouse payload to parsed jobs", () => {
    const json = JSON.stringify({
      jobs: [
        {
          id: 123,
          title: "QA Engineer",
          location: { name: "Austin, TX" },
          updated_at: "2024-04-10T10:00:00Z",
          absolute_url: "https://example.com/jobs/4",
        },
        {
          id: 456,
          title: "",
          absolute_url: "https://example.com/jobs/skip",
        },
      ],
    });

    expect(parseGreenhouseJSON(json, "GreenhouseCo")).toEqual([
      {
        ext_id: "123",
        title: "QA Engineer",
        company: "GreenhouseCo",
        location: "Austin, TX",
        date_posted: "2024-04-10",
        apply_link: "https://example.com/jobs/4",
        description: "",
      },
    ]);
  });
});
