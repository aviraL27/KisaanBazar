import { Link, Route, Routes } from "react-router-dom";

function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">KisaanBazaar</p>
        <h1>Farmer-first marketplace with live mandi insights</h1>
        <p className="subtitle">
          Sell crops, buy faster, and track real-time mandi prices with transparent trends.
        </p>
      </section>
      <section className="grid">
        <article className="card">
          <h2>Listings</h2>
          <p>Farmers publish crop availability and buyers discover by crop, region, and quality.</p>
        </article>
        <article className="card">
          <h2>Orders</h2>
          <p>Track placed, confirmed, shipped, and delivered status in one workflow.</p>
        </article>
        <article className="card">
          <h2>Price Intelligence</h2>
          <p>Monitor mandi movements with 7, 30, and 90-day trends and anomaly highlights.</p>
        </article>
      </section>
    </main>
  );
}

function AboutPage() {
  return <main className="page"><h1>About</h1><p>V1 foundation is now ready for module implementation.</p></main>;
}

export function App() {
  return (
    <>
      <header className="topbar">
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </>
  );
}
