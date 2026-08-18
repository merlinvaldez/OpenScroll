import { cleanString, deepFreeze, slug, unique } from "./utils.js";

export const TOPIC_DIMENSIONS = Object.freeze([
  { id: "arts-music", label: "Arts, Music & Acoustic Culture", icon: "music", color: "#ec4899" },
  { id: "history-roots", label: "History, Archives & Heritage", icon: "history", color: "#f59e0b" },
  { id: "architecture-places", label: "Architecture, Places & Geography", icon: "compass", color: "#10b981" },
  { id: "language-thought", label: "Language, Literature & Thought", icon: "languages", color: "#6366f1" },
  { id: "science-data", label: "Science, Data & Natural World", icon: "database", color: "#06b6d4" },
  { id: "living-culture", label: "Living Culture, Society & Craft", icon: "globe", color: "#8b5cf6" }
]);

const USER_AGENT = "OpenScroll/1.0 (https://github.com/merlinvaldez/OpenScroll; open-knowledge-mindmap)";

// Helper: safe fetch with timeout
async function safeFetch(url, options = {}, timeoutMs = 5000) {
  if (typeof fetch !== "function") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. RICH CURATED DOMAIN KNOWLEDGE BASE (High-speed & Offline Fallback)
// ---------------------------------------------------------------------------
const CURATED_GRAPHS = {
  jazz: {
    entity: { id: "Q8341", label: "Jazz", description: "Improvisational American musical art form rooted in African rhythms and blues", aliases: ["jazz music", "jazz genre"] },
    dimensions: [
      {
        dimensionId: "arts-music",
        dimensionLabel: "Styles, Movements & Subgenres",
        icon: "music",
        color: "#ec4899",
        topics: [
          { name: "Bebop", weight: 1, icon: "music", description: "Fast tempo, complex harmonies, and virtuosic improvisation developed in 1940s Harlem." },
          { name: "Cool Jazz & Modal Jazz", weight: 1, icon: "disc", description: "Subdued tones, linear melodic phrasing, and modal harmonies pioneered by Miles Davis." },
          { name: "Swing & Big Band Era", weight: 0.95, icon: "radio", description: "1930s dance orchestras featuring brass sections, syncopation, and driving rhythm sections." },
          { name: "Free Jazz & Avant-Garde", weight: 0.9, icon: "sparkles", description: "Radical departure from traditional chord structures, tempo constraints, and Western scales." },
          { name: "Jazz Fusion", weight: 0.85, icon: "zap", description: "Late-1960s synthesis of jazz improvisation with electric instruments, rock, and funk." }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "Key Figures, Masters & Innovators",
        icon: "sparkles",
        color: "#f59e0b",
        topics: [
          { name: "Miles Davis", weight: 1, icon: "user", description: "Trumpeter and bandleader who catalyzed Birth of the Cool, Hard Bop, and Kind of Blue." },
          { name: "John Coltrane", weight: 1, icon: "user", description: "Saxophonist whose harmonic intensity and spiritual works redefined modern jazz." },
          { name: "Thelonious Monk", weight: 0.95, icon: "user", description: "Pianist celebrated for unorthodox dissonances, angular melodies, and standard compositions." },
          { name: "Duke Ellington", weight: 0.9, icon: "user", description: "Composer and orchestra leader who elevated jazz to serious American art music." },
          { name: "Charlie Parker", weight: 0.9, icon: "user", description: "'Bird', legendary alto saxophonist and co-founder of the Bebop movement." }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Foundations, Theory & Core Mechanics",
        icon: "book-open",
        color: "#6366f1",
        topics: [
          { name: "Improvisation & Jam Sessions", weight: 1, icon: "mic", description: "Real-time collective and solo musical invention over harmonic chord progressions." },
          { name: "Blue Notes & Microtonality", weight: 0.95, icon: "music", description: "Flatted thirds, fifths, and sevenths inflecting African oral traditions." },
          { name: "Syncopation & Swing Feel", weight: 0.9, icon: "clock", description: "Off-beat rhythmic accentuation creating the propulsive forward momentum of swing." },
          { name: "Jazz Standards & Real Book", weight: 0.85, icon: "file-text", description: "Canon of shared chord progressions, show tunes, and compositions." }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Geographic Hubs & Cultural Sites",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: "New Orleans French Quarter", weight: 1, icon: "compass", description: "Cradle of jazz where brass marching bands, blues, and Creole traditions converged." },
          { name: "Harlem Renaissance & 52nd Street", weight: 0.95, icon: "landmark", description: "Manhattan jazz clubs (Minton's Playhouse, Birdland) fostering postwar bebop." },
          { name: "Montreux & Village Vanguard", weight: 0.9, icon: "map-pin", description: "Historic performance basements and international festivals preserving acoustic jazz." }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Masterpieces, Archives & Sound Recording",
        icon: "archive",
        color: "#06b6d4",
        topics: [
          { name: "Blue Note Records Archives", weight: 1, icon: "archive", description: "Iconic label known for Rudy Van Gelder acoustics and Francis Wolff photography." },
          { name: "Kind of Blue Master Tapes", weight: 0.95, icon: "disc", description: "1959 recording landmark representing the zenith of modal jazz." },
          { name: "Saxophone & Brass Acoustics", weight: 0.85, icon: "volume-2", description: "Acoustic resonance, timbre manipulation, and microphonic techniques in jazz." }
        ]
      }
    ]
  },
  "ancient egypt": {
    entity: { id: "Q11768", label: "Ancient Egypt", description: "Nile Valley civilization spanning three millennia of pharaohs, monuments, and papyrus texts", aliases: ["Egyptology", "Kemet", "Pharaonic Egypt"] },
    dimensions: [
      {
        dimensionId: "history-roots",
        dimensionLabel: "Dynasties, Eras & Imperial History",
        icon: "history",
        color: "#f59e0b",
        topics: [
          { name: "Old Kingdom & Pyramid Age", weight: 1, icon: "landmark", description: "3rd–6th Dynasties of monument building, solar theology, and central statecraft." },
          { name: "New Kingdom Imperial Era", weight: 1, icon: "crown", description: "18th–20th Dynasties of military expansion, Valley of the Kings, and golden treasures." },
          { name: "Amarna Period & Akhenaten", weight: 0.95, icon: "sun", description: "Monotheistic revolution dedicated to the Aten and radical naturalistic art." },
          { name: "Ptolemaic Dynasty & Alexandria", weight: 0.9, icon: "book-open", description: "Hellenistic era merging Greek administration with Egyptian temples and Rosetta Stone." }
        ]
      },
      {
        dimensionId: "arts-music",
        dimensionLabel: "Pharaohs, Queens & Key Figures",
        icon: "sparkles",
        color: "#ec4899",
        topics: [
          { name: "Tutankhamun", weight: 1, icon: "user", description: "Boy king whose intact tomb revealed the unmatched splendor of New Kingdom goldwork." },
          { name: "Hatshepsut", weight: 0.95, icon: "user", description: "Female pharaoh celebrated for architectural masterpieces at Deir el-Bahari and Punt trade." },
          { name: "Ramesses II", weight: 0.95, icon: "user", description: "Prolific builder of Abu Simbel and Ramesseum, sovereign of the Battle of Kadesh." },
          { name: "Imhotep", weight: 0.9, icon: "user", description: "Architect of the Saqqara Step Pyramid, revered as father of monumental stone masonry." }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Hieroglyphs, Papyrus & Mythos",
        icon: "languages",
        color: "#6366f1",
        topics: [
          { name: "Hieroglyphs & Papyrus Scrolls", weight: 1, icon: "file-text", description: "Sacred pictographic writing system and reed paper recording religious rituals." },
          { name: "Book of the Dead & Underworld", weight: 1, icon: "book", description: "Funerary spells and vignettes guiding the deceased through Osiris's hall of judgment." },
          { name: "Nile Inundation & Agriculture", weight: 0.9, icon: "droplets", description: "Annual flood cycles (Akhet) fertilizing black silt and governing the solar calendar." },
          { name: "Mummification & Canopic Rituals", weight: 0.85, icon: "shield", description: "Complex embalming preservation of the body for the Ka and Ba in eternity." }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Monuments, Necropolises & Sites",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: "Giza Necropolis & Great Sphinx", weight: 1, icon: "landmark", description: "Khufu, Khafre, and Menkaure pyramids oriented precisely to cardinal astronomy." },
          { name: "Valley of the Kings & Luxor", weight: 0.95, icon: "map-pin", description: "Subterranean cliff tombs in western Thebes painted with vivid mythological frescoes." },
          { name: "Karnak Temple Complex", weight: 0.9, icon: "columns", description: "Vast hypostyle hall dedicated to Amun-Ra, developed over 1,500 years." }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Artifacts, Astronomy & Excavation",
        icon: "archive",
        color: "#06b6d4",
        topics: [
          { name: "Rosetta Stone", weight: 1, icon: "file-text", description: "Trilingual stele (Hieroglyphic, Demotic, Greek) that unlocked decipherment in 1822." },
          { name: "Egyptian Astronomical Decans", weight: 0.9, icon: "sparkles", description: "Star charts and constellations painted on sarcophagus lids to mark nocturnal hours." },
          { name: "Goldwork & Lapis Lazuli Craft", weight: 0.85, icon: "gem", description: "Ancient metallurgy, faience glazing, and semi-precious stone inlays." }
        ]
      }
    ]
  },
  "quantum physics": {
    entity: { id: "Q944", label: "Quantum Mechanics", description: "Fundamental theory in physics describing nature at the scale of atoms and subatomic particles", aliases: ["quantum physics", "quantum theory"] },
    dimensions: [
      {
        dimensionId: "science-data",
        dimensionLabel: "Core Principles & Mechanics",
        icon: "database",
        color: "#06b6d4",
        topics: [
          { name: "Wave-Particle Duality", weight: 1, icon: "activity", description: "Matter and light exhibiting both wave-like interference and particle-like localization." },
          { name: "Quantum Superposition", weight: 1, icon: "layers", description: "A quantum system existing in a linear combination of multiple states simultaneously." },
          { name: "Quantum Entanglement", weight: 1, icon: "share-2", description: "Non-local correlation between entangled particles regardless of spatial separation." },
          { name: "Heisenberg Uncertainty Principle", weight: 0.95, icon: "gauge", description: "Fundamental limit on the precision with which complementary variables can be known." },
          { name: "Quantum Tunneling", weight: 0.9, icon: "arrow-right-circle", description: "Particles penetrating energy barriers higher than their classical kinetic energy." }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "Founders & Seminal Experiments",
        icon: "history",
        color: "#f59e0b",
        topics: [
          { name: "Double-Slit Experiment", weight: 1, icon: "eye", description: "Foundational demonstration that unobserved single particles produce interference patterns." },
          { name: "Max Planck & Blackbody Radiation", weight: 0.95, icon: "user", description: "1900 postulate that energy is emitted in discrete packets (quanta) with Planck constant h." },
          { name: "Erwin Schrödinger & Wave Mechanics", weight: 0.95, icon: "user", description: "Schrödinger wave equation describing state evolution, and the famous cat paradox." },
          { name: "Niels Bohr & Copenhagen School", weight: 0.9, icon: "user", description: "Complementarity principle and probabilistic collapse upon wave function measurement." },
          { name: "Richard Feynman & Quantum Electrodynamics", weight: 0.85, icon: "user", description: "Path integral formulation and Feynman diagram visualizations of particle interactions." }
        ]
      },
      {
        dimensionId: "arts-music",
        dimensionLabel: "Modern Frontiers & Computing",
        icon: "cpu",
        color: "#ec4899",
        topics: [
          { name: "Quantum Computing & Qubits", weight: 1, icon: "cpu", description: "Harnessing superposition and entanglement to solve computational problems exponentially faster." },
          { name: "Superconducting Transmon Qubits", weight: 0.9, icon: "zap", description: "Josephson junction microchips operating at millikelvin temperatures." },
          { name: "Quantum Cryptography & QKD", weight: 0.85, icon: "lock", description: "Unconditionally secure communication guaranteed by quantum no-cloning theorem." }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Interpretations & Philosophy of Reality",
        icon: "brain",
        color: "#6366f1",
        topics: [
          { name: "Many-Worlds Interpretation", weight: 0.95, icon: "git-branch", description: "Everettian quantum mechanics proposing all possible alternate histories are real." },
          { name: "Quantum Decoherence & Measurement", weight: 0.9, icon: "minimize-2", description: "Interaction with the thermal environment causing irreversible loss of quantum phase." },
          { name: "Bell's Theorem & Local Realism", weight: 0.9, icon: "scale", description: "Mathematical proof that no physical theory of local hidden variables can reproduce QM." }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Particle Colliders & Global Labs",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: "CERN Large Hadron Collider", weight: 1, icon: "landmark", description: "27km particle accelerator in Geneva discovering the Higgs boson and probing fields." },
          { name: "Institute for Advanced Study (Princeton)", weight: 0.9, icon: "compass", description: "Intellectual sanctuary where Einstein, Gödel, and Oppenheimer debated field theories." }
        ]
      }
    ]
  },
  renaissance: {
    entity: { id: "Q4692", label: "The Renaissance", description: "Fervent period of European cultural, artistic, political and economic rebirth spanning the 14th to 17th centuries", aliases: ["Rinascimento", "High Renaissance", "Early Modern Europe"] },
    dimensions: [
      {
        dimensionId: "arts-music",
        dimensionLabel: "Masters, Painters & Polymaths",
        icon: "sparkles",
        color: "#ec4899",
        topics: [
          { name: "Leonardo da Vinci", weight: 1, icon: "user", description: "Painter of Mona Lisa, inventor, anatomical draughtsman, and quintessential Renaissance polymath." },
          { name: "Michelangelo Buonarroti", weight: 1, icon: "user", description: "Sculptor of David and Pietà, master architect of St. Peter's Dome and Sistine frescoes." },
          { name: "Raphael Sanzio", weight: 0.95, icon: "user", description: "Master of harmonious composition and humanist clarity in The School of Athens." },
          { name: "Sandro Botticelli", weight: 0.9, icon: "user", description: "Florentine master of lyrical mythological allegories including The Birth of Venus." },
          { name: "Albrecht Dürer", weight: 0.85, icon: "user", description: "Northern Renaissance printmaker whose master woodcuts revolutionized European graphics." }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Humanism, Philosophy & Classical Revival",
        icon: "book-open",
        color: "#6366f1",
        topics: [
          { name: "Renaissance Humanism", weight: 1, icon: "book", description: "Intellectual movement centered on individual agency, classical Latin scholarship, and eloquence." },
          { name: "Linear Perspective & Brunelleschi", weight: 1, icon: "maximize-2", description: "Mathematical invention of vanishing point perspective creating illusionistic 3D depth." },
          { name: "Chiaroscuro & Sfumato", weight: 0.9, icon: "palette", description: "Smoky tonal transitions and dramatic contrasts of light and shadow in oil painting." },
          { name: "Gutenberg Movable Type Revolution", weight: 0.9, icon: "file-text", description: "Printing press democratizing classical treatises, scientific discoveries, and literature." }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Florentine Hubs, Palaces & Cities",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: "Florence Duomo & Uffizi", weight: 1, icon: "landmark", description: "Heart of the Medici patronage and Brunelleschi's magnificent brick octagonal dome." },
          { name: "Vatican Sistine Chapel", weight: 0.95, icon: "columns", description: "High Renaissance papal seat decorated with Michelangelo's Genesis and Last Judgment." },
          { name: "Venetian Renaissance Workshops", weight: 0.9, icon: "compass", description: "Titian and Bellini luminous colorism inspired by Adriatic maritime light and trade." }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "Movements, Eras & Medici Dynasties",
        icon: "history",
        color: "#f59e0b",
        topics: [
          { name: "Italian Early Renaissance (Quattrocento)", weight: 1, icon: "history", description: "15th-century rebirth of naturalism in Donatello's sculpture and Masaccio's frescoes." },
          { name: "High Renaissance Peak (1490–1527)", weight: 1, icon: "crown", description: "Period of supreme technical mastery in Rome and Florence preceding the 1527 Sack of Rome." },
          { name: "Medici Bank & Patronage Networks", weight: 0.9, icon: "landmark", description: "Florentine banking dynasty financing humanist academies, libraries, and public arts." }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Anatomy, Astronomy & Scientific Revolution",
        icon: "database",
        color: "#06b6d4",
        topics: [
          { name: "Vesalius De Humani Corporis Fabrica", weight: 0.95, icon: "file-text", description: "1543 anatomical treatise directly correcting Galen through empirical human dissection." },
          { name: "Copernican Heliocentrism", weight: 0.9, icon: "sun", description: "Revolutionary astronomical model placing the Sun at the center of celestial orbits." }
        ]
      }
    ]
  },
  morocco: {
    entity: { id: "Q1028", label: "Morocco", description: "Sovereign country in Northwestern Africa with centuries of Arab, Berber, and Andalusian heritage", aliases: ["المغرب", "Maroc", "Marruecos", "Kingdom of Morocco"] },
    dimensions: [
      {
        dimensionId: "arts-music",
        dimensionLabel: "Arts, Music & Acoustic Traditions",
        icon: "music",
        color: "#ec4899",
        topics: [
          { name: "Gnawa Spiritual Traditions", weight: 1, icon: "music", description: "Sufi trance healing ceremonies driven by the deep acoustic resonance of the guembri lute and qraqeb metal castanets." },
          { name: "Andalusian Classical Music (Al-Ala)", weight: 1, icon: "disc", description: "Historic Arab-Andalusian orchestral suites preserved in Fez and Tetouan since the 13th century." },
          { name: "Amazigh Berber Rug Weaving", weight: 0.95, icon: "palette", description: "Indigenous geometric symbolism woven into wool textiles across Atlas mountain tribal confederations." },
          { name: "Ahwash Collective Performance", weight: 0.85, icon: "music", description: "Polyrhythmic village dance and sung poetry of the High and Anti-Atlas mountains." }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "Dynasties, Archives & Historic Treaties",
        icon: "history",
        color: "#f59e0b",
        topics: [
          { name: "Marinid Dynasty & Madrasas", weight: 1, icon: "book-open", description: "13th–15th century zenith of intellectual scholarship, carved stucco madrasas, and library endowments." },
          { name: "Treaty of Peace and Friendship (1786)", weight: 0.95, icon: "file-text", description: "Historic accord signed by Sultan Mohammed III and Thomas Jefferson, America's oldest unbroken treaty." },
          { name: "Volubilis Roman Archaeological Site", weight: 0.9, icon: "landmark", description: "Ancient Berber-Roman imperial outpost renowned for intact mythological floor mosaics." },
          { name: "Almoravid & Almohad Architecture", weight: 0.85, icon: "shield", description: "Monumental stone minarets (Koutoubia, Hassan Tower, Giralda) spanning Morocco and al-Andalus." }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Medinas, Ksars & Geography",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: "Medina of Fez (Fes el-Bali)", weight: 1, icon: "compass", description: "UNESCO World Heritage site and the world's largest contiguous car-free historic urban zone." },
          { name: "Ait Benhaddou Earthen Ksar", weight: 1, icon: "landmark", description: "Iconic fortified clay and rammed earth architecture in the Ouarzazate river valley." },
          { name: "Zellij Geometric Tilework", weight: 0.95, icon: "palette", description: "Hand-chiseled terracotta tesserae arranged into intricate non-repeating Islamic geometric patterns." },
          { name: "High Atlas Mountain Passes", weight: 0.85, icon: "mountain", description: "Tizi n'Tichka trade corridors connecting Mediterranean fertile valleys with Saharan caravan routes." }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Languages, Manuscripts & Explorers",
        icon: "languages",
        color: "#6366f1",
        topics: [
          { name: "Darija & Multilingual Dialects", weight: 1, icon: "languages", description: "Unique Moroccan Arabic dialect blending Semitic grammar with Amazigh, French, and Spanish vocabularies." },
          { name: "Tamazight & Tifinagh Script", weight: 0.95, icon: "languages", description: "Official indigenous North African language written in ancient geometric Tifinagh characters." },
          { name: "Ibn Battuta Rihla Travelogues", weight: 0.9, icon: "book-open", description: "14th-century Tangier scholar whose 73,000-mile journey across Africa and Asia spanned three decades." }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Biospheres, Universities & Maps",
        icon: "database",
        color: "#06b6d4",
        topics: [
          { name: "University of al-Qarawiyyin", weight: 1, icon: "graduation-cap", description: "Founded in 859 AD by Fatima al-Fihri, recognized by UNESCO as the oldest continually operating university." },
          { name: "Argan Endemic Ecosystem", weight: 0.9, icon: "tree-pine", description: "UNESCO Biosphere Reserve where endemic Argania spinosa trees stabilize arid desert boundaries." },
          { name: "Historical Cartography of the Maghreb", weight: 0.85, icon: "map", description: "16th–18th century open cartographic surveys of North African ports, mountain passes, and desert trade routes." }
        ]
      }
    ]
  }
};

// Aliases lookup table
const CURATED_ALIASES = {
  "ancient-egypt": "ancient egypt",
  "egypt": "ancient egypt",
  "pharaohs": "ancient egypt",
  "quantum": "quantum physics",
  "quantum-computing": "quantum physics",
  "quantum mechanics": "quantum physics",
  "physics": "quantum physics",
  "renaissance art": "renaissance",
  "renaissance-art": "renaissance",
  "italian renaissance": "renaissance",
  "maroc": "morocco",
  "moroccan": "morocco"
};

// ---------------------------------------------------------------------------
// 2. LIVE WIKIPEDIA & WIKIDATA SEMANTIC TOPIC DISCOVERY ENGINE
// ---------------------------------------------------------------------------
export async function extractSemanticTopicsLive(query) {
  const cleanQ = cleanString(query, 100);
  if (!cleanQ) return null;

  const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQ + " culture history")}&gsrlimit=16&prop=extracts|pageprops&exintro=1&explaintext=1&format=json&origin=*`;
  const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQ)}&limit=10&namespace=0&format=json&origin=*`;
  const mainArticleUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanQ)}&prop=extracts|links|pageprops&pllimit=60&exintro=1&explaintext=1&format=json&origin=*`;

  const [searchRes, openRes, mainRes] = await Promise.all([
    safeFetch(wikiSearchUrl),
    safeFetch(opensearchUrl),
    safeFetch(mainArticleUrl)
  ]);

  const searchPages = Object.values(searchRes?.query?.pages || {});
  const mainPage = Object.values(mainRes?.query?.pages || {})[0];
  const suggestions = (openRes?.[1] || []).filter((s) => !s.toLowerCase().includes("(disambiguation)"));
  const outboundLinks = (mainPage?.links || []).map((l) => l.title);

  const noiseFilters = [
    /team|airline|wrestler|transgender|company|corporation|album|film\)/i,
    /^\d{4}/,
    /century/i,
    /^(Wikipedia|Template|Portal|File|Category|List of|Index of|Outline of):/i,
    /disambiguation/i
  ];

  function isEligibleTopic(title) {
    if (!title || title.length < 3) return false;
    return !noiseFilters.some((rx) => rx.test(title));
  }

  const collected = [];
  const seen = new Set([cleanQ.toLowerCase()]);

  // 1. Add search results with extracts
  searchPages.forEach((p) => {
    if (isEligibleTopic(p.title) && !seen.has(p.title.toLowerCase())) {
      seen.add(p.title.toLowerCase());
      collected.push({
        id: slug(p.title),
        name: p.title,
        description: p.extract ? p.extract.slice(0, 140) + "..." : `Key subject related to ${cleanQ}`,
        weight: 1
      });
    }
  });

  // 2. Add high-relevance outbound links from the root page
  outboundLinks.filter(isEligibleTopic).slice(0, 15).forEach((title) => {
    if (!seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      collected.push({
        id: slug(title),
        name: title,
        description: `Direct conceptual branch of ${cleanQ}`,
        weight: 0.9
      });
    }
  });

  // 3. Add suggestions from opensearch
  suggestions.filter(isEligibleTopic).forEach((title) => {
    if (!seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      collected.push({
        id: slug(title),
        name: title,
        description: `Topical exploration path for ${cleanQ}`,
        weight: 0.85
      });
    }
  });

  if (collected.length < 4) return null;

  // Categorize dynamically into 5 dimensions
  const dims = [
    { dimensionId: "arts-music", dimensionLabel: "Movements, Styles & Culture", icon: "sparkles", color: "#ec4899", topics: [] },
    { dimensionId: "history-roots", dimensionLabel: "History, Eras & Figures", icon: "history", color: "#f59e0b", topics: [] },
    { dimensionId: "language-thought", dimensionLabel: "Foundations & Core Principles", icon: "book-open", color: "#6366f1", topics: [] },
    { dimensionId: "architecture-places", dimensionLabel: "Sites, Hubs & Material World", icon: "compass", color: "#10b981", topics: [] },
    { dimensionId: "science-data", dimensionLabel: "Archives, Artifacts & Research", icon: "database", color: "#06b6d4", topics: [] }
  ];

  collected.forEach((item, index) => {
    const targetDim = dims[index % dims.length];
    targetDim.topics.push({
      ...item,
      dimensionId: targetDim.dimensionId,
      dimensionLabel: targetDim.dimensionLabel,
      icon: targetDim.icon
    });
  });

  return dims.filter((d) => d.topics.length > 0);
}

// ---------------------------------------------------------------------------
// 3. GRAPH TOPOLOGY & MINDMAP BUILDER
// ---------------------------------------------------------------------------
export function buildMindmapTopology(rootQuery, entity, dimensions) {
  const rootNode = {
    id: "root",
    label: entity?.label || rootQuery,
    type: "root",
    icon: "sparkles",
    color: "#6366f1",
    description: entity?.description || `Interactive knowledge mindmap for ${rootQuery}`
  };

  const clusters = dimensions.map((dim) => ({
    id: dim.dimensionId,
    label: dim.dimensionLabel,
    icon: dim.icon,
    color: dim.color,
    nodeIds: dim.topics.map((t) => slug(t.name))
  }));

  const nodes = [];
  const edges = [];

  // Add root node to graph
  nodes.push({
    id: "root",
    name: rootNode.label,
    label: rootNode.label,
    type: "root",
    dimensionId: "root",
    dimensionLabel: "Central Topic",
    description: rootNode.description,
    icon: "sparkles",
    weight: 1.5,
    selected: true,
    connections: dimensions.map((d) => d.dimensionId)
  });

  // Build cluster hub connections and leaf nodes
  dimensions.forEach((dim) => {
    // Edge from root to dimension cluster
    edges.push({
      id: `edge:root->${dim.dimensionId}`,
      source: "root",
      target: dim.dimensionId,
      label: dim.dimensionLabel,
      weight: 1
    });

    dim.topics.forEach((topic, idx) => {
      const nodeId = slug(topic.name);
      
      // Edge from dimension to node
      edges.push({
        id: `edge:${dim.dimensionId}->${nodeId}`,
        source: dim.dimensionId,
        target: nodeId,
        label: "branch",
        weight: topic.weight || 0.9
      });

      // Add cross-edge to neighbor within cluster for richer graph
      if (idx > 0) {
        const prevNodeId = slug(dim.topics[idx - 1].name);
        edges.push({
          id: `edge:${prevNodeId}<->${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          label: "related",
          weight: 0.5
        });
      }

      nodes.push({
        id: nodeId,
        name: topic.name,
        label: topic.name,
        type: "concept",
        dimensionId: dim.dimensionId,
        dimensionLabel: dim.dimensionLabel,
        description: topic.description,
        icon: topic.icon || dim.icon,
        color: dim.color,
        weight: topic.weight || 0.9,
        selected: idx < 2, // preselect high priority
        connections: ["root", dim.dimensionId]
      });
    });
  });

  return {
    root: rootNode,
    clusters,
    nodes,
    edges,
    totalNodes: nodes.length,
    totalEdges: edges.length
  };
}

// ---------------------------------------------------------------------------
// 4. OPENAI KNOWLEDGE GRAPH GENERATOR (Optional Cloud AI Provider)
// ---------------------------------------------------------------------------
export async function generateMindmapWithOpenAI(query, apiKey, model = process.env.OPENAI_MODEL || "gpt-4o") {
  if (!apiKey || typeof fetch !== "function") return null;

  const prompt = `You are a world-class curator of human knowledge, culture, arts, and science.
Analyze the concept "${query}" and generate an interconnected semantic knowledge graph across 5 distinct dimensions.

Return a JSON object with this exact structure:
{
  "entity": {
    "label": "Canonical Name of Concept",
    "description": "Engaging 1-2 sentence overview of the concept and its global significance.",
    "aliases": ["Alternative Name 1", "Alternative Name 2"]
  },
  "dimensions": [
    {
      "dimensionId": "arts-music",
      "dimensionLabel": "Styles, Movements & Creative Arts",
      "icon": "sparkles",
      "color": "#ec4899",
      "topics": [
        { "name": "Specific Movement/Style", "description": "1 sentence explanation of this concept.", "weight": 1.0, "icon": "palette" }
      ]
    },
    {
      "dimensionId": "history-roots",
      "dimensionLabel": "Key Figures, Masters & Heritage",
      "icon": "history",
      "color": "#f59e0b",
      "topics": [
        { "name": "Specific Key Person or Epoch", "description": "1 sentence explanation.", "weight": 1.0, "icon": "user" }
      ]
    },
    {
      "dimensionId": "language-thought",
      "dimensionLabel": "Foundations, Theory & Core Mechanics",
      "icon": "book-open",
      "color": "#6366f1",
      "topics": [
        { "name": "Specific Fundamental Principle", "description": "1 sentence explanation.", "weight": 1.0, "icon": "brain" }
      ]
    },
    {
      "dimensionId": "architecture-places",
      "dimensionLabel": "Geographic Hubs & Cultural Sites",
      "icon": "compass",
      "color": "#10b981",
      "topics": [
        { "name": "Specific Historic Hub/Site", "description": "1 sentence explanation.", "weight": 1.0, "icon": "map-pin" }
      ]
    },
    {
      "dimensionId": "science-data",
      "dimensionLabel": "Masterpieces, Archives & Empirical Data",
      "icon": "archive",
      "color": "#06b6d4",
      "topics": [
        { "name": "Specific Masterpiece/Archive", "description": "1 sentence explanation.", "weight": 1.0, "icon": "archive" }
      ]
    }
  ]
}
Each dimension MUST have 3 to 5 real, accurate, and deeply relevant conceptual nodes. Avoid generic placeholders. Return valid JSON only.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a specialized semantic knowledge graph engine. Output JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. ENTITY RESOLUTION & COMPREHENSIVE MINDMAP EXPORT
// ---------------------------------------------------------------------------
export async function resolveEntity(query, options = {}) {
  const clean = cleanString(query, 120).toLowerCase();
  if (!clean) return null;

  const key = CURATED_ALIASES[clean] || clean;
  if (CURATED_GRAPHS[key]) {
    return deepFreeze(CURATED_GRAPHS[key].entity);
  }

  // Live Wikidata search
  if (options.useLiveApi !== false && typeof fetch === "function") {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&limit=5`;
      const data = await safeFetch(url);
      if (data?.search?.length > 0) {
        const top = data.search[0];
        return {
          id: top.id,
          label: top.label,
          description: top.description || `Open knowledge domain relating to ${top.label}`,
          aliases: top.aliases || [top.label],
          canonicalUrl: `https://www.wikidata.org/wiki/${top.id}`
        };
      }
    } catch {
      // Clean fallback
    }
  }

  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    id: `Q-${slug(clean)}`,
    label: capitalized,
    description: `Knowledge domain and open cultural assets relating to ${capitalized}`,
    aliases: [capitalized, clean]
  };
}

export async function expandTopics(query, options = {}) {
  const clean = cleanString(query, 120).toLowerCase();
  const key = CURATED_ALIASES[clean] || clean;

  // 0. Check for OpenAI API Key in options or process.env
  const openaiApiKey = options.apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : null);
  const openaiModel = options.model || (typeof process !== "undefined" ? process.env?.OPENAI_MODEL : null) || "gpt-4o";

  if (openaiApiKey && options.useOpenAI !== false) {
    const aiData = await generateMindmapWithOpenAI(query, openaiApiKey, openaiModel);
    if (aiData && aiData.dimensions?.length) {
      const entity = {
        id: `AI-${slug(aiData.entity?.label || query)}`,
        label: aiData.entity?.label || query,
        description: aiData.entity?.description || `Knowledge graph relating to ${query}`,
        aliases: aiData.entity?.aliases || [query]
      };
      const dimensions = aiData.dimensions;
      const flatTopics = dimensions.flatMap((d) =>
        (d.topics || []).map((t) => ({ ...t, dimensionId: d.dimensionId, dimensionLabel: d.dimensionLabel, color: d.color }))
      );
      const mindmap = buildMindmapTopology(query, entity, dimensions);
      return {
        query,
        entity,
        dimensions,
        mindmap,
        flatTopics,
        count: flatTopics.length,
        source: `OpenAI (${openaiModel})`
      };
    }
  }

  const resolvedEntity = await resolveEntity(query, options);

  let dimensions = null;

  // 1. Check curated high-fidelity knowledge graphs
  if (CURATED_GRAPHS[key]) {
    dimensions = CURATED_GRAPHS[key].dimensions;
  }

  // 2. Try live semantic extraction from Wikipedia / Wikidata
  if (!dimensions && options.useLiveApi !== false) {
    dimensions = await extractSemanticTopicsLive(query);
  }

  // 3. Intelligent dynamic generator fallback
  if (!dimensions) {
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    dimensions = [
      {
        dimensionId: "arts-music",
        dimensionLabel: "Styles, Movements & Creative Arts",
        icon: "sparkles",
        color: "#ec4899",
        topics: [
          { name: `${capitalized} Movements & Aesthetics`, weight: 1, icon: "palette", description: `Major stylistic shifts, schools of thought, and creative expressions in ${capitalized}.` },
          { name: `${capitalized} Acoustic Traditions`, weight: 0.95, icon: "music", description: `Sonic heritage, recordings, and musical elements associated with ${capitalized}.` },
          { name: `${capitalized} Visual Heritage`, weight: 0.9, icon: "image", description: `Historic and contemporary imagery, iconography, and open visual works.` }
        ]
      },
      {
        dimensionId: "history-roots",
        dimensionLabel: "Key Figures, Pioneers & Masters",
        icon: "history",
        color: "#f59e0b",
        topics: [
          { name: `Pioneers of ${capitalized}`, weight: 1, icon: "user", description: `Seminal thinkers, creators, and leaders who defined ${capitalized}.` },
          { name: `Historic Eras of ${capitalized}`, weight: 0.95, icon: "clock", description: `Chronological periods, turning points, and foundational shifts.` },
          { name: `Primary Treatises & Manuscripts`, weight: 0.9, icon: "book-open", description: `Foundational writings, open access treatises, and historical archives.` }
        ]
      },
      {
        dimensionId: "language-thought",
        dimensionLabel: "Core Principles, Theory & Mechanics",
        icon: "book-open",
        color: "#6366f1",
        topics: [
          { name: `Theoretical Foundations of ${capitalized}`, weight: 1, icon: "file-text", description: `Essential concepts, working principles, and core vocabulary.` },
          { name: `Philosophy & Methodologies`, weight: 0.9, icon: "brain", description: `Conceptual frameworks and schools of thought underpinning ${capitalized}.` }
        ]
      },
      {
        dimensionId: "architecture-places",
        dimensionLabel: "Geographic Hubs, Sites & Architecture",
        icon: "compass",
        color: "#10b981",
        topics: [
          { name: `Historic Hubs & Geography`, weight: 1, icon: "compass", description: `Global centers, cities, and natural landscapes vital to ${capitalized}.` },
          { name: `Monuments & Material Spaces`, weight: 0.9, icon: "landmark", description: `Physical built environments, structures, and archaeological sites.` }
        ]
      },
      {
        dimensionId: "science-data",
        dimensionLabel: "Masterpieces, Archives & Collections",
        icon: "database",
        color: "#06b6d4",
        topics: [
          { name: `Open Access Masterpieces`, weight: 1, icon: "archive", description: `Curated public domain and CC-licensed artifacts from world museums.` },
          { name: `Research Archives & Datasets`, weight: 0.9, icon: "database", description: `Structured open data, statistical records, and scholarship.` }
        ]
      }
    ];
  }

  const flatTopics = dimensions.flatMap((d) =>
    d.topics.map((t) => ({
      ...t,
      dimensionId: d.dimensionId,
      dimensionLabel: d.dimensionLabel,
      color: d.color
    }))
  );

  const mindmap = buildMindmapTopology(query, resolvedEntity, dimensions);

  return deepFreeze({
    query,
    entity: resolvedEntity,
    dimensions,
    mindmap,
    flatTopics,
    count: flatTopics.length
  });
}

export function buildQueryPlan(entity, selectedTopics = [], locale = "en") {
  const entityLabel = entity?.label || "Open Knowledge";
  const topics = selectedTopics.length > 0 ? selectedTopics : ["Overview", "Culture", "History"];

  return deepFreeze({
    entityId: entity?.id || "Q-general",
    entityLabel,
    topics,
    locale,
    searchTerms: {
      wikimedia: unique([entityLabel, ...topics]),
      commons: unique([entityLabel, ...topics.slice(0, 3)]),
      openverse: unique([entityLabel, ...topics.slice(0, 3)]),
      culturalAggregators: unique([entityLabel, ...topics.slice(0, 4)])
    }
  });
}
