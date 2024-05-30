// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as expat from "node-expat";

import { CacheResult } from "@loanlink-nl/cget";
import { Rule } from "./Rule";

import * as types from "./types";
import { Context } from "./Context";
import { State } from "./State";
import { Namespace } from "./Namespace";
import { Loader } from "./Loader";
import { Source } from "./Source";
import { QName } from "./QName";

/** Parse syntax rules encoded into handler classes. */

function parseRule(ctor: types.BaseClass, context: Context) {
  if (ctor.rule) return ctor.rule as Rule;

  const rule = new Rule(ctor);

  ctor.rule = rule;

  for (const baseFollower of ctor.mayContain()) {
    const follower = baseFollower as types.BaseClass;
    const followerName = new QName().parseClass(
      follower.name,
      context.xsdSpace,
    );

    rule.followerTbl[followerName.nameFull] = parseRule(follower, context);
    rule.followerTbl[followerName.name] = parseRule(follower, context);
  }

  const obj = new ctor();

  for (const key of Object.keys(obj)) {
    rule.attributeList.push(key);
  }

  return rule;
}

export class Parser {
  constructor(context: Context) {
    this.context = context;
    this.rootRule = parseRule(types.Root, context);
  }

  startElement(
    state: State,
    name: string,
    attrTbl: { [name: string]: string },
  ) {
    const qName = this.qName;

    qName.parse(name, state.source, state.source.defaultNamespace);

    let rule = state.rule;

    if (rule) {
      rule =
        rule.followerTbl[qName.nameFull] ||
        rule.followerTbl[qName.name] ||
        rule.followerTbl["*"];
      // if(!rule) console.log('Unhandled child ' + state.rule.qName.nameFull + ' -> ' + qName.nameFull);
    }

    state = new State(state, rule);

    if (!rule || !rule.proto) return state;

    const xsdElem = new (rule.proto as types.BaseClass)(state);

    state.xsdElement = xsdElem;

    // Make all attributes lowercase.
    for (const key of Object.keys(attrTbl)) {
      const keyLower = key.toLowerCase();

      if (key != keyLower && !(keyLower in attrTbl)) {
        attrTbl[keyLower] = attrTbl[key];
      }
    }

    // Copy known attributes to XSD element.
    for (const key of rule.attributeList) {
      if (key in attrTbl) {
        (xsdElem as any as { [key: string]: string })[key] = attrTbl[key];
      }
    }

    if (xsdElem.init) {
      state.attributeTbl = attrTbl;

      xsdElem.init(state);
    }

    return state;
  }

  init(cached: CacheResult, source: Source, loader: Loader) {
    let state = new State(null, this.rootRule, source);
    const importList: { namespace: Namespace; url: string }[] = [];

    const xml = new expat.Parser(null);

    state.stateStatic = {
      context: this.context,

      addImport: (namespaceTarget: Namespace, urlRemote: string) => {
        importList.push({ namespace: namespaceTarget, url: urlRemote });
      },

      getLineNumber: () => {
        return xml.getCurrentLineNumber();
      },

      getBytePos: () => {
        return xml.getCurrentByteIndex();
      },

      textDepth: 0,
      textHandlerList: [],
    };

    const stateStatic = state.stateStatic;
    let resolve: (result: Source[]) => void;

    const promise = new Promise<Source[]>((res) => {
      resolve = res;
    });

    const stream = cached.stream;

    const pendingList = this.pendingList;

    xml.on(
      "startElement",
      (name: string, attrTbl: { [name: string]: string }) => {
        try {
          state = this.startElement(state, name, attrTbl);
        } catch (err) {
          // Exceptions escaping from node-expat's event handlers cause weird effects.
          console.error(err);
          console.error("Stack:");
          console.error(err.stack);
        }
      },
    );

    xml.on("endElement", () => {
      if (state.xsdElement) {
        if (state.xsdElement.loaded) {
          state.xsdElement.loaded(state);
        }

        if (state.xsdElement.resolve) {
          // Schedule resolve hook to run after parsing is done.
          // It might depend on definitions in scope but appearing later,
          // and selectively postponing only hooks that cannot run yet
          // would be extremely complicated.

          pendingList.push(state);
        }
      }

      state = state.parent;
    });

    xml.on("text", (text: string) => {
      if (stateStatic.textDepth) {
        stateStatic.textHandlerList[stateStatic.textDepth - 1].addText(
          state,
          text,
        );
      }
    });

    xml.on("error", (err: any) => {
      console.error(err);
    });

    // Expat-specific handler.
    stream.on("data", (data: Buffer) => {
      xml.parse(data, false);
    });

    stream.on("end", () => {
      // Finish parsing the file (synchronous call).

      xml.parse("", true); // Expat-specific line.

      resolve(
        importList.map((spec: { namespace: Namespace; url: string }) => {
          console.log(
            "IMPORT into " + spec.namespace.name + " from " + spec.url,
          );
          return loader.importFile(spec.url, spec.namespace);
        }),
      );
    });

    return promise;
  }

  /** Bind references, call after all imports have been initialized. */
  resolve() {
    for (let pos = 0; pos < this.pendingList.length; ++pos) {
      const state = this.pendingList[pos];
      try {
        state.xsdElement.resolve(state);
      } catch (err) {
        console.error(
          err +
            " on line " +
            state.xsdElement.lineNumber +
            " of " +
            state.source.url,
        );
        console.error("Stack:");
        console.error(err.stack);
      }
    }

    this.pendingList = [];
  }

  private context: Context;

  /** Temporarily holds a qualified name, re-used to avoid allocating objects. */
  private qName = new QName();

  /** List of parser states still needing further processing
   * after previous stage is done. */
  private pendingList: State[] = [];

  /** Defines valid contents for the XML file root element. */
  private rootRule: Rule;
}
