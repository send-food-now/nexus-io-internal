const SERPER_API_URL = 'https://google.serper.dev/search';

// --- Mocked Apollo contacts ---
function getMockContacts(companyName) {
  const roles = ['CEO', 'CTO', 'VP Engineering', 'Head of Recruiting'];
  const firstNames = ['Alex', 'Jordan', 'Sam', 'Morgan'];
  const lastNames = ['Chen', 'Park', 'Patel', 'Kim'];

  return roles.slice(0, 2).map((title, i) => ({
    name: `${firstNames[i]} ${lastNames[i]}`,
    title,
    email: `${firstNames[i].toLowerCase()}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
  }));
}

async function searchSerper(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 3 }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.organic || [];
  } catch {
    return [];
  }
}

async function enrichSingle(startup) {
  const contacts = getMockContacts(startup.name);

  const [newsResults, careersResults] = await Promise.all([
    searchSerper(`"${startup.name}" recent funding news 2024 2025`),
    searchSerper(`"${startup.name}" careers jobs page`),
  ]);

  const recentNews = newsResults.length > 0
    ? { headline: newsResults[0].title, url: newsResults[0].link }
    : null;

  const careersUrl = careersResults.find((r) => r.link.includes('career') || r.link.includes('jobs'))?.link || null;

  // Heuristic: companies with H-1B1 history get higher immigrant workforce estimate
  const immigrantPct = startup.visaSponsored ? '15-25%' : '5-15%';

  return {
    ...startup,
    contacts,
    recentNews,
    careersUrl,
    immigrantPct,
  };
}

export async function enrichStartups(categorized) {
  const allStartups = [...categorized.exact, ...categorized.recommended, ...categorized.luck];
  const enriched = [];
  const concurrencyLimit = 5;

  // Process in batches
  for (let i = 0; i < allStartups.length; i += concurrencyLimit) {
    const batch = allStartups.slice(i, i + concurrencyLimit);
    const results = await Promise.all(batch.map(enrichSingle));
    enriched.push(...results);
  }

  // Re-bucket
  return {
    exact: enriched.filter((s) => s.category === 'exact'),
    recommended: enriched.filter((s) => s.category === 'recommended'),
    luck: enriched.filter((s) => s.category === 'luck'),
  };
}
