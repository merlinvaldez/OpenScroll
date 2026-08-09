# OpenScroll Design Specification

**Status:** Design direction  
**Version:** 1.0  
**Platform priority:** Mobile first, responsive web second  
**Experience:** Calm, media-first, icon-led open discovery

## 1. Design Thesis

OpenScroll should feel like entering a quiet gallery that rearranges itself around a person's curiosity.

The interface recedes. The artifact leads. Actions are close at hand but visually quiet. The product does not overexplain itself, rush the user, reward compulsive behavior, or turn every object into the same generic card.

Three priorities govern the design:

1. **Iconography over explanatory copy**
2. **Minimal interface centered on media consumption**
3. **A peaceful, immediately understandable Zen UI**

Minimal does not mean mysterious. OpenScroll uses progressive disclosure: recognizable icon first, a short label when ambiguity is possible, and full detail on demand.

## 2. Experience Principles

### Artifact first

Photography fills the visual field. Audio opens as a player. Text becomes a readable page. Maps behave as maps. Datasets become legible visual stories. The interface does not flatten each medium into an identical image-title-description tile.

### One decision per moment

Each screen has one dominant task. Secondary actions are available but subdued.

### Quiet chrome

Navigation, controls, and metadata use low visual contrast until they are needed. The content itself receives the strongest contrast and largest area.

### Recognition over instruction

Use familiar platform conventions and a consistent icon grammar. Do not add paragraphs to compensate for unclear interaction design.

### Progressive disclosure

The default card shows only what is necessary to consume and orient: artifact, title, essential identity, and a quiet action rail. Context, provenance, rights, and recommendation reasoning open as layers.

### Humane rhythm

The feed alternates density, scale, medium, and pace. Intentional session markers create a breath every 25 items.

### Transparent, never noisy

Source and license are one gesture away on every object. Verification can appear as a compact mark, but legal meaning must never be conveyed by color or icon alone.

## 3. Product Personality

OpenScroll is:

- Quiet, curious, warm, and precise
- Editorial rather than algorithmic
- Contemporary without feeling trendy
- Scholarly without feeling academic
- Global without using generic “world culture” motifs
- Trustworthy without surrounding every item with warnings

OpenScroll is not:

- Loud, gamified, cute, hyperactive, or feed-addictive
- Dense like an archive search interface
- Visually uniform like a news aggregator
- Decorative at the expense of the artifact
- Dependent on lengthy onboarding copy

## 4. Information Architecture

### Primary navigation

Use a four-item bottom navigation on mobile:

| Icon | Label | Purpose |
| --- | --- | --- |
| Layered scroll | Scrolls | Current and saved Scrolls |
| Compass | Explore | Editorial and categorical discovery |
| Bookmark | Saved | Saved objects and collections |
| Sliders | Settings | Topics, languages, sources, history, storage, accessibility |

Search is a global action in the top-right or invoked by pull-down from major roots. It is not a fifth bottom-navigation item.

Labels remain visible in primary navigation because unlabeled custom navigation icons create unnecessary ambiguity. Labels may become visually quieter after familiarity is established, but remain available to accessibility services.

### Content hierarchy

1. Scroll
2. Topic branch
3. Content object
4. Context and relationships
5. Provenance and rights

### Overlay hierarchy

- **Peek sheet:** quick context, source, license, or “Why this?”
- **Half sheet:** actions, topic controls, related items
- **Full sheet:** detailed metadata, rights terms, source record, accessibility alternatives

Avoid modal alerts for ordinary discovery actions.

## 5. Core Flow

### 5.1 Welcome / Interest Entry

**Purpose:** Begin with curiosity, not setup.

**Layout:**

- Bare, calm field with a single centered prompt: **What do you want to explore?**
- One generous input line or capsule
- Search/arrow icon as the only primary action
- A quiet rotating line of examples beneath the field
- Small settings/sliders control in the corner

**Behavior:**

