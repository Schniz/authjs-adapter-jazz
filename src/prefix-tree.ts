import { CoMap, co } from "jazz-tools";
import { chunkString } from "./chunk-string";
import { CoMapInit, IfCo } from "jazz-tools/src/internal";

export const PrefixTree = <Value>(
  chunkSize: number,
  Of: IfCo<Value, Value>,
) => {
  class Branches extends CoMap.Record(co.ref(() => Tree)) {}
  class Leaf extends CoMap {
    value = Of;
  }

  async function getDeepestBranch(
    tree: Tree,
    key: string,
    create: "create",
  ): Promise<Tree>;
  async function getDeepestBranch(
    tree: Tree,
    key: string,
  ): Promise<Tree | null>;
  async function getDeepestBranch(
    tree: Tree,
    key: string,
    create?: "create",
  ): Promise<Tree | null> {
    const chunks = chunkString(key, chunkSize);
    const shouldCreate = create === "create";

    for (const chunk of chunks) {
      let branches: Branches | undefined = await tree._refs.branches?.load();
      if (!branches && !shouldCreate) {
        return null;
      } else if (!branches) {
        tree.branches = Branches.create({}, { owner: tree._owner });
        branches = tree.branches;
      }

      let nextTree = await branches._refs[chunk]?.load();
      if (!nextTree && !shouldCreate) {
        return null;
      } else if (!nextTree) {
        nextTree = Tree.create({}, { owner: tree._owner });
        branches[chunk] = nextTree;
      }

      tree = nextTree;
    }

    return tree;
  }

  class Tree extends CoMap {
    leaf = co.optional.ref(() => Leaf);
    branches = co.optional.ref(() => Branches);

    async get(key: string) {
      const tree = await getDeepestBranch(this, key);
      return tree?.leaf?.value;
    }

    async set(key: string, value: co<Value>) {
      const tree = await getDeepestBranch(this, key, "create");

      if (tree.leaf) {
        // @ts-expect-error types are weird
        tree.leaf.value = value;
      } else {
        // @ts-expect-error types are weird
        tree.leaf = Leaf.create({ value }, { owner: tree._owner });
      }
    }

    async del(key: string) {
      const tree = await getDeepestBranch(this, key);
      if (tree) {
        delete tree.leaf;
      }
    }
  }

  return Tree;
};
