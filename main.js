(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Boot ---------- */

  body.classList.add('loading');
  const boot = document.getElementById('boot');
  const bootFill = document.getElementById('bootFill');
  const bootCount = document.getElementById('bootCount');
  const bootStart = performance.now();
  const bootDuration = reduced ? 1 : 1400;

  function bootTick(now) {
    const p = clamp((now - bootStart) / bootDuration, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    bootFill.style.width = `${eased * 100}%`;
    bootCount.textContent = `${String(Math.round(eased * 100)).padStart(3, '0')}%`;
    if (p < 1) return requestAnimationFrame(bootTick);
    boot.classList.add('done');
    body.classList.remove('loading');
    setTimeout(observeReveals, 200);
  }
  requestAnimationFrame(bootTick);

  /* ---------- Ambient rack LEDs ---------- */

  const canvas = document.getElementById('leds');
  const ctx = canvas.getContext('2d');
  const CELL = 56;
  const palettes = {
    dark: ['#3fa9ff', '#3fa9ff', '#46f0a0', '#7cc4ff'],
    bad: ['#ff2a1f', '#ff2a1f', '#ff5a1f', '#3fa9ff'],
    good: ['#8fd0ff', '#bfe4ff', '#ffd98a'],
  };
  let leds = [];
  let mouse = { x: -9999, y: -9999 };
  let dpr = 1;

  function buildLeds() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    leds = [];
    const cols = Math.ceil(innerWidth / CELL);
    const rows = Math.ceil(innerHeight / CELL);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() > 0.22) continue;
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          leds.push({
            x: c * CELL + 8 + i * 7,
            y: r * CELL + 8,
            phase: Math.random() * Math.PI * 2,
            speed: 0.4 + Math.random() * 2.2,
            hue: Math.floor(Math.random() * 4),
            stepped: Math.random() > 0.5,
          });
        }
      }
    }
  }

  let lastFrame = 0;
  function drawLeds(now) {
    requestAnimationFrame(drawLeds);
    if (now - lastFrame < 33) return;
    lastFrame = now;
    const t = now / 1000;
    const palette = palettes[body.dataset.mode] || palettes.dark;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const led of leds) {
      let a = (Math.sin(t * led.speed + led.phase) + 1) / 2;
      if (led.stepped) a = a > 0.5 ? 1 : 0.15;
      const dx = led.x - mouse.x;
      const dy = led.y - mouse.y;
      const near = clamp(1 - Math.sqrt(dx * dx + dy * dy) / 220, 0, 1);
      ctx.globalAlpha = clamp(a * 0.35 + near * 0.9, 0, 1);
      ctx.fillStyle = palette[led.hue % palette.length];
      ctx.fillRect(led.x, led.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  buildLeds();
  if (!reduced) requestAnimationFrame(drawLeds);
  else drawLeds(0);
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildLeds, 150);
  });

  /* ---------- Cursor ---------- */

  const cursor = document.getElementById('cursor');
  let cx = innerWidth / 2;
  let cy = innerHeight / 2;
  addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  (function moveCursor() {
    cx = lerp(cx, mouse.x, 0.2);
    cy = lerp(cy, mouse.y, 0.2);
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(moveCursor);
  })();
  document.addEventListener('mouseover', (e) => {
    cursor.classList.toggle('hover', !!e.target.closest('[data-cursor], a, button, summary, input'));
  });
  document.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });

  /* ---------- Navigation ---------- */

  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  navToggle.addEventListener('click', () => nav.classList.toggle('open'));
  document.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => nav.classList.remove('open'))
  );

  /* ---------- Reveals & counters ---------- */

  function scramble(el) {
    const target = parseFloat(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    const plain = el.hasAttribute('data-plain');
    const digits = plain
      ? Math.max(1, String(Math.round(target)).length)
      : Math.max(3, String(Math.round(target)).length);
    const duration = 1600;
    const start = performance.now();
    (function step(now) {
      const p = clamp((now - start) / duration, 0, 1);
      if (p < 0.6) {
        el.textContent = Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join('') + suffix;
      } else {
        const v = Math.round(target * (1 - Math.pow(1 - (p - 0.6) / 0.4, 3)));
        el.textContent = (plain ? String(v) : String(v).padStart(digits, '0')) + suffix;
      }
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  function observeReveals() {
    document.querySelectorAll('.hero .reveal, .hero .split').forEach((el) => el.classList.add('in'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          entry.target.querySelectorAll('[data-count]').forEach(scramble);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('.reveal, .split, .reveal-img').forEach((el) => io.observe(el));
  }

  /* ---------- Section mode, rack indicator, nav state ---------- */

  const sections = [...document.querySelectorAll('main .section')];
  const rackLinks = [...document.querySelectorAll('#rack a')];
  const navLinks = [...document.querySelectorAll('.nav__links a')];
  const tension = document.getElementById('tension');
  const balance = document.getElementById('balance');
  const parallaxEls = [...document.querySelectorAll('.parallax')];
  let lastY = scrollY;
  let tensionT = 0;
  let ticking = false;

  const darkRGB = [3, 0, 0];
  const lightRGB = [238, 243, 246];
  const badText = [255, 42, 31];
  const goodText = [12, 26, 36];

  function setTension(t) {
    tensionT = t;
    tension.style.setProperty('--t', t.toFixed(3));
    const bg = darkRGB.map((v, i) => Math.round(lerp(v, lightRGB[i], t)));
    const fg = badText.map((v, i) => Math.round(lerp(v, goodText[i], t)));
    tension.style.backgroundColor = `rgb(${bg.join(',')})`;
    tension.style.color = `rgb(${fg.join(',')})`;
  }

  function onScroll() {
    ticking = false;
    const y = scrollY;
    const vh = innerHeight;
    const mid = vh * 0.5;

    nav.classList.toggle('scrolled', y > 40);
    nav.classList.toggle('hidden', y > lastY && y > vh * 0.8 && !nav.classList.contains('open'));
    lastY = y;

    let current = sections[0];
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { current = s; break; }
    }
    if (y + vh >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];

    const tr = tension.getBoundingClientRect();
    const tp = clamp(-tr.top / (tr.height - vh), 0, 1);
    if (tr.top < vh && tr.bottom > 0) {
      setTension(tp);
      balance.value = Math.round(tp * 100);
    }

    let mode = current.dataset.mode;
    if (current === tension) mode = tensionT > 0.5 ? 'good' : 'bad';
    body.dataset.mode = mode;

    const id = current.id;
    const act = current.dataset.act || '';
    const place = document.getElementById('place');
    if (place) {
      const label = current.dataset.place || '';
      place.textContent = label;
      place.classList.toggle('is-on', !!label);
    }
    rackLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
    navLinks.forEach((a) => a.classList.toggle('active', !!act && a.dataset.act === act));

    document.querySelectorAll('.gate').forEach((gate) => {
      const r = gate.getBoundingClientRect();
      const travel = Math.max(r.height - vh, 1);
      const p = clamp(-r.top / travel, 0, 1);
      gate.style.setProperty('--p', p.toFixed(3));
      const word = gate.querySelector('.gate__word');
      if (!word) return;
      word.textContent = p > 0.5 ? 'THE FUTURE' : 'THE TENSION';
      word.style.opacity = String(Math.min(1, Math.abs(p - 0.5) * 4));
    });

    if (!reduced) {
      for (const el of parallaxEls) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const offset = (r.top + r.height / 2 - mid) * parseFloat(el.dataset.speed || 0);
        el.style.transform = `translate3d(0, ${offset}px, 0)`;
      }
    }
  }

  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  balance.addEventListener('input', () => {
    setTension(balance.value / 100);
    body.dataset.mode = tensionT > 0.5 ? 'good' : 'bad';
  });

  /* ---------- Live ticker (the bad) ---------- */

  const ticker = document.getElementById('ticker');
  if (ticker) {
    const rate = parseFloat(ticker.dataset.rate) || 0;
    const tickStart = performance.now();
    (function tick(now) {
      const v = Math.floor(((now - tickStart) / 1000) * rate);
      ticker.textContent = v.toLocaleString();
      requestAnimationFrame(tick);
    })(tickStart);
  }

  /* ---------- Map pins ---------- */

  const pins = [...document.querySelectorAll('.pin, .site')];
  const pinName = document.getElementById('pinName');
  const pinMeta = document.getElementById('pinMeta');
  const pinNote = document.getElementById('pinNote');
  pins.forEach((pin) =>
    pin.addEventListener('click', () => {
      pins.forEach((p) => p.classList.toggle('active', p === pin));
      pinName.textContent = pin.dataset.name;
      pinMeta.textContent = pin.dataset.meta;
      if (pinNote && pin.dataset.note) pinNote.textContent = pin.dataset.note;
    })
  );

  /* ---------- Brief tint ---------- */

  const brief = document.getElementById('brief');
  if (brief) {
    brief.querySelectorAll('.brief__item').forEach((item) => {
      item.addEventListener('mouseenter', () => { brief.dataset.hover = item.dataset.q; });
      item.addEventListener('mouseleave', () => { delete brief.dataset.hover; });
    });
  }

  /* ---------- Scenario board ---------- */

  const scenarioBtns = [...document.querySelectorAll('.scenario')];
  const scenarioPanels = [...document.querySelectorAll('.scenario__panel')];
  scenarioBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.panel;
      scenarioBtns.forEach((b) => b.classList.toggle('is-on', b === btn));
      scenarioPanels.forEach((panel) => panel.classList.toggle('is-on', panel.dataset.panel === id));
    });
  });
})();
