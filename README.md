# HelloLuka

Luka 的设计作品集基础版，使用 React 和 Vite。

建议使用 Node.js 22.12 或更新版本。在项目目录运行：

```sh
npm install
npm run dev
```

打开终端显示的本地地址（默认 http://127.0.0.1:5173/）。使用 `npm run build` 生成 `dist/`，再用 `npm run preview` 预览。

个人信息、作品和能力文案集中在 `src/content.js`。默认头像和两个项目为示例；补充邮箱后会自动显示邮件链接。首屏默认使用实时渲染的视频流，填写 `profile.heroVideo`（例如 `./media/hero.mp4`）可换成本地视频文件。
