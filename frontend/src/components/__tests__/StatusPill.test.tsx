import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusPill from "../StatusPill";

describe("StatusPill", () => {
  it('renders "En Hora" for Scheduled status', () => {
    render(<StatusPill status="Scheduled" />);
    expect(screen.getByText("En Hora")).toBeInTheDocument();
  });

  it('renders "Embarcando" for Boarding status', () => {
    render(<StatusPill status="Boarding" />);
    expect(screen.getByText("Embarcando")).toBeInTheDocument();
  });

  it('renders "Demorado" for Delayed status', () => {
    render(<StatusPill status="Delayed" />);
    expect(screen.getByText("Demorado")).toBeInTheDocument();
  });

  it('renders "Salido" for Departed status', () => {
    render(<StatusPill status="Departed" />);
    expect(screen.getByText("Salido")).toBeInTheDocument();
  });

  it('renders "Suprimido" for Cancelled status', () => {
    render(<StatusPill status="Cancelled" />);
    expect(screen.getByText("Suprimido")).toBeInTheDocument();
  });

  it("applies correct CSS classes for Delayed", () => {
    render(<StatusPill status="Delayed" />);
    const el = screen.getByText("Demorado");
    expect(el.className).toContain("font-bold");
  });

  it("applies uppercase class", () => {
    render(<StatusPill status="Scheduled" />);
    const el = screen.getByText("En Hora");
    expect(el.className).toContain("uppercase");
  });

  it("renders with large size when large prop is true", () => {
    render(<StatusPill status="Cancelled" large />);
    const el = screen.getByText("Suprimido");
    expect(el.className).toContain("text-base");
  });

  it("renders with small size by default", () => {
    render(<StatusPill status="Cancelled" />);
    const el = screen.getByText("Suprimido");
    expect(el.className).toContain("text-sm");
  });
});
