// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { Command } from "commander";
import * as fs from "node:fs/promises";

import { handleConvert } from "./index";
import { version } from "../package.json";

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
    .option("-o, --out <path>", "Output definitions and modules under <path>")
    .option(
      "-t, --out-ts <path>",
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
    let data: string;
    if (input && input !== "-") {
      // Read input from the file
      try {
        data = await fs.readFile(input, "utf8");
      } catch (err) {
        console.error(`Error reading file ${input}:`, err);
        process.exit(1);
      }
    } else {
      // Read input from stdin
      data = await new Promise<string>((resolve, reject) => {
        let result = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (result += chunk));
        process.stdin.on("end", () => resolve(result));
        process.stdin.on("error", reject);
      });
    }

    // Pass the input data (and options) to the conversion handler.
    await handleConvert(data, options);
  });
  return program;
}
