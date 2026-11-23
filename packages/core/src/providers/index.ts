import type { DataSourceProvider } from '../types'
import { MockProvider } from './mock'
import { PassiveDnsProvider } from './passive-dns'
import { CertificateTransparencyProvider } from './certificate-transparency'
import { CodeSearchProvider } from './code-search'

export { MockProvider, detectQueryKind, baseDomain } from './mock'
export { PassiveDnsProvider } from './passive-dns'
export { CertificateTransparencyProvider } from './certificate-transparency'
export { CodeSearchProvider } from './code-search'

/** Providers chosen from environment variables, with the demo provider always present. */
export function providersFromEnvironment(env: NodeJS.ProcessEnv = process.env): DataSourceProvider[] {
  const providers: DataSourceProvider[] = [new MockProvider()]

  if (env.TRACELENS_ENABLE_LIVE_PROVIDERS === 'true') {
    providers.push(
      new PassiveDnsProvider(env.TRACELENS_LIVE_DNS_URL, env.TRACELENS_LIVE_DNS_KEY),
      new CertificateTransparencyProvider(env.TRACELENS_CT_URL),
      new CodeSearchProvider(env.TRACELENS_CODE_SEARCH_URL),
    )
  }

  return providers
}
