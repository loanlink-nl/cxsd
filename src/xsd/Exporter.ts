// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { MemberSpec, MemberRef } from "@loanlink-nl/cxml";

import { Namespace } from "./Namespace";
import { Scope, TypeMember } from "./Scope";
import { Source } from "./Source";
import * as types from "./types";
import * as schema from "../schema";

function mergeDuplicateTypes(typeList: types.TypeBase[]) {
  if (typeList.length < 2) return typeList;

  const tbl: { [key: string]: types.TypeBase } = {};

  for (const type of typeList) tbl[type.surrogateKey] = type;

  return Object.keys(tbl).map((key: string) => tbl[key]);
}

function exportMemberRef(
  spec: TypeMember,
  parentScope: Scope,
  namespace: schema.Namespace,
  context: schema.Context,
) {
  const member = spec.item as types.MemberBase;
  const outMember = member.getOutMember(context);
  const outRef = new MemberRef(outMember as any, spec.min, spec.max);

  if (!outMember.typeSpecList)
    exportMember(member, outRef, parentScope, namespace, context);

  return outRef;
}

// function exportMember(member: types.MemberBase, outRef: MemberRef, parentScope: Scope, namespace: schema.Namespace, context: schema.Context) {
function exportMember(
  member: types.MemberBase,
  outRef: any,
  parentScope: Scope,
  namespace: schema.Namespace,
  context: schema.Context,
) {
  const outMember = outRef.member;
  const scope = member.getScope();
  const otherNamespace = scope.namespace;

  outMember.comment = scope.getComments();

  if (otherNamespace != parentScope.namespace) {
    outMember.namespace = context.copyNamespace(otherNamespace);
  } else outMember.namespace = namespace;

  //outMember.typeSpecList = member.getTypes().map(
  outMember.typeSpecList = mergeDuplicateTypes(member.getTypes()).map(
    (type: types.TypeBase) => {
      const outType = type.getOutType(context);
      const qName = type.qName;

      if (!qName && !type.name && !type.exported) {
        // Anonymous type defined only within this element.

        outType.containingRef = outRef;

        // Look through parent scopes for a containing type,
        // If the member was referenced from another namespace,
        // its scope points to definition in that namespace.
        const parentType = scope.getParentType(otherNamespace);
        if (parentType) {
          outType.containingType = parentType.getOutType(context);
        }

        exportType(type, outMember.namespace, context);
      }

      return outType;
    },
  );

  outMember.isAbstract = member.isAbstract();

  if (member instanceof types.Element) {
    if (member.substitutes) {
      outMember.substitutes = member.substitutes.getOutMember(context);
      outMember.namespace.pendingSubstituteList.push(outMember);
    }
    if (member.isSubstituted) outMember.isSubstituted = true;
  }
}

function exportAttributes(
  scope: Scope,
  namespace: schema.Namespace,
  context: schema.Context,
  type: schema.Type,
) {
  const memberTbl = scope.dumpMembers("attribute", "attributeGroup");

  for (const key of Object.keys(memberTbl).sort()) {
    const ref = exportMemberRef(memberTbl[key], scope, namespace, context);
    type.addAttribute(ref);
  }
}

function exportChildren(
  scope: Scope,
  namespace: schema.Namespace,
  context: schema.Context,
  outType: schema.Type,
  setExported: boolean,
) {
  const memberTbl = scope.dumpMembers("element", "group");

  for (const key of Object.keys(memberTbl).sort()) {
    const ref = exportMemberRef(memberTbl[key], scope, namespace, context);

    if (setExported) ref.member.isExported = true;
    outType.addChild(ref);
  }
}

/* TODO
function exportGroups(scope: Scope, namespace: schema.Namespace, context: schema.Context) {
//	const groupTbl = scope.dumpGroups();
	const groupList: schema.Member[] = [];

	return(groupList);
}
*/

