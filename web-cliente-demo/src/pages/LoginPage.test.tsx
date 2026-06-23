import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";
import { useAuth } from "../context/AuthContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home privada</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("valida campos obligatorios antes de enviar", async () => {
    useAuthMock.mockReturnValue({
      estado: "sin-sesion",
      token: null,
      usuario: null,
      login: vi.fn(),
      logout: vi.fn(),
      obtenerToken: () => null,
    });

    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Usuario y contraseña son obligatorios.")).toBeInTheDocument();
  });

  it("ejecuta login con usuario y contraseña", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      estado: "sin-sesion",
      token: null,
      usuario: null,
      login,
      logout: vi.fn(),
      obtenerToken: () => null,
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "carlos" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "clave123" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("carlos", "clave123"));
  });
});
