import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Display from "../Display";
import { api, connectWS } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  api: {
    getConfig: vi.fn(),
    listStations: vi.fn(),
    listPlaces: vi.fn(),
    getStationDisplayConfig: vi.fn(),
    getStationBoard: vi.fn(),
    listTrains: vi.fn(),
  },
  connectWS: vi.fn(() => ({ close: vi.fn(), on: vi.fn(() => () => {}) })),
  fileUrl: (p: string | null) => p,
}));

const mockedApi = vi.mocked(api);

const baseConfig = {
  station_name: "Madrid Puerta de Atocha",
  mode: "departures" as const,
  displayMode: "single" as const,
};

const baseStation = { id: 1, name: "Madrid Puerta de Atocha", short: "ATOCHA", color: "#1A3254", sort_order: 0 };

function boardRow(overrides: Record<string, unknown> = {}) {
  return {
    stopId: 1,
    serviceId: 1,
    number: "03104",
    operatorName: "Renfe",
    trainTypeCode: "AVE",
    trainTypeName: "Alta Velocidad",
    destination: "Barcelona Sants",
    origin: "Madrid Puerta de Atocha",
    stopsText: "",
    time: "10:00",
    expectedTime: "10:00",
    platform: "5",
    sector: "B",
    status: "Scheduled",
    ...overrides,
  };
}

function renderDisplay() {
  return render(
    <MemoryRouter>
      <Display />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getConfig.mockResolvedValue(baseConfig as any);
  mockedApi.listStations.mockResolvedValue([baseStation] as any);
  mockedApi.listPlaces.mockResolvedValue([]);
  mockedApi.getStationDisplayConfig.mockResolvedValue(baseConfig as any);
  mockedApi.getStationBoard.mockResolvedValue({
    status: "ok",
    station: { id: 1, name: baseStation.name, displayName: baseStation.name },
    mode: "departures",
    rows: [boardRow()],
  } as any);
  mockedApi.listTrains.mockResolvedValue([]);
});

describe("Display", () => {
  it("renders the board once data loads", async () => {
    renderDisplay();
    await waitFor(() => expect(screen.getByText("Barcelona Sants")).toBeInTheDocument());
    expect(screen.getByText("03104")).toBeInTheDocument();
  });

  it("filters out Departed and Arrived trains from the board", async () => {
    mockedApi.getStationBoard.mockResolvedValue({
      status: "ok",
      station: { id: 1, name: baseStation.name, displayName: baseStation.name },
      mode: "departures",
      rows: [boardRow({ number: "1", destination: "Visible" }), boardRow({ number: "2", destination: "Hidden", status: "Departed" })],
    } as any);
    renderDisplay();
    await waitFor(() => expect(screen.getByText("Visible")).toBeInTheDocument());
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("falls back to legacy /trains when the board endpoint fails", async () => {
    mockedApi.getStationBoard.mockRejectedValue(new Error("board down"));
    mockedApi.listTrains.mockResolvedValue([
      {
        id: 42,
        number: "77777",
        operator_id: null,
        train_type_id: null,
        origin: "Madrid",
        destination: "Valencia",
        stops: [],
        scheduled_time: "11:00",
        expected_time: "11:00",
        platform: "3",
        sector: "A",
        status: "Scheduled",
      },
    ] as any);
    renderDisplay();
    await waitFor(() => expect(screen.getByText("Valencia")).toBeInTheDocument());
  });

  it("shows an error screen with a retry button when everything fails", async () => {
    mockedApi.getConfig.mockRejectedValue(new Error("network down"));
    mockedApi.listStations.mockRejectedValue(new Error("network down"));
    mockedApi.listPlaces.mockRejectedValue(new Error("network down"));
    renderDisplay();
    await waitFor(() => expect(screen.getByText(/Error al cargar la configuración/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Reintentar ahora/i })).toBeInTheDocument();
  });

  it("opens a WebSocket connection on mount and closes it on unmount", async () => {
    const close = vi.fn();
    const mockedConnectWS = vi.mocked(connectWS);
    mockedConnectWS.mockReturnValue({ close, on: vi.fn(() => () => {}) } as any);

    const { unmount } = renderDisplay();
    await waitFor(() => expect(mockedConnectWS).toHaveBeenCalled());
    unmount();
    expect(close).toHaveBeenCalled();
  });
});
