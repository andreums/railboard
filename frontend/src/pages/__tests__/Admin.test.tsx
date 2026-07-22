import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import Admin from "../Admin";
import { api, connectWS } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  api: {
    getConfig: vi.fn(),
    listStations: vi.fn(),
    listPlaces: vi.fn(),
    listRoutes: vi.fn(),
    listOperators: vi.fn(),
    listTrainTypes: vi.fn(),
    listDisplays: vi.fn(),
    listTrains: vi.fn(),
    createPlace: vi.fn(),
    deletePlace: vi.fn(),
  },
  connectWS: vi.fn(() => ({ close: vi.fn(), on: vi.fn(() => () => {}) })),
  fileUrl: (p: string | null) => p,
}));

vi.mock("../../services/routeApi", () => ({
  fetchNetworks: vi.fn(() => Promise.resolve([])),
  fetchStations: vi.fn(() => Promise.resolve([])),
  fetchRoutes: vi.fn(() => Promise.resolve([])),
  fetchRegions: vi.fn(() => Promise.resolve([])),
  reloadRailwayRoutes: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const baseConfig = { station_name: "Atocha", mode: "departures" as const };
const baseStation = { id: 1, name: "Atocha", short: "ATO", color: "#000", sort_order: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [],
    onvoiceschanged: null,
    speak: vi.fn(),
  });

  mockedApi.getConfig.mockResolvedValue(baseConfig as any);
  mockedApi.listStations.mockResolvedValue([baseStation] as any);
  mockedApi.listPlaces.mockResolvedValue([{ id: 1, name: "Madrid" }] as any);
  mockedApi.listRoutes.mockResolvedValue([]);
  mockedApi.listOperators.mockResolvedValue([]);
  mockedApi.listTrainTypes.mockResolvedValue([]);
  mockedApi.listDisplays.mockResolvedValue([]);
  mockedApi.listTrains.mockResolvedValue([]);
  mockedApi.createPlace.mockResolvedValue([
    { id: 1, name: "Madrid" },
    { id: 2, name: "Barcelona" },
  ] as any);
  mockedApi.deletePlace.mockResolvedValue(undefined as any);
});

async function renderAdminOnPlacesTab() {
  render(<Admin />);
  await waitFor(() => expect(screen.getByText("Destinos")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Destinos"));
  await waitFor(() => expect(screen.getByPlaceholderText("Nombre del nuevo destino...")).toBeInTheDocument());
}

describe("Admin", () => {
  it("shows a loading state before config resolves", () => {
    mockedApi.getConfig.mockReturnValue(new Promise(() => {}));
    render(<Admin />);
    expect(screen.getByText("Cargando panel...")).toBeInTheDocument();
  });

  it("loads the dashboard once data resolves", async () => {
    render(<Admin />);
    await waitFor(() => expect(screen.getAllByText(/Atocha/).length).toBeGreaterThan(0));
  });

  it("lists existing places on the Destinos tab", async () => {
    await renderAdminOnPlacesTab();
    expect(screen.getByText("Madrid")).toBeInTheDocument();
    expect(screen.getByText("Destinos (1)")).toBeInTheDocument();
  });

  it("creates a new place", async () => {
    await renderAdminOnPlacesTab();

    mockedApi.listPlaces.mockResolvedValue([
      { id: 1, name: "Madrid" },
      { id: 2, name: "Barcelona" },
    ] as any);
    fireEvent.change(screen.getByPlaceholderText("Nombre del nuevo destino..."), { target: { value: "Barcelona" } });
    fireEvent.click(screen.getByText("+ Agregar"));

    await waitFor(() => expect(mockedApi.createPlace).toHaveBeenCalledWith("Barcelona"));
    await waitFor(() => expect(screen.getByText("Barcelona")).toBeInTheDocument());
  });

  it("does not create a place with an empty name", async () => {
    await renderAdminOnPlacesTab();

    fireEvent.click(screen.getByText("+ Agregar"));

    expect(mockedApi.createPlace).not.toHaveBeenCalled();
    expect(await screen.findByText("⚠ Vacío")).toBeInTheDocument();
  });

  it("deletes a place", async () => {
    await renderAdminOnPlacesTab();
    const chip = screen.getByText("Madrid").closest("div") as HTMLElement;
    mockedApi.listPlaces.mockResolvedValue([]);

    fireEvent.click(within(chip).getByText("✕"));

    await waitFor(() => expect(mockedApi.deletePlace).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText("Madrid")).not.toBeInTheDocument());
  });

  it("opens a WebSocket connection on mount and closes it on unmount", async () => {
    const close = vi.fn();
    const mockedConnectWS = vi.mocked(connectWS);
    mockedConnectWS.mockReturnValue({ close, on: vi.fn(() => () => {}) } as any);

    const { unmount } = render(<Admin />);
    await waitFor(() => expect(mockedConnectWS).toHaveBeenCalled());
    unmount();
    expect(close).toHaveBeenCalled();
  });
});
