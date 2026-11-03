# Checklist source contract — 2026-11-03.2

This is the source-map snapshot for `checklist_version = 2026-11-03.2`. Changing a required check's meaning, supported variant, or evidence requirement requires a new checklist version and a retained source-map snapshot. Legacy logs have no recoverable historical checklist version; this map must not be retroactively assigned to them.

The current map was reviewed against local compiled/derived teaching. It is not an independent primary-video verification or statistical validation. In particular, the OTE, Turtle Soup, Silver Bullet and iFVG primary HTML files named by the reference are not present under their cited names in the local knowledge tree. The reference's “Direct” grade for iFVG describes its source chain, not this audit's primary-video coverage.

## Sources

- **R**: Compiled entry reference v1.0.0. Section numbers and named subheadings below identify the exact rule chain.
- **E6**: 2022 market efficiency / institutional order flow extract. Three-candle FVG: 10:05; execution: 15:12; bullish mirror: 23:06; timeframe drill: 28:54–29:27.
- **L8**: 2024 Technical Analysis, Lecture 8. Named wick drill: 39:45. Supporting body observation: 30:49.
- **L13**: 2024 Fair Value Gap, Lecture 13. Named FVG institutional entry example: 50:47.

**Source** below means a rule stated or paraphrased in the cited local material. **Component** is specifically the 2022 FVG teaching reused in the FVG drill. **Interpretation** is an app review/planning choice; it must not be presented as a verbatim universal ICT rule. Asking the user to identify a price does not mean the app stores that price.

## Required-check map

