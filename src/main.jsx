import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { profile, projects, skills } from './content'
import './style.css'

function HeroVideo() {
  const video = useRef(null)
  const canvas = useRef(null)
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (profile.heroVideo) {
      if (playing) video.current.play().catch(() => {})
      else video.current.pause()
      return
    }
    const surface = canvas.current
    const player = video.current
    const ctx = surface.getContext('2d')
    let frame, last = 0
    function draw(time) {
      const t = time / 3600
      ctx.clearRect(0, 0, 800, 800)
      const glow = ctx.createRadialGradient(400, 400, 35, 400, 400, 390)
      glow.addColorStop(0, '#292743')
      glow.addColorStop(.5, '#17192a')
      glow.addColorStop(1, '#10111200')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, 800, 800)
      for (let i = 0; i < 39; i++) {
        ctx.beginPath()
        for (let j = 0; j <= 220; j++) {
          const a = j / 220 * Math.PI * 2
          const r = 155 + i * 3.2 + 42 * Math.cos(a * 3 + t + i * .055)
          const x = 400 + r * Math.cos(a + i * .007)
          const y = 400 + r * Math.sin(a) * .8 + 62 * Math.sin(a * 2 + t / 2)
          if (j === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = 'rgba(170, 181, 255,' + (.14 + i * .007) + ')'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    function tick(time) {
      if (time - last >= 32) { draw(time); last = time }
      frame = requestAnimationFrame(tick)
    }
    if (!surface.dataset.drawn) { draw(0); surface.dataset.drawn = 'true' }
    if (!playing) { player.pause(); return }
    const stream = surface.captureStream?.(30)
    let active = true
    if (stream) {
      player.srcObject = stream
      player.play().then(() => { if (active) player.classList.add('streaming') }).catch(() => {})
    }
    frame = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(frame)
      player.classList.remove('streaming')
      player.srcObject = null
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [playing])

  return <>
    <div className="motion" aria-hidden="true">
      {!profile.heroVideo && <canvas ref={canvas} width="800" height="800" />}
      <video ref={video} className={profile.heroVideo ? 'file-video' : ''} src={profile.heroVideo || undefined} loop muted playsInline />
    </div>
    <button className="motion-control mono" type="button" onClick={() => setPlaying(!playing)}>{playing ? 'Ⅱ 暂停动效' : '▷ 播放动效'}</button>
  </>
}

function Heading({ index, label, children }) {
  return <div className="section-heading"><p className="mono eyebrow">{index} / {label}</p><h2>{children}</h2></div>
}

function App() {
  return <>
    <a className="skip" href="#main">跳到正文</a>
    <header id="top" className="hero">
      <HeroVideo />
      <div className="frame hero-frame">
        <div className="topbar">
          <a className="wordmark" href="#top">HelloLuka<span>.</span></a>
          <nav aria-label="主导航"><a href="#about">关于</a><a href="#work">作品</a><a href="./qianjiao/">千角灯</a><a href="#skills">能力</a></nav>
          <a className="button outline" href="#contact">联系我 <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-content">
          <p className="mono eyebrow"><span className="dot" /> INDEPENDENT DESIGN PORTFOLIO</p>
          <h1>Hello, I’m<br />Luka<span>.</span></h1>
          <p className="hero-desc">视觉设计 / AI 设计 / 品牌设计 / 工业设计</p>
          <a className="text-link" href="#work">浏览作品 <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-foot mono"><span>01 — INTRODUCTION</span></div>
      </div>
    </header>
    <main id="main">
      <section id="about" className="frame section">
        <Heading index="01" label="ABOUT">关于我</Heading>
        <div className="about-grid">
          <figure className="portrait"><img src={profile.portrait} alt={profile.portraitPlaceholder ? 'Luka 的几何剪影占位图' : 'Luka 的照片'} loading="lazy" />{profile.portraitPlaceholder && <figcaption className="mono">FIG. 01 / PORTRAIT PLACEHOLDER</figcaption>}</figure>
          <div className="about-copy">
            <h3>你好，我是 Luka。</h3>
            <p>我是一名跨领域设计师，在视觉、AI、品牌与工业设计之间工作。我关注一个概念如何从屏幕上的图像，走向一致的品牌体验，或者成为可以触摸的物件。</p>
            <a className="text-link" href={profile.email ? 'mailto:' + profile.email : '#contact'}>{profile.email || '联系信息'} <span aria-hidden="true">↗</span></a>
            <dl className="stats"><div><dt>设计方向</dt><dd>04</dd></div><div><dt>精选项目</dt><dd>{String(projects.length).padStart(2, '0')}</dd></div></dl>
          </div>
        </div>
      </section>
      <section id="work" className="frame section">
        <Heading index="02" label="SELECTED WORK">精选项目</Heading>
        <div className="project-grid">{projects.map((project, index) => <article className="project" key={project.title}>
          {project.href ? <a className="project-cover" href={project.href} aria-label={project.linkLabel}><img src={project.image} alt={project.alt} loading="lazy" /></a> : <img src={project.image} alt={project.alt} loading="lazy" />}
          <div className="project-meta"><div><p className="mono">{project.category} · {project.status || '概念示例'}</p><h3>{project.title}</h3></div><span className="mono">0{index + 1}</span></div>
          <p className="project-desc">{project.description}</p>
          {project.href && <a className="text-link project-link" href={project.href}>{project.linkLabel}</a>}
        </article>)}</div>
      </section>
      <section id="skills" className="frame section">
        <Heading index="03" label="CAPABILITIES">我能做什么</Heading>
        <div className="skill-grid">{skills.map(([title, label, description], index) => <article className="skill" key={title}>
          <p className="mono">0{index + 1} / {label}</p><h3>{title}</h3><p>{description}</p>
        </article>)}</div>
      </section>
    </main>
    <footer id="contact" className="contact">
      <div className="frame contact-frame">
        <div className="contact-content">
          <p className="mono eyebrow"><span className="dot" /> 04 / CONTACT</p>
          <h2>Let’s talk<span>.</span></h2>
          <p>有想法或合作计划，欢迎来聊。</p>
          {profile.email ? <a className="button solid" href={'mailto:' + profile.email}>{profile.email} ↗</a> : <span className="pending mono">联系邮箱待更新</span>}
        </div>
        <div className="endbar"><a className="wordmark" href="#top">HelloLuka<span>.</span></a><a className="text-link" href="#top">回到顶部 <span aria-hidden="true">↑</span></a></div>
      </div>
    </footer>
  </>
}

createRoot(document.getElementById('root')).render(<App />)
