import { RESEARCH, STEPS, PART_GROUPS, PART_ORDER, PART_DESCRIPTIONS, CONCEPTS, stageFor } from './content.js?v=3';
import { partSvg } from './geometry.js';
import { ObjectViewer } from './viewer.js?v=3';

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

const story=$('.lantern-story');
story.classList.add('story-enabled');

async function main() {
  const response=await fetch(new URL('../assets/geometry-v13.json',import.meta.url));
  if(!response.ok)throw new Error('板件数据读取失败');
  const data=await response.json();
  const instances=code=>data.scene.filter(item=>item.code===code);
  const viewers=new Map();
  const ids={assembly:'assembly-canvas',part:'part-canvas'};
  const visual=$('.story-visual'),hero=$('#top'),parts=$('#parts'),product=$('#product');
  const desktop=matchMedia('(min-width: 1080px)');
  const lightButton=$('#product-light'),playButton=$('#assembly-play'),pauseButton=$('#assembly-pause');
  let selectedItem=null,partCode='A3',partInstance=1,progress=0,playing=false,exploded=false;
  let lastUi=0,currentStage=-1,completedStage=-1,stopAt=10,scrollLinked=!reducedMotion;
  let pendingPose=null,poseKey='',scrollFrame=0;

  function showError(kind,message) {
    const error=$('#'+kind+'-error'),element=$('#'+ids[kind]);
    if(error){
      error.textContent=message||'当前环境无法显示三维模型，已载入静态产品图';
      error.hidden=false;
    }
    element.classList.add('failed');
    element.querySelector('.model-loading')?.remove();
    if(kind==='part'){
      element.innerHTML=partSvg(data.parts[partCode]);
      element.firstElementChild.style.cssText='width:100%;height:100%;fill:#edc6d2;stroke:#b77b90;stroke-width:.5';
    }
  }

  function ensureViewer(kind) {
    if(viewers.has(kind))return viewers.get(kind);
    try {
      const view=new ObjectViewer($('#'+ids[kind]),data,{
        kind,
        onSelect:item=>openPart(item.code,item.index),
        onRotateChange:setRotateLabel,
        onError:message=>showError(kind,message),
      });
      viewers.set(kind,view);
      if(kind==='assembly'){
        view.setScrollLinked(scrollLinked);
        view.setProgress(progress);
        view.onFrame=dt=>updateAssemblyFrame(view,dt);
      }
      return view;
    } catch(error) {
      console.error('三维模型初始化失败',kind,error);
      viewers.set(kind,null);
      showError(kind);
      return null;
    }
  }

  lightButton.addEventListener('click',()=>{
    const view=ensureViewer('assembly');
    if(!view)return;
    view.setLamp(!view.lampEnabled);
    lightButton.setAttribute('aria-pressed',String(view.lampEnabled));
  });

  function setRotateLabel(active) {
    $('#product-rotate').setAttribute('aria-pressed',String(active));
    $('#product-rotate').textContent=active?'暂停旋转':'自动旋转';
  }

  function selectProduct(item) {
    selectedItem=item;
    $('#product-selection').hidden=false;
    $('#product-selection-label').textContent=item.code+' · '+data.parts[item.code].name+' / '+item.index;
    status('已选中 '+item.code+' '+data.parts[item.code].name+'，第 '+item.index+' 件');
  }

  $('#product-rotate').addEventListener('click',()=>{
    const view=ensureViewer('assembly');
    if(!view)return;
    const active=!view.controls.autoRotate;
    if(active){
      jump(10);
      view.motion.setFollow(false);
      $('#assembly-follow').setAttribute('aria-pressed','false');
    }
    view.setRotate(active);
    setRotateLabel(active);
  });
  $('#product-xray').addEventListener('click',()=>{
    const view=ensureViewer('assembly');
    if(!view)return;
    view.setXray(!view.xray);
    $('#product-xray').setAttribute('aria-pressed',String(view.xray));
    $('#product-state').textContent=view.xray?'透视结构':'完整形态';
  });
  $('#product-reset').addEventListener('click',()=>{
    ensureViewer('assembly')?.reset();
    status('已重置产品视角');
  });
  for(const [id,factor] of [['product-zoom-in',1.2],['product-zoom-out',1/1.2]]){
    $('#'+id).addEventListener('click',()=>{
      const view=ensureViewer('assembly');
      if(!view)return;
      setScrollLinked(false);
      view.motion.userPaused=true;
      view.zoom(factor);
    });
  }
  $('#product-fullscreen').addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await story.requestFullscreen();
    } catch {
      status('当前浏览器不支持全屏，可使用模型缩放按钮');
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=document.fullscreenElement===story;
    if(active)setScrollLinked(false);
    $('#product-fullscreen').setAttribute('aria-label',active?'退出全屏':'全屏查看三维模型');
    viewers.get('assembly')?.resize();
    scheduleStory();
  });
  $('#product-clear').addEventListener('click',()=>{
    selectedItem=null;
    viewers.get('assembly')?.clearSelection();
    $('#product-selection').hidden=true;
  });
  $('#product-inspect').addEventListener('click',()=>{
    if(selectedItem)openPart(selectedItem.code,selectedItem.index);
  });

  $('#assembly-steps').innerHTML=STEPS.map((step,i)=>
    '<button data-step="'+(i+1)+'" aria-label="第 '+(i+1)+' 步：'+step.title+'"><span class="step-number">'+String(i+1).padStart(2,'0')+'</span><span>'+step.short+'</span></button>'
  ).join('');
  const stepButtons=$$('#assembly-steps [data-step]');
  const progressInput=$('#assembly-progress'),progressLabel=$('#assembly-progress-label'),assemblyCount=$('#assembly-count');
  const previousStep=$('#assembly-prev'),nextStep=$('#assembly-next');
  stepButtons.forEach(button=>button.addEventListener('click',()=>playStep(Number(button.dataset.step))));

  function updatePlayback() {
    playButton.disabled=playing;
    pauseButton.disabled=!playing;
    playButton.setAttribute('aria-label',progress>=10?'从头播放拼装':'播放拼装');
  }

  function updateAssembly() {
    const active=Math.ceil(progress),completed=Math.floor(progress);
    progressInput.value=String(progress);
    const view=viewers.get('assembly');
    const count=view?.storyScene==='assembly'?view.element.dataset.placed:data.scene.filter(item=>stageFor(item)<=completed).length;
    const countText=progress===0?data.scene.length+' 件 · 准备拼装':'已就位 '+count+' / '+data.scene.length+' 件';
    if(assemblyCount.textContent!==countText)assemblyCount.textContent=countText;
    previousStep.disabled=progress<=0;
    nextStep.disabled=progress>=10;
    if(active===currentStage&&completed===completedStage)return;
    for(const button of stepButtons){
      const n=Number(button.dataset.step);
      button.classList.toggle('active',n===active);
      button.classList.toggle('completed',n<=completed);
      if(n===active)button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
    completedStage=completed;
    currentStage=active;
    progressLabel.textContent=active+' / 10';
    const step=STEPS[active-1];
    progressInput.setAttribute('aria-valuetext',step?'第 '+active+' 步：'+step.title:'散落板件');
    if(!exploded)$('#assembly-mode-label').textContent=step?'插接演示':'散落板件';
    $('#step-kicker').textContent=step?'步骤 '+String(active).padStart(2,'0')+' / 10':'准备开始';
    $('#step-title').textContent=step?.title??'从散落的板件开始';
    $('#step-description').textContent=step?.description??'137 件板件已落到台面';
    $('#step-tip').textContent=step?.tip??'';
    $('#step-parts').innerHTML=(step?.codes??[]).map(code=>'<button data-open-part="'+code+'">'+code+' · '+data.parts[code].name+'</button>').join('');
    $$('[data-open-part]').forEach(button=>button.addEventListener('click',()=>openPart(button.dataset.openPart)));
  }

  function updateAssemblyFrame(view,dt) {
    if(pendingPose){
      const pose=pendingPose;
      pendingPose=null;
      if(pose.scene==='assembly'&&scrollLinked&&progress!==pose.progress){
        progress=pose.progress;
        view.setProgress(progress);
      }
      const entering=view.storyScene!==pose.scene;
      view.setStoryPose(pose.scene,pose);
      if(pose.scene==='assembly'&&(entering||scrollLinked)){
        updateAssembly();
        updatePlayback();
      }
    }
    if(!playing||view.storyScene!=='assembly')return false;
    progress=Math.min(stopAt,progress+dt/2.8);
    view.setProgress(progress);
    lastUi+=dt;
    if(lastUi>.085||progress===stopAt){
      updateAssembly();
      lastUi=0;
    }
    if(progress===stopAt){
      playing=false;
      updatePlayback();
    }
    return playing;
  }

  function setScrollLinked(active) {
    scrollLinked=active;
    poseKey='';
    $('#assembly-scroll').setAttribute('aria-pressed',String(active));
    viewers.get('assembly')?.setScrollLinked(active);
    scheduleStory();
  }

  function clearExplosion(view) {
    if(!exploded)return;
    exploded=false;
    view?.setExplosion(false);
    $('#assembly-explode').setAttribute('aria-pressed','false');
    $('#assembly-mode-label').textContent='插接演示';
  }

  function stopSpin(view) {
    view?.setRotate(false);
    setRotateLabel(false);
  }

  function jump(value) {
    setScrollLinked(false);
    playing=false;
    const view=ensureViewer('assembly');
    clearExplosion(view);
    stopSpin(view);
    progress=Math.max(0,Math.min(10,value));
    view?.setProgress(progress);
    if(progress===0||progress===10)view?.reset();
    updatePlayback();
    updateAssembly();
  }

  function playStep(step) {
    jump(step-1);
    playing=true;
    stopAt=step;
    updatePlayback();
  }

  playButton.addEventListener('click',()=>{
    jump(progress>=10?0:progress);
    playing=true;
    stopAt=10;
    updatePlayback();
  });
  pauseButton.addEventListener('click',()=>{
    playing=false;
    updateAssembly();
    updatePlayback();
  });
  progressInput.addEventListener('input',event=>jump(Number(event.target.value)));
  previousStep.addEventListener('click',()=>jump(Math.ceil(progress)-1));
  nextStep.addEventListener('click',()=>playStep(Math.min(10,Math.floor(progress)+1)));
  $('#assembly-complete').addEventListener('click',()=>jump(10));
  $('#assembly-reset').addEventListener('click',()=>ensureViewer('assembly')?.reset());
  $('#assembly-follow').addEventListener('click',()=>{
    const view=ensureViewer('assembly');
    if(!view)return;
    view.motion.setFollow(!view.motion.follow);
    $('#assembly-follow').setAttribute('aria-pressed',String(view.motion.follow));
    view.invalidate();
  });
  $('#assembly-explode').addEventListener('click',()=>{
    const active=!exploded;
    jump(10);
    exploded=active;
    viewers.get('assembly')?.setExplosion(active);
    $('#assembly-explode').setAttribute('aria-pressed',String(active));
    $('#assembly-mode-label').textContent=active?'结构展开':'插接演示';
  });
  $('#assembly-scroll').addEventListener('click',()=>{
    setScrollLinked(!scrollLinked);
    if(!scrollLinked)return;
    const view=ensureViewer('assembly');
    playing=false;
    clearExplosion(view);
    stopSpin(view);
    view?.motion.setFollow(true);
    $('#assembly-follow').setAttribute('aria-pressed','true');
    updatePlayback();
  });

  const cap=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>value*value*(3-2*value);
  const labels={
    hero:'千角灯三维成品，拖动旋转',
    editorial:'千角灯三维成品',
    scatter:'散落的三维板件，点选可查看独立模型',
    assembly:'千角灯三维拼装，拖动旋转，点选可查看独立板件',
  };
  const viewport=$('#assembly-canvas');

  function updateStory() {
    scrollFrame=0;
    const height=visual.clientHeight||innerHeight;
    const heroRect=hero.getBoundingClientRect();
    const partsRect=parts.getBoundingClientRect();
    const productRect=product.getBoundingClientRect();
    const fullscreen=document.fullscreenElement===story;
    const dock=desktop.matches&&!reducedMotion;
    const departure=reducedMotion?0:smooth(cap(-heroRect.top/Math.max(1,heroRect.height-height)));
    const approach=smooth(cap(1-partsRect.top/(height*.77)));
    let display='hero',scene='hero',opacity=1,shift=0,yaw=0,tilt=0,spread=0;
    let nextProgress=progress;

    if(fullscreen||productRect.top<=1&&productRect.bottom>0){
      display=scene='assembly';
      if(scrollLinked)nextProgress=10*cap(-productRect.top/Math.max(1,productRect.height-height));
    } else if(productRect.bottom<=0){
      display='hidden';
    } else if(partsRect.top<=1){
      display=scene='scatter';
      spread=reducedMotion?1:cap(-partsRect.top/Math.max(1,(partsRect.height-height)*.78));
    } else {
      shift=dock?departure*(1-approach)*24.5:0;
      yaw=departure*(1-approach)*(dock?1.66:1.08);
      tilt=departure*(1-approach)*.07;
      if(heroRect.bottom<=0)display='editorial';
      if(!dock){
        opacity=Math.max(smooth(cap(heroRect.bottom/(height*.54))),approach);
        if(opacity===0)display='hidden';
      }
    }

    if(story.dataset.scene!==display){
      story.dataset.scene=display;
      viewport.tabIndex=['hero','scatter','assembly'].includes(display)?0:-1;
      if(labels[display])viewport.setAttribute('aria-label',labels[display]);
    }
    visual.style.setProperty('--story-x',shift.toFixed(3)+'vw');
    visual.style.setProperty('--story-opacity',opacity.toFixed(3));
    hero.style.setProperty('--hero-type-opacity',String(1-departure*.78));

    const view=viewers.get('assembly');
    if(!view)return;
    if(view.storyScene==='assembly'&&display!=='assembly'&&(playing||view.controls.autoRotate)){
      playing=false;
      stopSpin(view);
      updatePlayback();
    }
    view.setActive(display!=='hidden');
    if(display==='hidden')return;

    const key=[scene,yaw.toFixed(4),spread.toFixed(4),scrollLinked?nextProgress.toFixed(4):'manual'].join('/');
    if(key===poseKey)return;
    poseKey=key;
    pendingPose={scene,yaw,tilt,spread,progress:nextProgress};
    view.invalidate();
  }

  function scheduleStory() {
    if(!scrollFrame)scrollFrame=requestAnimationFrame(updateStory);
  }

  $('#assembly-scroll').setAttribute('aria-pressed',String(scrollLinked));
  addEventListener('scroll',scheduleStory,{passive:true});
  addEventListener('resize',scheduleStory);
  desktop.addEventListener('change',scheduleStory);
  const lazy=new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting)return;
    lazy.disconnect();
    ensureViewer('assembly');
    poseKey='';
    updateStory();
  });
  lazy.observe(visual);
  updateAssembly();
  updatePlayback();
  updateStory();


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
    const view=ensureViewer('part');if(view){view.setActive(true);if(view.element.dataset.part!==partCode)view.setPart(partCode);else view.invalidate();}else showError('part');
  }
  function updatePartPosition(){const item=instances(partCode).find(i=>i.index===partInstance),module={body:'灯身',B:'下檐',C:'上檐',cap:'顶冠',drops:'挂片'}[item.module];$('#part-position').textContent=`${module}模块 · 实装第 ${partInstance} 件，可在整灯中定位`;}
  function openPart(code,index=1){partCode=code;partInstance=index;if(!partDialog.open)partDialog.showModal();populatePart();status('已打开 '+code+' '+data.parts[code].name+' 的独立模型');}
  $('#part-dialog-close').addEventListener('click',()=>partDialog.close());
  partDialog.addEventListener('close',()=>{const view=viewers.get('part');if(view)view.setActive(false);});
  $('#part-instance').addEventListener('change',e=>{partInstance=Number(e.target.value);updatePartPosition();});
  $('#part-prev').addEventListener('click',()=>{partCode=PART_ORDER[(PART_ORDER.indexOf(partCode)-1+PART_ORDER.length)%PART_ORDER.length];partInstance=1;populatePart();});
  $('#part-next').addEventListener('click',()=>{partCode=PART_ORDER[(PART_ORDER.indexOf(partCode)+1)%PART_ORDER.length];partInstance=1;populatePart();});
  $('#part-reset').addEventListener('click',()=>viewers.get('part')?.reset());
  $('#part-zoom-in').addEventListener('click',()=>viewers.get('part')?.zoom(1.2));
  $('#part-zoom-out').addEventListener('click',()=>viewers.get('part')?.zoom(1/1.2));
  $('#part-find').addEventListener('click',()=>{const item=instances(partCode).find(i=>i.index===partInstance);partDialog.close();jump(10);const view=ensureViewer('assembly');if(view){view.setRotate(false);setRotateLabel(false);view.select(partCode,partInstance);selectProduct(item);}$('#product').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});$('#assembly-canvas').focus({preventScroll:true});});
}

main().catch(error=>{console.error(error);$$('.model-loading').forEach(el=>el.textContent='模型数据暂时无法读取，请通过本地服务器打开此页面');status('模型数据暂时无法读取，请刷新页面');});
