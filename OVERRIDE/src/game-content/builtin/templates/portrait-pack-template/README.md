# Portrait Pack Template

## Supported image formats

- png
- gif
- webp
- jpg / jpeg
- svg

## Required files

- manifest.json
- thumbnail.(png|gif|webp|jpg|jpeg|svg)
- reference_sheet.(png|gif|webp|jpg|jpeg|svg)
- 12 portrait states x 2 mouth variants

## Required portrait states

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

Each state must provide:

- `closed`
- `open`

## Notes

- All runtime portraits should use the same canvas size.
- Keep character position stable across all files.
- `open` and `closed` should only change the mouth and minor expression details.
- Use ASCII filenames.
