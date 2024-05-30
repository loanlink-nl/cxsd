import * as path from "path";

import { Cache, Address } from "@loanlink-nl/cget";
import { Writer } from "./Exporter";

export const cacheWriter = (cache: Cache, disableCache = false): Writer => ({
  write: async (name, contentGetter) => {
    if (name === "xml-primitives.ts") {
      return true;
    }

    return cache
      .isCached(name)
      .then((isCached: boolean) => {
        if (isCached && !disableCache) return null;

        return cache.store(name, contentGetter());
      })
      .then((res) => res);
  },
  getPathTo: (name, namespace) => {
    // Append and then strip a file extension so references to a parent
    // directory will target the directory by name instead of .. or similar.

    const targetPath = cache.getCachePathSync(new Address(name)) + ".js";

    // Always output forward slashes.
    // If path.sep is a backslash as on Windows, we need to escape it (as a double-backslash) for it to be a valid Regex.
    // We are using a Regex because the alternative string.replace(string, string) overload only replaces the first occurance.
    const separatorRegex = new RegExp(path.sep.replace("\\", "\\\\"), "g");

    const address = new Address(namespace.name);
    const cacheDir = path.dirname(cache.getCachePathSync(address));

    let relPath = path
      .relative(cacheDir, targetPath)
      .replace(separatorRegex, "/")
      .replace(/\.js$/, "");

    if (!relPath.match(/^[./]/)) relPath = "./" + relPath;

    return relPath;
  },
});
