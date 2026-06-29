# Sources

Consolidated index of all links used during the research pass.

## Prototypes - Etherscan / Sourcify

### REKTSTR (ERC20Strategy v2)
- Proxy: <https://etherscan.io/address/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e>
- Implementation (Sourcify full match): <https://sourcify.dev/#/lookup/0xe5a9634bf5db3d8d6138c3182d09a561bcf1a2a5>
- Hook: <https://etherscan.io/address/0xdadaaa9591d6f4d68748898fbacc99dc69012444>
- Underlying $REKT: <https://etherscan.io/token/0xdd3b11ef34cd511a2da159034a05fcb94d806686>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e>

### WBTCSTR (ERC20Strategy v3) - our prototype
- Proxy: <https://etherscan.io/address/0x7af2a142c3486a9726791098e6415b768513e363>
- Implementation: <https://etherscan.io/address/0xb1a3015b61e4eac9253a674c6942cdc5dd8de510>
- Hook: <https://etherscan.io/address/0x9f8f375b2d246da6be816b453f13d43d8240a444>
- Factory: <https://etherscan.io/address/0x9f834e16b709c0781537186e7bb09de42a000a0a>
- Launch tx: <https://etherscan.io/tx/0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd>
- LP-NFT (tokenId 132829, sent to 0xdead): <https://etherscan.io/token/0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e?a=132829>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0x7af2a142c3486a9726791098e6415b768513e363>
- Underlying wBTC: <https://etherscan.io/token/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599>

### TokenWorks ecosystem
- Site: <https://token.works>
- Docs: <https://docs.tokenstrategy.com>
- GitHub: <https://github.com/token-works>
- Twitter: <https://x.com/token_works>
- Adam Lizek (Rhynotic): <https://x.com/Rhynotic>, <https://warpcast.com/rhynotic>

### Related
- PunkStrategy ($PNKSTR): <https://etherscan.io/address/0xc50673EDb3A7b94E8CAD8a7d4E0cD68864E33eDF>
- 0xQuit Twitter (Yuga Labs VP, slow-rug fix author): <https://x.com/0xQuit>
- Slow-rug arbitrageur addr (20.09.2025): <https://etherscan.io/address/0xa3d297423b17a3894dddd582dc41ff20e237ab75>

## Linea L2

- Network info: <https://linea.build>
- RPC: <https://rpc.linea.build>
- Block explorer: <https://lineascan.build>
- $LINEA token (canonical L2): <https://lineascan.build/token/0x1789e0043623282D5DCc7F213d703C6D8BAfBB04>
- $LINEA implementation: <https://lineascan.build/address/0xe03F157dE67AC4b2A9a949D64d2A3C64Ffa1BC55#code>

### Uniswap v4 on Linea
- PoolManager: <https://lineascan.build/address/0x248083fb965359d82b06c1f5322480dcfc1ad857>
- PositionManager: <https://lineascan.build/address/0xddcad5775b2816a87495f207731b3571d7ee3c76>
- StateView: <https://lineascan.build/address/0xe861de206e460a8b936b05ad3816520b58ccdf9b>
- Quoter: <https://lineascan.build/address/0x2c125569c0bee20a66e33e5491c552b37ebd9934>
- UniversalRouter V2_1_1: <https://lineascan.build/address/0x8B844f885672f333Bc0042cB669255f93a4C1E6b>
- Permit2 (universal): <https://lineascan.build/address/0x000000000022d473030f116ddee9f6b43ac78ba3>

### Uniswap SDK (source of truth)
- `Uniswap/sdks` repo: <https://github.com/Uniswap/sdks>
- `addresses.ts` (Linea entries): `sdks/sdk-core/src/addresses.ts`
- `universal-router-sdk/src/utils/constants.ts`

## Live API endpoints (for analytics)

- DefiLlama Coins: <https://coins.llama.fi/prices/current/...>
- DefiLlama Yields: <https://yields.llama.fi/pools>
- GeckoTerminal: <https://api.geckoterminal.com/api/v2/networks/linea/...>

## Uniswap v4 documentation

- v4-core: <https://github.com/Uniswap/v4-core>
- v4-periphery: <https://github.com/Uniswap/v4-periphery>
- v4-router: <https://github.com/Uniswap/v4-router>
- Hook permissions library: <https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol>

## TokenStrategy public mentions

- docs.tokenstrategy.com - fee structure, anti-snipe details
- bankless.com / Adam Levy - analysis of the PNKSTR launch and patches
- nftstrategy.fun - UI for NFTStrategy tokens
- punkstrategy.fun - UI for PNKSTR
- Bindoon's PunkStrategy v1 community breakdown: <https://github.com/bindoon/PunkStrategy>

## Incidents references

- Rhynotic tweet after 20.09.2025: <https://x.com/Rhynotic/status/1969098120219775306>
- 0xQuit personal bot deploy: mentioned in the Bankless / Twitter context
- SquiggleStrategy exploit: TokenWorks Twitter, 28.09.2025

## What we did NOT find in public sources

- Reactions from samczsun / pashov / spreekaway / DeFiHackLabs to TokenWorks bugs - not published
- Rekt.news article - there was none (impact below their $1M+ threshold)
- Technical postmortem from Rhynotic on Medium / Mirror / HackMD - not found
- `0xleastwood` audit report - a mention exists, but the report was not published publicly
