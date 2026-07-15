import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "What Is an On-Chain DAT?",
  description:
    "DAT names three different things: a listed company that holds crypto, a token carrying the rights of that company's stock, and a smart contract that holds a treasury. This page separates the three, links every source, and states which one $LDAT is.",
};

/**
 * Disambiguation page for a contested term. Two rules govern edits here:
 *
 *   1. Every claim about a third party carries an outbound link to the source it
 *      came from. If a claim cannot be linked, it does not go on the page.
 *   2. Every claim about $LDAT is scoped to what the current code does, not to
 *      what it is intended to do. The contracts are upgradeable and several
 *      headline numbers are owner-settable; the page says so.
 *
 * The FAQPage block below mirrors three of the h2 questions. Edit an answer and
 * edit its mirror.
 */
export default function WhatIsAnOnchainDatDocPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What does DAT stand for?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "DAT stands for digital asset treasury. Past those three words there is no single agreed referent. The definition most commonly given by mainstream financial and legal sources is the corporate one: a publicly traded company that accumulates cryptoassets as a core part of its business strategy. The term is also used for a token carrying the rights of such a company's stock, and for a smart contract that holds a treasury with no company behind it.",
              },
            },
            {
              "@type": "Question",
              name: "Is a DAT token the same as a DAT company?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. A DAT company is a publicly listed business that holds crypto on its balance sheet and sells shares in itself. A protocol-native DAT is a smart contract that holds a treasury: there are no shares, no filings and nobody obliged to the holder. Tokenized DAT equity is a third thing again, a token that carries the rights of a registered share.",
              },
            },
            {
              "@type": "Question",
              name: "Which kind of DAT is $LDAT?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "$LDAT is a protocol-native DAT: a smart contract holding a treasury on Linea L2. There is no on-chainDAT company to buy shares in, no share register, no filing and no claim on any legal entity. The contracts are upgradeable, ownership is a 2-of-3 Safe multisig, and there is no third-party audit.",
              },
            },
          ],
        }}
      />

      <h1>What is an on-chain DAT?</h1>

      <p className="docs-lead">
        A DAT company is a publicly listed business that holds crypto and sells
        shares in itself. Tokenized DAT equity is that company&apos;s registered
        stock issued on-chain, with the shareholder rights intact. A
        protocol-native DAT is a smart contract that holds a treasury, with no
        shares and nobody obliged to the holder. All three are called DATs, and
        the third is spelled both &ldquo;on-chain DAT&rdquo; and &ldquo;onchain
        DAT&rdquo;. <code>$LDAT</code> is the third one, and only the third.
      </p>

      <h2>What does DAT stand for?</h2>
      <p>
        DAT stands for <strong>digital asset treasury</strong>. Past those three
        words there is no single agreed referent. The definition most commonly
        given by mainstream financial and legal sources is the corporate one.{" "}
        <a
          href="https://www.theblock.co/learn/390761/what-is-a-dat"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Block
        </a>{" "}
        defines it as: &ldquo;Digital asset treasury companies (commonly known as
        DATs) are publicly traded firms which accumulate cryptoassets as a core
        part of their business strategy.&rdquo; DefiLlama&apos;s{" "}
        <a
          href="https://www.dlnews.com/articles/llama-u/hype-dat-ecosystem-case-study-for-mnav/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Llama U guide
        </a>{" "}
        is shorter: &ldquo;a public company that buys and holds crypto tokens
        directly on its balance sheet.&rdquo; Both describe a company. Neither
        describes a token, which is why a reader who arrives at a token called a
        DAT can end up confused.
      </p>

      <h2>The three categories at a glance</h2>
      {/* .table-scroll: five rows x four columns does not fit a phone. The wrapper
          scrolls sideways rather than letting the cells crush their own words. */}
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>1. DAT company (DATCO)</th>
            <th>2. Tokenized DAT equity</th>
            <th>3. Protocol-native DAT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">What you buy</th>
            <td>Registered shares in a listed company</td>
            <td>A token carrying the rights of a registered share</td>
            <td>A token issued by a contract, carrying no claim on anyone</td>
          </tr>
          <tr>
            <th scope="row">Who is obliged to you</th>
            <td>The company</td>
            <td>The company, through its transfer agent</td>
            <td>Nobody</td>
          </tr>
          <tr>
            <th scope="row">Dilution</th>
            <td>New shares can be issued (ATMs, PIPEs, convertibles)</td>
            <td>Same as category 1: the referent is the same stock</td>
            <td>No shares exist, so no share issuance and no dilution</td>
          </tr>
          <tr>
            <th scope="row">Where the treasury is reported</th>
            <td>Periodic filings, on the company&apos;s balance sheet</td>
            <td>Periodic filings, on the company&apos;s balance sheet</td>
            <td>Readable on-chain at any block, by direct contract read</td>
          </tr>
          <tr>
            <th scope="row">Who can change the rules</th>
            <td>Board and shareholders, inside securities law</td>
            <td>Board and shareholders, inside securities law</td>
            <td>
              Whoever holds the contract&apos;s keys, until those keys are
              renounced
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <h2>Category 1: the DAT company, or DATCO</h2>
      <p>
        A DAT company, also called a DATCO, is a publicly listed operating
        company whose core business is accumulating crypto on its own balance
        sheet. <strong>You buy shares.</strong>{" "}
        <a
          href="https://marketedge.dlapiper.com/2025/10/key-capital-market-trends-digital-asset-treasuries/"
          target="_blank"
          rel="noopener noreferrer"
        >
          DLA Piper
        </a>{" "}
        puts it this way: &ldquo;Known as digital asset treasury (DAT) companies,
        these public companies, at the core of their revamped business model,
        pursue long-term accumulation of significant reserves of digital assets
        while employing sophisticated, yield-enhancing trading strategies.&rdquo;
      </p>
      <p>
        The canonical example is{" "}
        <a
          href="https://data.sec.gov/submissions/CIK0001050446.json"
          target="_blank"
          rel="noopener noreferrer"
        >
          SEC filer CIK 0001050446
        </a>
        , whose registered name is Strategy Inc and whose former name,
        MICROSTRATEGY INC, is recorded on EDGAR through 2025-08-11. What an
        investor holds is conventional securities: class A common stock on
        Nasdaq, plus four listed preferred series. The stated reason to hold the
        share rather than the coin is corporate: The Block notes DATs
        &ldquo;typically utilize debt to fund new crypto purchases, meaning they
        offer a form of leveraged exposure,&rdquo; and DLA Piper enumerates the
        machinery used to build them - at-the-market offerings, PIPEs, equity
        lines of credit, convertible notes, warrants, preferred equity, de-SPACs,
        reverse mergers and credit facilities.
      </p>
      <p>
        The scale is corporate too. DLA Piper reports that fewer than ten
        companies held BTC in treasury in 2021, that more than 200 companies had
        adopted DAT strategies by September 2025 holding over $115 billion in
        digital assets, and that aggregate DAT market capitalisation was roughly
        $150 billion in September 2025 against $40 billion a year earlier.
      </p>
      <p>
        <strong>
          If your question is about category 1, this page does not answer it.
        </strong>{" "}
        The Block, DLA Piper, DefiLlama and Cornerstone Research, all linked on
        this page, cover it directly. Category 1 is described here only so that it
        can be told apart from category 3.
      </p>

      <h2>Category 2: tokenized DAT equity</h2>
      <p>
        Tokenized DAT equity is a token that represents a claim on the equity of a
        category-1 company, issued onto a blockchain. The distinguishing feature
        is that the referent is <strong>registered stock</strong> and the obligor
        is the company itself.
      </p>
      <p>
        The clearest example: on 2025-09-25 SharpLink Gaming announced it would
        tokenize its SEC-registered common stock on Ethereum through
        Superstate&apos;s Opening Bell platform, appointing Superstate as its
        Digital Transfer Agent.{" "}
        <a
          href="https://www.theblock.co/post/372367/sharplink-to-tokenize-sbet-stock-on-ethereum-via-superstate-opening-bell"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Block reported
        </a>{" "}
        that SharpLink plans to become the first public company to natively issue
        its common stock directly on the Ethereum blockchain. That is an announced
        intention as of that date; this page does not track whether it has
        completed.
      </p>
      <p>
        Category 2 is worth separating from synthetic price exposure, and
        regulators separate it. The SEC&apos;s Division of Corporation Finance, in
        its{" "}
        <a
          href="https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities"
          target="_blank"
          rel="noopener noreferrer"
        >
          statement on tokenized securities
        </a>
        , defines a &ldquo;linked security&rdquo; as one &ldquo;issued by the
        third party itself that provides synthetic exposure to a referenced
        security, but it is not an obligation of the issuer of the referenced
        security and confers no rights or benefits from the issuer of the
        referenced security.&rdquo; A token that tracks a DAT company&apos;s share
        price is not the same instrument as a token that is that company&apos;s
        share.
      </p>

      <h2>Category 3: the protocol-native DAT</h2>
      <p>
        A protocol-native DAT is a smart contract that holds a treasury. There is
        no company behind the token, no share class, no filings, no board and no
        dilution. The treasury is the contract itself, and its holdings are
        readable on-chain at any block by anyone, without waiting for a quarter to
        close.
      </p>
      <p>
        What you hold is a token issued by that contract. It is not a claim on a
        legal entity, nobody is obliged to redeem it for anything, and no
        counterparty owes you a distribution. Where a category-1 DAT raises money
        by selling shares and a category-2 token carries the rights of a share, a
        category-3 DAT typically funds its treasury out of its own trading
        activity. <code>$LDAT</code> is in this category. See{" "}
        <a href="/docs/dat-types">DAT Types</a> for how the funding rules differ
        between individual DATs.
      </p>
      <p>
        One qualification on &ldquo;no company.&rdquo; The &ldquo;no shares&rdquo;
        half is exact and structural. The &ldquo;no company&rdquo; half is weaker:
        every live implementation checked for this page still has an owner key
        that has not been renounced - wBTCStrategy, PunkStrategy and Aerostrategy,
        all named below, along with <code>$LDAT</code> itself - and a development
        team behind it. The defensible statement is that there are no shares, no
        share issuance and no dilution, and that the treasury is the contract. It
        is not that nobody holds a key.
      </p>

      <h2>Synthetic price exposure: a fourth shape</h2>
      <p>
        Synthetic price exposure to a company&apos;s stock is a fourth shape that
        the three categories above do not cover, and the most prominent product
        described as an &ldquo;onchain DAT&rdquo; belongs to it rather than to any
        of the three.
      </p>
      <p>
        On 2025-07-24 Injective published a post titled{" "}
        <a
          href="https://injective.com/blog/injective-pioneers-the-first-onchain-digital-asset-treasury-with-sbet"
          target="_blank"
          rel="noopener noreferrer"
        >
          &ldquo;Injective Pioneers the First Onchain Digital Asset Treasury with
          SBET&rdquo;
        </a>
        , stating: &ldquo;Today, Injective is releasing onchain SBET, marking the
        first onchain digital asset treasury (DAT).&rdquo; The reference asset is
        SharpLink Gaming&apos;s Nasdaq-listed common stock, ticker SBET, which is
        the equity of an ETH treasury company rather than ETH itself. The product
        is built on Injective&apos;s iAssets framework.
      </p>
      <p>
        On mechanism, the most reliable source is{" "}
        <a
          href="https://docs.injective.network/defi/trading/derivatives-iassets/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Injective&apos;s own documentation
        </a>
        , which describes iAssets as derivatives: they &ldquo;exist purely as
        synthetic derivatives, powered by Injective&apos;s on-chain perpetual
        futures engine,&rdquo; margin &ldquo;is posted in USDT (or other supported
        stablecoins),&rdquo; and &ldquo;Positions are USDT-settled, not physically
        delivered.&rdquo; On that description the instrument tracks a price rather
        than holding a treasury or carrying a share&apos;s rights, which is why it
        sits outside the three categories rather than inside category 2.
      </p>
      <p>
        Two events are routinely conflated and should not be. Injective&apos;s
        SBET (2025-07-24) is a separate thing from SharpLink&apos;s own
        announcement (2025-09-25) that it would tokenize its registered stock via
        Superstate. Injective is not a party to the second, and the second is the
        category-2 example above.
      </p>
      <p>
        Injective has publicly used &ldquo;first onchain digital asset treasury
        (DAT)&rdquo; for a product whose referent is corporate equity. That claim
        is different from anything on this page, it was made first, and this page
        neither contests it nor reuses the word &ldquo;first.&rdquo;
      </p>

      <h2>Why the term is contested</h2>
      <p>
        The business model is about five years older than the label. On 2020-08-11
        MicroStrategy filed an 8-K whose{" "}
        <a
          href="https://www.sec.gov/Archives/edgar/data/1050446/000119312520215604/d921849dex991.htm"
          target="_blank"
          rel="noopener noreferrer"
        >
          press-release exhibit was headlined &ldquo;MicroStrategy Adopts Bitcoin
          as Primary Treasury Reserve Asset&rdquo;
        </a>
        , disclosing the purchase of 21,454 bitcoins for an aggregate $250
        million. Outlets generally treat that filing as the founding event of the
        category, and it never uses the words &ldquo;digital asset treasury,&rdquo;
        &ldquo;DAT&rdquo; or &ldquo;DATCO&rdquo; anywhere. It says &ldquo;treasury
        reserve strategy.&rdquo; The label was applied later, by the market.
      </p>
      <p>
        A{" "}
        <a
          href="https://www.sec.gov/edgar/search/"
          target="_blank"
          rel="noopener noreferrer"
        >
          full-text search of SEC EDGAR
        </a>{" "}
        for the exact phrase &ldquo;digital asset treasury,&rdquo; run on
        2026-07-16, returns 0 matching filings for 2020, 22 for 2021, 11 for 2022,
        2 for 2023, 4 for 2024, 1,202 for 2025 and 973 for 2026 through
        2026-07-16. Within 2025 the monthly curve steps up across July to
        September. The pre-2025 hits were not inspected for whether they carry the
        modern sense of the phrase.{" "}
        <a
          href="https://www.cornerstone.com/insights/articles/the-emergence-of-the-digital-asset-treasury/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cornerstone Research
        </a>{" "}
        reaches the same conclusion independently: &ldquo;As evidenced by the
        mention of &lsquo;Digital Asset Treasury&rsquo; in 8-K filings, the rise of
        DATs began to accelerate notably in mid-2025.&rdquo; So the model dates to
        2020 and the vocabulary to mid-2025.
      </p>
      <p>
        Vocabulary that young has not settled. No published source identifies who
        coined &ldquo;DAT&rdquo; or &ldquo;DATCO&rdquo; - outlets generally credit
        Michael Saylor with the model and nobody with the acronym. An unowned
        acronym attached to a fast-moving subject is the condition under which
        three groups start using one word for three things.
      </p>

      <h2>Does mNAV apply to a protocol-native DAT?</h2>
      <p>
        mNAV compares a DAT company&apos;s market valuation to the value of the
        crypto it holds: above 1.0 is a premium, below 1.0 is a discount. It is a
        category-1 metric, and it is not as settled as it looks.
      </p>
      <p>
        There is more than one formula.{" "}
        <a
          href="https://docs.llama.fi/analysts/dat-methodology"
          target="_blank"
          rel="noopener noreferrer"
        >
          DefiLlama&apos;s published methodology
        </a>{" "}
        is{" "}
        <code>mNAV_B = (FD shares_B x Share price) / Crypto Treasury Value</code>,
        computed across three dilution buckets it calls Realized, Realistic and
        Maximum, and it excludes cash, bonds, equities and other non-crypto assets
        from the denominator.{" "}
        <a
          href="https://www.coindesk.com/business/2025/11/30/what-mnav-really-tells-you-about-bitcoin-treasury-companies-and-where-it-falls-short"
          target="_blank"
          rel="noopener noreferrer"
        >
          CoinDesk
        </a>{" "}
        describes the more common version as comparing enterprise value, meaning
        market cap plus debt minus cash, to the market value of the holdings. The
        numerators therefore differ: DefiLlama prices equity alone, the common
        version prices equity plus debt minus cash. Since enterprise value and
        market cap diverge whenever a company carries debt or cash, the two
        formulas will not return the same number for the same company on the same
        day, so mNAV figures are not portable between sources without checking
        which formula produced them. The metric is also contested on the merits:
        Greg Cipolaro, global head of research at NYDIG, called it &ldquo;woefully
        deficient&rdquo; in CoinDesk on 2025-11-30, on grounds that include its
        assuming convertible notes convert to equity and its ignoring the value of
        the operating business.
      </p>
      <p>
        For a category-3 DAT the ratio is still computable - market capitalisation
        over treasury value is the direct analogue - but the dilution machinery is
        not. DefiLlama&apos;s Realized, Realistic and Maximum buckets exist
        because share counts change, and a token with no shares has nothing to
        dilute. No mNAV is published for <code>$LDAT</code> on this site, and an
        mNAV quoted for any protocol-native token is worth little unless the
        source states which formula it used.
      </p>

      <h2>What the market already calls category 3</h2>
      <p>
        &ldquo;Protocol-native DAT&rdquo; is the phrase this site uses for the
        shape. The shape itself is not new and is not nameless: it is commonly
        called a &ldquo;strategy token.&rdquo; The lineage runs through{" "}
        <a href="https://www.token.works/" target="_blank" rel="noopener noreferrer">
          TokenWorks
        </a>
        &apos; family of contracts, which tax their own trading, buy a reserve
        asset, relist it at a markup, and use the proceeds to buy back and burn
        their own token. Live examples, read on-chain on 2026-07-16:
      </p>
      <ul>
        <li>
          <strong>PunkStrategy</strong> (<code>PNKSTR</code>,{" "}
          <a
            href="https://etherscan.io/token/0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf</code>
          </a>{" "}
          on Ethereum), reserve asset CryptoPunks.{" "}
          <a
            href="https://www.bankless.com/read/beginners-guide-punkstrategy-pnkstr"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bankless dates its launch to September 2025
          </a>
          , which would put it roughly nine months ahead of <code>$LDAT</code>.
        </li>
        <li>
          <strong>wBTCStrategy</strong> (<code>WBTCSTR</code>,{" "}
          <a
            href="https://etherscan.io/token/0x7af2a142c3486a9726791098e6415b768513e363"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>0x7af2a142c3486a9726791098e6415b768513e363</code>
          </a>{" "}
          on Ethereum), reserve asset wBTC, <code>VERSION()</code> returning 3.
          This is the direct prototype for <code>$LDAT</code>, which is an
          MIT-licensed fork of it with attribution.
        </li>
        <li>
          <strong>Aerostrategy</strong> (<code>AEROSTRAT</code>,{" "}
          <a
            href="https://basescan.org/token/0x1a85b97f8b0e1cee4d5500e093f5970a2aeb3fb8"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>0x1a85b97f8b0e1cee4d5500e093f5970a2aeb3fb8</code>
          </a>{" "}
          on Base), which taxes its trades into a treasury that acquires veAERO
          positions.
        </li>
      </ul>
      <p>
        On scale:{" "}
        <a
          href="https://thedefiant.io/news/nfts-and-web3/nftstrategy-ecosystem-surpasses-usd200-million-market-cap"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Defiant reported
        </a>{" "}
        that the NFTStrategy ecosystem passed $202 million in combined market
        capitalisation at its peak. Three of those tokens - PunkStrategy,
        PudgyStrategy and ApeStrategy - together sit near $9.8 million measured on
        GeckoTerminal on 2026-07-16, more than an order of magnitude below that
        peak, with 24-hour volumes in the low tens of thousands of dollars or
        less. This is a small, experimental and currently contracted corner of
        DeFi.
      </p>

      <h2>Which category is on-chainDAT, and what it cannot answer for you</h2>
      <p>
        <strong>on-chainDAT is category 3, and only category 3.</strong> There is
        no on-chainDAT company to buy shares in, no share register, no filing, no
        tokenized equity and no claim on any legal entity. The project is operated
        by PaTRoN Labs, described in our <a href="/terms">Terms of Service</a> as
        &ldquo;an unincorporated team of independent open-source
        contributors.&rdquo; It is not affiliated with Linea, ConsenSys, Base,
        Coinbase, Uniswap or TokenWorks.
      </p>
      <p>
        If you arrived here asking how to buy shares in a bitcoin treasury
        company, what a company&apos;s mNAV is, how a DAT&apos;s convertible notes
        are structured, or how tokenized stock settles, those are categories 1 and
        2, and the sources linked above address them directly.
      </p>

      <h2>What $LDAT actually is</h2>
      <p>
        A DAT here launches on top of an existing token: if a token{" "}
        <code>$XXX</code> exists, a <code>$XXXDAT</code> can launch on top of it.{" "}
        <code>$LDAT</code> launched on 2026-06-09 on Linea L2 (chain 59144) at{" "}
        <a
          href="https://lineascan.build/token/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5"
          target="_blank"
          rel="noopener noreferrer"
        >
          <code>0x02F289E429655d0C0D713A7dFD26850A81f7cFC5</code>
        </a>
        , on top of <code>$LINEA</code>. The contracts are open source and
        verified on Lineascan. What the current code does:
      </p>
      <ul>
        <li>
          <strong>The fee.</strong> Every trade pays <strong>10%</strong>,
          collected inside the pool&apos;s own Uniswap v4 hook. There is no
          exemption path from the swap fee. The hook splits each fee 80/20: 80%
          into the treasury, 20% to project-controlled fee destinations, which
          today makes the split 8% treasury and 2% project. Those destinations are
          owner-settable, not fixed in code. During the first 89 minutes after
          trading opened on 2026-06-09, the buy fee started at 99% and decayed to
          10% at 100 basis points a minute; see <a href="/docs/faq">FAQ</a>.
        </li>
        <li>
          <strong>The loop.</strong> Fees arrive as ETH, because the pool pairs{" "}
          <code>$LDAT</code> against ETH. The treasury spends that ETH buying{" "}
          <strong>150,000-LINEA bags</strong> from anyone willing to sell one, and
          relists each bag for 1.2x the ETH it paid. When a bag sells, the ETH
          proceeds fund a buyback that burns <code>$LDAT</code>. That call is
          permissionless and pays the caller 0.5%.
        </li>
        <li>
          <strong>Supply.</strong> <code>MAX_SUPPLY</code> is{" "}
          <strong>1,000,000,000</strong>, minted once at initialisation, and the
          current code has no further mint path. The entire supply was seeded into
          the Uniswap v4 pool at launch and the LP position was burned, so nobody
          can withdraw the liquidity. See <a href="/docs/tokenomics">Tokenomics</a>
          .
        </li>
        <li>
          <strong>Transfers.</strong> Tokens are{" "}
          <strong>non-transferable</strong> by ordinary ERC-20 transfer:{" "}
          <code>BaseStrategy.sol</code> reverts with <code>InvalidTransfer()</code>
          . The contract keeps an owner-controlled whitelist (
          <code>isDistributor</code>) of addresses exempt from that gate.
          Wallet-to-wallet moves go through a whitelisted relay that burns a 1%
          fee, live since 2026-06-21. See <a href="/docs/ldat">LDAT</a>.
        </li>
      </ul>

      <h2>What is materially risky about this implementation</h2>
      <p>As of 2026-07-16:</p>
      <ul>
        <li>
          <strong>The contracts are upgradeable.</strong> The logic described on
          this page can be replaced, which means the supply and transfer rules
          above are properties of the current code rather than guarantees. The
          intention is to revoke upgradeability once post-launch testing
          completes, but no date has been committed to.
        </li>
        <li>
          <strong>
            The owner can change some headline numbers without an upgrade.
          </strong>{" "}
          <code>updateBagSize</code> is owner-only and its sole constraint is that
          the new size is greater than zero, so the 150,000-LINEA bag is a current
          value rather than a constant. The buy-and-burn drip rate is owner-settable
          too (<code>setTwapIncrement</code>, <code>setTwapDelayInBlocks</code>).
          Changing either needs no redeploy and no delay. The 1.2x relist multiplier
          is <em>not</em> in this group: <code>setPriceMultiplier</code> is gated to
          the factory, and the deployed factory exposes no path that reaches it, so
          the multiplier moves only if the implementation is upgraded.
        </li>
        <li>
          <strong>
            On bag size, <code>$LDAT</code> is more owner-mutable than the
            contract it forks.
          </strong>{" "}
          TokenWorks&apos; v3 freezes <code>bagSize</code> permanently after the
          first purchase. <code>$LDAT</code> deliberately diverges and keeps it
          settable, because <code>$LINEA</code> is volatile and a frozen bag size
          drifts too thick or too thin.
        </li>
        <li>
          <strong>Ownership is a 2-of-3 Safe multisig.</strong> Two keyholders can
          act. Nothing has been renounced. Every peer implementation checked for
          this page is in the same position, which is a fact about the category
          rather than a defence of this one.
        </li>
        <li>
          <strong>The 2% project share is not held at arm&apos;s length.</strong>{" "}
          It is paid to a fee address that is also one of the three signers on the
          owning Safe.
        </li>
        <li>
          <strong>There is no third-party audit.</strong> The contracts are open
          source and verified on Lineascan and the treasury is readable on-chain,
          but no external auditor has reviewed any of it.
        </li>
        <li>
          <strong>
            This project is not first at anything and does not claim to be.
          </strong>{" "}
          <code>$LDAT</code> is a fork of TokenWorks&apos; wBTCStrategy v3, and
          Bankless dates that lineage&apos;s PunkStrategy to September 2025.
          Injective used &ldquo;first onchain digital asset treasury (DAT)&rdquo;
          publicly in July 2025. This is one experimental implementation among
          several.
        </li>
        <li>
          <strong>This is not an investment product.</strong> Our{" "}
          <a href="/terms">Terms of Service</a> state that the Services are
          &ldquo;experimental prototypes provided solely for educational,
          artistic, and informational purposes,&rdquo; that PaTRoN Labs
          &ldquo;makes no representations that the Services will operate in any
          particular manner or produce any economic return,&rdquo; and that they
          &ldquo;are not deployed for profit generation, investment solicitation,
          or speculative trading.&rdquo;
        </li>
      </ul>

      <h2>The short version</h2>
      <p>
        A DAT company is a listed business that holds crypto and sells you shares.
        Tokenized DAT equity is that company&apos;s stock, issued on-chain, with
        the rights intact. A protocol-native DAT is a smart contract with a
        treasury, no shares and no obligor. Synthetic price exposure to a DAT
        company&apos;s stock is a fourth thing again. All of them get called DATs;
        only the third describes <code>$LDAT</code>.
      </p>
    </>
  );
}
