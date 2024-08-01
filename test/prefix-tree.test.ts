import { PrefixTree } from "../src/prefix-tree";
import { test, expect } from "vitest";
import { Account, co, CoMap, WasmCrypto } from "jazz-tools";

test("treeof CoMap", async () => {
  class Test extends CoMap {
    name = co.string;
  }

  class Tree extends PrefixTree(
    2,
    co.ref(() => Test),
  ) {}

  const account = await Account.create({
    creationProps: { name: "server" },
    crypto: await WasmCrypto.create(),
  });

  const tree = Tree.create({}, { owner: account });

  await tree.set(
    "abcdefgh",
    Test.create({ name: "abcdefgh" }, { owner: account }),
  );
  await tree.set(
    "abcdefgx",
    Test.create({ name: "abcdefgx" }, { owner: account }),
  );
  await tree.set("123", Test.create({ name: "123" }, { owner: account }));

  expect({ ...tree }).toMatchObject({
    branches: {
      12: {
        branches: {
          3: {
            leaf: { value: { _type: "CoMap", name: "123" } },
          },
        },
      },
      ab: {
        branches: {
          cd: {
            branches: {
              ef: {
                branches: {
                  gh: {
                    leaf: { value: { _type: "CoMap", name: "abcdefgh" } },
                  },
                  gx: {
                    leaf: { value: { _type: "CoMap", name: "abcdefgx" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  expect(await tree.get("abcdefgh")).toEqual({ name: "abcdefgh" });
  await tree.del("abcdefgh");
  expect(await tree.get("abcdefgh")).toEqual(undefined);
});

test("treeof string", async () => {
  class Tree extends PrefixTree(2, co.string) {}

  const account = await Account.create({
    creationProps: { name: "server" },
    crypto: await WasmCrypto.create(),
  });

  const tree = Tree.create({}, { owner: account });

  await tree.set("abcdefgh", "abcdefgh");
  await tree.set("abcdefgx", "abcdefgx");
  await tree.set("123", "123");

  const v = await tree.get("abcdefgh");
  expect(v).toEqual("abcdefgh");

  expect({ ...tree }).toMatchObject({
    branches: {
      12: {
        branches: {
          3: {
            leaf: { value: "123" },
          },
        },
      },
      ab: {
        branches: {
          cd: {
            branches: {
              ef: {
                branches: {
                  gh: {
                    leaf: { value: "abcdefgh" },
                  },
                  gx: {
                    leaf: { value: "abcdefgx" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
});
