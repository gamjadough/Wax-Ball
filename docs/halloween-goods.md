# Halloween limited goods

Purchase through the candy badge → Halloween shop. Use/equip/unequip through
Inventory → Items → **한정**, immediately after the **초월** rarity filter.

| Goods | Candy | Effect |
|---|---:|---|
| 마녀 포션 | 50 | Final Gold ×1.5 for 30 minutes; independent fractional carry |
| 유령 포션 | 50 | Destruction duration ×0.5 for 30 minutes |
| 호박 포션 | 50 | Respawn delay ×0.5 for 30 minutes |
| 마녀의 심야 / 유령의 저택 / 잭오랜턴의 밤 | 200 each | Permanent profile card |
| 마녀의 계약자 / 유령의 친구 / 호박불의 수호자 | 100 each | Permanent title |

Potions multiply the results of existing items, pets, rebirths, supporter bonuses
and gem Gold multipliers. They do not change blue-gem/candy drops. Different potions
coexist; repeat uses extend time, never strength, up to seven days. Wall time flows
while signed out. Stock, active potions and cosmetics survive rebirth and the season
ending. Ordinary items continue using their original strongest-per-channel rules.

The privileged RPC checks the existing account/maintenance/moderation gates and
server catalog, locks game state before inventory, and journals action + goods ID.
Same-ID retries return current state without another debit or extension. A separate
revision protects goods mutations. Three private RLS tables have no direct client
grants; only the existing `wakppu_api` entry is executable. Profile cards use existing
permanent grants. Titles extend the existing title resolver, preserving monthly and
champion eligibility. Administrator potions use separate virtual expiry, preserve
paid stock and cease conferring virtual benefits after role/session revocation.

## Artwork provenance

Original artwork generated with the built-in image generation tool (`imagegen`
skill), then encoded as WebP without altering composition. No third-party source
art. Each 1536×1024 asset is under 310 KB, lazy-loaded in product cards.

- `wakppuball/images/profile-cards/halloween-witch.webp`
- `wakppuball/images/profile-cards/halloween-ghost.webp`
- `wakppuball/images/profile-cards/halloween-pumpkin.webp`

Prompt set (all specify landscape 3:2, no text/letters/numbers/logo, dark lower
quarter for the player's nickname):

1. Witch's Midnight: premium fantasy collectible profile background; obsidian wax
   sphere, subtle violet witch sigils, intricate magic circle, crescent moon,
   enchanted forest, silver corner filigree, painterly 3D cinematic moonlight.
2. Ghost Manor: luminous translucent pale-blue ghost sphere, moonlit Victorian
   mansion, misty forest, reflected wisps on wet stone, antique silver ornaments,
   rich painterly 3D materials, cold cyan light against charcoal navy.
3. Jack-o-lantern Night: glowing pumpkin wax sphere over autumn stone pedestal,
   bronze corner filigree, tiny embers, distant village beneath the harvest moon,
   black plum shadows, amber lighting and luxurious painterly detail.

## Validation

- `tools/halloween-goods.test.mjs`: real isolated Postgres migrations, prices,
  replay, stock, expiry, stacking/carry, profile visibility/equip/unequip, ended
  season, rebirth, signed-in/revoked/anonymous administrator access and ACLs.
- `tools/halloween-goods-browser.py`: touch 320×640, 844×390, reduced-motion
  390×844 and desktop 1200×900; lost-response retry, real purchases and use,
  cosmetic equip/unequip, reload, actual game destruction/Gold, timing factors,
  image decoding, scroll bounds and controls. Browser emulation, not hardware.
- The opt-in loopback fixture `WAKPPU_LOCAL_HALLOWEEN_GOODS_PREVIEW=1` seeds only
  the fictional local guest with candy. It is never included in production.