- Focus the field immediately for a new user.
- Accept topics, people, places, periods, languages, genres, and questions.
- Resolve ambiguous terms in a compact choice sheet rather than a conversation.
- No registration, login, profile, or account prompt anywhere in the consumer experience.

**Copy ceiling:** One prompt, one input hint, up to three examples. No onboarding carousel.

### 5.2 Topic Selection

**Purpose:** Let the user shape the algorithm explicitly.

**Header:** Root interest, compact entity mark, close/back.

**Main interaction:** A vertically browsable set of topic clusters. Each cluster uses a small category icon and horizontally wrapping topic chips or cards.

**Selection states:**

- Unselected: outline / quiet surface
- Selected: filled surface + check
- Strong interest: selected item can be pressed again to reveal a three-level weight control
- Excluded: long press or overflow → Hide topic

**Rules:**

- Show 18–30 high-quality suggestions initially, grouped into 5–7 dimensions.
- Use **Show more** only within a category.
- Keep selected topics pinned in a quiet tray above the CTA.
- Do not expose graph terminology, numerical weights, or AI mechanics here.

**Primary action:** **Build Scroll** with a small spark/arrow icon.

**Empty state:** The CTA remains usable. If nothing is selected, build from the root interest and invite refinement later.

### 5.3 Building State

Replace a conventional spinner with a restrained sequence of source and medium marks softly appearing around the root topic.

Show no fake percentage. If work exceeds two seconds, rotate short factual status phrases such as **Finding open audio** or **Checking rights**. Never claim completion before verification.

### 5.4 Scroll Feed

**Purpose:** Consume, understand, and branch with minimal friction.

**Header behavior:**

- Root topic and compact branch indicator
- Collapses after downward movement
- Returns on slight upward movement
- Contains search and Scroll settings only

**Card anatomy:**

- Media surface dominates
- One-line title or object identity
- Optional one-line creator/date/location depending on medium
- Source mark and verified-open indicator in a low-contrast metadata row
- Vertical or bottom action rail: save, branch, respond, more

**Core gestures:**

| Gesture | Outcome |
| --- | --- |
| Tap artifact | Enter focused viewer/player/reader |
| Swipe up | Next item |
| Swipe down | Previous item |
| Double tap | Save with reversible confirmation |
| Long press | Quick context and provenance sheet |
| Tap branch icon | Explore related topic |
| Tap open mark | “Why is this open?” sheet |

Every gesture must have a visible control equivalent. Gesture-only functionality is prohibited.

**Session marker:** After 25 items, show a full-bleed breathing card:

> You explored 25 objects across 8 sources.

Actions: **Pause** and **Continue**. Do not use streaks, countdowns, confetti, or loss framing.

### 5.5 Focused Viewer

The focused viewer removes navigation chrome and honors the medium:

- Image: edge-to-edge, pinch to zoom, optional caption
- Audio/music: artwork or quiet waveform, large transport controls, transcript drawer
- Video: native aspect ratio, captions and transcript
- Text/book: distraction-free reader, typography controls, original/translation toggle
- Museum/3D: object stage with rotate/zoom guidance on first use
- Dataset: chart first, methodology and raw data beneath
- Map: direct manipulation with layers in a bottom sheet

One tap reveals or hides chrome.

### 5.6 Explore Branch

Tapping the branch icon opens a bottom sheet anchored to the discovered concept.

Show:

- Concept name and one-line definition
- A compact relationship path back to the current Scroll
- 6–10 related topic chips
- Two actions: **Explore now** and **Add to Scroll**

Exploring now preserves the user's place. Back returns to the exact originating item.

### 5.7 Save and Collections

Double tap or bookmark saves instantly to **Saved**. A small reversible toast offers **Add to collection**.

Collection creation requires only a name. Collections remain private to the browser. There are no collaborators, public collection pages, or publishing controls.

### 5.8 “Why this?”

Open a compact causal path in a half sheet:

