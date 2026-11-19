// Editorial content is separate from the geometry and interaction code.
export const RESEARCH = {
  history: { kicker: '一盏灯与莞城的记忆', title: '从宗祠灯火到城市非遗', description: '东莞传统灯彩，与莞城赵氏的地方记忆相连。八角宫灯的形式，延续着岭南节庆的灯火', insight: '2006 年，灯彩（东莞千角灯）列入第一批国家级非物质文化遗产代表性项目名录', source: '中国非物质文化遗产网', url: 'https://www.ihchina.cn/project_details/14060/' },
  form: { kicker: '层层展开的空间秩序', title: '不止轮廓更是一套构成', description: '灯顶、灯体、灯柱、灯带与灯尾。层叠的几何与垂挂的节奏，构成它的识别', insight: '提取层叠、重复与垂挂，重组为六向拼接结构', source: '新华网 · 昔日宫灯点亮万千百姓家', url: 'https://www.xinhuanet.com/politics/2021-09/19/c_1127881117.htm' },
  craft: { kicker: '材料之间的连接智慧', title: '以手工把平面变成立体', description: '扎作、书画、剪纸与刺绣，在一盏灯里相遇', insight: '让“如何搭成”变成可以参与的体验', source: '新华网 · 昔日宫灯点亮万千百姓家', url: 'https://www.xinhuanet.com/politics/2021-09/19/c_1127881117.htm' },
  meaning: { kicker: '灯火里的共同愿望', title: '千角千灯寄托团聚与兴旺', description: '“角”与“个”、“灯”与“丁”谐音，寄托着人丁兴旺的愿望', insight: '共同完成，让这份记忆进入日常', source: '新华网 · 昔日宫灯点亮万千百姓家', url: 'https://www.xinhuanet.com/politics/2021-09/19/c_1127881117.htm' },
};

export const STEPS = [
  { title:'立起灯身骨架', short:'灯身骨架', codes:['A2','A4','K1'], description:'将两片 A2 下框叠合，六根 A4 角柱的下舌穿过底框，再用 K1 横销限位', tip:'框板叠合后，先确认柱脚方向和片销的插入空间' },
  { title:'围合六面灯窗', short:'六面灯窗', codes:['A3'], description:'沿灯身周向依次装入六片 A3 海棠漏窗灯面，下舌进入下框对应槽位', tip:'灯面上下方向保持一致，先不要封闭上框' },
  { title:'合上顶框与撑片', short:'顶框与撑片', codes:['A1','S1','K1','K2'], description:'先在 A1 下方装好 S1 底端及三点吊绳，再合上两片 A1 上框，用 K1 限位柱舌', tip:'S1 底部的 K2 会被上框遮挡，须提前装入。吊绳在本演示的末步统一显示' },
  { title:'搭好下檐骨架', short:'下檐骨架', codes:['B1','B2','B3','K2'], description:'预装 B1 下檐底架、六片 B2 角脊和六片 B3 中肋。长脚以 K2 限位，短脚入槽，再与 S1 连接', tip:'相邻角脊的承口留给承瓦横梁，先检查朝向' },
  { title:'安放下檐横梁', short:'下檐横梁', codes:['B5'], description:'六根 B5 横梁分别落进两侧角脊承口，中部开口与 B3 中肋半搭接', tip:'翘舌朝瓦、开口朝下，三处承口同时对准后落座' },
  { title:'盖上下檐斜瓦', short:'下檐斜瓦', codes:['B4'], description:'将 B4 窄端朝向屋脊，左右两槽对准横梁的双翘舌，沿瓦面法线直插到底', tip:'下檐两槽中心距 39 mm。先完成下檐瓦片，再向上搭建' },
  { title:'向上搭建第二层', short:'上檐骨架', codes:['S2','C1','C2','C3','K2'], description:'装好 S2 层间撑片，再安装预组的 C1 上檐底架、C2 角脊与 C3 中肋', tip:'与下檐相同：先处理随后会被遮挡的撑片底部 K2' },
  { title:'完成上檐承瓦', short:'上檐承瓦', codes:['C6','C4'], description:'先安放六根 C6 横梁，再逐片装入 C4 上檐斜瓦。两侧横梁与中肋共同托住瓦片', tip:'上檐双槽中心距 30 mm；上、下檐横梁与瓦片不能混用' },
  { title:'收合平板顶冠', short:'安装顶冠', codes:['S3','C5','K2'], description:'将三片 S3 顶冠撑片与 C5 平板顶冠连接，完成竖向层次', tip:'安装片销并检查位置后，所有 K1、K2 尾孔穿透明尼龙线系止退结' },
  { title:'垂挂最后的节奏', short:'挂片与吊绳', codes:['D1','D2','D3'], description:'沿下檐交替挂入 D1、D2 长短挂片，在底框悬挂 D3 下坠。三点吊绳穿过檐架后向中心汇合', tip:'搬运前按反序取瓦，拆下檐瓦前先卸上檐组件；实物吊挂另按重量与安装条件验证' },
];

