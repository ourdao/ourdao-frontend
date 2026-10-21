// The single IPFS CID implementation, shared by the documents route (verifying
// what the pinning provider returned) and the client (verifying downloads).
// It rebuilds the UnixFS DAG the way IPFS importers do by default: 256 KiB
// chunks in a balanced tree of at most 174 links per node. Uses Web Crypto so
// it runs in the browser and on the server.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

const CHUNK_SIZE = 262144
const MAX_LINKS = 174
const DAG_PB = 0x70
const RAW = 0x55

function varint(value: number): Uint8Array {
  const bytes: number[] = []
  while (value >= 0x80) {
    bytes.push((value % 0x80) | 0x80)
    value = Math.floor(value / 0x80)
  }
  bytes.push(value)
  return new Uint8Array(bytes)
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function encodeBase58(bytes: Uint8Array): string {
  let value = BigInt(0)
  for (const byte of bytes) value = (value << BigInt(8)) | BigInt(byte)
  let result = ''
  while (value > BigInt(0)) {
    result = BASE58_ALPHABET[Number(value % BigInt(58))] + result
    value /= BigInt(58)
  }
  for (const byte of bytes) {
    if (byte !== 0) break
    result = `1${result}`
  }
  return result
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let result = 'b'
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return result
}

async function sha256Multihash(block: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', block as unknown as BufferSource))
  return concat(new Uint8Array([0x12, 0x20]), digest)
}

/** A built DAG node: its multihash, the cumulative serialized size (dag-pb
 *  `Tsize`) and how many file bytes it covers. */
interface Node {
  multihash: Uint8Array
  codec: number
  tsize: number
  fileSize: number
}

const cidV1Bytes = (n: Node) => concat(new Uint8Array([0x01, n.codec]), n.multihash)

/** How a parent encodes its links: CIDv0 DAGs link by bare multihash. */
type Links = 'v0' | 'v1'
const linkBytes = (n: Node, links: Links) => (links === 'v0' ? n.multihash : cidV1Bytes(n))

async function leaf(chunk: Uint8Array, rawLeaves: boolean): Promise<Node> {
  if (rawLeaves) {
    return { multihash: await sha256Multihash(chunk), codec: RAW, tsize: chunk.length, fileSize: chunk.length }
  }
  const length = varint(chunk.length)
  // An empty file has no data field, only its (zero) size.
  const data = chunk.length
    ? concat(new Uint8Array([0x08, 0x02, 0x12]), length, chunk, new Uint8Array([0x18]), length)
    : new Uint8Array([0x08, 0x02, 0x18, 0x00])
  const block = concat(new Uint8Array([0x0a]), varint(data.length), data)
  return { multihash: await sha256Multihash(block), codec: DAG_PB, tsize: block.length, fileSize: chunk.length }
}

async function parent(children: Node[], links: Links): Promise<Node> {
  const encodedLinks = children.map((child) => {
    const hash = linkBytes(child, links)
    // PBLink: Hash (1), empty Name (2), Tsize (3)
    const link = concat(
      new Uint8Array([0x0a]), varint(hash.length), hash,
      new Uint8Array([0x12, 0x00, 0x18]), varint(child.tsize)
    )
    return concat(new Uint8Array([0x12]), varint(link.length), link)
  })
  const fileSize = children.reduce((sum, child) => sum + child.fileSize, 0)
  const data = concat(
    new Uint8Array([0x08, 0x02, 0x18]),
    varint(fileSize),
    ...children.map((child) => concat(new Uint8Array([0x20]), varint(child.fileSize)))
  )
  const block = concat(...encodedLinks, new Uint8Array([0x0a]), varint(data.length), data)
  return {
    multihash: await sha256Multihash(block),
    codec: DAG_PB,
    tsize: block.length + children.reduce((sum, child) => sum + child.tsize, 0),
    fileSize,
  }
}

/** Root node of the balanced DAG over `content` (matches `ipfs add` defaults). */
async function buildRoot(content: Uint8Array, rawLeaves: boolean, links: Links): Promise<Node> {
  let offset = 0
  const hasMore = () => offset < content.length
  const nextLeaf = () => {
    const chunk = content.subarray(offset, offset + CHUNK_SIZE)
    offset += chunk.length
    return leaf(chunk, rawLeaves)
  }
  const fill = async (depth: number, children: Node[]): Promise<void> => {
    while (children.length < MAX_LINKS && hasMore()) {
      if (depth === 1) {
        children.push(await nextLeaf())
      } else {
        const sub: Node[] = []
        await fill(depth - 1, sub)
        children.push(await parent(sub, links))
      }
    }
  }

  let root = await nextLeaf()
  for (let depth = 1; hasMore(); depth++) {
    const children = [root]
    await fill(depth, children)
    root = await parent(children, links)
  }
  return root
}

export interface ComputedCIDs {
  /** CIDv0: dag-pb leaves, the `ipfs add` / Pinata default. */
  cidV0: string
  /** CIDv1 with dag-pb leaves (links by CIDv1, so differs from v0 past one chunk). */
  cidV1DagPb: string
  /** CIDv1 built with raw leaves (a raw block itself for a single chunk). */
  cidV1Raw: string
}

/** Computes the CIDs an IPFS importer would produce for `content`. */
export async function computeIPFSCIDs(content: Uint8Array): Promise<ComputedCIDs> {
  const [v0, v1, raw] = await Promise.all([
    buildRoot(content, false, 'v0'),
    buildRoot(content, false, 'v1'),
    buildRoot(content, true, 'v1'),
  ])
  return {
    cidV0: encodeBase58(v0.multihash),
    cidV1DagPb: encodeBase32(cidV1Bytes(v1)),
    cidV1Raw: encodeBase32(cidV1Bytes(raw)),
  }
}

/** Shape check only (format, not integrity). */
export function validateIPFSHash(hash: string): boolean {
  // CIDv0: Qm followed by 44 base58btc chars (46 total)
  const cidV0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/
  // CIDv1: multibase prefix + variable-length hash
  const cidV1Regex = /^[bBfz][0-9A-Za-z]{7,60}$/
  return cidV0Regex.test(hash) || cidV1Regex.test(hash)
}

/**
 * Verifies that a CID has a valid shape and matches `content`, for files of any
 * size (CIDv0, CIDv1 dag-pb and CIDv1 raw-leaves layouts).
 */
export async function verifyIPFSHash(cid: string, content: Uint8Array): Promise<boolean> {
  if (!cid || typeof cid !== 'string') return false
  if (!validateIPFSHash(cid)) return false

  const computed = await computeIPFSCIDs(content)
  const lower = cid.toLowerCase()
  return (
    cid === computed.cidV0 ||
    lower === computed.cidV1DagPb.toLowerCase() ||
    lower === computed.cidV1Raw.toLowerCase()
  )
}
