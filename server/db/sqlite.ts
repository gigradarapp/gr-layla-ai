import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '../..')
const dbPath = resolve(rootDir, 'data/app.db')
const schemaPath = resolve(__dirname, 'schema.sql')

mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function migrate() {
  const schema = readFileSync(schemaPath, 'utf8')
  db.exec(schema)
}

export function hasSeedData() {
  migrate()
  const row = db.prepare('SELECT COUNT(*) as count FROM destinations').get() as { count: number }
  return row.count > 0
}

export function jsonArray(value: unknown) {
  return JSON.stringify(value)
}

export function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []) {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

export function id(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}
