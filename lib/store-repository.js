const fs = require("node:fs");
const path = require("node:path");

class JsonStoreRepository {
  constructor({ storePath, seedStore }) {
    if (!storePath) {
      throw new Error("storePath is required");
    }
    if (typeof seedStore !== "function") {
      throw new Error("seedStore function is required");
    }
    this.storePath = storePath;
    this.seedStore = seedStore;
  }

  ensureStore() {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    if (fs.existsSync(this.storePath)) {
      return false;
    }
    this.write(this.seedStore());
    return true;
  }

  read() {
    this.ensureStore();
    return JSON.parse(fs.readFileSync(this.storePath, "utf8"));
  }

  write(store) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, this.storePath);
  }

  health() {
    const result = {
      configured: Boolean(this.storePath),
      exists: false,
      readable: false,
      writable: false,
      path: this.storePath,
    };

    try {
      this.ensureStore();
      fs.accessSync(this.storePath, fs.constants.R_OK);
      result.exists = fs.statSync(this.storePath).isFile();
      result.readable = true;
      fs.accessSync(path.dirname(this.storePath), fs.constants.W_OK);
      result.writable = true;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }
}

function createJsonStoreRepository(options) {
  return new JsonStoreRepository(options);
}

module.exports = {
  JsonStoreRepository,
  createJsonStoreRepository,
};
