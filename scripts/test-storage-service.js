const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createStorageService, S3StorageBucket, retryStorageOperation } = require("../lib/storage-service");

async function testLocalStorageService() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cde-storage-test-"));
  const storage = createStorageService({
    adapter: "local",
    uploadsDir: path.join(root, "uploads"),
    exportsDir: path.join(root, "exports"),
    attachmentsDir: path.join(root, "attachments"),
  });

  await storage.uploads.writeBuffer("demo.txt", Buffer.from("hello"));
  assert.equal(await storage.uploads.exists("demo.txt"), true);
  assert.equal(await storage.uploads.size("demo.txt"), 5);
  assert.equal((await storage.uploads.readBuffer("demo.txt")).toString("utf8"), "hello");
  assert.equal((await storage.health()).adapter, "local");
}

async function testS3StorageSkeleton() {
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command.constructor.name);
      if (command.constructor.name === "HeadObjectCommand") return { ContentLength: 7 };
      if (command.constructor.name === "GetObjectCommand") return { Body: Readable.from(Buffer.from("content")) };
      return {};
    },
  };
  const storage = createStorageService({
    adapter: "s3",
    bucket: "cde-test",
    prefix: "root",
    endpoint: "http://127.0.0.1:9000",
    region: "us-east-1",
    client,
    multipartPartSize: 5 * 1024 * 1024,
  });

  assert.equal((await storage.health()).adapter, "s3");
  assert.equal(storage.uploads.key("../demo.pdf"), "root/uploads/demo.pdf");
  assert.equal(storage.exports.uri("report.pdf"), "s3://cde-test/root/exports/report.pdf");
  assert.equal(storage.attachments.path("note.txt"), "s3://cde-test/root/attachments/note.txt");
  assert.equal(await storage.uploads.exists("demo.pdf"), true);
  assert.equal(await storage.uploads.size("demo.pdf"), 7);
  assert.equal((await storage.uploads.readBuffer("demo.pdf")).toString("utf8"), "content");
  await storage.uploads.writeBuffer("small.txt", Buffer.from("small"));
  assert(commands.includes("PutObjectCommand"));
}

async function testS3RequiresBucket() {
  const bucket = new S3StorageBucket({ name: "uploads", bucket: "" });
  const health = await bucket.health();
  assert.equal(health.adapter, "s3");
  assert.equal(health.configured, false);
  assert.match(health.error, /CDE_S3_BUCKET/);
}

async function testRetryOperation() {
  let attempts = 0;
  const result = await retryStorageOperation(async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error("slow down");
      error.$metadata = { httpStatusCode: 503 };
      throw error;
    }
    return "ok";
  }, { attempts: 2, baseDelayMs: 1 });
  assert.equal(result, "ok");
  assert.equal(attempts, 2);
}

(async () => {
  await testLocalStorageService();
  await testS3StorageSkeleton();
  await testS3RequiresBucket();
  await testRetryOperation();
  console.log("storage service test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
