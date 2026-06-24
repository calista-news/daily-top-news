// 后端接口：/api/news
// 作用：抓取多个权威新闻源(RSS) → 各取最新一条 → 凑成每天 5 条返回给前端
// 这是“挑选 5 条新闻”的核心逻辑，目前不用 AI。以后想升级见文件底部的“升级提示”。

const Parser = require('rss-parser');

// ── 新闻源清单（中英混合，覆盖 时政 / 财经 / 科技）──
// 想增删新闻源，直接改这个数组即可。lang 只用于前端显示语言标签。
const FEEDS = [
  { name: 'BBC 中文',       url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', lang: 'zh' },
  { name: 'BBC World',      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',    lang: 'en' },
  { name: 'BBC Business',   url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en' },
  { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', lang: 'en' },
  { name: 'The Guardian',   url: 'https://www.theguardian.com/world/rss',          lang: 'en' },
];

const parser = new Parser({
  timeout: 9000,
  headers: { 'User-Agent': 'Mozilla/5.0 (DailyTopNews PWA)' },
});

function cleanSnippet(text) {
  return String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function fetchFeed(feed) {
  const data = await parser.parseURL(feed.url);
  return (data.items || []).slice(0, 5).map((item) => ({
    title: (item.title || '(无标题)').trim(),
    link: item.link || '#',
    source: feed.name,
    lang: feed.lang,
    isoDate: item.isoDate || item.pubDate || null,
    snippet: cleanSnippet(item.contentSnippet || item.summary || item.content),
  }));
}

module.exports = async (req, res) => {
  try {
    const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
    // 每个源对应一个“桶”，抓取失败的源就是空桶（不影响其它源）
    const buckets = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));

    // 轮流从每个新闻源各取一条，保证 5 条来自不同来源、覆盖面广
    const picked = [];
    let i = 0;
    while (picked.length < 5 && buckets.some((b) => b.length)) {
      const bucket = buckets[i % buckets.length];
      if (bucket.length) picked.push(bucket.shift());
      i++;
    }

    // 按时间从新到旧排序后展示
    picked.sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0));

    // 让 Vercel 边缘节点缓存 6 小时（每天自动刷新几次，既新鲜又省资源）
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: picked.length,
      items: picked,
    });
  } catch (err) {
    res.status(500).json({ error: '新闻获取失败', detail: String(err && err.message || err) });
  }
};

// ──────────────────────────────────────────────────────────────
// 💡 升级提示：以后想让 Claude AI 来“挑出真正最重要的 5 条 + 写中文摘要”，
// 只需在上面 picked.sort(...) 之前，把所有 buckets 里的新闻交给 Claude，
// 让它返回排好序的 5 条即可。需要时告诉我，我帮你补这段。
// ──────────────────────────────────────────────────────────────
