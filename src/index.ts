import { Cache, FetchOptions } from "@loanlink-nl/cget";

import { Context } from "./xsd/Context";
import { Loader } from "./xsd/Loader";
import { exportNamespace } from "./xsd/Exporter";
import { AddImports } from "./schema/transform/AddImports";
import { Sanitize } from "./schema/transform/Sanitize";
import * as schema from "./schema";
import { cacheWriter } from "./schema/exporter/CacheWriter";
import { inMemoryWriter } from "./schema/exporter/InMemoryWriter";
import { Writer } from "./schema/exporter/Exporter";

export async function handleConvert(
  urlRemote: string,
  opts: { [key: string]: any },
) {
  const fetchOptions: FetchOptions = {};

  fetchOptions.allowLocal = "allowLocal" in opts ? opts["allowLocal"] : true;

  const useCache = opts["cache"] ? true : false;

  if (opts["forceHost"]) {
    fetchOptions.forceHost = opts["forceHost"];
    if (opts["forcePort"]) fetchOptions.forcePort = opts["forcePort"];

    if (useCache) {
      Cache.patchRequest();
    }
  }

  const defaultOut = "xmlns";
  const outTs = opts["outTs"] ?? opts["out"] ?? defaultOut;

  let files: Record<string, string> | null = null;

  let tsWriter: Writer;
  if (useCache) {
    tsWriter = cacheWriter(
      new Cache(outTs, {
        indexName: "_index.d.ts",
      }),
    );
  } else {
    files = {};
    tsWriter = inMemoryWriter(files);
  }

  const schemaContext = new schema.Context();
  const xsdContext = new Context(schemaContext);
  const loader = new Loader(xsdContext, fetchOptions, opts["namespace"]);

  const namespace = await loader.import(urlRemote);

  try {
    exportNamespace(xsdContext.primitiveSpace, schemaContext);
    exportNamespace(xsdContext.xmlSpace, schemaContext);

    const spec = exportNamespace(namespace, schemaContext);

    const addImports = new AddImports(spec);
    const sanitize = new Sanitize(spec);

    const importsAdded = await addImports.exec();

    // Rename types to valid JavaScript class names,
    // adding a prefix or suffix to duplicates.
    await sanitize.exec();
    sanitize.finish();
    addImports.finish(importsAdded);

    await new schema.TS(spec, tsWriter, {
      document: opts?.["document"] ?? "document",
      safeNameOverrides: opts.override,
    }).exec();

    return files;
  } catch (err) {
    console.error(err);
    console.log("Stack:");
    console.error(err.stack);
  }
}
