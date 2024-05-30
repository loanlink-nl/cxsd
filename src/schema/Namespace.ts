// This file is part of cxsd, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { NamespaceBase, MemberSpec as Member } from "@loanlink-nl/cxml";

import { Context } from "./Context";
import { Type } from "./Type";

export interface ImportContent {
  typeTbl: { [key: string]: Type };
  memberTbl: { [key: string]: Member };
}

export class Namespace extends NamespaceBase<Context> {
  addRef(shortName: string, namespace: Namespace) {
    const id = namespace.id;

    if (!this.shortNameTbl[id]) this.shortNameTbl[id] = [];
    this.shortNameTbl[id].push(shortName);
  }

  getShortRef(id: number) {
    const nameList = this.shortNameTbl[id];

    if (nameList && nameList.length) return nameList[0];
    else return null;
  }

  getUsedImportTbl() {
    let importTbl = this.importTbl;

    if (!importTbl) {
      importTbl = {};

      if (this.importContentTbl) {
        for (const key of Object.keys(this.importContentTbl)) {
          const id = +key;
          const shortRef = this.getShortRef(id);
          importTbl[shortRef] = this.context.namespaceById(id);
        }

        this.importTbl = importTbl;
      }
    }

    return importTbl;
  }

  getUsedImportList() {
    if (this.importContentTbl) {
      const importTbl = this.getUsedImportTbl();

      return Object.keys(importTbl).map(
        (shortName: string) => importTbl[shortName],
      );
    } else {
      return Object.keys(this.shortNameTbl).map((id: string) =>
        this.context.namespaceById(+id),
      );
    }
  }

  addType(type: Type) {
    const id = type.surrogateKey;
    this.typeList[id] = type;

    type.namespace = this;
  }

  addMember(member: Member) {
    const id = member.surrogateKey;
    this.memberList[id] = member;

    member.namespace = this;
  }

  /** Augment type in another namespace with member from this namespace. */

  addAugmentation(type: Type, member: Member) {
    // TODO: Adding a member with an identical name but different namespace should be handled somehow!
    if (type.childTbl[member.name]) return;

    let augmentTbl = this.augmentTbl[type.namespace.id];

    if (!augmentTbl) {
      augmentTbl = {};
      this.augmentTbl[type.namespace.id] = augmentTbl;
    }

    let augmentSpec = augmentTbl[type.surrogateKey];

    if (!augmentSpec) {
      augmentSpec = { type: type, refList: [] };
      augmentTbl[type.surrogateKey] = augmentSpec;
    }

    augmentSpec.refList.push(member.getRef());
  }

  /** Invisible document element defining the types of XML file root elements. */
  doc: Type;

  /** All types used in the document. */
  typeList: Type[] = [];
  /** All members used in the document. */
  memberList: Member[] = [];
  /** Types from other namespaces augmented with members from this namespace. */
  augmentTbl: {
    [namespaceId: string]: {
      // [typeId: string]: { type: Type, refList: MemberRef[] }
      [typeId: string]: { type: Type; refList: any[] };
    };
  } = {};

  pendingSubstituteList: Member[] = [];

  /** List of URL addresses of files with definitions for this namespace. */
  sourceList: string[];

  /** Short names used to reference other namespaces in schemas defining this namespace. */
  shortNameTbl: { [namespaceId: string]: string[] } = {};

  /** Table of namespaces actually imported, by short name. */
  private importTbl: { [short: string]: Namespace };

  /** List of referenced type names from each imported namespace. */
  importContentTbl: { [namespaceId: string]: ImportContent };

  /** True only for the special namespace containing primitives. */
  isPrimitiveSpace: boolean;
}
