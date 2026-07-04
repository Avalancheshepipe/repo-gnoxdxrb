import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/server/env";

// S3-compatible client. For Beget (and most non-AWS providers) we set a custom
// endpoint and use path-style addressing.
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_TTL = 600; // 10 min
const DOWNLOAD_TTL = 3600; // 1 hour

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/** Build a stable, namespaced object key for an attachment. */
export function buildAttachmentKey(
  organizationId: string,
  taskId: string,
  name: string,
): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `org/${organizationId}/task/${taskId}/${stamp}-${rand}-${sanitizeName(name)}`;
}

/** Build a namespaced key for an agent-generated document (report/doc). */
export function buildDocumentKey(organizationId: string, name: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `org/${organizationId}/docs/${stamp}-${rand}-${sanitizeName(name)}`;
}

/**
 * Upload bytes directly from the server (used for agent-generated documents).
 * Returns the key so callers can presign a download URL.
 */
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_TTL },
  );
}

export function presignDownload(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: DOWNLOAD_TTL },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
}
