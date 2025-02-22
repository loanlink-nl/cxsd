// This file is part of cxsd, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { Namespace } from "../Namespace";
import { Type } from "../Type";

/**
 * Convert name to a name compatible with JAXB output (from Jsonix)
 *
 * eg. OfferteAanvraag > offerteAanvraag
 */
export function toLowerCamelCase(input: string) {
  return input.replace(/^([a-z]?[A-Z]+(?=([A-Z][a-z])|$)|[A-Z])/, (word) =>
    word.toLowerCase(),
  );
}

/** TransformType is a class derived from Transform, used like CRTP in C++. */

export abstract class Transform<
  TransformType extends Transform<TransformType, Output, State>,
  Output,
  State,
> {
  constructor(doc: Type) {
    this.doc = doc;
    this.namespace = doc.namespace;
  }

  getTypeMembers(type: Type) {
    // var memberList: MemberRef[] = [];
    const memberList: any[] = [];
    // var ref: MemberRef;
    let ref: any;

    if (type.attributeList) {
      for (ref of type.attributeList) memberList.push(ref);
    }

    if (type.childList) {
      for (ref of type.childList) memberList.push(ref);
    }

    return memberList;
  }

  prepare(): Output | Promise<Output> {
    return this.output;
  }

  async exec(
    visitedNamespaceTbl?: Record<string, Namespace>,
    state?: State,
  ): Promise<Output[]> {
    const doc = this.doc;
    const namespace = doc.namespace;

    if (state) this.state = state;

    if (!visitedNamespaceTbl) visitedNamespaceTbl = {};
    visitedNamespaceTbl[namespace.id] = namespace;

    const output = await Promise.resolve(this.prepare());
    const outputList = await Promise.all(
      namespace.getUsedImportList().map(async (namespace_1: Namespace) => {
        if (!visitedNamespaceTbl[namespace_1.id]) {
          if (namespace_1.doc) {
            const transform = new this.construct(namespace_1.doc);

            return transform.exec(visitedNamespaceTbl, this.state);
          }
        }

        return [] as Output[];
      }),
    );
    return Array.prototype.concat.apply([output], outputList);
  }

  construct: { new (...args: any[]): Transform<TransformType, Output, State> };
  output: Output;

  protected doc: Type;
  protected namespace: Namespace;
  protected state: State;
}