function exportType(
  type: types.TypeBase,
  namespace: schema.Namespace,
  context: schema.Context,
) {
  const scope = type.getScope();
  const comment = scope.getComments();

  type.exported = true;

  const outType = type.getOutType(context);
  outType.comment = comment;
  outType.bytePos = type.bytePos;
  // If the type derives from a primitive type, it may have text content.
  let parentPrimitive = type.getParent(types.Primitive, false);

  if (parentPrimitive) {
    // Get equivalent JavaScript type.
    outType.primitiveType = parentPrimitive.getOutType(context);

    // Check if primitive type is inherited without any additional attributes
    // or children, so contents can be represented as a JavaScript primitive.
    // NOTE: Substitutions won't be applied to such types!
    parentPrimitive = type.getParent(types.Primitive, true);
  }

  if (parentPrimitive) {
    let literalList: string[];
    const parentSimple = type.getParent(
      types.SimpleType,
      false,
    ) as types.SimpleType;

    if (parentSimple) {
      // If parent is restricted to enumerated alternatives, output those instead.
      literalList = parentSimple.getEnumerationList();
      if (literalList)
        literalList = literalList.map((content: string) => '"' + content + '"');
    }

    outType.literalList = literalList;
    outType.isPlainPrimitive = true;
    outType.primitiveType = parentPrimitive.getOutType(context);
  }

  const parent = type.parent;

  if (parent instanceof types.TypeBase && parent != parentPrimitive) {
    outType.parent = parent.getOutType(context);
  }

  exportAttributes(scope, namespace, context, outType);
  exportChildren(scope, namespace, context, outType, false);
  //	outType.groupList = exportGroups(scope, namespace, context);

  const listType = type.getListType();

  if (listType) {
    for (const spec of listType) {
      const outMember = new MemberSpec("");
      const outMemberRef = new MemberRef(outMember as any, spec.min, spec.max);

      outMember.namespace = namespace;
      outMember.typeSpecList = [
        exportType(spec.item as types.TypeBase, namespace, context),
      ] as any;

      outType.addChild(outMemberRef);
    }

    outType.isList = true;
  }

  return outType;
}

/** Export parsed xsd into a simpler internal schema format. */

export function exportNamespace(
  namespace: Namespace,
  context: schema.Context,
): schema.Type {
  const outNamespace = context.copyNamespace(namespace);
  let doc = outNamespace.doc;

  if (doc) return doc;

  //	if(!doc) {
  const scope = namespace.getScope();

  const sourceList = namespace.getSourceList();
  const importTbl: { [id: string]: Namespace } = {};

  for (const source of sourceList) {
    const namespaceRefTbl = source.getNamespaceRefs();

    for (const name of Object.keys(namespaceRefTbl)) {
      const otherNamespace = namespaceRefTbl[name];

      outNamespace.addRef(name, context.copyNamespace(otherNamespace));

      importTbl[otherNamespace.id] = otherNamespace;
    }
  }

  outNamespace.sourceList = sourceList
    .map((source: Source) => source.url)
    .sort();

  for (const spec of scope.dumpTypes("type") || []) {
    if (spec.name)
      exportType(
        spec.item as types.TypeBase,
        outNamespace,
        context,
      ).isExported = true;
  }

  doc = new schema.Type(null);

  doc.namespace = outNamespace;
  exportAttributes(scope, outNamespace, context, doc);
  exportChildren(scope, outNamespace, context, doc, true);

  outNamespace.doc = doc;

  for (const namespaceId of Object.keys(importTbl)) {
    exportNamespace(importTbl[namespaceId], context);
  }

  for (const member of outNamespace.pendingSubstituteList as any) {
    const proxy = member.substitutes.getProxy(schema.Type);

    if (member.substitutes.namespace == member.namespace) {
      if (member.isSubstituted || member.isAbstract) {
        proxy.addMixin(member.getProxy(schema.Type));
      } else {
        proxy.addChildSpec(member);
      }
    } else {
      member.namespace.addAugmentation(proxy, member);
    }
  }
  //	}

  return doc;
}
