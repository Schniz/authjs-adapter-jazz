export type { Adapter as NextAuthAdapter } from "@auth/core/adapters";
import type * as Jazz from "jazz-tools";

export type DeferredAccount = Jazz.Account | Promise<Jazz.Account>;
