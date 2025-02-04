#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeProgram } = require("../dist/src/cli.js");

const program = makeProgram();
program.parse(process.argv);

if (process.argv.length < 3) program.help();
