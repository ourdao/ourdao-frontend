import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'

/**
 * Pins an already-encrypted document blob to IPFS via Pinata.
 *
 * The client encrypts client-side (see src/lib/ipfs.ts) and posts the raw
 * ciphertext bytes here as the request body — this route never sees
 * plaintext. `PINATA_JWT` is a server-only env var (no `NEXT_PUBLIC_` prefix)
 * so the credential never reaches the client bundle.
 *
 * Access control: only authenticated DAO members can pin. Uses the same
 * challenge-response scheme as ourdao-backend (GET /api/auth/challenge +
 * signed header). Origin is checked as defence in depth.
 */
export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    return NextResponse.json(
      { error: 'Document uploads are not configured on the server.' },
      { status: 503 }
    )
  }

  const origin = req.headers.get('origin')
  if (origin && origin !== ALLOWED_ORIGIN) {
    return NextResponse.json(
      { error: 'Invalid origin' },
      { status: 403 }
    )
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const signature = authHeader.slice(7)
  const address = req.headers.get('x-stellar-address')
  if (!address) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify signature with backend (uses same challenge-response scheme)
  const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ address, signature }),
    cache: 'no-store',
  })

  if (!verifyRes.ok) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const verified = (await verifyRes.json()) as { valid: boolean; isMember: boolean }
  if (!verified.valid || !verified.isMember) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await req.arrayBuffer()
  if (body.byteLength === 0) {
    return NextResponse.json({ error: 'Empty upload' }, { status: 400 })
  }

  const form = new FormData()
  form.append('file', new Blob([body]), 'document')

  let res: Response
  try {
    res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach the pinning provider' }, { status: 502 })
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Pinning provider rejected the upload (${res.status})${detail ? `: ${detail}` : ''}` },
      { status: 502 }
    )
  }

  const data = (await res.json()) as { IpfsHash: string }
  return NextResponse.json({ hash: data.IpfsHash })
}