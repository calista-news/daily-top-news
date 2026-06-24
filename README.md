# 每日全球要闻 🌍

每天浏览全球 5 条最关键新闻的手机网页 (PWA)。可“添加到主屏幕”，像 App 一样使用。

## 项目结构

| 文件 | 作用 |
|------|------|
| `index.html` | 手机端页面（用户看到的界面） |
| `api/news.js` | 后端接口：抓 RSS 新闻源、挑 5 条 |
| `manifest.json` / `sw.js` / `icon.svg` | PWA 配置（装到桌面 + 离线） |
| `package.json` | 依赖清单 |

## 新闻来源

BBC 中文、BBC World、BBC Business、BBC Technology、The Guardian（中英混合，覆盖时政/财经/科技）。
想增删来源：编辑 `api/news.js` 顶部的 `FEEDS` 数组。

## 部署到 Vercel（让它上线）

### 方式一：网页拖拽（最简单，不用命令行）

1. 打开 https://vercel.com → 登录
2. 点 **Add New → Project**
3. 选 **Import** 你的 GitHub 仓库（需先把本文件夹推到 GitHub）
4. 框架预设保持 **Other**，直接点 **Deploy**
5. 等 1 分钟，拿到 `https://xxx.vercel.app` 网址，手机打开即可

### 方式二：命令行一键部署

```bash
npm i -g vercel   # 安装一次即可
vercel            # 在本文件夹运行，按提示登录并部署
vercel --prod     # 正式发布
```

## 添加到手机桌面

- **iPhone**：Safari 打开网址 → 分享 → “添加到主屏幕”
- **安卓**：Chrome 打开网址 → 菜单 → “添加到主屏幕 / 安装应用”

## 以后想升级（可选）

- **让 AI 挑选更聪明 + 写中文摘要**：接入 Claude API（见 `api/news.js` 底部提示）
- **每天定时推送**：可加 Vercel Cron + 通知

---
*本地预览：`npx vercel dev` 然后访问 http://localhost:3000*
