// This file is part of cxsd, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {
  MemberSpec as Member,
  MemberFlag,
  MemberRef,
  MemberRefFlag,
} from "@loanlink-nl/cxml";

import { Exporter } from "./Exporter";
import { Namespace } from "../Namespace";
import { Type } from "../Type";

export type NumTbl = { [id: string]: number };

export class JS extends Exporter {
  writeImport(shortName: string, relativePath: string) {
    return "var " + shortName + " = require(" + "'" + relativePath + "'" + ");";
  }

  writeMember(member: Member, typeNumTbl: NumTbl, memberNumTbl: NumTbl) {
    let substituteNum = 0;
    const memberTypeList = member.typeSpecList.map(
      (memberType) => typeNumTbl[memberType.surrogateKey],
    );

    const name = member.name;

    let flags = 0;
    if (member.isAbstract) flags |= MemberFlag.abstract;
    if (member.isSubstituted) flags |= MemberFlag.substituted;
    if (member.name == "*") flags |= MemberFlag.any;

    if (member.substitutes) {
      substituteNum = memberNumTbl[member.substitutes.surrogateKey];
    }

    const output = [name, memberTypeList, flags];
    if (substituteNum) {
      output.push(substituteNum);
    }
    return "\n\t" + JSON.stringify(output);
  }

  writeMemberRef(ref: MemberRef, memberNumTbl: NumTbl) {
    const member = ref.member;
    let name = ref.safeName;
    if (name == member.safeName) name = null;

    let flags = 0;
    if (ref.min < 1) flags |= MemberRefFlag.optional;
    if (ref.max > 1) flags |= MemberRefFlag.array;

    return (
      "[" +
      memberNumTbl[member.surrogateKey] +
      ", " +
      flags +
      (name ? ", " + "'" + name + "'" : "") +
      "]"
    );
  }

  writeType(type: Type, typeNumTbl: NumTbl, memberNumTbl: NumTbl) {
    const childSpecList: string[] = [];
    const attributeSpecList: string[] = [];

    let parentNum = 0;
    let flags = 0;

    if (type.primitiveType) flags |= Type.primitiveFlag;
    if (type.isPlainPrimitive) flags |= Type.plainPrimitiveFlag;

    if (type.isList) {
      flags |= Type.listFlag | Type.primitiveFlag | Type.plainPrimitiveFlag;
      parentNum =
        typeNumTbl[type.childList[0].member.typeSpecList[0].surrogateKey];
    } else {
      if (type.childList) {
        for (const member of type.childList) {
          childSpecList.push(this.writeMemberRef(member, memberNumTbl));
        }
      }

      if (type.attributeList) {
        for (const member of type.attributeList) {
          attributeSpecList.push(this.writeMemberRef(member, memberNumTbl));
        }
      }

      if (type.parent) parentNum = typeNumTbl[type.parent.surrogateKey];
    }

    return (
      "\n\t[" +
      flags +
      ", " +
      parentNum +
      ", " +
      "[" +
      childSpecList.join(", ") +
      "], " +
      "[" +
      attributeSpecList.join(", ") +
      "]" +
      "]"
    );
  }

  buildTypeList(namespace: Namespace) {
    const exportedTypeList: Type[] = [];
    const hiddenTypeList: Type[] = [];

    for (const type of namespace.typeList) {
      if (!type) continue;
      if (type.isExported) exportedTypeList.push(type);
      else hiddenTypeList.push(type);
    }

    exportedTypeList.sort((a: Type, b: Type) =>
      a.safeName.localeCompare(b.safeName),
    );
    hiddenTypeList.sort((a: Type, b: Type) =>
      a.safeName.localeCompare(b.safeName),
    );

    return {
      all: exportedTypeList.concat(hiddenTypeList),
      exported: exportedTypeList,
    };
  }

  buildMemberList(namespace: Namespace) {
    const exportedMemberList: Member[] = [];
    const hiddenMemberList: Member[] = [];

    for (const member of namespace.memberList) {
      if (!member) continue;
      if (member.isExported) exportedMemberList.push(member);
      else hiddenMemberList.push(member);
    }

    exportedMemberList.sort((a: Member, b: Member) =>
      a.name.localeCompare(b.name),
    );
    // TODO: merge identical hidden members.
    hiddenMemberList.sort((a: Member, b: Member) =>
      a.name.localeCompare(b.name),
    );

    return {
      all: exportedMemberList.concat(hiddenMemberList),
      exported: exportedMemberList,
    };
  }

