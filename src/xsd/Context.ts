// This file is part of cxsd, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { ContextBase } from "@loanlink-nl/cxml";

import { Namespace } from "./Namespace";
import { Scope } from "./Scope";

import { Source } from "./Source";
import { State } from "./State";
import { QName } from "./QName";
import { Primitive } from "./types/Primitive";
import * as schema from "../schema";

/** XML parser context, holding definitions of all imported namespaces. */

export class Context extends ContextBase<Namespace> {
  constructor(schemaContext: schema.Context) {
    super(Namespace);

    this.primitiveSpace = this.registerNamespace("xml-primitives");
    this.primitiveSpace.init(null, "Primitive");
    this.primitiveScope = this.populatePrimitives(
      this.primitiveSpace,
      schemaContext,
    );

    this.xmlSpace = this.registerNamespace(
      "http://www.w3.org/XML/1998/namespace",
    );
    this.xmlSpace.init("http://www.w3.org/2001/xml.xsd", "xml");

    this.xsdSpace = this.registerNamespace("http://www.w3.org/2001/XMLSchema");
    this.xsdSpace.init("http://www.w3.org/2009/XMLSchema/XMLSchema.xsd", "xsd");
  }

  registerNamespace(name: string, url?: string) {
    const namespace = super.registerNamespace(name);

    if (url) namespace.updateUrl(null, url);

    return namespace;
  }

  getPrimitiveScope() {
    // While primitiveSpace is still being initialized, this must return null.
    return this.primitiveScope;
  }

  /** Initialize special namespace containing primitive types. */

  private populatePrimitives(
    primitiveSpace: Namespace,
    schemaContext: schema.Context,
  ) {
    const scope = primitiveSpace.getScope();

    const spec = [
      ["boolean", "boolean"],
      ["date dateTime", "Date"],
      [
        "byte decimal double float int integer long short " +
          "unsignedLong unsignedInt unsignedShort unsignedByte " +
          "negativeInteger nonNegativeInteger nonPositiveInteger positiveInteger ",
        "number",
      ],
      [
        "Name NCName QName anyURI language normalizedString string token " +
          "ENTITY ENTITIES ID IDREF IDREFS NMTOKEN NMTOKENS " +
          "gDay gMonth gMonthDay gYear gYearMonth " +
          "hexBinary base64Binary " +
          "duration time",
        "string",
      ],
      ["anytype", "any"],
    ];

    // TODO: these lines are ugly!
    const source = new Source("", this, { targetNamespace: primitiveSpace });
    const state = new State(null, null, source);

    state.setScope(scope);
    schemaContext.copyNamespace(primitiveSpace).isPrimitiveSpace = true;

    for (const typeSpec of spec) {
      const type = new Primitive(null);
      type.name = typeSpec[1];
      type.init(new State(state, null));

      const outType = type.getOutType(schemaContext);

      outType.primitiveType = outType;
      outType.safeName = type.name;

      for (const name of typeSpec[0].split(" ")) {
        scope.add(
          new QName().parsePrimitive(name, primitiveSpace).nameFull,
          "type",
          type,
          1,
          1,
        );
      }
    }

    return scope;
  }

  /** Scope containing XML primitive types.
   * Parent of global scopes of all other namespaces. */
  private primitiveScope: Scope = null;

  /** Namespace containing XML primitive types. */
  primitiveSpace: Namespace;
  /** The official "xml" namespace defining commonly used types.  */
  xmlSpace: Namespace;
  /** The official "xsd" namespace used for schema parsing.  */
  xsdSpace: Namespace;
}
