import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms of Service - LDAT",
  description:
    "Terms of Service for the LDAT / on-chainDAT website and smart contracts operated by PaTRoN Labs.",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)] max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Last Updated: May 6, 2026</p>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 sm:p-5 mb-10 text-sm text-foreground leading-relaxed">
          <p>
            <span className="font-semibold">on-chaindat.com and the LDAT token are an independent,
            community-driven project.</span> They are <span className="font-semibold">not affiliated with,
            endorsed by, or sponsored by</span> Linea, ConsenSys, Base, Coinbase, Uniswap, TokenWorks, or
            any other company, foundation, or organization. All third-party brand, network, and project
            names appearing on this Site are used nominatively for descriptive purposes only and remain the
            property of their respective owners.
          </p>
        </div>

        <div className="prose-style space-y-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
          <p>
            PaTRoN Labs (an unincorporated team of independent open-source contributors -{" "}
            <span className="text-foreground">&quot;PaTRoN Labs,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;</span>) operates the{" "}
            on-chainDAT / LDAT websites and related subdomains (including{" "}
            <a href="https://www.on-chaindat.com" className="text-primary underline hover:no-underline break-all">https://www.on-chaindat.com</a>),
            the Smart Contracts directly accessible through the Site, and other products or services that we make
            available through the Site or applications (collectively, the <span className="text-foreground">&quot;Services&quot;</span>).
          </p>

          <p>
            PaTRoN Labs is a technology contributor and smart-contract experimenter building open-source,
            non-custodial, and experimental tools for on-chain markets and decentralized DATs. As used in
            these Terms, <span className="text-foreground">&quot;DAT&quot;</span> stands for{" "}
            <span className="text-foreground">digital asset treasury</span> (plural:{" "}
            <span className="text-foreground">&quot;DATs&quot;</span> - digital asset treasuries) and means
            autonomous, on-chain mechanisms, protocols, or smart-contract architectures designed by PaTRoN
            Labs (or forked from upstream projects such as TokenWorks ERC20Strategy v3 under the MIT license)
            and deployed by unaffiliated third-party users through the Services that enable, execute, or
            encode defined sets of blockchain interactions, rules, or conditions for the management of
            digital assets. All references in these Terms to &quot;DAT&quot; or &quot;DATs&quot; carry this
            defined meaning.
          </p>

          <p className="text-foreground font-semibold uppercase tracking-wide text-xs sm:text-sm">
            Please read these Terms carefully as they constitute a binding legal agreement between you and PaTRoN Labs.
            Aspects of these Terms limit certain rights, including the right to maintain a court action, the right to a
            jury trial, the right to participate in any form of class or representative claim, the right to engage in
            discovery except as provided in AAA (American Arbitration Association) rules, and the right to certain
            remedies and forms of relief.
          </p>

          <Section number="1" title="This is a binding agreement between you and PaTRoN Labs">
            <p>
              These Terms of Service (<span className="text-foreground">&quot;Terms&quot;</span> or{" "}
              <span className="text-foreground">&quot;Agreement&quot;</span>) are entered into between you and PaTRoN Labs.
              These Terms govern your access to and use of the Site, interaction with our Smart Contracts either through
              the Site or directly through the relevant Smart Contract network, and any other software, websites,
              applications, APIs, web tools, third-party tools, experiences, features, or functionalities provided on or
              in connection with the Site and all successor sites thereto (collectively, the &quot;Services&quot;).
            </p>
            <p>
              Without limitation, these Terms govern your voluntary use of our Site or Services - whether past, present
              or future - for any purpose, including to view, connect, or interact with our Smart Contracts, deploy or
              interact with any &quot;DAT,&quot; or to otherwise initiate any blockchain transactions using your
              digital wallet through the Site. By continuing to use the Services, connecting a wallet, or initiating any
              transaction, you ratify and reaffirm that all prior activity conducted through the Services is and has
              been subject to these Terms as if they had been in effect at the time such activity occurred.
            </p>
            <p>
              For the purposes of these Terms, &quot;you&quot; includes both you, the individual person or entity, and
              any digital wallet that you act on behalf of or use to access the Services.
            </p>
            <p>
              You acknowledge and agree that your access to and use of the Services is further governed by, and subject
              to, the technical specifications, operational descriptions, and explanatory materials provided at{" "}
              <a
                href="https://github.com/patronny/on-chainDAT/tree/main/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline break-all"
              >
                github.com/patronny/on-chainDAT/tree/main/docs
              </a>{" "}
              (the &quot;Documentation&quot;). The Documentation is incorporated by reference into these Terms. To the
              extent any description in the Documentation conflicts with these Terms, the publicly deployed Smart-Contract
              code shall control, followed by these Terms. You are solely responsible for reviewing the Documentation
              prior to deploying or interacting with any DAT or Smart Contract and represent that you understand the
              functionality, parameters, and operational limitations described therein.
            </p>
            <p className="text-foreground font-semibold uppercase tracking-wide text-xs">
              You acknowledge and reaffirm your agreement to these Terms each time you access the Site, use the
              Services, connect your digital wallet through the Site, initiate transactions from your digital wallet
              through the Site, or otherwise perform any action on or through our Site or Smart Contracts. If you do not
              agree to these Terms, you must immediately and permanently discontinue your access and use of the Services.
            </p>
          </Section>

          <Section number="2" title="You are responsible for your own wallet">
            <p>
              Your digital wallet address functions as your identity for purposes of the Services. You are solely
              responsible for maintaining the security of your wallet, private keys, seed phrases, and any associated
              credentials. PaTRoN Labs does not and cannot access your wallet, recover lost keys, or reverse any
              transaction initiated from your address. All actions taken using your wallet, whether authorized by you or
              not, shall be deemed to be taken by you. You agree to promptly discontinue use of the Services and secure
              your wallet if you suspect any compromise, and you acknowledge that PaTRoN Labs has no responsibility or
              liability for any unauthorized access to or use of your wallet.
            </p>
          </Section>

          <Section number="3" title="Modifications">
            <p>
              PaTRoN Labs reserves the right to change or modify these Terms or any aspect of the Services at any time
              in our sole discretion. If we make material changes, we will use reasonable efforts to provide notice of
              such changes, such as by updating the &quot;Last Updated&quot; date at the beginning of these Terms.
              PaTRoN Labs is moving toward a purely deterministic, immutable Smart Contract deployment structure.
              PaTRoN Labs reserves the right to modify its Smart Contract code or certain Smart Contract parameters or
              functionalities for the sole purpose of improving the Smart Contract functionality or user experience, in
              its sole discretion. Any future upgrades or parameter changes to PaTRoN Labs-deployed Smart Contracts shall
              be disclosed through on-chain publication of the code, which will be made available through the Site or
              official PaTRoN Labs communication channels. PaTRoN Labs shall have no obligation to maintain any prior
              contract versions once upgraded.
            </p>
            <p>
              By continuing to access or use the Services, you confirm your acceptance of the revised Terms effective as
              of the date they are updated. It is your sole responsibility to review these Terms periodically to ensure
              you understand the terms and conditions that apply when you access or use the Services.
            </p>
            <p>
              To the extent any aspect of our Smart Contracts conflicts with these Terms, the publicly deployed
              Smart-Contract code shall control. Before invoking any Smart Contract function or performing any
              blockchain transaction, you will have the ability to review such transaction through your digital wallet
              provider (e.g., MetaMask). You represent and warrant that you have reviewed, understand, and consent to the
              operation of all Smart Contracts that you interact with through the Site.
            </p>
            <p>
              In the event of a blockchain fork, upgrade, or migration, PaTRoN Labs may determine, in its sole
              discretion, whether and how to support any resulting network or token. PaTRoN Labs bears no responsibility
              for any loss, incompatibility, or duplication of assets arising from such events.
            </p>
          </Section>

          <Section number="4" title="Legal capacity to use the Services">
            <p>
              You expressly represent and warrant that you have the right, authority, and capacity to enter into this
              Agreement on behalf of yourself and any third-party individual, entity, or digital wallet for which you are
              acting. You must be over the age of majority in your jurisdiction and at least thirteen (13) years old.
              Users under eighteen (18) may only use the Services through a parent or guardian who separately agrees to
              these Terms.
            </p>
            <p>
              If you use our Services on behalf of another person, a company, partnership, protocol, smart contract, DAO,
              project, or other entity, &quot;you&quot; includes both you and that entity, and you represent that (i) you
              are authorized to bind the entity to these Terms, (ii) you are authorized to initiate blockchain
              transactions on its behalf, and (iii) you agree to these Terms on the entity&apos;s behalf.
            </p>
          </Section>

          <Section number="5" title="Your legal responsibilities">
            <p>
              You are solely responsible for determining, understanding, and discharging any legal obligations applicable
              to your use of the Services, including compliance with tax, securities, sanctions, and anti-money-laundering
              laws. PaTRoN Labs is not responsible for determining, withholding, or remitting any taxes or fees associated
              with your use of the Services or any blockchain transaction. You agree not to use our Smart Contracts in
              any manner that violates applicable law. Nothing in these Terms, or any statements from PaTRoN Labs,
              including statements made through the official PaTRoN Labs X (formerly Twitter) account
              (<a href="https://x.com/PaTRoN4egLabs" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">@PaTRoN4egLabs</a>),
              should be construed as legal, tax, or investment advice.
            </p>
          </Section>

          <Section number="6" title="Data privacy">
            <p>
              All blockchain interactions are publicly viewable on their respective networks. By using the Services, you
              understand that your wallet address and transaction data may be publicly accessible and permanently
              recorded on the blockchain. PaTRoN Labs does not control and cannot delete or obscure such information.
            </p>
          </Section>

          <Section number="7" title="The Services rely on experimental technologies">
            <p>
              The Services interact with public blockchains, including but not limited to Ethereum, Ethereum Layer-2 (L2)
              networks, and other networks, protocols, and smart contracts not designed by or controlled by PaTRoN Labs
              (e.g., Linea, Base). These networks may involve the operation of self-executing smart contracts that are
              deterministic, irreversible, and under the control of third parties. PaTRoN Labs provides tools to enable
              voluntary interaction with these technologies through compatible digital wallets. Your use of these
              technologies involves significant risks - including hacks, smart-contract vulnerabilities, malicious actors
              deploying or interacting with DATs, Sybil attacks, exploits, bugs, and regulatory uncertainty - for
              which PaTRoN Labs has no control and bears no responsibility. PaTRoN Labs does not and cannot guarantee
              uninterrupted access, error-free operation, functionality, or compatibility of any smart contracts, assets,
              or protocol to which any of our Smart Contracts interact, invoke, or otherwise functionally depend upon,
              nor does it guarantee that other users of the Smart Contracts will not engage in malicious or deceptive
              behavior. You acknowledge that all blockchain transactions are final and irreversible, that transaction
              fees (&quot;Gas Fees&quot;) are set by network demand, and that PaTRoN Labs has no control over Gas Fees.
              PaTRoN Labs does not and cannot verify or confirm the authenticity, source, or success of any blockchain
              transaction initiated through the Services. You are solely responsible for ensuring that all transaction
              data, wallet addresses, and smart contract interactions are accurate. PaTRoN Labs disclaims all liability
              for failed, stuck, or front-run transactions, including those affected by network congestion, maximal
              extractable value (MEV), malicious third parties, or third-party RPC node errors. The Services are
              experimental prototypes provided solely for educational, artistic, and informational purposes. PaTRoN Labs
              makes no representations that the Services will operate in any particular manner or produce any economic
              return. You acknowledge that the Services are not deployed for profit generation, investment solicitation,
              or speculative trading.
            </p>
          </Section>

          <Section number="8" title="The PaTRoN Labs Smart Contracts are non-custodial">
            <p>
              PaTRoN Labs&apos; Smart Contracts are non-custodial and autonomous. Once deployed, we no longer take
              control or manage any deployed Smart Contract. You retain full custody and control of your digital wallet
              and deployed smart contracts. PaTRoN Labs never takes possession of or controls any user assets or private
              keys. PaTRoN Labs never has custody or possession of any of your assets or any digital assets held within
              any DAT protocol. PaTRoN Labs will never ask for or require knowledge of your private keys. PaTRoN
              Labs does not act as an intermediary, broker, money-services business, or fiduciary.
            </p>
            <p>
              The Services merely enable interactions with on-chain protocols. PaTRoN Labs does not intermediate trades,
              store funds, or manage DAT parameters. PaTRoN Labs does not execute, match, route, clear, or settle
              any trades, swaps, or orders; all such transactions occur directly on the applicable blockchain or
              third-party protocol between you and other participants. The parameters of any given DAT are
              controlled by, or at the direction of, the person or entity that caused the deployment of the given
              DAT. You understand and agree that all transactions initiated through your wallet are voluntary
              transactions executed directly by you on-chain and are completely outside PaTRoN Labs&apos; control once
              submitted. All transactions are final and irreversible. PaTRoN Labs disclaims any responsibility for the
              outcome of any transaction performed by you using the Services. PaTRoN Labs is not, and the Services are
              not operated as, a securities or commodities exchange, alternative trading system, broker-dealer, swap
              execution facility, clearing agency, or money transmitter, and nothing in the Services constitutes order
              routing, trade execution, clearing, settlement, or brokerage activity.
            </p>
            <p>
              PaTRoN Labs may facilitate access to third-party Smart Contracts or services through the Site. PaTRoN Labs
              assumes no duty to facilitate access to, maintain, or otherwise make available for you to use any
              particular functions or aspects of the Smart Contracts. You understand and agree that you are able to make
              full technical use of our Smart Contracts, and your deployed Smart Contracts, without using the Site and
              that you do not need to rely upon the Site or Services to make use of our Smart Contracts, any DAT,
              or any of your assets.
            </p>
          </Section>

          <Section number="9" title="No affiliation with underlying projects or technologies">
            <p>
              PaTRoN Labs is not affiliated with, endorsed by, or sponsored by Linea, ConsenSys, Base, Coinbase,
              TokenWorks, Uniswap, or any individual DAT deployer, NFT collection, creator, intellectual property,
              or marketplace that may use PaTRoN Labs Services or Smart Contracts in connection with a DAT. Any
              references by PaTRoN Labs to any third-party projects, networks, or recognizable intellectual property are
              for nominative and descriptive purposes only. PaTRoN Labs makes no representations or warranties regarding
              any third-party network, collection, or its smart contracts, and cannot ensure that third-party contracts
              will remain functional or compatible with the DATs.
            </p>
            <p>
              PaTRoN Labs does not review, monitor, validate, curate, or verify any names, tickers, symbols, metadata,
              images, collection references, artwork, branding, or other content selected, uploaded, or referenced by
              users in connection with any DAT, Smart Contract, token, or digital asset displayed on the Site. Any
              appearance of a third-party trademark, service mark, brand, or other indicia of source is solely the result
              of user action. PaTRoN Labs expressly disclaims all responsibility and liability for any alleged or actual
              infringement, dilution, misappropriation, or violation of third-party intellectual-property rights arising
              from user-generated or user-selected content, including token names, ticker symbols, metadata, images,
              branding elements, or third-party project references. You acknowledge and agree that PaTRoN Labs does not
              police or enforce third-party intellectual-property rights on your behalf and has no obligation to do so.
              PaTRoN Labs makes no representation regarding the legality or authorization of any content associated with
              any DAT.
            </p>
          </Section>

          <Section number="10" title="User consents to programmatic operations and fees">
            <p>
              By using the Services and interacting with any DAT or Smart Contract, you acknowledge, understand, and
              expressly consent to the automated, programmatic, and autonomous operation of the Smart Contracts and
              respective DATs. You authorize their execution and consent to all conceivable resulting outcomes,
              calculations, outputs, functionalities, or effects, including but not limited to fees, transfers, mints,
              burns, token issuances, redistributions, reallocations, or any other on-chain actions defined or enabled by
              the applicable Smart Contract, which may be initiated by other users in any manner permitted by the
              relevant Smart Contract.
            </p>
            <p>
              These operations may include, without limitation: (i) minting, issuing, burning, or purchasing tokens;
              (ii) selling, swapping, listing, buying, offering, burning, or transferring tokens; (iii) burning or
              otherwise permanently removing digital assets from circulation; (iv) redistributing, reassigning, or
              reallocating assets or tokens pursuant to the logic of the applicable Smart Contract; (v) interacting with
              decentralized exchanges or liquidity pools; (vi) triggering or settling any other on-chain transactions or
              protocol-defined outcomes; (vii) paying fees.
            </p>
            <p>
              You further acknowledge and agree that: (a) all Smart Contract operations are self-executing, irreversible,
              and final, and PaTRoN Labs has no ability to reverse, modify, or cancel any transaction once submitted to
              the blockchain; (b) DATs are open-source, permissionless systems that operate solely according to
              their code, and PaTRoN Labs cannot halt, alter, or intervene in their execution; (c) the Smart Contracts
              may calculate, deduct, or require payment of network transaction fees (&quot;Gas Fees&quot;) or other
              programmatic fees, which are determined by blockchain network conditions and are outside PaTRoN Labs&apos;
              control; (d) certain DATs or Smart Contracts may include embedded fee mechanisms, royalties,
              commissions, or other programmatic deductions automatically distributed to predefined addresses designated
              by third parties or wallets as encoded in the Smart Contract; (e) PaTRoN Labs does not control, receive, or
              direct any such fees unless expressly stated in the relevant Smart Contract code; and (f) all values,
              conversions, exchange rates, and market conditions affecting any digital asset are volatile, independent
              of PaTRoN Labs, and beyond its influence.
            </p>
            <p>
              By initiating any transaction, connecting a wallet, or interacting with any Smart Contract through the
              Services, you represent that you have reviewed and understood the Smart Contract functions, parameters,
              and fee logic, and that you voluntarily assume all risks associated with those operations - including
              potential loss of funds, errors in execution, or unintended results arising from automated code execution,
              market fluctuations, or user input.
            </p>
          </Section>

          <Section number="11" title="No partnership or affiliation">
            <p>
              All users of the Services - including but not limited to deployers of DATs, developers, holders or
              users of DAT tokens, and participants in any coordinated on-chain or off-chain activity - act
              independently and on their own behalf. Your access to or interaction with the Services, Smart Contracts,
              or any DAT does not create or imply any partnership, joint venture, agency, employment, fiduciary, or
              other relationship of trust, reliance, or association between you and PaTRoN Labs, or between you and any
              users of the Services. PaTRoN Labs provides non-custodial, autonomous tools that may enable or facilitate
              user interaction, coordination, or shared participation in DATs or other Smart Contracts. Such
              functionality is purely technological and does not give rise to any shared ownership, control, management,
              or liability between PaTRoN Labs and any user, or among users themselves, and does not create any
              obligations, duties, or responsibilities for PaTRoN Labs with respect to any community, group, promoter,
              proponent, or organizer that elects to use DAT tokens in connection with its activities.
            </p>
            <p>
              Users who deploy DATs or Smart Contracts through the Services do so solely in their individual
              capacity and assume full responsibility for the functionality, configuration, compliance, and consequences
              of those deployments and assume the risk of use of the Site and Smart Contracts. PaTRoN Labs does not
              endorse, supervise, audit, or guarantee any user-deployed DAT, Smart Contract, or token and bears no
              responsibility for their operation, outcomes, or effects, and makes no commitments, promises, or
              representations that any DAT, Smart Contract, or token will integrate with, support, interoperate
              with, or be compatible with any third-party token, smart contract, network, community coin, ecosystem
              token, or project now or in the future.
            </p>
            <p>
              Any governance, voting, or coordination features accessible or expressible through the Services are
              provided merely as neutral technical mechanisms. They do not confer decision-making authority, fiduciary
              obligations, or partnership status on PaTRoN Labs or any other participant. All actions taken through or in
              connection with the Services are voluntary, autonomous, and undertaken at the user&apos;s own risk, and no
              community organizer, promoter, leader, or participant shall be deemed to act on behalf of PaTRoN Labs or to
              possess any authority to bind or speak for PaTRoN Labs in any manner.
            </p>
          </Section>

          <Section number="12" title="Market and third-party independence">
            <p>
              The Services may facilitate access to decentralized exchanges, NFT marketplaces, or other protocols that
              operate independently of PaTRoN Labs. PaTRoN Labs does not control, endorse, or assume responsibility for
              the operation of such platforms. You are solely responsible for evaluating the legitimacy, safety, and
              functionality of any external services you use in connection with the Services or any DATs deployed
              using the Services.
            </p>
          </Section>

          <Section number="13" title="Insider information and marketing conduct">
            <p>
              You agree not to use or share non-public information about DAT deployments, token launches, or
              configuration details to trade, speculate, or otherwise seek profit. If you deploy, configure, or exercise
              control over a DAT, you acknowledge that your own intention to deploy, the timing of deployment, your
              decisions, and the parameters of deployment constitute non-public information until such information is
              visible on-chain, and you agree not to trade, purchase, sell, or otherwise position yourself or others in
              anticipation of, or prior to, public on-chain disclosure of that information. You further agree not to
              front-run, back-run, manipulate, or otherwise exploit any market, liquidity pool, or participant based on
              such information. You further agree not to market or promote any DAT or token as an investment,
              profit opportunity, or security. All marketing and communications are your sole responsibility, and PaTRoN
              Labs disclaims all liability for user or third-party statements.
            </p>
          </Section>

          <Section number="14" title="Non-reliance">
            <p>
              You represent that you are knowledgeable and experienced in blockchain technology and digital assets. You
              have conducted your own independent investigation of the Services and Smart Contracts and have not relied
              upon any statement, omission, or representation by PaTRoN Labs other than those expressly set forth in
              these Terms. You understand that DATs are experimental protocols and may fail, perform unpredictably,
              or be exploited. You assume all associated risks.
            </p>
          </Section>

          <Section number="15" title="Accessing and using the Services">
            <p>
              Access to the Services requires a compatible digital wallet. By connecting a wallet, you represent that you
              are its lawful owner and that you are solely responsible for safeguarding your private keys and seed
              phrase. PaTRoN Labs has no control over and cannot assist with lost keys, compromised wallets, or
              unauthorized access. Your wallet and all assets therein are your exclusive responsibility.
            </p>
          </Section>

          <Section number="16" title="The Services are PaTRoN Labs' property">
            <p>
              You acknowledge and agree that PaTRoN Labs owns all legal rights, title, and interest in and to the Site,
              documentation, the proprietary components of the Services, and all trademark interests in the names
              on-chainDAT, LDAT, and the ticker $LDAT. PaTRoN Labs retains intellectual-property rights in the
              Site, Services, Smart Contract, source code, designs, and trademarks, subject to any applicable open-source
              licenses (including the upstream MIT-licensed TokenWorks ERC20Strategy v3 from which the LDAT
              contracts are forked). Your use of the Services does not grant you any ownership or license rights except
              as expressly stated herein. Certain components of the Services may be released under open-source licenses.
              To the extent you submit code, comments, ideas, or other contributions to PaTRoN Labs, whether through
              public statements or a repository or open-source project, you grant PaTRoN Labs and the public a perpetual,
              irrevocable, worldwide, non-exclusive, royalty-free license to use, modify, and distribute such
              contributions. You agree not to assert any intellectual-property claim against PaTRoN Labs or other users
              arising from their lawful use of such open-source materials.
            </p>
          </Section>

          <Section number="17" title="PaTRoN Labs controls the Site">
            <p>
              PaTRoN Labs may modify, upgrade, suspend, discontinue, delist, or restrict any aspect of the Services,
              including the Site, user interface, APIs, analytics, rankings, discovery features, or any DAT, at any
              time and for any reason, without notice or liability. PaTRoN Labs has no obligation to maintain, support,
              or continue to offer any particular feature, view, endpoint, or integration, and any such change shall not
              affect the on-chain operation of any Smart Contract.
            </p>
            <p>
              You acknowledge that PaTRoN Labs does not verify or curate User Content. You bear sole responsibility for
              obtaining all necessary rights to any User Content referenced by or embedded in any DAT, token, or
              Smart Contract visible or accessible through the Site. You further acknowledge and agree that you assume
              all risk associated with interacting with, purchasing, acquiring, or relying upon any DAT, token, or
              Smart Contract that may contain, reference, display, or be associated with infringing, unauthorized, or
              improperly licensed intellectual property, and that PaTRoN Labs has no obligation to screen, review,
              investigate, or police such material.
            </p>
          </Section>

          <Section number="18" title="License to use the Services">
            <p>
              PaTRoN Labs grants you a limited, non-exclusive, non-transferable, revocable, and non-sublicensable license
              to access and use the Services solely in accordance with these Terms. Your license is conditioned upon
              lawful use. PaTRoN Labs reserves the right to suspend or restrict access at any time for any reason,
              including suspected violation of these Terms or applicable law.
            </p>
          </Section>

          <Section number="19" title="License to PaTRoN Labs">
            <p>
              By uploading, inputting, selecting, generating, configuring, or otherwise submitting any names, titles,
              labels, tickers, symbols, descriptions, metadata, images, artwork, graphics, icons, text, traits,
              audiovisual materials, branding elements, or any other content (<span className="text-foreground">&quot;User Content&quot;</span>)
              to or through the Services in connection with any DAT, Smart Contract, or information that you display
              on the Site, you hereby grant PaTRoN Labs a worldwide, non-exclusive, royalty-free, fully paid,
              transferable, sublicensable license to host, store, reproduce, display, perform, publish, distribute,
              transmit, modify (solely for formatting or technical display purposes), and otherwise use such User Content
              as necessary or useful to operate, provide, display, improve, promote, and document the Services, including
              the rendering of DAT pages, indexes, leaderboards, analytics, historical views, search results, and
              any other user-interface or technical functions. This license survives for as long as the User Content
              appears on or is needed to operate the Services and includes the right for PaTRoN Labs to make backup
              copies, cache content, and permit third-party infrastructure providers (including hosting, indexing,
              caching, analytics, and partners) to exercise these rights on PaTRoN Labs&apos; behalf.
            </p>
          </Section>

          <Section number="20" title="Takedown policy">
            <p>
              This Section governs requests to remove or disable access to User Content displayed on the Site. PaTRoN
              Labs may remove, disable, hide, or modify the display of User Content on the Site at any time. Such
              actions apply only to Site-hosted or Site-rendered content. Removal from the Site does not affect any
              DAT, transaction, Smart Contract, or state of the blockchain. PaTRoN Labs cannot modify, remove, halt,
              interfere with, or reverse any of your on-chain deployments.
            </p>
            <p>
              PaTRoN Labs complies with the Digital Millennium Copyright Act (&quot;DMCA&quot;). Copyright holders may
              submit a notice to{" "}
              <a href="mailto:legal@on-chaindat.com" className="text-primary underline hover:no-underline">
                legal@on-chaindat.com
              </a>{" "}
              that includes: identification of the copyrighted work claimed to be infringed; identification of the
              material claimed to be infringing and its location on the Site; contact information of the complaining
              party; a statement of good-faith belief that the use is unauthorized; a statement, under penalty of
              perjury, that the information is accurate and the complaining party is authorized to act; and a physical or
              electronic signature.
            </p>
            <p>
              Notices that do not satisfy 17 U.S.C. §512(c)(3) may be rejected. Users whose Site-hosted content is
              removed pursuant to a DMCA notice may send a counter-notification consistent with 17 U.S.C. §512(g).
              PaTRoN Labs may restore the material unless the copyright claimant initiates a court proceeding.
            </p>
            <p>
              PaTRoN Labs may, at any time and in its sole discretion, remove, disable, hide, or restrict the display of
              any User Content on the Site that PaTRoN Labs determines to be unlawful, abusive, harassing, defamatory,
              hateful, fraudulent, deceptive, violent, sexually explicit, pornographic, or otherwise inappropriate.
              These actions apply solely to Site-hosted or Site-rendered content and do not extend to any Smart Contract
              or DAT deployed on-chain, which PaTRoN Labs cannot modify, remove, or interfere with.
            </p>
          </Section>

          <Section number="21" title="Incident reporting">
            <p>
              PaTRoN Labs encourages the responsible disclosure of security vulnerabilities. If you believe you have
              discovered a potential vulnerability or security issue, please report it by contacting{" "}
              <a href="mailto:security@on-chaindat.com" className="text-primary underline hover:no-underline">
                security@on-chaindat.com
              </a>
              . Unless explicitly stated, PaTRoN Labs does not offer any form of bounty or compensation for such
              disclosures.
            </p>
          </Section>

          <Section number="22" title="You must obey the law">
            <p>
              You agree to use the Services only in compliance with all applicable laws, including those governing
              securities, commodities, money transmission, anti-money-laundering, and sanctions. You further agree not
              to: (i) use the Services for illegal, fraudulent, or unauthorized purposes; (ii) distribute malware or
              harmful code; (iii) misrepresent affiliation with PaTRoN Labs or any third-party project; (iv) interfere
              with network operations or engage in Sybil or denial-of-service attacks; (v) manipulate market activity;
              (vi) use the Services in any way that violates sanctions administered by the U.S. Department of
              Treasury&apos;s Office of Foreign Assets Control (&quot;OFAC&quot;) or any other applicable authority;
              (vii) use the Services for any harmful, deceitful, or unlawful purpose; or (viii) attempt to interact with
              the Site or Smart Contracts for the purpose of unjustly enriching yourself at the expense of others.
            </p>
            <p>
              In addition to all other obligations in these Terms, you agree that you will not, in connection with the
              Services or any DAT: (i) engage in fraud, deception, or misrepresentation; (ii) operate or participate
              in wash trading, spoofing, layering, pump-and-dump schemes, or any other form of market manipulation;
              (iii) deploy, promote, or facilitate DATs intended primarily to defraud, steal from, or otherwise
              harm other users; (iv) engage in phishing, spamming, or attempts to obtain private keys, seed phrases, or
              other sensitive credentials from any person; (v) upload or reference malware, malicious contracts, or code
              intended to interfere with the operation of any wallet, protocol, or network; or (vi) use the Services in
              any manner that attempts to circumvent, disable, or abuse any limits, filters, or controls implemented by
              PaTRoN Labs.
            </p>
          </Section>

          <Section number="23" title="Prohibited persons">
            <p>
              The Services may not be used in any jurisdiction where their use would be unlawful or require registration
              or licensing of PaTRoN Labs. PaTRoN Labs reserves the right to restrict access by IP geolocation or wallet
              address where legally required. You represent and warrant that you are not: (i) located in, ordinarily
              resident in, or organized under the laws of any jurisdiction subject to a comprehensive U.S. Government
              embargo (&quot;Embargoed Jurisdiction&quot;); (ii) identified on any U.S. or international sanctions list,
              including OFAC&apos;s Specially Designated Nationals list; or (iii) acting for or on behalf of any such
              prohibited person or entity. PaTRoN Labs may block or restrict your access to the Services if it believes
              you have violated any aspects of these Terms.
            </p>
          </Section>

          <Section number="24" title="Third-party services">
            <p>
              The Services may include links or functionality connecting to third-party websites, smart contracts, or
              applications (<span className="text-foreground">&quot;Third-Party Services&quot;</span>). PaTRoN Labs does
              not review, endorse, or control these Third-Party Services and is not responsible for their content or
              performance. You use all Third-Party Services at your own risk and are subject to their respective terms
              and conditions.
            </p>
          </Section>

          <Section number="25" title="User feedback">
            <p>
              You may provide comments, bug reports, or other feedback about the Services
              (<span className="text-foreground">&quot;Feedback&quot;</span>). You grant PaTRoN Labs a perpetual,
              irrevocable, non-exclusive, royalty-free, worldwide license to use and disclose your Feedback for any
              purpose without compensation.
            </p>
          </Section>

          <Section number="26" title="No investment or financial advice">
            <p>
              All information made available through the Services or by PaTRoN Labs is for informational purposes only.
              PaTRoN Labs does not provide investment, financial, tax, or legal advice. You acknowledge that no DAT
              token constitutes a security, investment contract, or financial instrument under applicable law, and that
              your participation in any DAT is at your sole risk. No token or digital item associated with the
              Services is offered or sold by PaTRoN Labs as an investment or security. The Services do not constitute an
              offer to sell or the solicitation of an offer to buy any financial instrument. Users are solely responsible
              for determining whether their use of any token complies with applicable laws in their jurisdiction. Any
              competitive, leaderboard, or reward functionality associated with the Services is intended solely for
              entertainment and experimentation. No feature or outcome within the Services should be interpreted as a
              financial reward, staking mechanism, investment return, or promise of profit. PaTRoN Labs does not
              guarantee that any tokens or digital items have or will ever have monetary value.
            </p>
            <p>
              You acknowledge and agree that the Site may display prices, charts, historical data, graphs, analytics,
              rankings, performance summaries, market information, or other financial or quasi-financial data. All such
              information is provided solely for informational and descriptive purposes, may be incomplete, inaccurate,
              delayed, incorrect, interrupted, or unavailable, and is furnished without any warranties of any kind,
              express or implied. PaTRoN Labs does not verify, audit, or confirm the accuracy, reliability, timeliness,
              or completeness of any displayed data and makes no representation that such information reflects real-time
              or actual market conditions. You agree that you will not rely on any such information to make financial,
              investment, trading, or transactional decisions, and that any use of such information is entirely at your
              own risk. PaTRoN Labs does not undertake any obligation to update, correct, or continue to display any
              such information, and no communication or silence by PaTRoN Labs regarding displayed data creates any duty
              to monitor markets or act for your benefit.
            </p>
          </Section>

          <Section number="27" title="Representations and warranties">
            <p>
              By deploying, configuring, or otherwise making available any DAT, Smart Contract, or on-chain
              mechanism through the Services, you represent and warrant to PaTRoN Labs that: (i) you have full right,
              title, authority, and capacity to create, deploy, configure, and make available such DAT; (ii) you are
              the lawful owner of, or are duly authorized by the lawful owner or controller of, each Smart Contract,
              DAT contract, or on-chain mechanism that you deploy, reference, or configure through the Services;
              (iii) if the DAT references, controls, includes, displays, encodes, or otherwise involves or interacts
              with any digital assets containing or referencing any artwork, image, text, sound recording, audiovisual
              work, metadata, name, likeness, logo, trademark, brand, or any other form of intellectual property
              (collectively, &quot;User Content&quot;), you have obtained all necessary rights, licenses, permissions,
              and consents from the applicable rights holders; (iv) you will not deploy any DAT that infringes,
              misappropriates, dilutes, or otherwise violates the intellectual-property, publicity, moral, or privacy
              rights of any third party; (v) any wallet address, smart contract, DAO, account, or other destination you
              designate within a DAT to receive royalties, revenue, proceeds, or other value belongs to the lawful
              recipient entitled to such payments or benefits.
            </p>
            <p>
              Each time you upload, input, reference, configure, select, deploy, or otherwise use the Services, you
              represent and warrant that all information, parameters, contract references, metadata, content, wallet
              designations, settings, and selections you provide or initiate: (i) are accurate, complete, honest, and
              made solely by you; (ii) do not violate any third-party rights, licenses, restrictions, agreements, laws,
              or obligations; (iii) are authorized by all persons or entities with any legal or equitable interest in
              the referenced Smart Contract, DAT, metadata, or related content; (iv) do not create any duty,
              obligation, liability, or expectation for PaTRoN Labs beyond those expressly stated in these Terms; and
              (v) are within your full right, authority, and capacity to make, both at the time of the action and on an
              ongoing basis.
            </p>
          </Section>

          <Section number="28" title="Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless PaTRoN Labs, its contributors, affiliates, and
              successors (collectively, the <span className="text-foreground">&quot;PaTRoN Labs Parties&quot;</span>)
              from and against any and all claims, damages, liabilities, losses, and expenses (including reasonable
              attorneys&apos; fees) arising out of or related to: (i) your use or misuse of the Services; (ii) your
              violation of these Terms or any applicable law; (iii) your violation, infringement, misappropriation, or
              dilution of any intellectual-property, proprietary, privacy, publicity, moral, or contractual right of any
              third party; (iv) any DAT, Smart Contract, or on-chain mechanism you deploy, configure, or authorize
              through the Services; (v) any designation of a wallet address, account, or recipient to receive royalties,
              revenues, proceeds, or other value from a DAT or Smart Contract; and (vi) any promotional, marketing,
              or public statements made by you relating to a DAT, Smart Contract, or the Services.
            </p>
            <p>
              PaTRoN Labs may, at its sole discretion, assume control of the defense of any matter for which you owe
              indemnification. You agree to cooperate fully with PaTRoN Labs in any such defense, including providing
              all information, records, and access reasonably requested.
            </p>
            <p>
              This indemnification, release, and cooperation obligation shall survive the termination of these Terms and
              your use of the Services.
            </p>
          </Section>

          <Section number="29" title="Disclaimers">
            <p>
              The Services, all DATs, and all digital assets available in connection with the Services are
              provided <span className="text-foreground">&quot;as is&quot;</span> and{" "}
              <span className="text-foreground">&quot;as available,&quot;</span> without warranties of any kind. To the
              maximum extent permitted by law, PaTRoN Labs disclaims all express or implied warranties, including
              merchantability, fitness for a particular purpose, title, and non-infringement. Ownership of any DAT
              token does not grant or imply any legal rights, economic rights, governance rights, claims, interests, or
              entitlements in or to any underlying asset, Smart Contract, DAT configuration, governance mechanism,
              treasury, pool, reserve, digital asset, or other property referenced by or incorporated within the
              DAT. DAT tokens are purely programmatic artifacts that operate according to their encoded logic
              and do not confer governance rights, ownership rights, revenue rights, economic rights, or any form of
              legal or equitable interest in PaTRoN Labs or in any third-party project. Any appearance of value,
              functionality, or interaction arising from a DAT token exists solely as a result of autonomous Smart
              Contract operations and does not create any expectation of rights, control, or benefit beyond those
              executed on-chain.
            </p>
            <p>
              PaTRoN Labs does not warrant that the Services will function uninterrupted, be free of errors,
              vulnerabilities, or exploits, or that any DAT will perform as expected. There is the risk of known
              and unknown errors, bugs, exploits, or vulnerabilities with the Smart Contracts which may interfere with
              your expected use or enjoyment of the Smart Contracts.
            </p>
          </Section>

          <Section number="30" title="Acknowledgments; assumption of risk">
            <p>
              By using the Services, you acknowledge and accept the following risks, among others: (i) smart-contract
              bugs or exploits may result in loss of assets; (ii) third-party protocols, exchanges, or pools may change,
              fail, or become incompatible with our Site or Smart Contracts; (iii) gas fees or network congestion or
              errors outside PaTRoN Labs&apos; control; (iv) market volatility may affect the price, liquidity, or
              availability of any token or asset interacting with our Smart Contracts; (v) regulatory developments may
              adversely impact blockchain systems and may result in the discontinuation of any of our Smart Contracts;
              (vi) final, irreversible, and public transactions; (vii) known and unknown errors or bugs affecting the
              Smart Contract that may affect their intended or expected operation; (viii) malicious third parties who
              interact with, exploit, or use the Smart Contract in a deceptive or unintended manner; (ix) the volatile
              price of ETH, LINEA, or any related asset may impact the functionality, usability, logic, practicality, or
              intended purpose of the Smart Contracts. You assume total responsibility for any losses or damages to
              yourself or others arising from these risks.
            </p>
            <p>
              You further acknowledge and agree that DATs and tokens accessible through the Services may be highly
              experimental, volatile, illiquid, and speculative. PaTRoN Labs makes no promise or representation that any
              market, pool, or counterparty will exist for any token at any time, that you will be able to buy, sell, or
              exit any position, or that any token will have, retain, or attain any particular price or value. There is
              no expectation of profit, liquidity, secondary market support, or continued availability of any DAT
              or token, and you may lose all value associated with any digital asset you choose to interact with through
              the Services.
            </p>
          </Section>

          <Section number="31" title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, PaTRoN Labs and the PaTRoN Labs Parties shall not be liable for any
              indirect, consequential, incidental, special, or punitive damages, or for any loss of profits, data, or
              goodwill arising out of or relating to the Services or these Terms. In no event shall PaTRoN Labs&apos;
              aggregate liability exceed the lesser of (a) USD $100 or (b) the amount directly paid by you to PaTRoN Labs
              for use of the Services giving rise to the claim.
            </p>
          </Section>

          <Section number="32" title="Arbitration; class action waiver">
            <p>
              <span className="text-foreground font-semibold">(a) Agreement to arbitrate.</span> You and PaTRoN Labs agree
              that any dispute, controversy, or claim arising out of or relating to these Terms, the Services, or any
              aspect of the relationship between you and PaTRoN Labs (whether based in contract, tort, statute, fraud,
              misrepresentation, or any other legal theory, and whether arising before or after the termination of this
              Agreement) shall be resolved exclusively and finally by binding arbitration, rather than in court, except
              as otherwise expressly provided in this Section.
            </p>
            <p>
              <span className="text-foreground font-semibold">(b) Governing law and rules.</span> This arbitration
              agreement is governed by the Federal Arbitration Act (9 U.S.C. §§ 1-16). Arbitration shall be conducted
              before a single neutral arbitrator under the Commercial Arbitration Rules of the American Arbitration
              Association (&quot;AAA&quot;), as modified by these Terms. Judgment on the arbitrator&apos;s award may be
              entered in any court having jurisdiction.
            </p>
            <p>
              <span className="text-foreground font-semibold">(c) Location and language.</span> Unless you and PaTRoN
              Labs agree otherwise, arbitration shall be conducted remotely (virtually or document-only at the
              arbitrator&apos;s discretion) in the English language.
            </p>
            <p>
              <span className="text-foreground font-semibold">(d) Delegation of arbitrability.</span> The arbitrator
              shall have the exclusive authority to determine all issues relating to the interpretation, applicability,
              enforceability, or formation of this arbitration agreement, including any claim that all or part of this
              agreement is void or voidable.
            </p>
            <p>
              <span className="text-foreground font-semibold">(e) Individual claims only.</span> To the fullest extent
              permitted by applicable law, you and PaTRoN Labs each agree that any arbitration or proceeding shall be
              conducted solely on an individual basis, and not in a class, collective, consolidated, private attorney
              general, or representative action. The arbitrator may not consolidate more than one person&apos;s claims
              and may not otherwise preside over any form of class or representative proceeding.
            </p>
            <p>
              <span className="text-foreground font-semibold">(f) Limited court actions.</span> Notwithstanding the
              foregoing, either party may seek (i) temporary or preliminary injunctive relief in a court of competent
              jurisdiction to prevent immediate or irreparable harm; or (ii) to compel arbitration or confirm an
              arbitral award under the Federal Arbitration Act.
            </p>
            <p>
              <span className="text-foreground font-semibold">(g) Fees and costs.</span> The arbitration fees and costs
              shall be shared in accordance with the AAA Rules. Each party shall bear its own attorneys&apos; fees and
              costs, except as otherwise required by applicable law or determined by the arbitrator.
            </p>
            <p>
              <span className="text-foreground font-semibold">(h) Severability.</span> If any portion of this arbitration
              agreement is found to be unenforceable, the remainder shall remain in full force and effect.
            </p>
          </Section>

          <Section number="33" title="Contact">
            <p>
              For questions about these Terms, contact{" "}
              <a href="mailto:legal@on-chaindat.com" className="text-primary underline hover:no-underline">
                legal@on-chaindat.com
              </a>
              . For security disclosures, contact{" "}
              <a href="mailto:security@on-chaindat.com" className="text-primary underline hover:no-underline">
                security@on-chaindat.com
              </a>
              . Public communications:{" "}
              <a href="https://x.com/PaTRoN4egLabs" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                @PaTRoN4egLabs
              </a>{" "}
              on X, or via email:{" "}
              <a href="mailto:support@on-chaindat.com" className="text-primary underline hover:no-underline">
                support@on-chaindat.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-lg sm:text-xl font-display font-semibold text-foreground">
        <span className="text-primary mr-2">{number}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
