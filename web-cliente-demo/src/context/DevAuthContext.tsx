import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'dev-portal-token'

export interface DevUsuario {
  id: string
  email: string
  nombre: string
}

export type DevAuthEstado = 'verificando' | 'sin-sesion' | 'autenticado'

interface DevAuthValue {
  estado: DevAuthEstado
  usuario: DevUsuario | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nombre: string) => Promise<void>
  logout: () => Promise<void>
}

const DevAuthContext = createContext<DevAuthValue | null>(null)

let tokenDevActual: string | null = null

export function leerTokenDevPortal(): string | null {
  return tokenDevActual
}

function leerStorage(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v?.trim() || null
  } catch {
    return null
  }
}

function guardarStorage(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

async function devAuthFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = leerTokenDevPortal()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`/api${path}`, { ...init, headers })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.mensaje ?? `HTTP ${res.status}`)
  }
  return data as T
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const t = leerStorage()
    tokenDevActual = t
    return t
  })
  const [usuario, setUsuario] = useState<DevUsuario | null>(null)
  const [estado, setEstado] = useState<DevAuthEstado>(() => (leerStorage() ? 'verificando' : 'sin-sesion'))

  const limpiar = useCallback(() => {
    tokenDevActual = null
    setToken(null)
    setUsuario(null)
    guardarStorage(null)
    setEstado('sin-sesion')
  }, [])

  useEffect(() => {
    if (!token) {
      setEstado('sin-sesion')
      return
    }
    let cancel = false
    void (async () => {
      try {
        const r = await devAuthFetch<{ ok: boolean; usuario: DevUsuario }>('/dev/auth/me')
        if (cancel) return
        setUsuario(r.usuario)
        setEstado('autenticado')
      } catch {
        if (!cancel) limpiar()
      }
    })()
    return () => {
      cancel = true
    }
  }, [token, limpiar])

  const login = useCallback(async (email: string, password: string) => {
    const r = await devAuthFetch<{ ok: boolean; token: string; usuario: DevUsuario }>('/dev/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
    })
    tokenDevActual = r.token
    guardarStorage(r.token)
    setToken(r.token)
    setUsuario(r.usuario)
    setEstado('autenticado')
  }, [])

  const register = useCallback(async (email: string, password: string, nombre: string) => {
    const r = await devAuthFetch<{ ok: boolean; token: string; usuario: DevUsuario }>('/dev/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre }),
    })
    tokenDevActual = r.token
    guardarStorage(r.token)
    setToken(r.token)
    setUsuario(r.usuario)
    setEstado('autenticado')
  }, [])

  const logout = useCallback(async () => {
    try {
      await devAuthFetch('/dev/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    limpiar()
  }, [limpiar])

  const value = useMemo(
    () => ({ estado, usuario, login, register, logout }),
    [estado, usuario, login, register, logout],
  )

  return <DevAuthContext.Provider value={value}>{children}</DevAuthContext.Provider>
}

export function useDevAuth(): DevAuthValue {
  const ctx = useContext(DevAuthContext)
  if (!ctx) throw new Error('useDevAuth requiere DevAuthProvider')
  return ctx
}
