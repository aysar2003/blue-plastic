import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

/**
 * Cloudflare R2 via the S3-compatible API.
 * Keys are relative paths within the bucket (no leading slash).
 */
type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
}

let client: S3Client | undefined
let cachedConfig: R2Config | undefined

function loadConfig(): R2Config {
  if (cachedConfig) return cachedConfig

  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.',
    )
  }

  cachedConfig = { accountId, accessKeyId, secretAccessKey, bucket, endpoint }
  return cachedConfig
}

function s3(): S3Client {
  if (client) return client
  const config = loadConfig()
  client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // AWS SDK ≥3.729 sends CRC32 checksums by default; R2 rejects them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

/** Refuse path traversal even if a storage key in the DB is ever corrupted. */
export function assertSafeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('..') ||
    normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('That file could not be read.')
  }
  return normalized
}

export async function putStoredObject(key: string, body: Buffer, contentType: string) {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: safeKey,
        Body: body,
        ContentType: contentType,
      }),
    )
  } catch (error) {
    console.error('[r2] put failed', safeKey, error)
    throw error
  }
}

export async function getStoredObject(key: string): Promise<Buffer> {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  try {
    const out = await s3().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: safeKey,
      }),
    )
    const bytes = await out.Body?.transformToByteArray()
    if (!bytes) throw new Error('That file could not be read.')
    return Buffer.from(bytes)
  } catch (error) {
    console.error('[r2] get failed', safeKey, error)
    throw error
  }
}

export async function deleteStoredObject(key: string) {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  await s3()
    .send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: safeKey,
      }),
    )
    .catch(() => undefined)
}
