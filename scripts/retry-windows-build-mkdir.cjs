/* eslint-disable @typescript-eslint/no-require-imports -- Node preload runs before the build and its workers. */
const fs = require("node:fs/promises");
const { resolve, sep } = require("node:path");
const { setTimeout: pause } = require("node:timers/promises");

if (process.platform === "win32") {
  const mkdir = fs.mkdir;
  const generated = resolve(".next", "server", "app") + sep;

  fs.mkdir = async function mkdirGenerated(path, options) {
    if (typeof path !== "string" || !options?.recursive || !resolve(path).startsWith(generated)) {
      return mkdir(path, options);
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return await mkdir(path, options);
      } catch (error) {
        if (error.code !== "EPERM" || attempt === 4) throw error;
        await pause(25 * (attempt + 1));
      }
    }
  };
}
