# Asset Pack Specification

This project supports two runtime asset pack types:

1. portrait packs
2. background packs

## Portrait Pack

- version: `portrait_pack_v1`
- required fields:
  - `id`
  - `displayName`
  - `thumbnail`
  - `referenceSheet`
  - `states`
- optional field:
  - `roleHint` = `hero` | `enemy` | `generic`

Portrait states:

- neutral_idle
- polite_smile
- smug_tilt
- innocent_hand
- serious_focus
- thinking_hand_to_chin
- surprise_small
- shock_big
- defensive_frown
- angry_attack
- breakdown_unstable
- sad_confession

Each portrait state contains:

```json
{
  "closed": "state_closed.png",
  "open": "state_open.png"
}
```

## Background Pack

- version: `background_pack_v1`
- required fields:
  - `id`
  - `displayName`
  - `thumbnail`
  - `slots`
- optional field:
  - `overlays`

Background slots:

- boot
- briefing
- hearing
- cross_exam
- analysis
- reveal
- confession
- ending

## File format support

- png
- gif
- webp
- jpg / jpeg
- svg

## Runtime notes

- Portrait packs are shared by video-window mode and AVG mode.
- Background packs are shared by AI mode and local scripted mode.
- SVG files are useful as debug placeholders because they can embed readable text.
- For production art, static files should usually use PNG; animated assets may use GIF.
