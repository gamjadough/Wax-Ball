# Ball input recovery

Reproduction: block `input-guard-rules.js` while allowing `input-guard.js` to load. The old pointer handler calls `record()` before `onHit()`. Its missing rules reference throws `WakppuInputGuardRules is not defined`, preventing every ball hit while other buttons still work. Reloading repeats the failure if the bundle remains unavailable.

The collector now falls back to the same bounded 2048-sample buffer when the optional rules bundle is unavailable. The pointer handler also isolates unexpected collector exceptions and logs only the first failure; the actual hit still runs. This changes no server authorization, input reports, rate limits, rewards or account restrictions.

Regression: `ball-input-browser.py` checks normal loading, a blocked rules download, and an injected collector exception using real touch input at 320×640, 844×390, 390×844 and 1200×900. Each case must progress through the local server hit API, leave the shop reachable and produce no unhandled JavaScript exception. This is browser emulation, not physical-device testing. `input-guard-client.test.mjs` verifies reporting remains bounded when the rules bundle is missing.

A clean local production-style custom-studio fixture and a synthetic production SQL hit also progressed normally. The synthetic production transaction was rolled back. The user's exact browser/network cause has not been directly inspected.
