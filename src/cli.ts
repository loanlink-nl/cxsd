// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { Command } from "commander";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { handleConvert } from "./index";
import { version } from "../package.json";
import { randomUUID } from "node:crypto";

export function makeProgram() {
  const program = new Command();

  program
    .version(version)
    .arguments("[url]")
    .description("XSD download and conversion tool")
    .option(
      "-L, --allow-local <boolean> (default true)",
      "Allow or disallow fetching files from local filesystem",
    )
    .option(
      "-H, --force-host <host>",
      'Fetch all xsd files from <host>\n    (original host is passed in GET parameter "host")',
    )
    .option(
      "-P, --force-port <port>",
      "Connect to <port> when using --force-host",
    )
    .option("-c, --cache", "When present, cache downloaded XSD files")
    .option(
      "-o, --out <directory>",
      "Output definitions and modules under <path>",
    )
    .option(
      "-t, --out-ts <directory>",
      "Output TypeScript definitions under <path>. Overrides --out",
    )
    .option(
      "-j, --out-js <path>",
      "Output JavaScript modules under <path>. Overrides --out",
    )
    .option(
      "-n, --namespace <namespace>",
      "Use namespace <namespace> as namespace when file doesn't define a namespace.",
    )
    .option(
      "-d, --document <name>",
      "Use the document <namespace> as the document name",
      "document",
    );

  // The action callback reads from a file if given (and not "-"), otherwise from stdin.
  program.action(async (input: string | undefined, options: any) => {
    let url: string;
    if (input && input !== "-") {
      url = input;
    } else {
      // Read input from stdin
      const data = await new Promise<string>((resolve, reject) => {
        let result = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (result += chunk));
        process.stdin.on("end", () => resolve(result));
        process.stdin.on("error", reject);
      });

      // Write data to temp file
      const tmpDir = os.tmpdir();
      const filename = randomUUID();
      const tmpFileName = path.join(tmpDir, filename);

      await fs.writeFile(tmpFileName, data, "utf8");

      url = tmpFileName;
    }

    // Pass the input data (and options) to the conversion handler.
    const files = await handleConvert(url, options);
    if (!files) {
      return;
    }

    const fileEntries = Object.entries(files);

    if (options.out) {
      await fs.mkdir(options.out, { recursive: true });

      for (const [filename, content] of fileEntries) {
        const outPath = path.resolve(options.out, filename);

        await fs.writeFile(outPath, content, "utf8");
      }
    } else if (fileEntries.length <= 1) {
      process.stdout.write(fileEntries[0][1]);
    } else {
      throw Error(
        "Multiple files generated. Use --out to specify output directory.",
      );
    }
  });

  return program;
}