  /** Output namespace contents to the given cache key. */

  writeContents(): string {
    const doc = this.doc;
    const namespace = doc.namespace;

    const typeNumTbl: NumTbl = {};
    const memberNumTbl: NumTbl = {};
    // Separately defined document type is number 0.
    let typeNum = 1;
    // Member number 0 is skipped.
    let memberNum = 1;

    const importTbl = namespace.getUsedImportTbl();
    const importSpecList: string[] = [];
    const importNumTbl: NumTbl = {};
    let num = 0;

    for (const importName of Object.keys(importTbl)) {
      const otherNamespaceId = importTbl[importName].id;
      const content = namespace.importContentTbl[otherNamespaceId];
      const importTypeNameList: string[] = [];
      const importMemberNameList: string[] = [];

      for (const name of Object.keys(content.typeTbl || {}).sort()) {
        const type = content.typeTbl[name];

        importTypeNameList.push("'" + type.safeName + "'");
        typeNumTbl[type.surrogateKey] = typeNum++;
      }

      for (const name of Object.keys(content.memberTbl || {}).sort()) {
        const member = content.memberTbl[name];

        importMemberNameList.push("'" + member.name + "'");
        memberNumTbl[member.surrogateKey] = memberNum++;
      }

      importSpecList.push(
        "\n\t" +
          "[" +
          importName +
          ", " +
          "[" +
          importTypeNameList.join(", ") +
          "], " +
          "[" +
          importMemberNameList.join(", ") +
          "]" +
          "]",
      );

      importNumTbl[otherNamespaceId] = num++;
    }

    const typeList = this.buildTypeList(namespace);
    const memberList = this.buildMemberList(namespace);

    for (const type of typeList.all) {
      typeNumTbl[type.surrogateKey] = typeNum++;
    }

    for (const member of memberList.all) {
      memberNumTbl[member.surrogateKey] = memberNum++;
    }

    const typeSpecList: string[] = [];

    typeSpecList.push(this.writeType(namespace.doc, typeNumTbl, memberNumTbl));

    for (const type of typeList.all) {
      typeSpecList.push(this.writeType(type, typeNumTbl, memberNumTbl));
    }

    const memberSpecList: string[] = [];

    for (const member of memberList.all) {
      /* if(member.name != '*') */
      memberSpecList.push(this.writeMember(member, typeNumTbl, memberNumTbl));
    }

    const exportTypeNameList: string[] = [];
    const exportedTypesObject: string[] = [];

    for (const type of typeList.exported) {
      let name = type.safeName;
      if (type.name && type.name != name) name += ":" + type.name;

      exportTypeNameList.push("\n\t" + "'" + name + "'");

      if (
        type.isPlainPrimitive &&
        type.literalList &&
        type.literalList.length
      ) {
        exportedTypesObject.push(
          "\t" +
            name +
            ": {\n" +
            type.literalList.map((el) => `\t\t${el}: ${el}`).join(",\n") +
            "\n\t}",
        );
      }
    }

    return []
      .concat(
        ['var cxml = require("@loanlink-nl/cxml");'],
        this.writeHeader(),
        [
          "",
          "cxml.register(" +
            "'" +
            namespace.name +
            "', " +
            "exports, " +
            "[" +
            importSpecList.join(",") +
            "\n], " +
            "[" +
            exportTypeNameList.join(",") +
            "\n], " +
            "[" +
            typeSpecList.join(",") +
            "\n], " +
            "[" +
            memberSpecList.join(",") +
            "\n]" +
            ");",
        ],
        exportedTypesObject.length > 0
          ? [
              "",
              "Object.assign(module.exports, {\n" +
                exportedTypesObject.join(",\n") +
                "\n});",
            ]
          : "",
      )
      .join("\n");
  }

  getOutName(name: string) {
    return name + ".js";
  }

  construct = JS;
}
