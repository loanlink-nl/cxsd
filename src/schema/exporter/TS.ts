// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { MemberRef } from "@loanlink-nl/cxml";
import * as path from "node:path";
import { Exporter } from "./Exporter";
import { Type } from "../Type";

const singleIndent = "  ";

/** Export parsed schema to a TypeScript d.ts definition file. */
export class TS extends Exporter {
  /** Format an XSD annotation as JSDoc. */
  static formatComment(indent: string, comment: string) {
    const lineList = comment.split("\n");
    let blankCount = 0;
    let contentCount = 0;
    const output: string[] = [];
    let prefix = "/**";

    for (let line of lineList) {
      // Remove leading and trailing whitespace.
      line = line.trim();

      if (!line) ++blankCount;
      else {
        if (blankCount && contentCount) output.push(indent + prefix);

        output.push(indent + prefix + " " + line);
        prefix = "  *";

        ++contentCount;
        blankCount = 0;
      }
    }

    if (output.length) output[output.length - 1] += " */";

    return output.join("\n");
  }

  writeImport(shortName: string, relativePath: string) {
    return `import * as ${shortName} from "${relativePath}";`;
  }

  /** Output list of original schema file locations. */
  exportSourceList(sourceList: string[]) {
    const output: string[] = [];

    output.push("// Source files:");

    for (const urlRemote of sourceList) {
      output.push("// " + urlRemote);
    }

    output.push("");
    return output;
  }

  writeTypeRef(type: Type, namePrefix: string) {
    const output: string[] = [];

    const namespace = type.namespace as any;
    const name = namePrefix + type.safeName;

    if (!namespace || namespace == this.namespace) {
      output.push(name);
    } else {
      // Type from another, imported namespace.
      const short = this.namespace.getShortRef(namespace.id);

      if (short) {
        output.push(short + "." + name);
      } else {
        console.error(
          "MISSING IMPORT " + namespace.name + " for type " + type.name,
        );
        output.push("any");
      }
    }

    return output.join("");
  }

  writeParents(parentDef: string, mixinList: Type[]) {
    const parentList: string[] = [];

    if (parentDef) parentList.push(parentDef);

    for (const type of mixinList || []) {
      parentList.push(this.writeTypeRef(type, "_"));
    }

    return parentList.length ? " extends " + parentList.join(", ") : "";
  }

  // writeTypeList(ref: MemberRef) {
  writeTypeList(ref: any) {
    this.opts.safeNameOverrides = this.opts.safeNameOverrides || {};

    let typeList = ref.member.typeSpecList;

    if (ref.max > 1 && ref.member.proxySpec) typeList = [ref.member.proxySpec];

    const outTypeList = typeList.map((type: Type) => {
      if (
        type.isPlainPrimitive &&
        (!type.literalList || !type.literalList.length)
      ) {
        if (this.opts.safeNameOverrides[type.safeName]) {
          return this.opts.safeNameOverrides[type.safeName];
        }

        return type.primitiveType.name;
      } else {
        return this.writeTypeRef(type, "");
      }
    });

    if (outTypeList.length == 0) return null;

    const outTypes = outTypeList.sort().join(" | ");

    if (ref.max > 1) {
      const type = outTypeList.length > 1 ? "(" + outTypes + ")" : outTypes;

      return `${type}[]`;
    } else return outTypes;
  }

  writeMember(ref: MemberRef, isGlobal: boolean, indentCount = 1) {
    const output: string[] = [];
    const member = ref.member;
    const comment = member.comment;
    const indent = singleIndent.repeat(indentCount);

    if ((ref as any).isHidden) return "";
    if (isGlobal && member.isAbstract) return "";
    if (member.name == "*") return "";

    if (comment) {
      output.push(TS.formatComment(indent, comment));
      output.push("\n");
    }

    let name = member.name;

    // Convert name to a name compatible with JAXB output (from Jsonix)
    if (member.name !== ref.safeName) name = `"${name}"`;

    output.push(indent + name);

    if (ref.min == 0) output.push("?");
    output.push(": ");

    const outTypes = this.writeTypeList(ref);
    if (!outTypes) return "";

    output.push(outTypes);
    output.push(";");

    return output.join("");
  }

  writeTypeContent(type: Type) {
    const output: string[] = [];

    if (type.isPlainPrimitive) {
      const literalList = type.literalList;

      if (literalList && literalList.length > 0) {
        if (literalList.length > 1) {
          output.push("(" + literalList.join(" | ") + ")");
        } else output.push(literalList[0]);
      } else {
        output.push(type.primitiveType.name);
      }
    } else if (type.isList) {
      output.push(this.writeTypeList(type.childList[0]));
    } else {
      const outMemberList: string[] = [];
      const outAttributeList: string[] = [];

      for (const attribute of type.attributeList) {
        const outAttribute = this.writeMember(attribute, false, 1);
        if (outAttribute) outAttributeList.push(outAttribute);
      }

      for (const child of type.childList) {
        const outChild = this.writeMember(child, false, 1);
        if (outChild) outMemberList.push(outChild);
      }

      output.push("{");

      if (outAttributeList.length || outMemberList.length) {
        output.push("\n");
      }

      if (outAttributeList.length) {
        output.push(outAttributeList.join("\n"));
        output.push("\n");
      }

      if (outMemberList.length) {
        if (outAttributeList.length) {
          output.push("\n");
        }

        output.push(outMemberList.join("\n"));
        output.push("\n");
      }

      output.push("}");
    }

    return output.join("");
  }

