# HelloLuka

Luka 的设计作品集基础版，使用 React 和 Vite。

建议使用 Node.js 22.12 或更新版本。在项目目录运行：

```sh
npm install
npm run dev
```

打开终端显示的本地地址（默认 http://127.0.0.1:5173/）。使用 `npm run build` 生成 `dist/`，再用 `npm run preview` 预览。

个人信息、作品和能力文案集中在 `src/content.js`。默认头像和两个项目为示例；补充邮箱后会自动显示邮件链接。首屏默认使用实时渲染的视频流，填写 `profile.heroVideo`（例如 `./media/hero.mp4`）可换成本地视频文件。

## 千角灯 V13

作品集导航和精选项目均可进入千角灯独立网站，线上地址为 <https://helloluka.cn/qianjiao/>

源码及全部运行资源位于 `public/qianjiao/`，Vite 构建时会原样复制到 `dist/qianjiao/`

该项目包含分类调研、真实纸板实验照片、红色渐变透明亚克力模型、内部微光、滚动拼装、分步镜头及独立板件查看器

Three.js、控制器、几何数据和图片均已放入项目，不依赖外部 CDN，具体文件与资料出处见 `public/qianjiao/README.md`

推送到 `main` 后，现有 GitHub Actions 工作流会构建并发布整个作品集，原有作品仍保留