**Morocco → Music → Gnawa → Field recording in Essaouira**

Use icons and concise relationship labels. Offer semantic controls beneath:

- More like this
- Less like this
- Go deeper
- More surprising
- Hide this topic

Do not expose a numeric relevance score.

### 5.9 “Why open?”

Open from the verified-open mark.

First layer:

- License name
- Plain-language permissions using access, share, adapt, and commercial-use icons
- Obligations using attribution and ShareAlike icons

Second layer:

- Rights holder
- Verification date and method
- License link
- Attribution text
- Original source

Use text alongside every legal icon. Legal permissions are never icon-only.

## 6. Media-Native Card System

Cards share spacing, action placement, and provenance behavior, but not a universal visual template.

| Card | Dominant treatment | Essential visible metadata | Primary control |
| --- | --- | --- | --- |
| Image | Full-width image, natural ratio | Title, creator/date | Zoom |
| Audio | Large transport area and restrained waveform | Recording, performer, duration | Play/pause |
| Music discovery | Artist/work relationship with playable open recording when available | Artist, work, recording source | Play / explore artist |
| Video | Native video frame | Title, duration, captions | Play |
| Article | Readable excerpt with typographic hierarchy | Title, source, reading time | Read |
| Book | Cover beside spacious title block | Author, year, language | Read/listen |
| Primary source | Artifact crop plus visible PRIMARY SOURCE label | Date, origin, holding institution | Inspect |
| Museum object | Neutral object stage | Object, period, material | Inspect/rotate |
| Dataset | Immediate chart or map | Measure, geography, update date | Explore data |
| Research | Editorial abstract treatment | Authors, year, method marker | Read summary |
| Dictionary | Term as hero typography | Language, pronunciation, meaning | Listen |
| Timeline | Horizontal time interaction | Period and event count | Explore |
| Map | Interactive geography | Layer name, date, source | Pan/zoom |

### Density rhythm

- Alternate immersive, medium, and compact objects.
- Never place more than two items of the same medium consecutively.
- Follow a dense research or data object with a visually lighter object when relevance permits.
- Reserve full-bleed treatment for media that can support it at adequate resolution.

## 7. Iconography System

### Icon principles

- Use a single established icon family with rounded, optically balanced strokes.
- Default size: 24 px; compact metadata: 16–18 px; primary media action: 32–40 px.
- Minimum touch target: 44 × 44 px.
- Use filled states only for active, selected, playing, or saved status.
- Avoid metaphor collisions. One icon has one product meaning.
- Do not use emoji as interface icons.
- Do not hand-draw cultural motifs to represent topics or regions.

### Core icon vocabulary

| Meaning | Recommended metaphor | Visible label policy |
| --- | --- | --- |
| Search | Magnifier | No label in standard header |
| Explore branch | Branching path / nodes | Label on first use and in sheets |
| Save | Bookmark | No label on card; label in confirmation |
| More | Horizontal ellipsis | No label |
| Why this | Path / connected nodes | Always labeled in menu or sheet |
| Verified open | Open lock with check | Label as “Open” on first use and detail views |
| Source | Institution / external link | Label in provenance view |
| Original language | Language / characters | Label in reader toggle |
| Translation | Language swap | Label in reader toggle |
| Depth | Descending layers | Always paired with semantic text |
| Surprise | Offset spark / discovery mark | Always paired with semantic text |
| Sensitive content | Eye with caution mark | Always paired with warning text |

### First-use learning

The first time a user encounters a nonstandard icon, show a two-word anchored label for approximately two seconds or until interaction. Never run a tutorial tour. Repeat labels only after long inactivity or when usability data shows confusion.

### Accessibility rule

Every icon control requires an accessible name, visible focus state, tooltip on pointer hover, and short label in any expanded menu. Iconography reduces copy volume; it does not remove meaning.

## 8. Visual Language

### Color

