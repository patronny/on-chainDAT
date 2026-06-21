import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transfer" };

export default function TransferDocPage() {
  return (
    <>
      <h1>Transfer</h1>

      <p>
        All <code>$XXXDAT</code> tokens are{" "}
        <strong>non-transferable</strong> through regular wallet-to-wallet
        transfers.
      </p>

      <p>
        But over time, users may have a legitimate reason to move their tokens:
      </p>

      <ul>
        <li>switch to a new wallet</li>
        <li>send tokens to another person</li>
        <li>move assets to a safer address</li>
      </ul>

      <p>For this, there is a dedicated interface on our website:</p>

      <p>
        <a href="https://www.on-chaindat.com/transfer">
          https://www.on-chaindat.com/transfer
        </a>
      </p>

      <p>
        The transfer works through a special intermediary contract (the relay).
      </p>

      <p>
        The principle is similar to how <code>$veAERO</code> positions are moved
        on Aerodrome.
      </p>

      <p>
        <strong>How it works:</strong>
      </p>

      <ul>
        <li>you connect your wallet</li>
        <li>
          enter the amount of <code>$XXXDAT</code>
        </li>
        <li>enter the recipient address</li>
        <li>approve the contract to spend only that specific amount</li>
        <li>click &ldquo;Send&rdquo;</li>
        <li>
          the contract takes the specified amount of <code>$XXXDAT</code> from
          your wallet and sends it to the selected address
        </li>
      </ul>

      <p>
        <strong>Transfer fee:</strong>
      </p>

      <p>
        Every transfer charges a mandatory <strong>1% fee</strong>, taken in{" "}
        <code>$XXXDAT</code> and <strong>burned</strong> (sent to the dead
        address). The recipient receives the remaining <strong>99%</strong>. The
        burn permanently reduces the circulating supply and shows up in the
        protocol&rsquo;s burn total like any other buy-and-burn.
      </p>

      <p>
        <strong>Important:</strong>
      </p>

      <ul>
        <li>
          regular <code>$XXXDAT</code> transfers between wallets are disabled
        </li>
        <li>
          transfers are only possible through the official interface and the
          relay contract
        </li>
        <li>
          the contract receives permission only for the exact amount you choose
        </li>
        <li>a 1% fee is burned on every transfer; the recipient receives 99%</li>
        <li>tokens cannot be moved without your confirmation in your wallet</li>
      </ul>
    </>
  );
}
