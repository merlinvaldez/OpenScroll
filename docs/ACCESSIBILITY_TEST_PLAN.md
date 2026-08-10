# Epic A manual accessibility test plan

Record browser, operating system, assistive technology, result, evidence, and reviewer for every release candidate.

| Surface | Manual check | Pass condition |
| --- | --- | --- |
| Screen reader | VoiceOver/Safari and TalkBack/Chrome: complete interest, topics, and feed | Names, roles, state, order, and status announcements are correct |
| Keyboard/switch | Complete the flow using Tab, Shift+Tab, Enter, Space, Escape | No trap; visible focus; sheets close; focus restores |
| Zoom/type | Test at 200% browser zoom and largest OS text size | No clipped content or two-dimensional scrolling; controls remain usable |
| Motion | Enable reduced motion and move through all screens | Nonessential entrance, shimmer, and smooth motion stop |
| RTL | Select Arabic and complete the flow | Layout, arrows, ordering, and alignment mirror; item text uses bidi isolation |
| Captions | Inspect any audio/video viewer added after Epic A | Captions/transcripts are reachable without playback |
| Charts | Inspect any visualization added after Epic A | Equivalent table or text alternative is present |
| Contrast | Test light, dark, forced-colors, disabled, focus, and selected states | WCAG 2.2 AA contrast and non-color state cues pass |

Automated Axe checks supplement this script; they do not replace it.
