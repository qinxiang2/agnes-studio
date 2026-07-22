# Agnes AI Studio 📱

AI 图像和视频生成 PWA 应用 —— 在手机上独立运行，无需电脑。

## 功能

- 🎨 **文生图** — 输入描述，AI 生成图片
- ✏️ **图生图** — 拍照或选图，AI 编辑修改
- 🎬 **文生视频** — 输入描述，AI 生成视频
- 📹 **图生视频** — 选图 + 动作描述，AI 生成动态视频
- ⬇️ **下载到本地** — 一键保存到手机相册
- ↗️ **系统分享** — 通过微信/QQ 等直接分享

## 使用方法

### 方式一：部署到 GitHub Pages（推荐）

1. 将整个 `agnes_mobile/` 文件夹上传到 GitHub 仓库
2. 在仓库 Settings → Pages 中启用 GitHub Pages
3. 手机浏览器访问 `https://你的用户名.github.io/仓库名/`
4. Chrome 菜单 → "添加到主屏幕"

### 方式二：本地文件

1. 将 `agnes_mobile/` 文件夹复制到手机
2. 用 Chrome 打开 `index.html`

### 方式三：Netlify / Vercel

直接拖拽文件夹到 Netlify 或 Vercel 即可部署。

## 配置

1. 打开应用 → 设置 Tab
2. 输入你的 Agnes API Key
3. 点击"测试连接"验证
4. 开始生成！

## 注意事项

- 需要有效的 Agnes AI API Key
- 视频生成需要排队等待（通常 1-3 分钟）
- 第一次访问后建议"添加到主屏幕"获得最佳体验
- 如遇 CORS 错误，在设置中切换代理模式
