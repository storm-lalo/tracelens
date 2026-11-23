import type { LLMInput, LLMProvider } from './types'

/** Deterministic analyst used when no LLM is configured. */
export class LocalAnalyst implements LLMProvider {
  readonly name = 'TraceLens Local Analyst'

  async analyze(input: LLMInput): Promise<string> {
    const high = input.findings.filter((finding) =>
      ['high', 'critical'].includes(finding.severity),
    )
    const medium = input.findings.filter((finding) => finding.severity === 'medium')
    const types = [...new Set(input.entities.map((entity) => entity.type))]

    const opener = `Investigation of "${input.query}" produced a risk score of ${input.score}/100 (grade ${input.grade}) across ${input.entities.length} entities and ${input.findings.length} findings.`

    const headline =
      high.length > 0
        ? `The dominant concern is ${high[0]?.title.toLowerCase()}; ${high.length} high-severity signal${high.length === 1 ? '' : 's'} drive the overall rating.`
        : medium.length > 0
          ? `No critical exposure was observed, though ${medium.length} medium-severity signal${medium.length === 1 ? '' : 's'} warrant follow-up.`
          : 'No high-confidence critical exposure was observed in the available signals.'

    const coverage = `Collected signals span ${types.slice(0, 6).join(', ')}${types.length > 6 ? `, and ${types.length - 6} more` : ''}.`

    const recommendations = input.findings
      .filter((finding) => finding.severity === 'high' || finding.severity === 'critical')
      .slice(0, 3)
      .map((finding) => `- ${finding.recommendation}`)
      .join('\n')

    const nextSteps = recommendations
      ? `Recommended next steps:\n${recommendations}`
      : 'Recommended next step: continue passive monitoring and re-run the investigation after remediation.'

    return `${opener}\n\n${headline}\n\n${coverage}\n\n${nextSteps}\n\nFindings are generated from synthetic demo signals unless live providers are explicitly configured.`
  }
}

/** Optional OpenAI-compatible chat-completions analyst. */
export class OpenAICompatibleAnalyst implements LLMProvider {
  readonly name = 'OpenAI-compatible Analyst'

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async analyze(input: LLMInput): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise OSINT analyst. Summarize the supplied structured findings in under 180 words. Never invent facts not present in the input. Include recommended next steps.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query: input.query,
              score: input.score,
              grade: input.grade,
              findings: input.findings,
              entityTypes: [...new Set(input.entities.map((entity) => entity.type))],
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(`LLM provider returned ${response.status}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM provider returned no content')
    return content.trim()
  }
}

/** Selects the configured analyst, falling back to deterministic output. */
export function analystFromEnvironment(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const endpoint = env.TRACELENS_LLM_URL
  const apiKey = env.TRACELENS_LLM_KEY

  if (!endpoint || !apiKey) return new LocalAnalyst()

  return new OpenAICompatibleAnalyst(
    endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint.replace(/\/$/, '')}/chat/completions`,
    apiKey,
    env.TRACELENS_LLM_MODEL ?? 'gpt-4o-mini',
  )
}
