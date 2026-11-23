import type { DataSourceProvider } from '../types'
import { MockProvider } from './mock'
import { PassiveDnsProvider } from './passive-dns'

export { MockProvider, detectQueryKind, baseDomain } from './mock'
export { PassiveDnsProvider } from './passive-dns'

/** Providers chosen from environment variables, with the demo provider always present. */
export function providersFromEnvironment(env: NodeJS.ProcessEnv = process.env): DataSourceProvider[] {
  const providers: DataSourceProvider[] = [new MockProvider()]

  if (env.TRACELENS_ENABLE_LIVE_PROVIDERS === 'true') {
    providers.push(new PassiveDnsProvider(env.TRACELENS_LIVE_DNS_URL, env.TRACELENS_LIVE_DNS_KEY))
  }

  return providers
}
