# October 2026 tester badge

Every surviving account with at least one server-recorded accepted manual click
in October 2026 receives the permanent `monthly_202610_participant` badge, labelled
`2026년 10월 테스터 배지`. This commemorates the trial; formal November rewards and
their 1,000-click participation threshold remain unchanged.

The idempotent migration inserts existing private monthly reward entitlements.
It does not alter scores, frozen ranks, progression, titles or equipped badges.
Players equip or remove it in Inventory → Profile → Badge selection. It can be
worn alongside any title. Rankings and public profiles share a cool silver/gray
shield-and-star treatment with no gold emoji, motion or gameplay bonus.

Validation: `tools/october-tester.test.mjs` checks one-click eligibility, repeated
grant safety, excluded November-only accounts, ownership/ACL guards, title
coexistence, public profile/ranking output, and score preservation.
`tools/october-tester-browser.py` checks real local equip/unequip/reload and silver
presentation on touch 320×640, landscape 844×390 and desktop 1200×900. It verifies
the badge and title do not overlap. These are browser emulations.
