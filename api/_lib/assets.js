// Asset URL builders and the league allowlist for Past Matches.

// Hero/item icons live on the same Steam CDN OpenDota referenced. We return the
// path only (no host); the client prepends the CDN host in src/lib/constants.ts,
// matching the old `img` contract exactly.
const heroShort = (name) => name.replace(/^npc_dota_hero_/, '')
const itemShort = (name) => name.replace(/^item_/, '')

export const heroImg = (name) =>
  `/apps/dota2/images/dota_react/heroes/${heroShort(name)}.png`
export const itemImg = (name) =>
  `/apps/dota2/images/dota_react/items/${itemShort(name)}.png`

// Steam has no global pro-match feed, so Past Matches pulls recent results for
// these league ids (union'd at request time with whatever is live now). League
// names are resolved automatically from Valve's esports API, so this is only a
// list of tournaments you want to keep in Past Matches even when they are not
// currently live. Leave empty to just track whatever is live.
export const LEAGUE_IDS = [
  // e.g. 18865,
]
