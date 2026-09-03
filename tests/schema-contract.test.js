import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Contract tests between the service layer and the database.
 *
 * A typo in a column name or an RPC argument is invisible to the linter, to the
 * type system (there isn't one) and to the build — it only shows up as a
 * runtime error against a live project. These tests read the migrations, read
 * the services, and assert that every table, column, relationship, function and
 * function argument the app asks for actually exists.
 *
 * If a migration renames something, this fails before anyone deploys.
 */

// process.cwd() is the project root under Vitest; import.meta.url is rewritten
// by the dev server's /@fs prefix and is not a usable filesystem path here.
const root = process.cwd()
const migrationsDir = join(root, 'supabase/migrations')
const servicesDir = join(root, 'src/services')

const migrationSql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n')

// ── Parse the schema out of the migrations ──────────────────────────────────

/** table name → Set of column names */
function parseTables(sql) {
  const tables = new Map()
  const re = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g
  let match
  while ((match = re.exec(sql)) !== null) {
    const [, name, body] = match
    const columns = new Set()
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('--')) continue
      // Skip table-level constraints, which start with a keyword not a name.
      if (/^(unique|primary key|foreign key|check|constraint)\b/i.test(line)) continue
      const column = line.match(/^(\w+)\s+/)
      if (column) columns.add(column[1])
    }
    tables.set(name, columns)
  }
  return tables
}

/** view name → Set of column aliases */
function parseViews(sql) {
  const views = new Map()
  const re = /create or replace view public\.(\w+)[\s\S]*?as\s*select([\s\S]*?)from/g
  let match
  while ((match = re.exec(sql)) !== null) {
    const [, name, body] = match
    const columns = new Set()
    for (const part of splitTopLevel(body)) {
      const alias = part.trim().match(/(?:as\s+)?(\w+)\s*$/i)
      if (alias) columns.add(alias[1])
    }
    views.set(name, columns)
  }
  return views
}

/** function name → ordered list of parameter names */
function parseFunctions(sql) {
  const functions = new Map()
  const re = /create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*\n?returns/g
  let match
  while ((match = re.exec(sql)) !== null) {
    const [, name, params] = match
    const names = splitTopLevel(params)
      .map((p) => p.trim().split(/\s+/)[0])
      .filter((p) => p && p !== '')
    functions.set(name, names)
  }
  return functions
}

/** Splits on commas that are not inside brackets. */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

const tables = parseTables(migrationSql)
const views = parseViews(migrationSql)
const functions = parseFunctions(migrationSql)

// ── Parse what the services ask for ─────────────────────────────────────────

const serviceFiles = readdirSync(servicesDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, source: readFileSync(join(servicesDir, f), 'utf8') }))

/** Every `.from('table')` call, with the file it appears in. */
function collectTableRefs() {
  const refs = []
  for (const { name, source } of serviceFiles) {
    // Storage buckets are addressed with .from() too; skip those.
    const re = /(?<!storage\s*\n?\s*)\.from\('(\w+)'\)/g
    let match
    while ((match = re.exec(source)) !== null) {
      const before = source.slice(Math.max(0, match.index - 40), match.index)
      if (/storage\s*$/.test(before)) continue
      refs.push({ file: name, table: match[1] })
    }
  }
  return refs
}

/** Every `.rpc('fn', { ... })` call with its argument names. */
function collectRpcCalls() {
  const calls = []
  for (const { name, source } of serviceFiles) {
    const re = /\.rpc\('(\w+)'\s*(?:,\s*\{([\s\S]*?)\n\s*\}\s*\))?/g
    let match
    while ((match = re.exec(source)) !== null) {
      const args = (match[2] ?? '')
        .split('\n')
        .map((line) => line.trim().match(/^(p_\w+):/))
        .filter(Boolean)
        .map((m) => m[1])
      calls.push({ file: name, fn: match[1], args })
    }
  }
  return calls
}

