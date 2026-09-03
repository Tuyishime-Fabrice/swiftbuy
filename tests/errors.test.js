import { describe, it, expect } from 'vitest'
import { classifyError, ErrorKind } from '../src/lib/errors'

/**
 * The database raises deliberate SQLSTATE codes from the functions in
 * supabase/migrations, and those messages are already written for a person to
 * read. Anything else must not leak a constraint name into the UI.
 */

describe('classifyError', () => {
  it('passes through messages our own functions authored', () => {
    expect(classifyError({ code: 'P0001', message: 'Only 3 of Yoga Mat left in stock' }))
      .toMatchObject({
        kind: ErrorKind.RULE,
        message: 'Only 3 of Yoga Mat left in stock',
      })

    expect(classifyError({ code: '42501', message: 'Only a superadmin may change roles' }))
      .toMatchObject({
        kind: ErrorKind.PERMISSION,
        message: 'Only a superadmin may change roles',
      })

    expect(classifyError({ code: '22023', message: 'A delivery address is required' }))
      .toMatchObject({ kind: ErrorKind.VALIDATION })
  })

  it('replaces a raw constraint violation with something readable', () => {
    const result = classifyError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "reviews_order_item_id_key"',
    })
    expect(result.kind).toBe(ErrorKind.CONFLICT)
    expect(result.message).not.toMatch(/constraint/)
    expect(result.message).toBe('That has already been done.')
  })

  it('recognises an unreachable backend as a network problem', () => {
    const result = classifyError({ message: 'Failed to fetch' })
    expect(result.kind).toBe(ErrorKind.NETWORK)
    expect(result.message).toMatch(/connection/i)
  })

  it('maps HTTP statuses when there is no SQLSTATE', () => {
    expect(classifyError({ status: 401 }).kind).toBe(ErrorKind.AUTH)
    expect(classifyError({ status: 403 }).kind).toBe(ErrorKind.PERMISSION)
    expect(classifyError({ status: 404 }).kind).toBe(ErrorKind.NOT_FOUND)
  })

  it('falls back to a generic server message for anything unrecognised', () => {
    const result = classifyError({ message: 'PGRST301 something internal' })
    expect(result.kind).toBe(ErrorKind.SERVER)
    expect(result.message).toBe('Something went wrong on our side. Please try again.')
  })

  it('returns null when there is no error', () => {
    expect(classifyError(null)).toBeNull()
    expect(classifyError(undefined)).toBeNull()
  })

  it('never returns an empty message', () => {
    const cases = [
      { code: 'P0001' },
      { code: '42501' },
      { status: 500 },
      { message: '' },
      {},
    ]
    for (const error of cases) {
      expect(classifyError(error).message.length).toBeGreaterThan(0)
    }
  })
})
