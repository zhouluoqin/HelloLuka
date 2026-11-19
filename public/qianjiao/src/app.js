import { RESEARCH, STEPS, PART_GROUPS, PART_ORDER, PART_DESCRIPTIONS, CONCEPTS, stageFor } from './content.js';
import { partSvg } from './geometry.js';
import { ObjectViewer } from './viewer.js?v=2';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const status=message=>{$('#live-status').textContent=message;};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

// Navigation remains usable independently of the 3D renderer.
const header=$('#site-header'),menu=$('.menu-toggle'),mobileNav=$('#mobile-nav');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'关闭导航菜单':'打开导航菜单');mobileNav.hidden=!open;header.classList.toggle('is-fixed',open||scrollY>450);});
$$('#mobile-nav a').forEach(link=>link.addEventListener('click',()=>{mobileNav.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','打开导航菜单');}));
const navSections=$$('.desktop-nav a').map(a=>({a,section:$(a.getAttribute('href'))}));
let scrollQueued=false;
function updateNavigation(){header.classList.toggle('is-fixed',scrollY>Math.min(450,$('.hero').offsetHeight*.55)||!mobileNav.hidden);let current=null;for(const entry of navSections)if(entry.section.getBoundingClientRect().top<170)current=entry.a;for(const {a} of navSections)if(a===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');scrollQueued=false;}
addEventListener('scroll',()=>{if(!scrollQueued){requestAnimationFrame(updateNavigation);scrollQueued=true;}},{passive:true});updateNavigation();

function tabs(selector,callback) {
  const buttons=$$(selector);
  for(const button of buttons){
    button.addEventListener('click',()=>{for(const b of buttons){const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}callback(button);});
    button.addEventListener('keydown',e=>{const i=buttons.indexOf(button);let next;if(e.key==='ArrowRight')next=(i+1)%buttons.length;if(e.key==='ArrowLeft')next=(i-1+buttons.length)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next!==undefined){e.preventDefault();buttons[next].focus();buttons[next].click();}});
  }
}
tabs('[data-research]',button=>{const d=RESEARCH[button.dataset.research];$('#research-kicker').textContent=d.kicker;$('#research-subtitle').textContent=d.title;$('#research-description').textContent=d.description;$('#research-insight').textContent=d.insight;$('#research-source').textContent='阅读资料 · '+d.source;$('#research-source').href=d.url;$('#research-panel').setAttribute('aria-labelledby',button.id);});
tabs('[data-sheet]',button=>{const n=button.dataset.sheet;$('#sheet-image').src=`./assets/cutting-sheet-${n}.svg`;$('#sheet-image').alt=`第${n}张 V13 切割画板，包含真实板件轮廓与编号`;$('#sheet-preview').setAttribute('aria-labelledby',button.id);});
function updateConcept(key){const c=CONCEPTS[key];$('#concept-drawing').innerHTML=c.svg;$('#concept-title').textContent=c.title;$('#concept-description').textContent=c.description;$('#concept-boundary').textContent=c.boundary;$('#concept-panel').setAttribute('aria-labelledby','concept-tab-'+key);}
tabs('[data-concept]',button=>updateConcept(button.dataset.concept));updateConcept('window');

// Real process photographs are presented in a native, keyboard-accessible lightbox.
const imageDialog=$('#image-dialog');
$$('[data-image]').forEach(button=>button.addEventListener('click',()=>{const caption=button.dataset.caption;$('#lightbox-image').src=button.dataset.image;$('#lightbox-image').alt=caption;$('#lightbox-caption').textContent=caption;imageDialog.showModal();}));
$('#image-dialog-close').addEventListener('click',()=>imageDialog.close());
function closeOnBackdrop(dialog){dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});}
closeOnBackdrop(imageDialog);

async function main(){
  const response=await fetch(new URL('../assets/geometry-v13.json',import.meta.url));if(!response.ok)throw new Error('板件数据读取失败');
  const data=await response.json();
  const instances=code=>data.scene.filter(item=>item.code===code);
  const viewers=new Map();
  const ids={hero:'hero-canvas',product:'assembly-canvas',assembly:'assembly-canvas',bay:'bay-canvas',part:'part-canvas'};
  let selectedItem=null,partCode='A3',partInstance=1,progress=0,playing=false,hasPlayed=false,exploded=false,lastUi=0,currentStage=-1,stopAt=10;
  let scrollLinked=!reducedMotion,scrollUpdatePending=false,lastScrollProgress=-1,queuedProgress=null;
  const heroSection=$('#top'),heroStage=heroSection.querySelector('.hero-stage');
  const productSection=$('#product'),productStage=productSection.querySelector('.experience-sticky');
  const lightButton=$('#product-light');
  const shortSteps=['叠好底框，柱脚对槽后直插','灯面竖起，下舌进入底框','先装撑片，再合上框','角脊与中肋，分别落入檐架','横梁两端落座，中间半搭接','双槽对准翘舌，沿瓦面直插','装好层间撑片，再搭上檐','先装横梁，再落上檐瓦','撑片对槽，收合顶冠','挂好长短挂片，点亮微光'];

  function showError(kind,message){const error=$('#'+kind+'-error');if(error){error.textContent=message||'当前环境无法启用 WebGL，已显示静态产品图。请用支持 WebGL 的浏览器查看交互模型';error.hidden=false;}const el=$('#'+ids[kind]);el.classList.add('failed');el.querySelector('.model-loading')?.remove();if(kind==='part'){el.innerHTML=partSvg(data.parts[partCode]);el.firstElementChild.style.cssText='width:100%;height:100%;fill:#edc6d2;stroke:#b77b90;stroke-width:.5';}}
  function ensureViewer(kind){
    if(kind==='product')return ensureViewer('assembly');
    if(viewers.has(kind))return viewers.get(kind);
    try{
      const view=new ObjectViewer($('#'+ids[kind]),data,{kind,
        onSelect:item=>{if(kind==='product')selectProduct(item);else if(['assembly','bay'].includes(kind))openPart(item.code,item.index);},
        onRotateChange:active=>{if(kind==='assembly')setRotateLabel(active);},
        onError:message=>showError(kind,message),
      });
      viewers.set(kind,view);
      if(kind==='assembly'){
        view.setScrollLinked(scrollLinked);
        view.setProgress(progress);
        view.onFrame=dt=>updateAssemblyFrame(view,dt);
        setRotateLabel(false);
        updateLightButton(view);
      }
      if(kind==='hero')updateHeroPose(view);
      return view;
    }catch(error){console.error('三维模型初始化失败：',kind,error);viewers.set(kind,null);showError(kind);return null;}
  }
  const lazy=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){ensureViewer(entry.target.dataset.viewer);lazy.unobserve(entry.target);}});
  for(const kind of ['hero','assembly','bay']){const element=$('#'+ids[kind]);element.dataset.viewer=kind;lazy.observe(element);}
  function updateLightButton(view){
    const active=String(view.lampEnabled);
    if(lightButton.getAttribute('aria-pressed')===active)return;
    lightButton.setAttribute('aria-pressed',active);
  }
  lightButton.addEventListener('click',()=>{
    const view=ensureViewer('assembly');
    if(!view)return;
    view.setLamp(!view.lampEnabled);
    view.motion.lampOverride=view.lampEnabled;
    updateLightButton(view);
  });

  function setRotateLabel(active){$('#product-rotate').setAttribute('aria-pressed',String(active));$('#product-rotate').textContent=active?'暂停旋转':'自动旋转';}
  function selectProduct(item){selectedItem=item;$('#product-selection').hidden=false;$('#product-selection-label').textContent=`${item.code} · ${data.parts[item.code].name} / ${item.index}`;status(`已选中 ${item.code} ${data.parts[item.code].name}，第 ${item.index} 件`);}
  $('#product-rotate').addEventListener('click',()=>{
    const view=ensureViewer('product');
    if(!view)return;
    const active=!view.controls.autoRotate;
    manualMode();
    if(active){
      playing=false;
      updatePlay();
      progress=10;
      view.setProgress(10);
      view.motion.reset();
      view.motion.setFollow(false);
      $('#assembly-follow').setAttribute('aria-pressed','false');
      updateAssembly();
    }
    view.setRotate(active);
    setRotateLabel(active);
  });
  $('#product-xray').addEventListener('click',()=>{const view=ensureViewer('product');if(view){const active=!view.xray;view.setXray(active);$('#product-xray').setAttribute('aria-pressed',String(active));$('#product-state').textContent=active?'透视结构':'完整形态';}});
  $('#product-reset').addEventListener('click',()=>{ensureViewer('product')?.reset();status('已重置产品视角');});
  $('#product-zoom-in').addEventListener('click',()=>{manualMode();const view=ensureViewer('product');if(view){view.motion.userPaused=true;view.zoom(1.2);}});
  $('#product-zoom-out').addEventListener('click',()=>{manualMode();const view=ensureViewer('product');if(view){view.motion.userPaused=true;view.zoom(1/1.2);}});
  $('#product-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.product-viewer-wrap').requestFullscreen();}catch{status('当前浏览器不支持全屏，可使用模型缩放按钮');}});
  document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;$('#product-fullscreen').setAttribute('aria-label',active?'退出全屏':'全屏查看三维模型');viewers.get('assembly')?.resize();});
  $('#product-clear').addEventListener('click',()=>{selectedItem=null;viewers.get('assembly')?.clearSelection();$('#product-selection').hidden=true;});
  $('#product-inspect').addEventListener('click',()=>{if(selectedItem)openPart(selectedItem.code,selectedItem.index);});

  // The storyboard controls the same real instances as the assembled product.
  $('#assembly-steps').innerHTML=STEPS.map((step,i)=>`<button data-step="${i+1}" aria-label="第 ${i+1} 步：${step.title}"><span class="step-number">${String(i+1).padStart(2,'0')}</span><span>${step.short}</span></button>`).join('');
  const stepButtons=$$('#assembly-steps [data-step]');
  const progressInput=$('#assembly-progress'),progressLabel=$('#assembly-progress-label'),assemblyCount=$('#assembly-count');
  const previousStep=$('#assembly-prev'),nextStep=$('#assembly-next');
  let completedStage=-1;
  stepButtons.forEach(button=>button.addEventListener('click',()=>playStep(Number(button.dataset.step))));
  function updatePlay(){const b=$('#assembly-play');b.innerHTML=(playing?'暂停演示':'播放拼装')+`<span aria-hidden="true">${playing?'Ⅱ':'▷'}</span>`;b.setAttribute('aria-label',playing?'暂停自动拼装演示':progress>=10?'从头自动演示拼装':'播放自动拼装演示');b.setAttribute('aria-pressed',String(playing));}
  function updateAssembly(){
    const active=Math.ceil(progress),completed=Math.floor(progress);
    progressInput.value=String(progress);
    const view=viewers.get('assembly');
    const count=view?.element.dataset.placed??data.scene.filter(i=>stageFor(i)<=completed).length;
    if(view)updateLightButton(view);
    const countText=progress===0?`${data.scene.length} 件 · 准备拼装`:`已就位 ${count} / ${data.scene.length} 件`;
    if(assemblyCount.textContent!==countText)assemblyCount.textContent=countText;
    if(completed!==completedStage||active!==currentStage){
      previousStep.disabled=progress<=0;nextStep.disabled=progress>=10;
      for(const button of stepButtons){
        const n=Number(button.dataset.step);
        button.classList.toggle('active',n===active);
        button.classList.toggle('completed',n<=completed);
        if(n===active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      }
      completedStage=completed;
    }
    if(active===currentStage)return;currentStage=active;
    progressLabel.textContent=`${active} / 10`;
    progressInput.setAttribute('aria-valuetext',active?`第 ${active} 步：${STEPS[active-1].title}`:'尚未开始');
    if(!exploded)$('#assembly-mode-label').textContent=progress===0?'平铺板件':'插接演示';
    const s=STEPS[active-1];$('#step-kicker').textContent=active?`步骤 ${String(active).padStart(2,'0')} / 10`:'准备开始';$('#step-title').textContent=s?.title??'从平板开始';$('#step-description').textContent=active?shortSteps[active-1]:'三张切割板，所有板件都已就位';$('#step-tip').textContent=s?.tip??'';
    $('#step-parts').innerHTML=(s?.codes??[]).map(code=>`<button data-open-part="${code}" aria-label="查看 ${code} ${data.parts[code].name}">${code} · ${data.parts[code].name}</button>`).join('');
    $$('[data-open-part]').forEach(b=>b.addEventListener('click',()=>openPart(b.dataset.openPart)));
  }
  function updateAssemblyFrame(view,dt){
    if(queuedProgress!==null){
      progress=queuedProgress;
      queuedProgress=null;
      view.setProgress(progress);
      updateAssembly();
    }
    if(!playing)return false;
    progress=Math.min(stopAt,progress+dt/6);
    view.setProgress(progress);
    lastUi+=dt;
    if(lastUi>.09||progress===stopAt){updateAssembly();lastUi=0;}
    if(progress===stopAt){playing=false;updatePlay();}
    return playing;
  }
  function clearExplosion(){if(exploded){exploded=false;viewers.get('assembly')?.setExplosion(false);$('#assembly-explode').setAttribute('aria-pressed','false');$('#assembly-mode-label').textContent='分步拼装';}}
  function manualMode(){scrollLinked=false;queuedProgress=null;$('#assembly-scroll').setAttribute('aria-pressed','false');viewers.get('assembly')?.setScrollLinked(false);}
  function stopSpin(view){if(view){view.setRotate(false);setRotateLabel(false);}}
  function jump(value){manualMode();playing=false;hasPlayed=true;clearExplosion();progress=Math.max(0,Math.min(10,value));const view=ensureViewer('assembly');view?.setProgress(progress);stopSpin(view);if(progress===0||progress===10)view?.motion.reset();updatePlay();updateAssembly();}
  function focusAssembly(){const stage=$('.assembly-stage'),r=stage.getBoundingClientRect();if(r.top<76||r.bottom>innerHeight-15)stage.scrollIntoView({block:'center',behavior:reducedMotion?'instant':'smooth'});}
  function playStep(step){manualMode();clearExplosion();const view=ensureViewer('assembly');if(!view)return;stopSpin(view);progress=step-1+.001;stopAt=step;hasPlayed=true;playing=true;view.setProgress(progress);updatePlay();updateAssembly();focusAssembly();}
  $('#assembly-play').addEventListener('click',()=>{manualMode();const view=ensureViewer('assembly');if(!view)return;stopSpin(view);clearExplosion();if(!playing){if(!hasPlayed||progress>=10)progress=0;hasPlayed=true;playing=true;stopAt=10;}else playing=false;view.setProgress(progress);updatePlay();updateAssembly();focusAssembly();});
  $('#assembly-progress').addEventListener('input',e=>jump(Number(e.target.value)));
  $('#assembly-prev').addEventListener('click',()=>jump(Math.ceil(progress)-1));
  $('#assembly-next').addEventListener('click',()=>playStep(Math.min(10,Math.floor(progress)+1)));
  $('#assembly-complete').addEventListener('click',()=>jump(10));
  $('#assembly-reset').addEventListener('click',()=>ensureViewer('assembly')?.reset());
  $('#assembly-follow').addEventListener('click',()=>{const view=ensureViewer('assembly');if(!view?.motion)return;view.motion.setFollow(!view.motion.follow);$('#assembly-follow').setAttribute('aria-pressed',String(view.motion.follow));view.invalidate();});
  $('#assembly-explode').addEventListener('click',()=>{manualMode();playing=false;updatePlay();const view=ensureViewer('assembly');if(!view)return;stopSpin(view);exploded=!exploded;progress=10;view.setProgress(10);view.setExplosion(exploded);$('#assembly-explode').setAttribute('aria-pressed',String(exploded));$('#assembly-mode-label').textContent=exploded?'结构展开':'分步拼装';updateAssembly();});
  updateAssembly();updatePlay();

  function updateHeroPose(view=viewers.get('hero')){
    if(!view||!view.visible)return;
    const travel=Math.max(1,heroSection.offsetHeight-heroStage.offsetHeight);
    const value=reducedMotion?0:Math.min(1,Math.max(0,scrollY/travel));
    view.setScrollPose(value);
  }

  // Scroll records the next pose; the viewer applies it at its own frame rate.
  function updateScrollExperience(){
    scrollUpdatePending=false;
    updateHeroPose();
    if(!scrollLinked)return;
    const rect=productSection.getBoundingClientRect();
    if(rect.top>=innerHeight||rect.bottom<=0)return;
    const travel=Math.max(1,rect.height-productStage.offsetHeight);
    const value=Math.max(0,Math.min(10,(76-rect.top)/travel*10));
    if(value===lastScrollProgress||(value>0&&value<10&&Math.abs(value-lastScrollProgress)<.002))return;
    const view=ensureViewer('assembly');if(!view)return;
    lastScrollProgress=value;
    queuedProgress=value;
    view.invalidate();
  }
  $('#assembly-scroll').setAttribute('aria-pressed',String(scrollLinked));
  $('#assembly-scroll').addEventListener('click',()=>{
    if(scrollLinked){manualMode();return;}
    scrollLinked=true;
    $('#assembly-scroll').setAttribute('aria-pressed','true');
    const view=ensureViewer('assembly');
    if(view){
      view.setScrollLinked(true);
      view.motion.setFollow(true);
      $('#assembly-follow').setAttribute('aria-pressed','true');
      playing=false;
      clearExplosion();
      stopSpin(view);
      updatePlay();
      view.invalidate();
    }
    lastScrollProgress=-1;
    updateScrollExperience();
  });
  addEventListener('scroll',()=>{if(!scrollUpdatePending){scrollUpdatePending=true;requestAnimationFrame(updateScrollExperience);}},{passive:true});
  addEventListener('resize',()=>{lastScrollProgress=-1;updateScrollExperience();});
  $('#experience-next').addEventListener('click',()=>{playing=false;updatePlay();$('#joinery').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});});
  updateScrollExperience();

  const bayDescriptions=['横梁两端对准角脊承口，中间开口与中肋半搭接','瓦片窄端朝屋脊，两槽对准横梁上的双翘舌','沿瓦面法线直插到底，两侧与中线共同托住斜瓦'];
  $$('[data-bay]').forEach(button=>button.addEventListener('click',()=>{const step=Number(button.dataset.bay);ensureViewer('bay')?.setBay(step);for(const b of $$('[data-bay]')){const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}$('#bay-description').textContent=bayDescriptions[step];}));

  // One card per unique cutting profile. Every installed copy is separately selectable.
  let filter='all',query='';
  function renderParts(){
    const codes=PART_ORDER.filter(code=>(filter==='all'||PART_GROUPS[filter].includes(code))&&(!query||(code+' '+data.parts[code].name+' '+PART_DESCRIPTIONS[code]).toLowerCase().includes(query)));
    $('#parts-grid').innerHTML=codes.map(code=>{const part=data.parts[code],count=instances(code).length;return `<button class="part-card" data-part="${code}" aria-label="打开 ${code} ${part.name} 的三维模型，实装 ${count} 件"><span class="part-thumb">${partSvg(part)}</span><span class="part-plus" aria-hidden="true">＋</span><span class="part-code">${code}<span>× ${count}</span></span><h3>${part.name}</h3></button>`;}).join('');
    $$('.part-card').forEach(button=>button.addEventListener('click',()=>openPart(button.dataset.part)));
    $('#parts-empty').hidden=codes.length>0;$('#parts-total').textContent=filter==='all'&&!query?'共 23 类板件，137 件实装；另含 6 件备用片销':`显示 ${codes.length} / 23 类板件。点击板件可查看每一件的模型与装配位置`;
  }
  $$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;for(const b of $$('[data-filter]')){const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}renderParts();status($('#parts-total').textContent);}));
  $('#parts-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderParts();});renderParts();

  const partDialog=$('#part-dialog');closeOnBackdrop(partDialog);
  function populatePart(){
    const part=data.parts[partCode],copies=instances(partCode),index=PART_ORDER.indexOf(partCode);
    $('#part-dialog-code').textContent=partCode+' / PART STUDY';$('#part-dialog-title').textContent=part.name;$('#part-dialog-description').textContent=PART_DESCRIPTIONS[partCode];
    $('#part-dialog-specs').innerHTML=`<div><dt>实装数量</dt><dd>${copies.length} 件${part.spare?' / 备用 '+part.spare+' 件':''}</dd></div><div><dt>轮廓包围尺寸</dt><dd>${part.width.toFixed(1)} × ${part.height.toFixed(1)} mm</dd></div><div><dt>设计板厚</dt><dd>${data.thickness.toFixed(1)} mm</dd></div>`;
    $('#part-instance').innerHTML=copies.map(item=>`<option value="${item.index}">${partCode} · 第 ${item.index} 件</option>`).join('');
    if(!copies.some(i=>i.index===partInstance))partInstance=copies[0].index;
    $('#part-instance').value=String(partInstance);$('#part-index').textContent=`${index+1} / ${PART_ORDER.length}`;updatePartPosition();
    const view=ensureViewer('part');if(view){view.visible=true;if(view.element.dataset.part!==partCode)view.setPart(partCode);else view.invalidate();}else showError('part');
  }
  function updatePartPosition(){const item=instances(partCode).find(i=>i.index===partInstance),module={body:'灯身',B:'下檐',C:'上檐',cap:'顶冠',drops:'挂片'}[item.module];$('#part-position').textContent=`${module}模块 · 实装第 ${partInstance} 件，可在整灯中定位`;}
  function openPart(code,index=1){partCode=code;partInstance=index;if(!partDialog.open)partDialog.showModal();populatePart();status('已打开 '+code+' '+data.parts[code].name+' 的独立模型');}
  $('#part-dialog-close').addEventListener('click',()=>partDialog.close());
  partDialog.addEventListener('close',()=>{const view=viewers.get('part');if(view)view.visible=false;});
  $('#part-instance').addEventListener('change',e=>{partInstance=Number(e.target.value);updatePartPosition();});
  $('#part-prev').addEventListener('click',()=>{partCode=PART_ORDER[(PART_ORDER.indexOf(partCode)-1+PART_ORDER.length)%PART_ORDER.length];partInstance=1;populatePart();});
  $('#part-next').addEventListener('click',()=>{partCode=PART_ORDER[(PART_ORDER.indexOf(partCode)+1)%PART_ORDER.length];partInstance=1;populatePart();});
  $('#part-reset').addEventListener('click',()=>viewers.get('part')?.reset());
  $('#part-zoom-in').addEventListener('click',()=>viewers.get('part')?.zoom(1.2));
  $('#part-zoom-out').addEventListener('click',()=>viewers.get('part')?.zoom(1/1.2));
  $('#part-find').addEventListener('click',()=>{const item=instances(partCode).find(i=>i.index===partInstance);partDialog.close();jump(10);const view=ensureViewer('product');if(view){view.setRotate(false);setRotateLabel(false);view.select(partCode,partInstance);selectProduct(item);}$('#product').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});$('#assembly-canvas').focus({preventScroll:true});});
}

main().catch(error=>{console.error(error);$$('.model-loading').forEach(el=>el.textContent='模型数据暂时无法读取，请通过本地服务器打开此页面');status('模型数据暂时无法读取。请使用随附的启动脚本');});