Use a warm-neutral foundation inspired by paper, stone, and gallery walls without imitating any specific culture.

Suggested semantic palette:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#F7F5F0` | `#151614` | App background |
| Surface | `#FFFEFB` | `#1E201D` | Sheets and cards |
| Ink | `#1D211E` | `#F1F0EA` | Primary text |
| Muted ink | `#686D68` | `#A9AEA7` | Metadata |
| Hairline | `#DCDDD7` | `#343731` | Dividers |
| Moss | `#476556` | `#86AD98` | Selected / trusted action |
| Ochre | `#A56B32` | `#D6A36C` | Discovery accent |
| Caution | `#8E5A43` | `#D39A7D` | Sensitive or degraded state |

Color must never be the sole carrier of selection, license, safety, or availability.

### Typography

- Use a highly legible humanist sans for interface and metadata.
- Use a restrained editorial serif only for long-form reading and selected object titles.
- Support Arabic, Tamazight/Tifinagh, Latin, and other scripts with script-appropriate companion fonts rather than forcing a single family.
- Base interface text: 16 px.
- Metadata minimum: 13 px with strong contrast.
- Reading line length: 55–75 characters.
- Do not use all caps except short categorical labels such as PRIMARY SOURCE.

### Space and shape

- Base spacing unit: 4 px.
- Common gaps: 8, 12, 16, 24, 32, 48 px.
- Screen edge padding: 20 px mobile, 32 px tablet.
- Use large empty zones intentionally around high-value media.
- Card radius: 16–20 px only when the media is not full bleed.
- Sheets: 24 px top radius.
- Shadows should be nearly absent; use tonal separation and hairlines.

### Imagery

- Preserve the artifact's aspect ratio whenever possible.
- Never crop away identifying context by default.
- Offer full-object and detail views for archival and museum material.
- Do not apply decorative filters, gradients, or automatic color treatments to collection assets.

## 9. Motion and Sound

Motion should explain continuity, not celebrate activity.

- Standard transitions: 180–240 ms with gentle deceleration.
- Branch exploration visually grows from the selected concept.
- Save confirmation uses a subtle bookmark fill, not confetti.
- New feed items settle without bounce.
- Loading uses slow opacity and position shifts, not rapidly spinning indicators.
- Respect Reduce Motion by replacing movement with crossfades or immediate state changes.
- No interface sounds by default.
- Media never autoplays with sound.

## 10. Copy System

### Voice

Brief, direct, curious, and nonjudgmental.

### Copy rules

- Prefer verbs: Explore, Save, Listen, Read, Inspect, Add.
- Use one short sentence instead of a title plus explanatory paragraph.
- Avoid “AI-powered,” “algorithm,” and “content” in user-facing discovery copy.
- Never imply that the user is behind or should keep going.
- Use precise terms for rights and provenance.

### Good examples

- What do you want to explore?
- What about Morocco interests you?
- Build Scroll
- Explore Gnawa
- Why this?
- Why open?
- You explored 25 objects. Pause here?

### Avoid

- Tell us about all your interests so our powerful AI can personalize your experience.
- Keep scrolling so we can learn more about you.
- You are on a 7-day discovery streak.
- This content is copyright free.

## 11. Accessibility and Inclusive Design

OpenScroll targets WCAG 2.2 AA as a release requirement.

- 44 × 44 px minimum touch targets
- 4.5:1 contrast for normal text; 3:1 for large text and meaningful UI boundaries
- Dynamic type and browser zoom without clipped controls
- Complete keyboard and switch navigation
- Logical focus order and persistent visible focus
- Screen-reader names for every icon and gesture equivalent
- Captions for video and transcripts for audio when available
- Alt text separated into source-provided, translated, and AI-generated fields
- Original/translation toggle with language named in text
- Right-to-left layout support, not only right-aligned strings
- Reduced motion and reduced transparency support
- Text alternative or table for every generated data visualization
- Sensitive-content controls that remain operable with assistive technology