export const PART_GROUPS = {
  body:['A1','A2','A3','A4'], lower:['B1','B2','B3','B5','B4'], upper:['C1','C2','C3','C6','C4'], support:['S1','S2','S3','C5'], other:['D1','D2','D3','K1','K2'],
};
export const PART_ORDER = Object.values(PART_GROUPS).flat();
export const PART_DESCRIPTIONS = {
  A1:'两片叠合形成灯身上框，接住角柱与灯面上舌，并为向上的撑片提供连接位置',
  A2:'两片叠合形成灯身下框，确定六向灯身的平面秩序。角柱穿框后由 K1 限位',
  A3:'海棠形镂空灯面，围合成六面灯身。海棠漏窗是本项目引入的园林纹样参考',
  A4:'角柱贯穿上下双层框，长舌端的窗口供 K1 横销挡脱，形成灯身骨架',
  B1:'下檐水平底架，连接角脊、中肋和撑片；孔槽与 V13 实际切割图一致',
  B2:'下檐角脊的上缘承口接住相邻两根横梁，两根横梁各占板厚一侧',
  B3:'整条斜面支撑下檐瓦片中线，中部开口与 B5 横梁半搭接',
  B5:'V13 的关键板件。两端入角脊承口，中部与中肋搭接，两枚翘舌向左右展开',
  B4:'窄端朝屋脊，两个槽对准 B5 的双翘舌后直插；下檐双槽中心距为 39 mm',
  C1:'上檐水平底架，以较小的六向构成延续下檐节奏，连接上檐角脊与中肋',
  C2:'上檐角脊，承口接住相邻 C6 横梁；与下檐角脊具有不同的尺寸',
  C3:'上檐瓦片的中线支撑，与 C6 横梁半搭接，协同承担瓦片落座',
  C6:'上檐的双侧承瓦横梁，双翘舌对应 C4 的两个槽口。上檐双槽中心距为 30 mm',
  C4:'上檐双侧直插斜瓦，窄端朝脊，沿瓦面法线装入。需配合 C6，不能与下檐混用',
  S1:'连接灯身上框与下檐，肩间高 12 mm。底部片销要在封闭上框前提前安装',
  S2:'连接下、上檐的层间撑片，肩间高 36 mm。两端窗口分别以 K2 锁止',
  S3:'支撑平板顶冠的撑片，肩间高 26 mm；三片配合构成顶冠下的空间层次',
  C5:'以一片水平板收合顶部，与三片 S3 撑片插接，形成灯顶',
  D1:'通过透明线悬挂在下檐的长挂片，与 D2 短挂片沿周向交替排列',
  D2:'通过透明线悬挂在下檐的短挂片，用长短变化转译传统灯带的垂挂节奏',
  D3:'悬挂在底框下方的平面下坠，以小体量收束整灯的竖向轮廓',
  K1:'灯身横销，实装 12 件，备用 2 件。凸肩留在插入侧，尾孔穿尼龙线系止退结',
  K2:'屋檐与撑片横销，实装 42 件，备用 4 件。尾孔穿透明尼龙线止退',
};

// The stage is assigned to every real instance, including each individual pin.
export function stageFor(item) {
  const c=item.code;
  if(c==='A2'||c==='A4')return 1;
  if(c==='A3')return 2;
  if(c==='A1'||c==='S1')return 3;
  if(c==='K1')return item.index%2===1?1:3;
  if(['B1','B2','B3'].includes(c))return 4;
  if(c==='B5')return 5;
  if(c==='B4')return 6;
  if(['S2','C1','C2','C3'].includes(c))return 7;
  if(['C6','C4'].includes(c))return 8;
  if(['S3','C5'].includes(c))return 9;
  if(c==='K2') {
    if(item.module==='cap')return 9;
    // S1 lower pins must precede top-frame closure; S2/S3 lower pins precede the next tier.
    if(item.module==='B'&&item.origin[2]<110)return 3;
    return item.module==='C'?7:4;
  }
  return 10;
}

export const CONCEPTS = {
  window:{title:'把透光的秩序拼成桌面屏风',description:'提取几何窗格与重复单元，探索可扩展的亚克力格栅模块',boundary:'设计者核验：纹样来源、模块强度与边缘触感',svg:'<svg viewBox="0 0 140 140"><rect x="14" y="14" width="112" height="112"/><rect x="22" y="22" width="96" height="96"/><path d="M70 22v96M22 70h96M22 46l24-24 48 96 24-24M22 94l24 24 48-96 24 24M22 46l96 48M22 94l96-48"/></svg>'},
  boat:{title:'把修长的骨架转成掌上的龙舟',description:'研究船肋、龙骨与外壳的关系，探索沿轴线重复装入的片状结构',boundary:'设计者核验：船体比例、连接顺序与文化使用情境',svg:'<svg viewBox="0 0 140 140"><path d="m9 78 18 23 77 0 27-37-18 11-87 0Z M27 85h88M34 75v25M47 75v25M60 75v25M73 75v25M86 75v25M99 75v25M27 75l-7-21 12 8 6 13M112 75l9-27 10-5-1 21"/><path d="m35 48 22 30m5-30 22 30m5-30 22 30"/></svg>'},
  lion:{title:'把形态的张力拆成可叠合的层片',description:'研究醒狮头部的轮廓和层次，探索以平面切片表达立体神态',boundary:'设计者核验：造型语义、地方差异与叠层可装配性',svg:'<svg viewBox="0 0 140 140"><path d="M25 105 17 76 23 45 42 24 70 15 98 24 117 45 123 76 115 105 92 121H48Z"/><path d="M34 99 28 73 34 49 49 32 70 25 91 32 106 49 112 73 106 99 86 111H54Z"/><circle cx="46" cy="61" r="15"/><circle cx="94" cy="61" r="15"/><circle cx="46" cy="61" r="6"/><circle cx="94" cy="61" r="6"/><path d="m61 73 9-7 9 7-9 8ZM42 93l13-7h30l13 7-12 10H54ZM70 27v20"/></svg>'},
};