/** Column names used in `.eq('col', …)`, `.order('col')` and friends. */
function collectColumnFilters() {
  const filters = []
  for (const { name, source } of serviceFiles) {
    // Associate each filter with the nearest preceding .from('table').
    const re = /\.from\('(\w+)'\)([\s\S]*?)(?=\n\s*(?:const|return|assertOk|\}\s*,?\s*$)|$)/g
    let match
    while ((match = re.exec(source)) !== null) {
      const [, table, chain] = match
      const columnRe = /\.(eq|neq|gt|gte|lt|lte|is|ilike|like|order)\('(\w+)'/g
      let inner
      while ((inner = columnRe.exec(chain)) !== null) {
        filters.push({ file: name, table, column: inner[2] })
      }
    }
  }
  return filters
}


/**
 * Every `.select(...)` in the services, paired with the table it reads from.
 * PostgREST embeds related rows as `relation ( columns )`, optionally aliased
 * as `alias:relation!constraint`, so the parser resolves those and recurses.
 */
function collectSelects() {
  const selects = []
  for (const { name, source } of serviceFiles) {
    const re = /\.from\('(\w+)'\)\s*\n?\s*\.select\(\s*([`'"])([\s\S]*?)\2/g
    let match
    while ((match = re.exec(source)) !== null) {
      selects.push({ file: name, table: match[1], body: match[3] })
    }
  }
  return selects
}

/** Splits a PostgREST select list into bare columns and embedded relations. */
function parseSelect(body) {
  const columns = []
  const embeds = []
  let depth = 0
  let current = ''
  const parts = []

  for (const char of body) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current)

  for (const raw of parts) {
    const part = raw.trim().replace(/\s+/g, ' ')
    if (!part) continue
    const embed = part.match(/^([\w:!]+)\s*\(([\s\S]*)\)$/)
    if (embed) {
      // alias:table!constraint → table
      const target = embed[1].includes(':') ? embed[1].split(':')[1] : embed[1]
      embeds.push({ relation: target.split('!')[0], body: embed[2] })
    } else if (/^\w+$/.test(part)) {
      columns.push(part)
    }
  }
  return { columns, embeds }
}

/** Recursively checks a select list against the parsed schema. */
function checkSelect(table, body, problems, path = table) {
  const known = tables.get(table) ?? views.get(table)
  if (!known) {
    problems.push(`${path} is not a table or view defined in the migrations`)
    return
  }
  const { columns, embeds } = parseSelect(body)
  for (const column of columns) {
    if (column === '*') continue
    if (!known.has(column)) problems.push(`${path}.${column} does not exist`)
  }
  for (const embed of embeds) {
    checkSelect(embed.relation, embed.body, problems, `${path} → ${embed.relation}`)
  }
}

const tableRefs = collectTableRefs()
const rpcCalls = collectRpcCalls()
const columnFilters = collectColumnFilters()
const selects = collectSelects()

// ── The tests ───────────────────────────────────────────────────────────────

describe('the migrations parse into a schema', () => {
  it('finds the tables the app depends on', () => {
    for (const name of [
      'profiles', 'sellers', 'categories', 'products', 'product_images',
      'cart_items', 'wishlist_items', 'orders', 'order_items', 'shipments',
      'payments', 'reviews', 'conversations', 'messages', 'notifications',
      'commissions', 'platform_settings', 'audit_logs', 'disputes',
    ]) {
      expect(tables.has(name), `migrations define ${name}`).toBe(true)
      expect(tables.get(name).size).toBeGreaterThan(2)
    }
  })

  it('finds the server-side functions', () => {
    for (const name of [
      'place_order', 'cancel_order', 'update_shipment_status', 'search_products',
      'declare_payment', 'confirm_payment', 'reject_payment', 'record_refund',
      'set_seller_status', 'set_user_role', 'set_user_suspended', 'set_product_featured',
      'get_or_create_conversation', 'open_dispute', 'respond_to_dispute', 'resolve_dispute',
    ]) {
      expect(functions.has(name), `migrations define ${name}()`).toBe(true)
    }
  })
})

describe('every table the services query exists', () => {
  it.each([...new Set(tableRefs.map((r) => r.table))])('%s', (table) => {
    expect(
      tables.has(table) || views.has(table),
      `${table} is queried by a service but not defined in any migration`
    ).toBe(true)
  })
})

describe('every column the services filter or sort on exists', () => {
  const cases = columnFilters.filter((f) => tables.has(f.table) || views.has(f.table))

  it.each(cases.map((f) => [`${f.table}.${f.column}`, f]))('%s', (_label, filter) => {
    const columns = tables.get(filter.table) ?? views.get(filter.table)
    expect(
      columns.has(filter.column),
      `${filter.file} filters ${filter.table} on "${filter.column}", which that table does not have`
    ).toBe(true)
  })

  it('actually checked a meaningful number of them', () => {
    expect(cases.length).toBeGreaterThan(20)
  })
})

describe('every column the services select exists, including embedded rows', () => {
  it.each(selects.map((s) => [`${s.file} · ${s.table}`, s]))('%s', (_label, select) => {
    const problems = []
    checkSelect(select.table, select.body, problems)
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('checked every select in the service layer', () => {
    // One per query; if this drops, the regex above has stopped matching.
    expect(selects.length).toBeGreaterThanOrEqual(15)
  })
})

describe('every RPC the services call exists with the arguments they pass', () => {
  it.each(rpcCalls.map((c) => [c.fn, c]))('%s', (_label, call) => {
    expect(functions.has(call.fn), `${call.file} calls ${call.fn}(), which is not defined`).toBe(true)

    const declared = functions.get(call.fn)
    for (const arg of call.args) {
      expect(
        declared.includes(arg),
        `${call.file} passes "${arg}" to ${call.fn}(), which takes: ${declared.join(', ')}`
      ).toBe(true)
    }
  })

  it('covers the RPCs the commerce flow depends on', () => {
    const called = new Set(rpcCalls.map((c) => c.fn))
    for (const required of ['place_order', 'confirm_payment', 'declare_payment', 'search_products']) {
      expect(called.has(required), `no service calls ${required}()`).toBe(true)
    }
  })
})

describe('the storage buckets the services write to are declared', () => {
  it('creates every bucket referenced in code', () => {
    const declared = new Set(
      [...migrationSql.matchAll(/insert into storage\.buckets[\s\S]*?values \(\s*'([\w-]+)'/g)]
        .map((m) => m[1])
    )

    const used = new Set(
      serviceFiles.flatMap(({ source }) =>
        [...source.matchAll(/storage\s*\n?\s*\.from\('([\w-]+)'\)/g)].map((m) => m[1])
      )
    )
    // The client module also names buckets when building public URLs.
    const clientSource = readFileSync(join(root, 'src/lib/supabase.js'), 'utf8')
    for (const m of clientSource.matchAll(/\.from\('([\w-]+)'\)/g)) used.add(m[1])

    expect(used.size).toBeGreaterThan(0)
    for (const bucket of used) {
      expect(declared.has(bucket), `bucket "${bucket}" is used but never created`).toBe(true)
    }
  })
})

describe('nothing in the client bundle reaches for a service-role key', () => {
  it('never mentions the service role', () => {
    const clientSource = [
      ...serviceFiles.map((f) => f.source),
      readFileSync(join(root, 'src/lib/supabase.js'), 'utf8'),
      readFileSync(join(root, 'src/context/AuthContext.jsx'), 'utf8'),
    ].join('\n')

    expect(clientSource).not.toMatch(/service_role/i)
    expect(clientSource).not.toMatch(/SERVICE_ROLE_KEY/)
  })

  it('reads only the two public env vars', () => {
    const src = readFileSync(join(root, 'src/lib/supabase.js'), 'utf8')
    const envRefs = [...src.matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1])
    expect(new Set(envRefs)).toEqual(new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']))
  })
})
