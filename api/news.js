// 后端接口：/api/news
// 作用：抓取欧美权威新闻源(RSS) → 按【国际时政 / 财经商业 / 科技AI】均衡挑选 5 条
// 只用 BBC + The Guardian（速度快、最稳定，避免接口超时）。目前不用 AI。

const Parser = require('rss-parser');

// ── 新闻源清单（按领域 category 分组）──
// category：'politics'(国际时政) / 'business'(财经商业) / 'tech'(科技AI)
const FEEDS = [
  { name: 'BBC World',          url: 'https://feeds.bbci.co.uk/news/world/rss.xml',      category: 'politics' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss',            category: 'politics' },
  { name: 'BBC Business',       url: 'https://feeds.bbci.co.uk/news/business/rss.xml',   category: 'business' },
  { name: 'Guardian Business',  url: 'https://www.theguardian.com/uk/business/rss',      category: 'business' },
  { name: 'BBC Technology',     url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech' },
  { name: 'Guardian Tech',      url: 'https://www.theguardian.com/uk/technology/rss',    category: 'tech' },
];

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'Mozilla/5.0 (DailyTopNews PWA)' },
});

function cleanSnippet(text) {
  return String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 170);
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

    // 按领域分组，每组内按时间从新到旧
    const byCat = {};
    for (const item of all) (byCat[item.category] ||= []).push(item);
    for (const k in byCat) byCat[k].sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0));

    // 轮流从各领域各取最新一条，保证 5 条均衡覆盖 时政/财经/科技
    const cats = ['politics', 'business', 'tech'].filter((c) => byCat[c]);
    const picked = [];
    let i = 0;
    while (picked.length < 5 && cats.some((c) => byCat[c].length)) {
      const c = cats[i % cats.length];
      if (byCat[c].length) picked.push(byCat[c].shift());
      i++;
    }

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: picked.length,
      items: picked,
    });
  } catch (err) {
    // 即使出错也返回 200 + 空列表，前端会显示“暂时没有新闻”而不是“加载失败”
    res.status(200).json({ updatedAt: new Date().toISOString(), count: 0, items: [], error: String((err && err.message) || err) });
  }
};
