import PinataClient from '@pinata/sdk'
import { Readable } from 'stream'
import type { EvidencePackage, MetaEvidence } from '@cripex/shared'

const pinata = new PinataClient({
  pinataApiKey: process.env.PINATA_API_KEY || '',
  pinataSecretApiKey: process.env.PINATA_SECRET_KEY || '',
})

const GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'

export async function uploadImage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const stream = Readable.from(buffer)
  const result = await pinata.pinFileToIPFS(stream, {
    pinataMetadata: { name: filename },
  })
  return result.IpfsHash
}

export async function uploadProductMetadata(metadata: object): Promise<string> {
  const result = await pinata.pinJSONToIPFS(metadata, {
    pinataMetadata: { name: 'product-metadata.json' },
  })
  return result.IpfsHash
}

export async function uploadEvidence(evidence: EvidencePackage): Promise<string> {
  const result = await pinata.pinJSONToIPFS(evidence, {
    pinataMetadata: { name: 'evidence.json' },
  })
  return result.IpfsHash
}

export async function uploadMetaEvidence(metaEvidence: MetaEvidence): Promise<string> {
  const result = await pinata.pinJSONToIPFS(metaEvidence, {
    pinataMetadata: { name: 'meta-evidence.json' },
  })
  return result.IpfsHash
}

export function ipfsUrl(cid: string): string {
  return `${GATEWAY}/ipfs/${cid}`
}
