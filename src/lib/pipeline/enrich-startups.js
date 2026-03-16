import { getContacts } from '../mocks/apollo.js';

async function searchNews(companyName) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `"${companyName}" news funding 2025 2026`, num: 5 }),
    });
    const data = await res.json();
    return (data.organic || []).slice(0, 3).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));
  } catch (e) {
    console.error(`News search failed for ${companyName}:`, e.message);
    return [];
  }
}

async function enrichStartup(startup) {
  const [contacts, recentNews] = await Promise.all([
    Promise.resolve(getContacts(startup.domain)),
    searchNews(startup.name),
  ]);

  const careerPageUrl = startup.domain ? `https://${startup.domain}/careers` : null;

  return {
    ...startup,
    contacts,
    recentNews,
    careerPageUrl,
  };
}

export async function enrichStartups({ categorizedStartups }) {
  const enrichBucket = async (bucket) => {
    const results = [];
    for (const startup of bucket) {
      results.push(await enrichStartup(startup));
    }
    return results;
  };

  const [exact, recommended, luck] = await Promise.all([
    enrichBucket(categorizedStartups.exact),
    enrichBucket(categorizedStartups.recommended),
    enrichBucket(categorizedStartups.luck),
  ]);

  return { exact, recommended, luck };
}
