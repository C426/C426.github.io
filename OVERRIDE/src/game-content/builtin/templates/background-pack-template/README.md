# Background Pack Template

## Supported image formats

- png
- gif
- webp
- jpg / jpeg
- svg

## Required files

- manifest.json
- thumbnail.(png|gif|webp|jpg|jpeg|svg)
- one asset for each background slot

## Standard slots

- boot
- briefing
- hearing
- cross_exam
- analysis
- reveal
- confession
- ending

## Optional overlays

You can provide overlay assets in `overlays` for slots such as:

- cross_exam
- analysis
- reveal
- confession

If a pack does not include overlays, the game will simply render the background image.
