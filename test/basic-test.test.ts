import { runBasicTests } from "./utils/adapter";
import { JazzAdapter } from "../src";
import { WasmCrypto } from "jazz-tools";
import { AccountRoot, AccountWithRoot } from "../src/data";

const providers: Record<string, Record<string, any>> = {};

const account = await AccountWithRoot.create({
  creationProps: { name: "server" },
  crypto: await WasmCrypto.create(),
});

account.root = AccountRoot.create({}, { owner: account });

runBasicTests({
  adapter: JazzAdapter({
    account: account,
  }),
  db: {
    user: async (id) => {
      const vvv = account.root?.userStore?.[id] ?? null;
      if (vvv?.deletedAt) return null;
      return vvv?.toAdapterUser() ?? null;
    },
    session(token) {
      const vvv = account.root?.sessionStore?.[token] ?? null;
      return vvv?.toAdapterSession() ?? null;
    },
    account({ providerAccountId, provider }) {
      return (
        account.root?.providerStore?.[provider]?.[
          providerAccountId
        ]?.toAuth() ?? null
      );
    },
    verificationToken({ token, identifier }) {
      return (
        account.root?.verificationTokenStore?.[
          `${identifier}/${token}`
        ]?.toAuth() ?? null
      );
    },
  },
});
