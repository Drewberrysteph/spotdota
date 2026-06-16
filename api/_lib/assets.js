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

// Past Matches has no global pro feed on Steam, so we pull recent results for a
// curated set of leagues (union'd at request time with whatever is live now).
// Edit this each season as tournaments change - this is the one piece of the
// Steam migration that needs occasional upkeep.
export const LEAGUE_IDS = [
  // Add marquee league ids here, e.g. the current TI / DPC majors.
]
