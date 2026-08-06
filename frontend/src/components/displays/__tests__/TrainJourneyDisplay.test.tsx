import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TrainJourneyDisplay, { formatStopTime, type JourneyTrain } from "../TrainJourneyDisplay";

afterEach(cleanup);

const baseTrain: JourneyTrain = {
  id: 1,
  number: "1234",
  destination: "Alacant Terminal",
  scheduled_time: "12:30",
  status: "Scheduled",
  platform: "3",
  operator_name: "Renfe",
  type_code: "C-5",
  stops: [
    { station: "Cuenca", time: "12:55" },
    { station: "Albacete", time: "13:33" },
    { station: "Villena", time: "14:24" },
    { station: "Alacant Terminal", time: "14:45" },
  ],
};

const clock = new Date(2026, 7, 6, 12, 0, 0);

describe("formatStopTime", () => {
  it("truncates seconds and handles missing values", () => {
    expect(formatStopTime("14:45:00")).toBe("14:45");
    expect(formatStopTime()).toBe("--:--");
  });
});

describe("TrainJourneyDisplay", () => {
  it("renders the full-screen no-train state when no train is selected", () => {
    render(<TrainJourneyDisplay train={undefined} lang="es" clock={clock} />);
    expect(screen.getByText("Sin información de tren")).toBeInTheDocument();
  });

  it("shows the destination and track for a scheduled train", () => {
    render(<TrainJourneyDisplay train={baseTrain} lang="es" clock={clock} />);
    expect(screen.getAllByText("Alacant Terminal").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the placeholder track value when no platform is assigned", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, platform: null }} lang="es" clock={clock} />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("does not render an observation strip when observations are empty", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, observations: "   " }} lang="es" clock={clock} />);
    expect(screen.queryByText(/./, { selector: "div[style*='opacity: 0.45']" })).not.toBeInTheDocument();
  });

  it("shows the cancelled status with priority over any observation", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, status: "Cancelled", observations: "Via cambiada" }} lang="es" clock={clock} />);
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.queryByText("Via cambiada")).not.toBeInTheDocument();
  });

  it("falls back to the operator name when there is no logo configured", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, operator_logo: null }} lang="es" clock={clock} />);
    expect(screen.getByText("Renfe")).toBeInTheDocument();
  });

  it("falls back to a LineBadge with the product code when there is no product logo", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, type_logo: null, type_code: "C-5" }} lang="es" clock={clock} />);
    expect(screen.getByText("C-5")).toBeInTheDocument();
  });

  it("does not hide the product entirely when type_code is missing", () => {
    render(<TrainJourneyDisplay train={{ ...baseTrain, type_logo: null, type_code: null, type_name: "Cercanías" }} lang="es" clock={clock} />);
    expect(screen.getByText("Cercanías")).toBeInTheDocument();
  });

  it("shows a single-line station ticker without per-stop times in landscape (the default)", () => {
    render(<TrainJourneyDisplay train={baseTrain} lang="es" clock={clock} />);
    expect(screen.getByText("Cuenca")).toBeInTheDocument();
    expect(screen.queryByText("12:55")).not.toBeInTheDocument();
  });

  it("shows the vertical stop list with per-stop times in portrait", () => {
    render(<TrainJourneyDisplay train={baseTrain} lang="es" clock={clock} orientation="PORTRAIT" />);
    expect(screen.getByText("Cuenca")).toBeInTheDocument();
    expect(screen.getByText("12:55")).toBeInTheDocument();
  });

  it("cleans up its pagination interval on unmount without leaking timers", () => {
    vi.useFakeTimers();
    const manyStops = Array.from({ length: 9 }, (_, i) => ({ station: `Station ${i}`, time: "12:00" }));
    const { unmount } = render(<TrainJourneyDisplay train={{ ...baseTrain, stops: manyStops }} lang="es" clock={clock} />);
    unmount();
    expect(() => vi.advanceTimersByTime(30000)).not.toThrow();
    vi.useRealTimers();
  });
});
