const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

function safeObjectName(name) {
  const safeName = path.basename(String(name || ""));
  if (!safeName) {
    throw new Error("storage object name is required");
  }
  return safeName;
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

async function retryStorageOperation(operation, options = {}) {
  const attempts = Math.max(1, positiveNumber(options.attempts, 3));
  const baseDelayMs = positiveNumber(options.baseDelayMs, 150);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableStorageError(error)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

function isRetryableStorageError(error) {
  const status = Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0);
  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  return ["TimeoutError", "RequestTimeout", "Throttling", "SlowDown", "NetworkingError", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(error?.name || error?.code);
}

async function streamToBuffer(stream) {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

class LocalStorageBucket {
  constructor(rootDir) {
    if (!rootDir) {
      throw new Error("rootDir is required");
    }
    this.rootDir = rootDir;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  path(name) {
    return path.join(this.rootDir, safeObjectName(name));
  }

  exists(name) {
    return fs.existsSync(this.path(name));
  }

  size(name) {
    const filePath = this.path(name);
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  }

  readBuffer(name) {
    return fs.readFileSync(this.path(name));
  }

  writeBuffer(name, buffer) {
    fs.writeFileSync(this.path(name), buffer);
  }

  copyFromPath(sourcePath, name) {
    fs.copyFileSync(sourcePath, this.path(name));
  }

  copyToPath(name, targetPath) {
    fs.copyFileSync(this.path(name), targetPath);
  }

  copyObject(sourceName, targetName) {
    fs.copyFileSync(this.path(sourceName), this.path(targetName));
  }

  materializeToTempPath(name) {
    return this.path(name);
  }

  delete(name) {
    const filePath = this.path(name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  createReadStream(name) {
    return fs.createReadStream(this.path(name));
  }

  health() {
    const result = {
      configured: Boolean(this.rootDir),
      exists: false,
      writable: false,
      path: this.rootDir,
      adapter: "local",
    };
    try {
      fs.mkdirSync(this.rootDir, { recursive: true });
      result.exists = fs.statSync(this.rootDir).isDirectory();
      fs.accessSync(this.rootDir, fs.constants.W_OK);
      result.writable = true;
    } catch (error) {
      result.error = error.message;
    }
    return result;
  }
}

class LocalStorageService {
  constructor({ uploadsDir, exportsDir, attachmentsDir }) {
    this.uploads = new LocalStorageBucket(uploadsDir);
    this.exports = new LocalStorageBucket(exportsDir);
    this.attachments = new LocalStorageBucket(attachmentsDir);
  }

  health() {
    return {
      adapter: "local",
      uploads: this.uploads.health(),
      exports: this.exports.health(),
      attachments: this.attachments.health(),
    };
  }
}

class S3StorageBucket {
  constructor({
    bucket,
    prefix = "",
    name,
    endpoint = "",
    region = "us-east-1",
    forcePathStyle = true,
    publicBaseUrl = "",
    client = null,
    retryAttempts = 3,
    retryBaseDelayMs = 150,
    multipartPartSize = 8 * 1024 * 1024,
    multipartQueueSize = 4,
  }) {
    this.bucket = String(bucket || "").trim();
    this.prefix = String(prefix || "").trim().replace(/^\/+|\/+$/g, "");
    this.name = String(name || "").trim();
    this.endpoint = String(endpoint || "").trim();
    this.region = String(region || "us-east-1").trim() || "us-east-1";
    this.forcePathStyle = Boolean(forcePathStyle);
    this.publicBaseUrl = String(publicBaseUrl || "").trim().replace(/\/+$/g, "");
    this.retryAttempts = Math.max(1, positiveNumber(retryAttempts, 3));
    this.retryBaseDelayMs = positiveNumber(retryBaseDelayMs, 150);
    this.multipartPartSize = Math.max(5 * 1024 * 1024, positiveNumber(multipartPartSize, 8 * 1024 * 1024));
    this.multipartQueueSize = Math.max(1, positiveNumber(multipartQueueSize, 4));
    this.client = client || new S3Client({
      region: this.region,
      endpoint: this.endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      maxAttempts: this.retryAttempts,
    });
  }

  key(name) {
    const objectName = safeObjectName(name);
    return [this.prefix, this.name, objectName].filter(Boolean).join("/");
  }

  uri(name) {
    return `s3://${this.bucket}/${this.key(name)}`;
  }

  path(name) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encodeURIComponent(this.key(name)).replace(/%2F/g, "/")}`;
    }
    return this.uri(name);
  }

  async exists(name) {
    try {
      await this.head(name);
      return true;
    } catch (error) {
      if (this.isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async size(name) {
    try {
      const head = await this.head(name);
      return Number(head.ContentLength || 0);
    } catch (error) {
      if (this.isNotFound(error)) {
        return 0;
      }
      throw error;
    }
  }

  async readBuffer(name) {
    const response = await this.sendWithRetry(() => new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
    return streamToBuffer(response.Body);
  }

  async writeBuffer(name, buffer) {
    await this.writeStream(name, Readable.from(buffer), { contentLength: buffer.length });
  }

  async writeStream(name, stream, { contentLength, contentType } = {}) {
    const key = this.key(name);
    if (Number(contentLength || 0) >= this.multipartPartSize) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentLength: contentLength,
          ContentType: contentType,
        },
        queueSize: this.multipartQueueSize,
        partSize: this.multipartPartSize,
        leavePartsOnError: false,
      });
      await retryStorageOperation(() => upload.done(), this.retryOptions());
      return;
    }

    await this.sendWithRetry(() => new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentLength: contentLength,
      ContentType: contentType,
    }));
  }

  async copyFromPath(sourcePath, name) {
    const stat = fs.statSync(sourcePath);
    await this.writeStream(name, fs.createReadStream(sourcePath), { contentLength: stat.size });
  }

  async copyToPath(name, targetPath) {
    const stream = await this.createReadStream(name);
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(targetPath);
      stream.on("error", reject);
      writer.on("error", reject);
      writer.on("finish", resolve);
      stream.pipe(writer);
    });
  }

  async copyObject(sourceName, targetName) {
    const tempPath = await this.materializeToTempPath(sourceName);
    try {
      await this.copyFromPath(tempPath, targetName);
    } finally {
      this.cleanupTempPath(tempPath);
    }
  }

  async materializeToTempPath(name) {
    const tempPath = path.join(os.tmpdir(), `cde-s3-${process.pid}-${Date.now()}-${safeObjectName(name)}`);
    await this.copyToPath(name, tempPath);
    return tempPath;
  }

  cleanupTempPath(filePath) {
    if (filePath && filePath.startsWith(os.tmpdir())) {
      fs.rmSync(filePath, { force: true });
    }
  }

  async delete(name) {
    if (!(await this.exists(name))) {
      return false;
    }
    await this.sendWithRetry(() => new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
    return true;
  }

  async createReadStream(name) {
    const response = await this.sendWithRetry(() => new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
    return response.Body;
  }

  async health() {
    const result = {
      adapter: "s3",
      configured: Boolean(this.bucket),
      writable: false,
      bucket: this.bucket,
      prefix: [this.prefix, this.name].filter(Boolean).join("/"),
      endpoint: this.endpoint,
      region: this.region,
      forcePathStyle: this.forcePathStyle,
      multipartPartSize: this.multipartPartSize,
      multipartQueueSize: this.multipartQueueSize,
      retryAttempts: this.retryAttempts,
    };
    if (!this.bucket) {
      result.error = "CDE_S3_BUCKET is required";
      return result;
    }
    const probeName = `.health-${process.pid}-${Date.now()}`;
    try {
      await this.writeBuffer(probeName, Buffer.from("ok"));
      result.writable = await this.exists(probeName);
      await this.delete(probeName);
    } catch (error) {
      result.error = error.message;
    }
    return result;
  }

  async head(name) {
    return this.sendWithRetry(() => new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
  }

  async sendWithRetry(commandFactory) {
    return retryStorageOperation(() => this.client.send(commandFactory()), this.retryOptions());
  }

  retryOptions() {
    return { attempts: this.retryAttempts, baseDelayMs: this.retryBaseDelayMs };
  }

  isNotFound(error) {
    const status = Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0);
    return status === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey";
  }
}

class S3StorageService {
  constructor(options) {
    const client = options.client || new S3Client({
      region: options.region || "us-east-1",
      endpoint: options.endpoint || undefined,
      forcePathStyle: options.forcePathStyle !== false,
      maxAttempts: positiveNumber(options.retryAttempts, 3),
    });
    const bucketOptions = {
      bucket: options.bucket,
      prefix: options.prefix,
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle !== false,
      publicBaseUrl: options.publicBaseUrl,
      retryAttempts: options.retryAttempts,
      retryBaseDelayMs: options.retryBaseDelayMs,
      multipartPartSize: options.multipartPartSize,
      multipartQueueSize: options.multipartQueueSize,
      client,
    };
    this.uploads = new S3StorageBucket({ ...bucketOptions, name: options.uploadsPrefix || "uploads" });
    this.exports = new S3StorageBucket({ ...bucketOptions, name: options.exportsPrefix || "exports" });
    this.attachments = new S3StorageBucket({ ...bucketOptions, name: options.attachmentsPrefix || "attachments" });
  }

  async health() {
    return {
      adapter: "s3",
      uploads: await this.uploads.health(),
      exports: await this.exports.health(),
      attachments: await this.attachments.health(),
    };
  }
}

function createLocalStorageService(options) {
  return new LocalStorageService(options);
}

function createS3StorageService(options) {
  return new S3StorageService(options);
}

function createStorageService(options = {}) {
  const adapter = String(options.adapter || process.env.CDE_STORAGE_ADAPTER || "local").trim().toLowerCase() || "local";
  if (["s3", "minio"].includes(adapter)) {
    return createS3StorageService({
      bucket: options.bucket || process.env.CDE_S3_BUCKET,
      prefix: options.prefix || process.env.CDE_S3_PREFIX || "cde-docs",
      endpoint: options.endpoint || process.env.CDE_S3_ENDPOINT,
      region: options.region || process.env.CDE_S3_REGION || "us-east-1",
      forcePathStyle: options.forcePathStyle ?? process.env.CDE_S3_FORCE_PATH_STYLE !== "false",
      publicBaseUrl: options.publicBaseUrl || process.env.CDE_S3_PUBLIC_BASE_URL,
      uploadsPrefix: options.uploadsPrefix || process.env.CDE_S3_UPLOADS_PREFIX,
      exportsPrefix: options.exportsPrefix || process.env.CDE_S3_EXPORTS_PREFIX,
      attachmentsPrefix: options.attachmentsPrefix || process.env.CDE_S3_ATTACHMENTS_PREFIX,
      retryAttempts: options.retryAttempts || process.env.CDE_S3_RETRY_ATTEMPTS,
      retryBaseDelayMs: options.retryBaseDelayMs || process.env.CDE_S3_RETRY_BASE_DELAY_MS,
      multipartPartSize: options.multipartPartSize || process.env.CDE_S3_MULTIPART_PART_SIZE,
      multipartQueueSize: options.multipartQueueSize || process.env.CDE_S3_MULTIPART_QUEUE_SIZE,
      client: options.client,
    });
  }
  if (adapter !== "local") {
    throw new Error(`Unsupported storage adapter: ${adapter}`);
  }
  return createLocalStorageService(options);
}

module.exports = {
  LocalStorageBucket,
  LocalStorageService,
  S3StorageBucket,
  S3StorageService,
  createLocalStorageService,
  createS3StorageService,
  createStorageService,
  retryStorageOperation,
};
