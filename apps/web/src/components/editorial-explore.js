"use client";

import { BookOpen, Compass, Globe2, Landmark, Music2, Sparkles, TreePine } from "lucide-react";

const FEATURED_JOURNEYS = [
  {
    id: "morocco-cultural-heritage",
    title: "Morocco: Medina, Music & Architecture",
    query: "Morocco",
    description: "From historic Fez medinas to sacred Gnawa acoustic traditions and earthen architecture.",
    icon: Globe2,
    badge: "Featured Culture",
    topics: ["Music", "Architecture", "History", "Darija"]
  },
  {
    id: "renaissance-astronomy",
    title: "Celestial Cartography & Early Science",
    query: "Astronomy",
    description: "Historical star charts, astrolabes, manuscript folios, and public domain observations.",
    icon: Sparkles,
    badge: "Open Science",
    topics: ["History", "Open data", "Architecture"]
  },
  {
    id: "ancient-silk-road",
    title: "The Ancient Silk Road: Arts & Trade",
    query: "Silk Road",
    description: "Centuries of cross-continental trade, textile crafts, manuscript illumination, and archaeological sites.",
    icon: Landmark,
    badge: "Archaeology",
    topics: ["History", "Culture", "Architecture"]
  },
  {
    id: "global-acoustic-traditions",
    title: "Global Acoustic & Oral Traditions",
    query: "Oral Tradition",
    description: "Archival ethnomusicology, field recordings, and polyphonic performance traditions.",
    icon: Music2,
    badge: "Sound Commons",
    topics: ["Music", "Culture", "History"]
  }
];

export function EditorialExplore({ onSelectJourney, messages, locale }) {
  return (
    <div className="editorial-explore-screen">
      <header className="explore-header">
        <h1>{messages.exploreNav}</h1>
        <p className="explore-subtitle">
          Curated gateways into the world's verifiably open knowledge commons
        </p>
      </header>

      <section className="explore-section">
        <h2>{messages.featuredJourneys}</h2>
        <div className="journeys-grid">
          {FEATURED_JOURNEYS.map((journey) => {
            const Icon = journey.icon;
            return (
              <article
                key={journey.id}
                className="journey-card"
                onClick={() => onSelectJourney(journey.query, journey.topics)}
                tabIndex="0"
              >
                <div className="journey-card-header">
                  <span className="journey-badge">{journey.badge}</span>
                  <Icon size={24} className="journey-icon" aria-hidden="true" />
                </div>
                <h3 dir="auto">{journey.title}</h3>
                <p dir="auto">{journey.description}</p>
                <div className="journey-card-footer">
                  <button type="button" className="journey-start-btn">
                    <span>{messages.startJourney}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
