---
name: emil-design-eng
description: Polish UI components and motion using Emil Kowalski's design-engineering principles. Use for animation reviews, interaction refinement, perceived performance, hover and press feedback, easing, duration, transform origin, reduced motion, and Before/After/Why UI critique.
---

# Design Engineering Polish

Make interfaces feel responsive and intentional through small, evidence-based improvements. Preserve the product's visual identity and avoid decorative motion that competes with the user's task.

## Review lens

For every proposed change, state:

| Before | After | Why |
| --- | --- | --- |
| Observable current behavior | Specific scoped change | User-facing benefit |

Use this format for review findings; include `file:line` in the Before cell. Distinguish defects from taste-based options.

## Animation decision

Before adding or retaining motion, answer:

1. Is the interaction frequent? Frequent actions should be instant or very subtle.
2. What purpose does motion serve: spatial continuity, state explanation, feedback, or preventing a jarring change?
3. Can the animation be interrupted or reversed naturally?
4. What happens when reduced motion is enabled?

If the only purpose is “looks cool,” especially on a frequent path, remove it.

## Timing and easing

- Press feedback: roughly 100–160 ms.
- Tooltip or small popover: roughly 125–200 ms.
- Dropdown or compact state change: roughly 150–250 ms.
- Modal or drawer: roughly 200–500 ms, with the longer end reserved for meaningful travel distance.
- Default product UI should usually finish within 300 ms.
- Enter and exit motion usually uses a strong ease-out; on-screen movement may use ease-in-out; continuous progress uses linear.
- Avoid ease-in for user-triggered entrances because it delays visible response.
- Use springs for interruptible gestures when the existing stack supports them; keep bounce restrained unless playfulness is intentional.

Do not copy durations blindly. Measure distance, frequency, platform convention, and perceived response.

## Interaction polish

- Give pressable controls immediate pressed feedback. A subtle scale around 0.97–0.98 can work when it does not cause layout or text-rendering issues.
- Never enter from `scale(0)`; begin near full size and combine with opacity when scale is justified.
- Set transform origin to the triggering edge for anchored popovers. Keep centered modals centered.
- Hover is an enhancement, not the only state cue. Gate web hover motion to precise pointers.
- Keep exit feedback fast. Do not delay navigation or input while decorative stagger animations finish.
- Prefer transitions that can retarget over keyframes that restart during rapidly changing UI.

## Performance and accessibility

- Never use `transition: all`; name the exact properties.
- Prefer opacity and transforms. Avoid animating layout, blur, or large shadows unless the measured benefit justifies the cost.
- On React Native, prefer the native/UI-thread animation path already used by the project and avoid per-frame React state updates.
- For drag interactions, preserve pointer/touch capture semantics, apply boundary damping, and provide a non-gesture alternative.
- Honor `prefers-reduced-motion` on web and the platform reduced-motion setting on native. Remove or shorten spatial motion first; preserve useful opacity/color state feedback.
- Pause or stop non-essential looping motion when hidden or reduced motion is requested.
- Verify on real low/mid-range hardware or a throttled preview when animation performance matters.

## Audit checklist

Search for and inspect:

- `transition: all` and overly broad transition properties;
- durations above 300 ms without a distance or comprehension reason;
- `ease-in` on entrances and weak/default easing where it feels sluggish;
- `scale(0)` and incorrect transform origin;
- motion with no functional purpose or motion that delays interaction;
- gesture-only behavior and non-interruptible animations;
- missing reduced-motion handling;
- expensive per-frame layout, shadow, blur, or React state work;
- missing hover, focus, press, disabled, loading, success, and error feedback.

Prioritize broken or inaccessible interaction before visual polish. Reuse existing motion helpers or add a shared abstraction only when it removes repeated complexity and keeps behavior consistent.

## Attribution and license

Adapted for Codex and React Native from Emil Kowalski's `emil-design-eng` skill, reviewed 2026-08-26:

- https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng
- https://animations.dev/

Upstream license: MIT, copyright (c) 2026 Emil Kowalski. This adaptation is not affiliated with or endorsed by Emil Kowalski.