| Check ID | Supported review | Classification | Source and application boundary |
|---|---|---|---|
| `ote-context` | 2016/17 body-anchored 62–79% | Source | R §1.1, Prerequisites 1 / Higher Timeframes Priority. User supplies direction. |
| `ote-break` | Same | Source | R §1.1, Prerequisites 2 / Market Structure Break. No invented displacement-size threshold. |
| `ote-anchors` | Same | Interpretation | R §1.1, Entry Sequence 3 / Fibonacci Settings supports body anchors. Premarking them is the app's planning safeguard. |
| `ote-convention` | Same | Interpretation | R §1.1, Prerequisites 3 and Source Divergence. This release selects 62–79%; it excludes the spoken 60% floor and separate 2022 62–70% example. |
| `ote-zone` | Same | Source | R §1.1, Entry Sequence 4. Chart geometry illustrates the selected band's boundaries; no tick tolerance is adopted. |
| `ote-swing` | Same | Source | R §1.1, Invalidation / Risk Model & Stop Loss. Protective swing must not be traded through. |
| `ote-entry` | Same | Interpretation | R §1.1, Entry Sequence 5. Identify the entry location on the user's chart; no fill inference. |
| `ts-level` | Turtle Soup general framework | Source | R §1.3, Prerequisites 1 / old high or low. |
| `ts-context` | Same | Source | R §1.3, Prerequisites 2–5. Context differs by variant; preferred contexts are not all simultaneous requirements. |
| `ts-variant` | Same | Interpretation | R §1.3, The Eight Reversal Types / Entry Sequence 1. User identifies their context; the schematic is a generic false-break example, not a complete variant-specific trigger. |
| `ts-run` | Same | Source | R §1.3, Entry Sequence 2 / Turtle Soup Core Concept (6:11–6:20 cited). A touch without a breach does not show a run. |
| `ts-failure` | Same | Interpretation | R §1.3, false-break definition. Requiring observable return/rejection is the app's evidence check, not a universal numerical reversal threshold. |
| `ts-entry` | Same | Interpretation | R §1.3, Entry Sequence. Identify a reason and reference on the chart; no universal trigger is supplied across eight variants. |
| `io-reference` | FVG institutional drill component | Interpretation | E6 Prerequisites & Context and R §2.4 Prerequisites. User states direction/reference; the app does not find a draw. |
| `io-sweep` | Same | Component | E6 Rules & Conditions 1, R §2.4. The sweep requirement belongs to this component sequence. |
| `io-shift` | Same | Component | R §2.4 Prerequisites / E6 displacement teaching. Energetic close beyond the short-term swing; no numerical size threshold. |
| `io-gap` | Same | Component | E6 Structure / Pattern Description and Rules 2–3 (10:05), R §2.4. Completed candle 3 with outer-wick separation. |
| `io-drill` | Same | Component | E6 28:54–29:27; R §2.4 Entry Sequence. Start at 15m and identify a gap on the timeframe drill. |
| `io-price` | Same | Interpretation | E6 Entry Execution (15:12); L13 50:47 naming example. Exact 'on' vs 'just beyond' offsets are not unified; user identifies their reference. |
| `io-return` | Same | Interpretation | E6 Entry Execution / R §2.4. Later touch after gap completion is observable; it is not proof of a fill. |
| `wick-delivery` | Bearish wick drill only | Source | L8 39:45, Institutional Order Flow Entry Drill context. Bullish mirror remains blocked. |
| `wick-reference` | Same | Source | L8 39:45, reference candlestick/wick. |
| `wick-ce` | Same | Source | L8 39:45 and R Glossary: Consequent Encroachment. Midpoint of the upper wick, not the candle body. |
| `wick-return` | Same | Source | L8 39:45. Return to wick CE without exceeding reference candle high. |
| `wick-entry` | Same | Interpretation | L8 39:45 describes a possible entry. The app asks the user to identify that retest; it does not choose an offset. |
| `sb-draw` | Silver Bullet | Source | R §2.2, Prerequisites 2 / Types of Draws on Liquidity. |
| `sb-window` | Same | Interpretation | R §2.2, Prerequisites 1,3. Listed NY hours are teaching; weekday exclusion and half-open hour boundaries are app timing policy. Holidays are not checked. |
| `sb-gap` | Same | Source | R §2.2, Prerequisites 4 / Entry Sequence 3, cited 56:56. Gap may predate the entry window. |
| `sb-entry` | Same | Source | R §2.2, Entry Sequence 4–5. Entry return must be inside the selected hour; exit need not be. |
| `sb-price` | Same | Interpretation | R §2.2, Entry Sequence 4. User identifies a reference, without automatic execution/fill calculation. |
| `ifvg-gap` | Scenario B, conservative CE-close | Source | R §4.1, Definition / Prerequisites 1. Original completed FVG comes first. |
| `ifvg-fail` | Same | Source | R §4.1, Definition / Study & Review. Original role must fail. A full far-edge close is this schematic's example, not an exclusive universal failure test. |
| `ifvg-scenario` | Same | Interpretation | R §4.1, Prerequisites 3 / Scenario B: No Prior Penetration. This release restricts review to B; earlier penetration means No. The failure and later return are excluded from 'prior' in this review. |
| `ifvg-return` | Same | Source | R §4.1, Prerequisites 1. Later opposite-role return, after failure. |
| `ifvg-proof` | Same | Source | R §4.1, Prerequisites 4–5 / Signature Pattern. This release selects the conservative CE body-close example. Exact chart equality is illustrative; source tolerance is unresolved and is not inferred from pixels. |
| `ifvg-entry` | Same | Interpretation | R §4.1, Entry Sequence 3–4. Identify the CE entry reference on the chart. The high-boundary and aggressive-touch alternatives are outside this checklist. |

The optional `wick-body` observation is not counted in the saved result: L8 30:49 describes body behaviour and the next lower high separately from the 39:45 retest.

## Interpretation safeguards

There is no universal raid → displacement → FVG checklist across all five models. The 2022 component sequence cannot be imposed on OTE, Turtle Soup or the wick drill merely because it appears in the same app. L13 establishes an FVG use of the institutional-drill name; L8 separately establishes a wick use. Neither source turns every component rule into a universal named-drill rule.

OTE's body-anchor calculation is the compiled-reference convention represented in this release, not a claim that every ICT OTE example uses identical anchoring. iFVG Scenario A/high-boundary/aggressive-entry paths require their own source-reviewed checklist before support is claimed. Long/Short iFVG diagrams mirror the general opposite-role gap concept and CE midpoint; they do not introduce mirrored Scenario A requirements.

## Independent semantic fixtures

Source fixtures use ordinary price observations, separate from the renderer's screen coordinates. Contract tests check source locator existence, expected Yes/No boundaries, current check coverage and the corresponding diagram observations. These are source-linked engineering fixtures reviewed during this local-source pass; they are not independently verified primary-video examples or historical market samples.

This test site includes source summaries only. The underlying local study material is not published here. Entries are self-reported observations, not automated market validation.