  writePrimitiveEnum(type: Type) {
    if (!type.isPlainPrimitive) {
      console.warn(
        `When writing an enum, type should be primitive. Found in type '${type.name}'. This is a bug and/or unsupported case in CXSD.`,
      );
      return "";
    }

    const output: string[] = [];

    const literalList = type.literalList;
    if (literalList && literalList.length > 0) {
      const isDefinitions = false;
      let assignmentOp = " =";
      let wrapFunc = "Object.freeze(";
      let endOp = ")";

      if (isDefinitions) {
        assignmentOp = ":";
        wrapFunc = "Readonly<";
        endOp = ">";
      }

      output.push(
        `export const ${type.safeName}${assignmentOp} ${wrapFunc}{\n`,
      );
      output.push(
        literalList.map((el) => `${singleIndent}${el}: ${el}`).join(",\n"),
      );
      output.push(`\n}${endOp};\n`);
    } else {
      return "";
    }

    return output.join("");
  }

  writeType(type: Type) {
    const namespace = this.namespace;
    const output: string[] = [];
    const comment = type.comment;
    let parentDef: string;
    const exportPrefix = type.isExported ? "export " : "";

    const name = type.safeName;

    if (comment) {
      output.push(TS.formatComment("", comment));
      output.push("\n");
    }

    const content = this.writeTypeContent(type);

    if (namespace.isPrimitiveSpace) {
      output.push(
        exportPrefix +
          "interface _" +
          name +
          this.writeParents(null, type.mixinList) +
          " { " +
          "content" +
          ": " +
          type.primitiveType.name +
          "; }" +
          "\n",
      );
    } else if (type.isList) {
      output.push(exportPrefix + "type " + name + " = " + content + ";" + "\n");
    } else if (type.isPlainPrimitive) {
      parentDef = this.writeTypeRef(type.parent, "_");

      if (type.literalList && type.literalList.length) {
        output.push(
          exportPrefix +
            "type " +
            name +
            " = keyof typeof " +
            name +
            ";" +
            "\n",
        );

        output.push(this.writePrimitiveEnum(type));
      } else {
        output.push(
          exportPrefix + "type " + name + " = " + content + ";" + "\n",
        );
      }
    } else {
      if (type.parent) parentDef = this.writeTypeRef(type.parent, "_");

      output.push(
        exportPrefix +
          "interface " +
          name +
          this.writeParents(parentDef, type.mixinList) +
          " " +
          content +
          "\n",
      );
    }

    return output.join("");
  }

  // writeSubstitutions(type: Type, refList: MemberRef[], output: string[]) {
  writeSubstitutions(type: Type, refList: any[], output: string[]) {
    for (const ref of refList) {
      const proxy = ref.member.proxySpec;

      if (!ref.member.isAbstract) output.push(this.writeMember(ref, false));

      if (proxy && proxy != type)
        this.writeSubstitutions(proxy, proxy.childList, output);
    }

    for (const mixin of type.mixinList) {
      if (mixin != type)
        this.writeSubstitutions(mixin, mixin.childList, output);
    }
  }

  writeAugmentations(output: string[]) {
    const namespace = this.namespace;

    for (const namespaceId of Object.keys(namespace.augmentTbl)) {
      const augmentTbl = namespace.augmentTbl[namespaceId];
      const typeIdList = Object.keys(augmentTbl);
      let type = augmentTbl[typeIdList[0]].type;
      const other = type.namespace;

      output.push(
        "declare module " +
          "'" +
          this.state.writer.getPathTo(other.name, namespace) +
          "'" +
          " {",
      );

      for (const typeId of typeIdList) {
        type = augmentTbl[typeId].type;

        output.push("export interface _" + type.safeName + " {");

        for (const ref of augmentTbl[typeId].refList) {
          ref.safeName = ref.member.safeName;
        }

        this.writeSubstitutions(type, augmentTbl[typeId].refList, output);

        output.push("}");
      }

      output.push("}");
    }
  }

  writeContents(): string {
    const output = []; //this.writeHeader();
    const doc = this.doc;
    const namespace = this.namespace;

    output.push("/* eslint-disable */");
    output.push("// @ts-nocheck");
    output.push("");

    // this.writeAugmentations(output);

    for (const type of namespace.typeList
      .slice(0)
      .sort((a: Type, b: Type) => a.safeName.localeCompare(b.safeName))) {
      if (!type) continue;

      output.push(this.writeType(type));
    }

    output.push(
      "export interface " + (this.opts?.["document"] ?? "document") + " {",
    );

    for (const child of doc.childList) {
      const outElement = this.writeMember(child, true);
      if (outElement) {
        output.push(outElement);
      }
    }

    output.push("}");

    return output.join("\n");
  }

  getOutName(name: string) {
    return path.basename(name) + ".ts";
  }

  construct = TS;
}
