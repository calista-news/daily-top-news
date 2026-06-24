const Parser = require('rss-parser');

const FEEDS = [
  { name: 'BBC World',          url: 'https://feeds.bbci.co.uk/news/world/rss.xml',      category: 'politics' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss',            category: 'politics' },
  { name: 'BBC Business',       url: 'https://feeds.bbci.co.uk/news/business/rss.xml',   category: 'business' },
  { name: 'Guardian Business',  url: 'https://www.theguardian.com/uk/business/rss',      category: 'business' },
  { name: 'BBC Technology',     url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech' },
  { name: 'Guardian Tech',      url: 'https://www.theguardian.com/uk/technology/rss',    category: 'tech' },
];

const parser = new Parser({
  timeout: 5000,
  headers: { 'User-Agent': 'Mozilla/5.0 (DailyTopNews PWA)' },
});

function cleanSnippet(text) {
  return String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 170);
}

async function translateToZh(text) {
  if (!text) return '';
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' + encodeURIComponent(text);
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const data = await r.json();
      const zh = (data[0] || []).map((seg) => seg[0]).join('');
      if (zh) return zh.trim();
    }
  } catch (e) {}
  try {
    const url = 'https://api.mymemory.translated.net/get?langpair=en|zh-CN&q=' + encodeURIComponent(text.slice(0, 480));
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const data = await r.json();
      const zh = data && data.responseData && data.responseData.translatedText;
      if (zh) return String(zh).trim();
    }
  } catch (e) {}
  return '';
}

async function fetchFeed(feed) {
  const data = await parser.parseURL(feed.url);
  return (data.items || []).slice(0, 4).map((item) => ({
    title: (item.title || '(无标题)').trim(),
    link: item.link || '#',
    source: feed.name,
    category: feed.category,
    isoDate: item.isoDate || item.pubDate || null,
    snippet: cleanSnippet(item.contentSnippet || item.summary || item.content),
  }));
}

module.exports = async (req, res) => {
  try {
    const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
    const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    const byCat = {};
    for (const item of all) (byCat[item.category] ||= []).push(item);
    for (const k in byCat) byCat[k].sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0));

    const cats = ['politics', 'business', 'tech'].filter((c) => byCat[c]);
    const picked = [];
    let i = 0;
    while (picked.length < 5 && cats.some((c) => byCat[c].length)) {
      const c = cats[i % cats.length];
      if (byCat[c].length) picked.push(byCat[c].shift());
      i++;
    }

    await Promise.all(
      picked.map(async (it) => {
        const [titleZh, snippetZh] = await Promise.all([
          translateToZh(it.title),
          translateToZh(it.snippet),
        ]);
        it.titleZh = titleZh;
        it.snippetZh = snippetZh;
      })
    );

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ updatedAt: new Date().toISOString(), count: picked.length, items: picked });
  } catch (err) {
    res.status(200).json({ updatedAt: new Date().toISOString(), count: 0, items: [], error: String((err && err.message) || err) });
  }
};
