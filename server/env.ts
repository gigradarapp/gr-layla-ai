import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFiles = ['.env', ',env']

export function loadLocalEnv() {
  for (const file of envFiles) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      const raw = trimmed.slice(index + 1).trim()
      if (!key || process.env[key]) continue
      process.env[key] = raw.replace(/^['"]|['"]$/g, '')
    }
  }
}
