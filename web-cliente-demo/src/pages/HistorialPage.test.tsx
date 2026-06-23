import { fireEvent, render, screen } from "@testing-library/react";
import HistorialPage from "./HistorialPage";
import { useAppStore } from "../context/AppStoreContext";

vi.mock("../context/AppStoreContext", () => ({
  useAppStore: vi.fn(),
}));

const useAppStoreMock = vi.mocked(useAppStore);

describe("HistorialPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("renderiza operaciones y permite filtrar por tipo", () => {
    useAppStoreMock.mockReturnValue({
      eventos: [
        {
          id: "1",
          tipo: "registro_creado",
          estado: "exito",
          titulo: "Alta",
          mensaje: "Creado",
          fechaIso: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          tipo: "consulta",
          estado: "exito",
          titulo: "Consulta",
          mensaje: "Consultado",
          fechaIso: "2026-01-02T00:00:00.000Z",
        },
      ],
    } as never);

    render(<HistorialPage />);
    expect(screen.getByText("Historial de actividad")).toBeInTheDocument();
    expect(screen.getByText("2 operación(es) con el filtro actual")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alta" }));
    expect(screen.getByText("1 operación(es) con el filtro actual")).toBeInTheDocument();
  });
});