If an icon repeatedly fails comprehension testing, add a persistent label. Visual minimalism does not outrank successful use.

## 12. States and Feedback

### Loading

Use content-shaped skeletons sparingly. For longer source retrieval, name the real activity in short phrases.

### Empty

Empty states offer one next action and no illustration unless the illustration adds meaning.

Example: **Nothing open matched these filters. Widen topics.**

### Degraded source

Do not interrupt the Scroll. Exclude unavailable items, compose from healthy sources, and show source status only in source controls.

### Rights uncertainty

Fail closed. The object does not appear in the main Scroll. Admin interfaces explain the rejection; consumer interfaces do not tease unavailable media.

### Undo

Hide, save, remove, and preference actions show a quiet reversible toast.

### Offline

Saved metadata and legally cacheable media remain available. Clearly distinguish unavailable remote media without blaming the user.

## 12.1 Account-Free Local Continuity

OpenScroll is free to open and free to Scroll. It has no consumer accounts. The product should feel persistent on a device without pretending local browser storage is a cloud backup.

### What is saved locally

- Scroll recipes, topic weights, and exclusions
- Languages, media, depth, time, surprise, source, accessibility, and safety preferences
- Saves, collections, and explicit feedback
- Browsing history when the user leaves history enabled
- Reading, listening, and viewing position
- Small amounts of rights-safe offline metadata and media selected by the user

### First-run disclosure

Do not interrupt first exploration. After the first meaningful save or completed Scroll, show a quiet one-time sheet:

> Saved on this device
>
> Your Scrolls and preferences stay in this browser. Clearing browser data removes them. You can export a backup anytime.

Actions: **Got it** and **Export backup**.

### Settings → Your data

Provide:

- Storage used
- Browser persistence status
- Export OpenScroll Data
- Import OpenScroll Data
- Clear history
- Remove offline media
- Reset preferences
- Delete all local OpenScroll data

Destructive actions show the exact affected categories and require confirmation. Export and clear actions must work without an account or email address.

### Private browsing and blocked storage

Scrolling remains available. If persistence is unavailable, show a compact status near Save:

> This browser will not keep saves after you close it.

Never repeatedly prompt or shame the user into changing browser settings.

### Cross-device expectation

Do not imply synchronization. When a user asks to move their setup, guide them to **Export** on one device and **Import** on the other. A future optional sync feature would be a separate product decision and must not quietly introduce accounts into 1.0.

### Canonical-link sharing only

The Share action is available only on an existing verified-open source item or public OpenScroll topic page. It invokes the platform share sheet or copies that canonical URL.

It must never publish or transmit a user's Scroll, collection, annotations, preferences, history, generated arrangement, device identifier, or local database record. Scrolls and collections have **Export for backup**, not Share or Publish.

There are no consumer uploads, posts, comments, creator profiles, public recipes, public collections, collaboration, following, or remixing of user-created material. OpenScroll editorial templates may be copied into a local Scroll, but consumer templates cannot be submitted to the platform.

## 13. Responsive Behavior

### Mobile

- Single-column immersive feed
- Bottom navigation
- Bottom sheets for secondary layers
- One-handed access to main actions

### Tablet

- Centered consumption column with optional related-context rail
- Navigation may become a narrow side rail
- Focused viewer can retain a provenance side panel

### Desktop web

- Maximum-width media stage, not a stretched mobile feed
- Left rail for Scroll/navigation, center for artifact, right contextual rail on demand
- Keyboard shortcuts for next/previous, save, open context, and branch
- Hover reveals supplemental controls but never creates hover-only functionality

## 14. Trust and Provenance Pattern

Trust is represented as a compact stack beneath or beside the artifact:

**Institution/source mark · Open status · AI-enrichment mark when applicable**

Rules:

- The source record is visually primary to AI context.
- AI summaries include a subtle **Generated context** label.
- Translations name the source language.
- Inferred dates, entities, and topics are never presented as original catalog metadata.
- Tapping the trust stack opens a consistent provenance sheet across every medium.

