# Hero background video

Drop the real clip here as:

```
public/videos/hero-training.mp4
```

`src/components/landing/Hero.tsx` references it at `/videos/hero-training.mp4`. Until the file
exists, the hero silently falls back to the current static poster image — nothing breaks, the
video is purely additive.

## What to look for

A short (10–20s), tightly-cropped, **portrait-leaning** clip of a coach actively training a
client — reps, form correction, energy — not a wide gym establishing shot. It needs to read
clearly at a small autoplaying size next to the headline, so prefer a medium/close shot over a
wide one.

- **Format:** H.264 `.mp4`, muted-safe audio track (autoplay requires `muted`, but keep a real
  audio track so the mute/unmute button in the corner does something)
- **Aspect/crop:** the frame is `object-cover` at roughly 900×1000–1100 (portrait-ish) — a
  16:9 source works fine, it'll crop to fit
- **Length:** 8–20s, looping — avoid a hard visual "seam" at the loop point if possible
- **File size:** keep it under ~6–8MB for a hero asset; compress with `ffmpeg` if needed:
  ```bash
  ffmpeg -i source.mov -vf "scale=900:-2" -c:v libx264 -crf 26 -preset slow -an public/videos/hero-training.mp4
  ```
  (drop `-an` if you're keeping real audio for the mute toggle)

## Where to source a real clip

Pick something properly licensed for commercial use — the categories below are free,
no-attribution stock video libraries with fitness/training footage; browse and pick one that
actually matches the brand rather than using the first result:

- Mixkit — https://mixkit.co/free-stock-video/personal-trainer/ and
  https://mixkit.co/free-stock-video/workout/
- Pexels Videos — https://www.pexels.com/search/videos/personal%20trainer/
- Coverr — https://coverr.co

Or, better for production: shoot/commission a real LEANR coach+client clip and self-host it the
same way (this file's path is the contract — the component doesn't care where the mp4 came from).

## Production note

For a live app, prefer serving this from Supabase Storage (already used elsewhere in this
project — see `supabase/migrations/0013_storage_buckets.sql`) or a CDN instead of committing a
binary into git — swap `VIDEO_SRC` in `Hero.tsx` to the storage public URL when that's ready.
