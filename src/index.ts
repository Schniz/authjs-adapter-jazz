import type * as Jazz from "jazz-tools";
import { DeferredAccount, NextAuthAdapter } from "./types";
import {
  Account,
  AccountRoot,
  AccountStore,
  ProviderStore,
  Session,
  SessionStore,
  User,
  UserStore,
  VerificationToken,
  VerificationTokenStore,
} from "./data";
import * as crypto from "crypto";

export function JazzAdapter(opts: {
  account: DeferredAccount;
}): NextAuthAdapter {
  const root = Promise.resolve(opts.account)
    .then((x) => {
      return x.root?.castAs(AccountRoot);
    })
    .then((x) => {
      if (!x) throw new Error("Can't load account");
      return x;
    });

  const owner = Promise.resolve(opts.account);

  const getUserStore = () =>
    Promise.resolve(opts.account).then((owner) =>
      root.then((account) => {
        account.userStore ||= UserStore.create({}, { owner });
        return account.userStore;
      }),
    );

  const getAccountStore = async (provider: string) => {
    const account = await root;
    account.providerStore ||= ProviderStore.create({}, { owner: await owner });
    if (!(provider in account.providerStore._refs)) {
      account.providerStore[provider] ||= AccountStore.create(
        {},
        { owner: account._owner },
      );
    }
    const loaded = await account.providerStore._refs[provider].load();
    if (!loaded) {
      throw new Error("error loading");
    }
    return loaded;
  };

  const getSessionStore = async () => {
    const account = await root;
    account.sessionStore ||= SessionStore.create({}, { owner: await owner });
    return account.sessionStore;
  };

  const getVerificationTokenStore = async () => {
    const account = await root;
    account.verificationTokenStore ||= VerificationTokenStore.create(
      {},
      { owner: await owner },
    );
    return account.verificationTokenStore;
  };

  const getUserById = async (id: string) => {
    const userStore = await getUserStore();
    const user = await userStore._refs[id]?.load();
    if (user?.deletedAt) {
      return null;
    }
    return user;
  };

  return {
    async getUser(id) {
      const user = await getUserById(id);
      if (!user) {
        return null;
      }
      return user.toAdapterUser();
    },

    async createUser(opts) {
      const userStore = await getUserStore();
      const created = User.create(
        {
          a_id: "",
          email: opts.email,
          jazz: null,
          emailVerified: opts.emailVerified as Jazz.co<Date>,
          name: opts.name as any,
          ...(opts.image && { image: opts.image }),
          sessions: SessionStore.create({}, { owner: userStore._owner }),
          accounts: AccountStore.create({}, { owner: userStore._owner }),
        },
        { owner: userStore._owner },
      );
      userStore[created.id] = created;
      userStore[`mailto:${opts.email}`] = created;
      return { ...created, id: created.id };
    },

    async deleteUser(id) {
      const userStore = await getUserStore();
      let user = await userStore._refs[id]?.load();
      if (user) {
        user = (await user.ensureLoaded({ sessions: {}, accounts: {} }))!;
        user.deletedAt = new Date();
        const sessions = await getSessionStore();
        for (const sessionId of Object.keys(user.sessions!)) {
          delete sessions[sessionId];
        }
        for (const account of Object.values(user.accounts!)) {
          if (!account) continue;
          const store = await getAccountStore(account?.provider);
          delete store[account.providerAccountId];
        }
      }
      delete userStore[id];
      delete userStore[`mailto:${user?.email}`];
    },

    async getAccount(providerAccountId, provider) {
      const accountStore = await getAccountStore(provider);
      const account = await accountStore._refs[providerAccountId]?.load();
      return account?.toAuth() ?? null;
    },

    async updateUser(user) {
      const userStore = await getUserStore();
      const loaded = await userStore.ensureLoaded({});

      const x = loaded?.[user.id];
      if (!x) {
        throw new Error("error loading");
      }
      const { id, ...rest } = user;
      return Object.assign(x, rest);
    },

    async getUserByEmail(email) {
      return this.getUser!(`mailto:${email}`);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await this.getAccount!(providerAccountId, provider);
      if (!account) {
        return null;
      }
      return this.getUser!(account.userId);
    },

    async linkAccount(account) {
      const user = await getUserById(account.userId);
      if (!user) return;
      const accountStore = await getAccountStore(account.provider);
      const created = Account.create(
        { ...account, user },
        { owner: accountStore._owner },
      );
      user.accounts![`${account.provider}/${account.providerAccountId}`] =
        created;
      accountStore[account.providerAccountId] = created;
    },

    async createSession(opts) {
      const sessionStore = await getSessionStore();
      const user = await getUserById(opts.userId);
      if (!user) throw new Error("User not found");
      const session = Session.create(
        { sessionToken: opts.sessionToken, expires: opts.expires, user },
        { owner: await owner },
      );
      user.sessions![opts.sessionToken] = session;
      sessionStore[opts.sessionToken] = session;
      return session.toAdapterSession();
    },
    async getSessionAndUser(sessionToken) {
      const sessionStore = await getSessionStore();
      const session = await sessionStore._refs[sessionToken]?.load();
      if (!session) return null;
      const user = await session._refs.user.load();
      if (!user) return null;
      return {
        session: session.toAdapterSession(),
        user: user.toAdapterUser(),
      };
    },
    async updateSession(session) {
      const sessionStore = await getSessionStore();
      const stored = await sessionStore._refs[session.sessionToken]?.load();
      if (!stored) return null;

      if (session.expires) {
        stored.expires = session.expires;
      }

      const user = session.userId && (await getUserById(session.userId));
      if (user) {
        stored.user = user;
      }
    },
    async deleteSession(token) {
      const sessionStore = await getSessionStore();
      const stored = await sessionStore._refs[token]?.load();
      delete sessionStore[token];
      if (!stored) return null;

      const user = await stored._refs.user.load();
      if (!user) return null;
      const userSessions = await user._refs.sessions.load();
      if (!userSessions) return null;
      delete userSessions[token];
    },
    async unlinkAccount({ providerAccountId, provider }) {
      const accountStore = await getAccountStore(provider);
      const account = await accountStore._refs[providerAccountId]?.load();
      if (account) {
        delete account.user!.accounts![`${provider}/${providerAccountId}`];
      }
      delete accountStore[providerAccountId];
    },
    async createVerificationToken({ expires, identifier, token }) {
      const verificationTokenStore = await getVerificationTokenStore();
      const created = VerificationToken.create(
        {
          identifier,
          token,
          expires,
        },
        { owner: await owner },
      );
      verificationTokenStore[`${identifier}/${token}`] = created;
      return created.toAuth();
    },
    async useVerificationToken({ identifier, token }) {
      const verificationTokenStore = await getVerificationTokenStore();
      const key = `${identifier}/${token}`;
      const stored = await verificationTokenStore._refs[key]?.load();
      if (stored) {
        delete verificationTokenStore[key];
        return stored;
      }
      return null;
    },
  };
}
