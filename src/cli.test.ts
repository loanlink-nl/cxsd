// cli.test.ts
import { makeProgram } from "./cli";
import { handleConvert } from "./index";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PassThrough } from "stream";

// Mock the conversion function.
jest.mock("./index", () => ({
  handleConvert: jest.fn(() => Promise.resolve()),
}));

describe("CLI input handling", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("reads from a file if a filename is provided", async () => {
    // Use os.tmpdir() to get the temporary directory.
    const tmpDir = os.tmpdir();
    // Generate a unique temporary file name.
    const tmpFileName = path.join(
      tmpDir,
      `cxsd-test-${Date.now()}-${Math.random()}.xml`,
    );
    const fileContent = "This is file input.";

    // Write the content to the temporary file.
    fs.writeFileSync(tmpFileName, fileContent, "utf8");

    // Create and parse the program with the filename.
    const program = makeProgram();
    await program.parseAsync(["node", "cli.js", tmpFileName]);

    // Check that handleConvert was called with the file's content.
    expect(handleConvert).toHaveBeenCalledWith(fileContent, expect.any(Object));

    // Cleanup the temporary file.
    fs.unlinkSync(tmpFileName);
  });

  test("reads from stdin if no filename is provided", async () => {
    const inputContent = "This is stdin input.";
    const program = makeProgram();

    // Create a PassThrough stream to simulate stdin.
    const fakeStdin = new PassThrough();

    // Save the original property descriptor for process.stdin.
    const originalStdinDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "stdin",
    );

    // Override process.stdin using Object.defineProperty.
    // Cast process to any to bypass the type-check.
    Object.defineProperty(process as any, "stdin", {
      configurable: true,
      get: () => fakeStdin,
    });

    // Start parsing the program. Since no filename is provided, it will read from stdin.
    const parsePromise = program.parseAsync(["node", "cli.js"]);

    // Write the test input to the fake stdin and then signal end-of-input.
    fakeStdin.write(inputContent);
    fakeStdin.end();

    // Wait for the CLI to finish processing.
    await parsePromise;

    // Check that handleConvert was called with the stdin content.
    expect(handleConvert).toHaveBeenCalledWith(
      inputContent,
      expect.any(Object),
    );

    // Restore the original process.stdin property.
    if (originalStdinDescriptor) {
      Object.defineProperty(process as any, "stdin", originalStdinDescriptor);
    }
  });
});
