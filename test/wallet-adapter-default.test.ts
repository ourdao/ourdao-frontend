import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake kit with the real kit's relevant behaviour: `init` resets the active
// module to `selectedWalletId`, and the picker changes it afterwards.
const kit = vi.hoisted(() => {
  const state = { active: "", init: vi.fn(), calls: [] as string[] };
  return {
    state,
    StellarWalletsKit: {
      init(params: { selectedWalletId?: string }) {
        state.init(params);
        if (params.selectedWalletId) state.active = params.selectedWalletId;
      },
      async authModal() {
        state.active = "xbull";
        return { address: "GADDR" };
      },
      async getAddress() {
        return { address: "GADDR" };
      },
      async getNetwork() {
        state.calls.push(`getNetwork:${state.active}`);
        return { network: "TESTNET", networkPassphrase: "p" };
      },
      async signTransaction() {
        state.calls.push(`signTransaction:${state.active}`);
        return { signedTxXdr: "signed" };
      },
      async signMessage() {
        state.calls.push(`signMessage:${state.active}`);
        return { signedMessage: "sig" };
      },
      async disconnect() {},
    },
  };
});

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: kit.StellarWalletsKit,
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({ defaultModules: () => [] }));
vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({ FREIGHTER_ID: "freighter" }));

import { getDefaultWalletAdapter } from "@/lib/wallet-adapter";

describe("getDefaultWalletAdapter", () => {
  beforeEach(() => {
    kit.state.calls.length = 0;
  });

  it("initialises the kit once, preselecting Freighter, and keeps the picked wallet", async () => {
    const adapter = getDefaultWalletAdapter("p");
    expect(kit.state.init).not.toHaveBeenCalled();

    await adapter.connect();
    await adapter.getNetwork();
    await adapter.signTransaction("xdr", "GADDR");
    await adapter.signMessage("msg", "GADDR");

    expect(kit.state.init).toHaveBeenCalledTimes(1);
    expect(kit.state.init.mock.calls[0][0].selectedWalletId).toBe("freighter");
    expect(kit.state.calls).toEqual([
      "getNetwork:xbull",
      "signTransaction:xbull",
      "signMessage:xbull",
    ]);
  });
});
