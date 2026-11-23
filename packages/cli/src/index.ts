#!/usr/bin/env -S tsx
import { writeFile } from 'node:fs/promises'
import { Command } from 'commander'
import { investigate, toMarkdown, riskLabel } from '@tracelens/core'
import type { Investigation } from '@tracelens/core'

const program = new Command()
program
  .name('tracelens')
  .description('AI-powered OSINT investigation workspace')
  .version('0.1.0')

const SEVERITY_COLOR: Record<string, string> = {
  info: '\x1b[90m',
  low: '\x1b[36m',
  medium: '\x1b[33m',
  high: '\x1b[31m',
  critical: '\x1b[35m',
}
const RESET = '\x1b[0m'

function printSummary(result: Investigation): void {
  console.log(`\n  ◈ TraceLens — ${result.query}`)
  console.log(`  ${'─'.repeat(52)}`)
  console.log(`  Risk      ${result.score}/100  (${result.grade} · ${riskLabel(result.score)})`)
  console.log(`  Graph     ${result.entities.length} entities · ${result.links.length} relationships`)
  console.log(`  Findings  ${result.findings.length}`)
  console.log(`  Analyst   ${result.analyst}\n`)

  for (const finding of result.findings.slice(0, 8)) {
    const color = SEVERITY_COLOR[finding.severity] ?? ''
    console.log(`  ${color}${finding.severity.toUpperCase().padEnd(8)}${RESET} ${finding.title}`)
  }
  console.log('')
}

async function save(output: string | undefined, content: string): Promise<void> {
  if (!output) return
  await writeFile(output, content, 'utf8')
  console.log(`  Saved → ${output}`)
}

program
  .command('investigate <query>')
  .alias('scan')
  .description('Run an investigation from the command line')
  .option('--json', 'print full JSON result')
  .option('--report <file>', 'write a Markdown report')
  .option('--out <file>', 'alias for --report')
  .action(async (query: string, options: { json?: boolean; report?: string; out?: string }) => {
    const result = await investigate(query)
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printSummary(result)
      console.log(`  ${result.summary.split('\n')[0]}\n`)
    }
    await save(options.report ?? options.out, toMarkdown(result))
  })

program
  .command('report <query>')
  .description('Generate a Markdown report without printing the graph summary')
  .option('--out <file>', 'output file (default: stdout)')
  .action(async (query: string, options: { out?: string }) => {
    const result = await investigate(query)
    const markdown = toMarkdown(result)
    if (options.out) await save(options.out, markdown)
    else console.log(markdown)
  })

program
  .command('examples')
  .description('Show example queries')
  .action(() => {
    console.log('\n  northwind-labs.io\n  octocat\n  203.0.113.42\n  security@example.com\n')
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`tracelens: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
