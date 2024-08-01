import * as Jazz from "jazz-tools";
import { co } from "jazz-tools";
import type * as Auth from "@auth/core/adapters";

type Value<T> = T extends { value?: co<infer R> } ? R : never;

type Satisfies<Jazzed extends Jazz.CoMap> = Jazzed["_edits"] extends infer Edits
  ? {
      [key in keyof Edits as key extends `a_${infer R}` ? R : key]: Value<
        Edits[key]
      >;
    }
  : never;

export class ManagedJazzAccount extends Jazz.CoMap {
  accountId = co.string;
  accountSecret = co.string;
  syncServer = co.optional.string;
}

export class User extends Jazz.CoMap {
  email = co.string;
  name = co.string;
  image = co.optional.string;
  emailVerified = co.optional.encoded(Jazz.Encoders.Date);
  jazz = co.optional.ref(ManagedJazzAccount);

  deletedAt = co.optional.encoded(Jazz.Encoders.Date);

  sessions = co.ref(() => SessionStore);
  accounts = co.ref(() => AccountStore);

  toAdapterUser(): Auth.AdapterUser {
    const { jazz, sessions, accounts, ...rest } = this;
    return { ...rest, id: this.id };
  }
}

export class UserStore extends Jazz.CoMap.Record(co.ref(User)) {}

export class Account extends Jazz.CoMap {
  provider = co.string;
  type = co.json<Auth.AdapterAccountType>();
  providerAccountId = co.string;

  scope = co.optional.string;
  session_state = co.optional.string;
  token_type = co.optional.string;
  refresh_token = co.optional.string;
  id_token = co.optional.string;
  access_token = co.optional.string;
  expires_at = co.optional.number;

  user = co.ref(() => User);

  toAuth(): Auth.AdapterAccount {
    return {
      provider: this.provider,
      providerAccountId: this.providerAccountId,
      userId: this._refs.user.id,
      type: this.type,
      expires_at: this.expires_at,
      scope: this.scope,
      id_token: this.id_token,
      session_state: this.session_state,
      token_type: this.token_type as Lowercase<string>,
      refresh_token: this.refresh_token,
      access_token: this.access_token,
    };
  }
}

export class AccountStore extends Jazz.CoMap.Record(co.ref(Account)) {}

export class ProviderStore extends Jazz.CoMap.Record(co.ref(AccountStore)) {}

export class Session extends Jazz.CoMap {
  sessionToken = co.string;
  user = co.ref(User);
  expires = co.encoded(Jazz.Encoders.Date);

  toAdapterSession(): Auth.AdapterSession {
    const { user, ...rest } = this;
    return { ...rest, userId: this._refs.user.id };
  }
}

export class VerificationToken extends Jazz.CoMap {
  expires = co.encoded(Jazz.Encoders.Date);
  identifier = co.string;
  token = co.string;

  toAuth() {
    return {
      identifier: this.identifier,
      token: this.token,
      expires: this.expires,
    };
  }
}

export class VerificationTokenStore extends Jazz.CoMap.Record(
  co.ref(VerificationToken),
) {}

export class SessionStore extends Jazz.CoMap.Record(co.ref(Session)) {}

export class AccountRoot extends Jazz.CoMap {
  userStore = co.optional.ref(UserStore);
  providerStore = co.optional.ref(ProviderStore);
  sessionStore = co.optional.ref(SessionStore);
  verificationTokenStore = co.optional.ref(VerificationTokenStore);
}

export class AccountWithRoot extends Jazz.Account {
  root = co.ref(AccountRoot);
}
