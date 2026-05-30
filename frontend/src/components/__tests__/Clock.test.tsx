import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Clock from "../Clock";

describe("Clock", () => {
  it("renders time in HH:MM:SS format", () => {
    const { container } = render(<Clock mode="real" />);
    const text = container.textContent || "";
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("renders fake time", () => {
    const { container } = render(<Clock mode="fake" fakeTime="14:30:00" />);
    expect(container.textContent).toMatch(/14:30:00/);
  });

  it("renders default fake time when not specified", () => {
    const { container } = render(<Clock mode="fake" />);
    const text = container.textContent || "";
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
