import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import Trains from "../Trains";
import { api } from "../../lib/api";

let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: any) => {
      capturedOnDragEnd = onDragEnd;
      return children;
    },
  };
});

vi.mock("../../lib/api", () => ({
  api: {
    getConfig: vi.fn(),
    listTrains: vi.fn(),
    listOperators: vi.fn(),
    listTrainTypes: vi.fn(),
    listPlaces: vi.fn(),
    listStations: vi.fn(),
    listDisplays: vi.fn(),
    reorderTrains: vi.fn(),
    clearTrains: vi.fn(),
    deleteTrain: vi.fn(),
    generateRandomTrain: vi.fn(),
    updateTrain: vi.fn(),
    createTrain: vi.fn(),
  },
  connectWS: vi.fn(() => ({ close: vi.fn(), on: vi.fn(() => () => {}) })),
}));

const mockedApi = vi.mocked(api);

function makeTrain(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    number: String(10000 + id),
    operator_id: null,
    train_type_id: null,
    origin: "Madrid Puerta de Atocha",
    destination: `Destino ${id}`,
    stops: [],
    scheduled_time: "10:00",
    expected_time: "10:00",
    platform: "5",
    sector: "B",
    status: "Scheduled",
    sort_order: id,
    ...overrides,
  };
}

const routeTitle = (id: number) => `Madrid Puerta de Atocha → Destino ${id}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getConfig.mockResolvedValue({ station_name: "Atocha", mode: "departures" } as any);
  mockedApi.listTrains.mockResolvedValue([makeTrain(1), makeTrain(2)] as any);
  mockedApi.listOperators.mockResolvedValue([]);
  mockedApi.listTrainTypes.mockResolvedValue([]);
  mockedApi.listPlaces.mockResolvedValue([]);
  mockedApi.listStations.mockResolvedValue([{ id: 1, name: "Atocha", short: "ATO", color: "#000", sort_order: 0 }] as any);
  mockedApi.listDisplays.mockResolvedValue([]);
  mockedApi.reorderTrains.mockResolvedValue(undefined as any);
  mockedApi.clearTrains.mockResolvedValue(undefined as any);
  mockedApi.deleteTrain.mockResolvedValue(undefined as any);
  mockedApi.generateRandomTrain.mockResolvedValue(makeTrain(3) as any);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

describe("Trains", () => {
  it("loads and lists trains from the API", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());
    expect(screen.getByTitle(routeTitle(2))).toBeInTheDocument();
    expect(screen.getByText("Trenes (2)")).toBeInTheDocument();
  });

  it("generates a random train and refreshes the list", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    mockedApi.listTrains.mockResolvedValue([makeTrain(1), makeTrain(2), makeTrain(3)] as any);
    fireEvent.click(screen.getByText("+ Tren random"));

    expect(mockedApi.generateRandomTrain).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTitle(routeTitle(3))).toBeInTheDocument());
  });

  it("deletes a train after confirmation", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    const row = screen.getByTitle(routeTitle(1)).closest("div.bg-black\\/20") as HTMLElement;
    mockedApi.listTrains.mockResolvedValue([makeTrain(2)] as any);
    fireEvent.click(within(row).getByTitle("Eliminar"));

    expect(mockedApi.deleteTrain).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.queryByTitle(routeTitle(1))).not.toBeInTheDocument());
  });

  it("does not delete when confirmation is declined", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    const row = screen.getByTitle(routeTitle(1)).closest("div.bg-black\\/20") as HTMLElement;
    fireEvent.click(within(row).getByTitle("Eliminar"));

    expect(mockedApi.deleteTrain).not.toHaveBeenCalled();
  });

  it("clears all trains after confirmation", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    mockedApi.listTrains.mockResolvedValue([]);
    fireEvent.click(screen.getByText("Borrar todos"));

    expect(mockedApi.clearTrains).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Sin trenes")).toBeInTheDocument());
  });

  it("opens the edit form for a train and saves changes", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    const row = screen.getByTitle(routeTitle(1)).closest("div.bg-black\\/20") as HTMLElement;
    fireEvent.click(within(row).getByTitle("Editar"));

    expect(await screen.findByText("Editar tren")).toBeInTheDocument();
  });

  it("switches into reorder mode and shows drag handles for every train", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Reordenar/));
    await waitFor(() => expect(screen.getAllByText("⠿")).toHaveLength(2));
  });

  it("reorders trains on drag-and-drop and persists the new order", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Reordenar/));
    await waitFor(() => expect(screen.getAllByText("⠿")).toHaveLength(2));

    expect(capturedOnDragEnd).toBeTypeOf("function");
    capturedOnDragEnd!({ active: { id: "1" }, over: { id: "2" } } as DragEndEvent);

    await waitFor(() => expect(mockedApi.reorderTrains).toHaveBeenCalled());
    expect(mockedApi.reorderTrains).toHaveBeenCalledWith([2, 1]);
  });

  it("does nothing on drag-and-drop when dropped on itself", async () => {
    render(<Trains />);
    await waitFor(() => expect(screen.getByTitle(routeTitle(1))).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Reordenar/));
    await waitFor(() => expect(screen.getAllByText("⠿")).toHaveLength(2));

    capturedOnDragEnd!({ active: { id: "1" }, over: { id: "1" } } as DragEndEvent);

    expect(mockedApi.reorderTrains).not.toHaveBeenCalled();
  });
});
