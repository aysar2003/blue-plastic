import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

/** Browser uploads large files straight to R2 (bypasses the ~4.5 MB function body limit). */
export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 60 * 15,
): Promise<string> {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  // Cast via unknown: pnpm may hoist two @smithy copies; runtime is the same S3 client.
  return getSignedUrl(
    s3() as unknown as Parameters<typeof getSignedUrl>[0],
    new PutObjectCommand({
      Bucket: bucket,
      Key: safeKey,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  )
}

export async function headStoredObject(key: string): Promise<{ contentLength: number; contentType?: string }> {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  try {
    const out = await s3().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: safeKey,
      }),
    )
    return {
      contentLength: out.ContentLength ?? 0,
      contentType: out.ContentType,
    }
  } catch (error) {
    console.error('[r2] head failed', safeKey, error)
    throw error
  }
}

/** First bytes only — used to sniff PDF/image magic after a client-direct upload. */
export async function getStoredObjectRange(key: string, start: number, endInclusive: number): Promise<Buffer> {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  try {
    const out = await s3().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: safeKey,
        Range: `bytes=${start}-${endInclusive}`,
      }),
    )
    const bytes = await out.Body?.transformToByteArray()
    if (!bytes) throw new Error('That file could not be read.')
    return Buffer.from(bytes)
  } catch (error) {
    console.error('[r2] range get failed', safeKey, error)
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

/** Stream the object so large downloads do not hit the function response size cap. */
export async function streamStoredObject(key: string): Promise<{
  body: ReadableStream<Uint8Array>
  contentType?: string
  contentLength?: number
}> {
  const safeKey = assertSafeObjectKey(key)
  const { bucket } = loadConfig()
  try {
    const out = await s3().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: safeKey,
      }),
    )
    const webStream = out.Body?.transformToWebStream()
    if (!webStream) throw new Error('That file could not be read.')
    return {
      body: webStream as ReadableStream<Uint8Array>,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
    }
  } catch (error) {
    console.error('[r2] stream failed', safeKey, error)
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