## 15. Personalization Controls

Preferences use words and spatial controls rather than exposed numbers.

- Familiar ↔ Surprise me
- Quick discoveries ↔ Deep dives
- Current ↔ Mixed ↔ Historical
- Strong / Normal / Occasional / Exclude for topics

Each control includes an accessible text value and immediate preview of its effect. Changes are reversible and do not erase explicit topic selections.

## 16. Anti-Patterns

Do not use:

- Endless auto-pagination without session markers
- Autoplay with sound
- Engagement streaks, points, badges, or scarcity
- Like counts, popularity counts, comments, or follower pressure
- Login, sign-up, profile, recovery, or cloud-sync prompts
- Upload, submit, publish, post, comment, collaborate, follow, or public-profile controls
- Public Scrolls, public collections, user-created feeds, or user-submitted recommendation recipes
- Floating explanatory paragraphs over media
- Generic cards that make every medium look identical
- Multiple competing accent colors
- Carousels nested inside vertically scrolling cards
- Hidden provenance or euphemistic rights language
- Tooltips as the only way to understand a critical control
- Flags as language selectors
- Decorative cultural stereotypes
- AI-generated replacement images for unavailable artifacts

## 17. Usability Test Priorities

Test the following before visual polish is considered complete:

1. Can a first-time user create a Morocco Scroll without instruction?
2. Can the user predict what the branch icon will do?
3. Can the user save, undo, and add an item to a collection?
4. Can the user find why an item appeared and adjust that signal?
5. Can the user determine the license and allowed reuse without legal expertise?
6. Can the user distinguish source metadata from translation and AI context?
7. Can screen-reader and keyboard users consume and navigate every core medium?
8. Does the 25-item stopping point feel supportive rather than interruptive?
9. Do Arabic and right-to-left flows feel native rather than mirrored afterthoughts?
10. Does a cultural Scroll represent local voices and institutions visibly enough?
11. Does a user understand that saves live on this device and know how to export them without the disclosure feeling alarming?
12. Can a user recover gracefully when storage is full, blocked, cleared, corrupted, or temporary?
13. Can a user distinguish sharing a canonical source link from publishing personal material, and is publishing impossible from every consumer surface?

## 18. Design Acceptance Criteria

The design is ready for implementation when:

- The Interest → Topics → Build → Feed → Branch flow works without a tutorial.
- Every screen has one visually dominant purpose.
- At least nine media types have genuinely medium-specific presentations.
- Persistent chrome occupies minimal space and yields to focused consumption.
- All nonstandard icons have a first-use learning and persistent accessible label strategy.
- Rights, provenance, and recommendation reasoning are reachable from every object in one gesture.
- Explicit personalization is easy to inspect and edit.
- The session has a humane completion moment.
- Light, dark, reduced-motion, dynamic-type, keyboard, screen-reader, and RTL states are specified.
- The interface contains no social validation or compulsion mechanics.
- Every consumer flow works without identity, registration, login, or cloud sync.
- Local persistence, export/import, private browsing, quota, and data-loss states are fully designed.
- No consumer surface or flow permits user-generated content, public collections, public Scrolls, annotations, or publishing.

## 19. Initial Prototype Scope

The first high-fidelity prototype should cover seven connected mobile states:

1. Interest entry
2. Morocco topic selection
3. Scroll-building state
4. Mixed-media feed with image, audio, archival, data, and text cards
5. Focused audio or image viewer
6. Explore Gnawa branch sheet
7. Why this / Why open provenance sheets

The prototype should use realistic open-source metadata and media references, not generic placeholders. It should test the interaction model and visual quietness before expanding into all navigation roots.

## 20. Design North Star

When OpenScroll is working, the user remembers the photograph, voice, map, manuscript, idea, or unexpected connection they discovered. They do not remember fighting the interface.
