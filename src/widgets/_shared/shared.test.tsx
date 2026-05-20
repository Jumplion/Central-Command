import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { vi, describe, expect, it } from "vitest";
import { Chip } from "./Chip";
import { StatusBar } from "./StatusBar";
import { StackedBarChart } from "./StackedBarChart";
import { ListRow, InteractiveListRow, TableHeader } from "./list";
import { FormSection, FormField, FormGrid, FormActions } from "./form";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("shared widget utilities", () => {
  it("renders Chip with active styles and responds to click", () => {
    const onClick = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        <Chip active color="#123456" onClick={onClick}>
          Hello
        </Chip>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe("Hello");
    expect(button?.style.background).toContain("rgba(18, 52, 86");

    act(() => {
      button?.click();
    });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders StatusBar items and calls onSelect", () => {
    const onSelect = vi.fn();
    const items = [
      { value: "one", label: "One", count: 1, color: "#f00" },
      { value: "two", label: "Two", count: 2, color: "#0f0" },
    ];

    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        <StatusBar
          items={items}
          selected="one"
          onSelect={onSelect}
          allLabel="All"
          allCount={3}
          allColor="#00f"
        />,
      );
    });

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    );
    expect(buttons.map((button) => button.textContent)).toEqual([
      "All (3)",
      "One (1)",
      "Two (2)",
    ]);

    act(() => {
      buttons[2].click();
    });
    expect(onSelect).toHaveBeenCalledWith("two");

    const bars = Array.from(
      container.querySelectorAll<HTMLDivElement>("div[title]"),
    );
    expect(bars.length).toBe(2);
    expect(bars[0].style.width).toBe("33.33333333333333%");
    expect(bars[1].style.width).toBe("66.66666666666666%");
  });

  it("renders StackedBarChart with labels and stacked bars", () => {
    const html = renderToString(
      <StackedBarChart
        data={[
          { label: "A", x: 5, y: 3 },
          { label: "B", x: 2, y: 0 },
        ]}
        series={[
          { key: "x", color: "#f00" },
          { key: "y", color: "#0f0" },
        ]}
      />,
    );

    expect(html).toContain("A");
    expect(html).toContain("B");
    expect(html.match(/<rect/g)?.length).toBe(3);
  });

  it("renders form helpers with title, helper text, and children", () => {
    const html = renderToString(
      <FormSection title="Section" description="Details">
        <FormField label="Name" helper="Required">
          <span>Input</span>
        </FormField>
        <FormGrid columns={2} gap={4}>
          <div>One</div>
          <div>Two</div>
        </FormGrid>
        <FormActions>
          <button type="button">Save</button>
        </FormActions>
      </FormSection>,
    );

    expect(html).toContain("Section");
    expect(html).toContain("Details");
    expect(html).toContain("Name");
    expect(html).toContain("Required");
    expect(html).toContain("Save");
    expect(html).toContain("display:grid");
  });

  it("renders list components and handles interactive click", () => {
    const onClick = vi.fn();
    const html = renderToString(
      <div>
        <ListRow>Row</ListRow>
        <InteractiveListRow onClick={onClick}>Clickable</InteractiveListRow>
        <TableHeader>Header</TableHeader>
      </div>,
    );

    expect(html).toContain("Row");
    expect(html).toContain("Clickable");
    expect(html).toContain("Header");

    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        <InteractiveListRow onClick={onClick}>Clickable</InteractiveListRow>,
      );
    });
    const button = container.querySelector<HTMLButtonElement>("button");
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onClick).toHaveBeenCalledOnce();
  });
});
