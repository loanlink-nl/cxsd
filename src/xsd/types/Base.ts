// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { Rule } from "../Rule";
import { State } from "../State";
import { Scope } from "../Scope";
import { QName } from "../QName";

export interface BaseClass {
  new (state?: State): Base;

  /** Returns other classes allowed as children. */
  mayContain(): BaseClass[];

  rule: Rule;

  name: string;
}

/** Common handler base class for all schema tags. */

export class Base {
  /** Returns other classes allowed as children. */
  static mayContain = () => [] as BaseClass[];

  constructor(state?: State) {
    if (!state) return;

    this.scope = state.getScope();
    this.lineNumber = state.stateStatic.getLineNumber();
    this.bytePos = state.stateStatic.getBytePos();
  }

  /** Hook, runs after opening tag. */
  init(_state: State) {
    return;
  }

  /** Hook, runs for text content. */
  addText(_state: State, _text: string) {
    return;
  }

  /** Hook, runs after closing tag. */
  loaded(_state: State) {
    return;
  }

  /** Hook, runs after all dependencies have been loaded. */
  resolve(_state: State) {
    return;
  }

  /** Add this named tag to scope, listed under given type.
   * Optionally set number of allowed occurrences, for optional elements, sequences etc.
   * @return fully qualified name. */
  define(state: State, type: string, min = 1, max = 1, scope?: Scope) {
    let name = this.name;
    let qName: QName = null;

    if (name) {
      qName = new QName(name, state.source);
      name = qName.nameFull;
    }

    (scope || this.scope).addToParent(name, type, this, min, max);

    return qName;
  }

  getScope() {
    return this.scope;
  }

  protected scope: Scope;
  lineNumber: number;
  bytePos: number;
  name: string;

  static rule: Rule;
}
