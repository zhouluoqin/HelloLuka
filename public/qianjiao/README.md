# 千角灯 V13

HelloLuka 作品集中的独立产品网站，访问 <https://helloluka.cn/qianjiao/>

本目录就是可直接发布的完整网页源码，所有资源均使用相对地址，页尾可返回作品集

## 内容与交互

- 东莞千角灯分类调研与林荣泰文化产品设计模型的设计映射
- V13 建模、切割模板与真实纸板试装照片
- 浅红渐变透明亚克力、内部红色微光与开屏滚动镜头
- 同一画布中的完整产品、滚动拼装与手动旋转缩放
- 以三张真实平铺切割板为起点，137 件板件分十步插接
- 随步骤改变的镜头、对槽提示和 23 类板件的独立模型
- AI 辅助文化产品转译工作室的发展构想

## 源码

| 文件 | 用途 |
| --- | --- |
| `index.html` | 页面、调研、实验照片与模型按钮 |
| `styles.css` | 浅红视觉、响应式布局与滚动体验 |
| `src/app.js` | 页面交互、模型共享、图鉴与进度控制 |
| `src/viewer.js` | Three.js 渲染、亚克力、灯光、旋转与拾取 |
| `src/geometry.js` | 真实轮廓与孔洞的 3 mm 挤出及红色渐变 |
| `src/assembly-motion.js` | 平铺板位、插接轨迹和各步镜头 |
| `src/content.js` | 调研分类、步骤与板件说明 |
| `assets/` | V13 几何数据、原始切割资料与项目照片 |
| `vendor/` | 本地 Three.js 0.170.0、控制器、环境及 MIT 许可证 |
| `cover.jpg` | 作品集入口所用的网页实拍 |

开发时在仓库根目录运行 `pnpm dev`，打开 `/qianjiao/`

生产构建沿用仓库现有命令 `pnpm run build --base=./`，Vite 将本目录复制到 `dist/qianjiao/`

三维几何使用 V13 原始 23 类轮廓与 137 件实装坐标，另有 6 件备用片销，灯芯及光晕为网站氛围示意，不计入切割板件

纸板照片记录比例与搭建探索，亚克力实际插合与吊挂表现仍以同批材料的试切及实测为准

## 资料出处

- [中国非物质文化遗产网：灯彩（东莞千角灯）](https://www.ihchina.cn/project_details/14060/)
- [新华网：昔日宫灯点亮万千百姓家](https://www.xinhuanet.com/politics/2021-09/19/c_1127881117.htm)
- [Lin, R. T. (2007)：文化产品设计模型](https://www.ijdesign.org/index.php/IJDesign/article/view/46/26)
- [文史广东：传统千角灯展陈图片出处](https://www.gdwsw.gov.cn/wsgdlnfw/content/post_25952.html)，图片版权归原作者
- [苏州市地方志馆：海棠花窗参考](https://dfzb.suzhou.gov.cn/dfzb/fzxh/201002/4310c9b7dad442b99b209d301b8cdd82.shtml)

传统千角灯的八角宫灯体系与 V13 六向构成分别说明，海棠漏窗为另行引入的园林纹样

工作室与后续转译方向为发展构想，未接入在线 AI 生成或收费服务
