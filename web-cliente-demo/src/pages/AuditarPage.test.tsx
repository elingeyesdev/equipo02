import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuditarPage from "./AuditarPage";
import { useSettings } from "../context/SettingsContext";
import { fetchAuditoriaCombinada } from "../services/apiAuditoria";

vi.mock("../context/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../services/apiAuditoria", () => ({
  fetchAuditoriaCombinada: vi.fn(),
}));

vi.mock("../services/apiHistorialCliente", () => ({
  fetchHistorialCliente: vi.fn().mockResolvedValue({ operaciones: [] }),
  fetchLineaTiempoCliente: vi.fn(),
  operacionesAVista: vi.fn(() => []),
}));

vi.mock("../services/apiClientesLista", () => ({
  listarClientesApi: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/apiDatos", () => ({
  fetchHistorialDato: vi.fn(),
  restaurarDatoRevision: vi.fn(),
}));

const useSettingsMock = vi.mocked(useSettings);
const fetchAuditoriaCombinadaMock = vi.mocked(fetchAuditoriaCombinada);

describe("AuditarPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("consulta auditoría y renderiza resumen de resultados", async () => {
    useSettingsMock.mockReturnValue({
      mode: "api",
      apiKey: "jwt",
      tenant: "clientes",
    } as never);

    fetchAuditoriaCombinadaMock.mockResolvedValue({
      httpPuente: [],
      eventosCadena: [],
      totalHttp: 0,
      totalEventos: 0,
    });

    render(
      <MemoryRouter>
        <AuditarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));

    await waitFor(() => expect(fetchAuditoriaCombinadaMock).toHaveBeenCalled());
    expect(await screen.findByText(/HTTP 0 · cadena 0/)).toBeInTheDocument();
  });
});
