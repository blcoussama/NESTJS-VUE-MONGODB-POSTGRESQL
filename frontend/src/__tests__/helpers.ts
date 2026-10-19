import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { authClient, http } from '@/api/http'

export interface MockReply {
  status: number
  data?: unknown
}

type Handler = (config: InternalAxiosRequestConfig) => MockReply | Promise<MockReply>

interface Route {
  method: string
  matcher: string | RegExp
  handler: Handler
}

/**
 * Minimal in-memory API used by the tests (no network): an axios adapter that routes
 * `METHOD url` to handlers and reproduces axios' behaviour for non-2xx statuses.
 */
export function createMockServer() {
  const routes: Route[] = []
  const calls: InternalAxiosRequestConfig[] = []

  const adapter: AxiosAdapter = async (config) => {
    calls.push(config)
    const method = (config.method ?? 'get').toUpperCase()
    const url = config.url ?? ''
    const route = [...routes]
      .reverse()
      .find((r) => r.method === method && (typeof r.matcher === 'string' ? r.matcher === url : r.matcher.test(url)))
    if (!route) throw new AxiosError(`No mock for ${method} ${url}`, 'ERR_NO_MOCK', config)
    const reply = await route.handler(config)
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
      request: {},
    }
    if (reply.status >= 200 && reply.status < 300) return response
    throw new AxiosError(
      `Request failed with status code ${reply.status}`,
      reply.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    )
  }

  function on(method: string, matcher: string | RegExp, handler: Handler | MockReply) {
    routes.push({
      method: method.toUpperCase(),
      matcher,
      handler: typeof handler === 'function' ? handler : () => handler,
    })
  }

  function callsTo(method: string, url: string) {
    return calls.filter((c) => (c.method ?? 'get').toUpperCase() === method.toUpperCase() && c.url === url)
  }

  return { adapter, calls, on, callsTo }
}

export type MockServer = ReturnType<typeof createMockServer>

/** Plugs the mock server into both axios instances (API client and refresh client). */
export function installMockServer(): MockServer {
  const server = createMockServer()
  http.defaults.adapter = server.adapter
  authClient.defaults.adapter = server.adapter
  return server
}

export function networkError(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
}

export function authHeader(config: InternalAxiosRequestConfig | undefined): string | undefined {
  const value = config?.headers?.get?.('Authorization') ?? config?.headers?.Authorization
  return value == null ? undefined : String(value)
}

export const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export const candidate = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  firstName: 'Oussama',
  lastName: 'Belcadi',
  email: 'candidate@example.com',
  role: 'candidate' as const,
  avatarUrl: null,
}

export const recruiter = {
  id: '64b7f0c2a1b2c3d4e5f60799',
  firstName: 'Sara',
  lastName: 'Recruteuse',
  email: 'recruiter@example.com',
  role: 'recruiter' as const,
  avatarUrl: null,
}

export function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: '7f1d2c3b-0000-4000-8000-000000000001',
    title: 'Développeur Vue.js',
    description: 'Construire une plateforme de recrutement moderne.',
    location: 'Tanger',
    jobType: 'full-time',
    experienceLevel: 'junior',
    requirements: ['Vue 3', 'TypeScript'],
    salaryType: 'range',
    salary: { min: 8000, max: 12000, currency: 'MAD' },
    isOpen: true,
    companyId: '7f1d2c3b-0000-4000-8000-0000000000c1',
    recruiterId: recruiter.id,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    company: { id: '7f1d2c3b-0000-4000-8000-0000000000c1', name: 'ACME', logoUrl: null },
    ...overrides,
  }
}
