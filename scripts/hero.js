(function() {
  // Hero state machine — three text states swap as you scroll the hero
  const heroSection = document.getElementById('hero');
  const videoScrollRegion = document.getElementById('videoScrollRegion');
  const heroVideo = document.getElementById('heroVideo');
  const leftStates = document.querySelectorAll('#heroStates .hero-state');
  const rightStates = document.querySelectorAll('#heroRightStates .hero-state');
  const totalStates = leftStates.length;

  let lastState = -1;
  let videoReady = false;
  let videoDuration = 0;

  if (heroVideo) {
    // Try to start playback briefly so iOS will allow currentTime seeks, then pause.
    heroVideo.play().then(() => heroVideo.pause()).catch(() => {});
    const onMeta = () => {
      videoDuration = heroVideo.duration || 0;
      videoReady = videoDuration > 0;
      update();
    };
    if (heroVideo.readyState >= 1 && heroVideo.duration) onMeta();
    else heroVideo.addEventListener('loadedmetadata', onMeta, { once: true });
  }

  function update() {
    // HERO state machine: progress within the hero pin only
    const heroRect = heroSection.getBoundingClientRect();
    const heroTotal = heroSection.offsetHeight - window.innerHeight;
    const heroScrolled = Math.min(Math.max(-heroRect.top, 0), heroTotal);
    const heroProgress = heroTotal > 0 ? heroScrolled / heroTotal : 0;

    // VIDEO scrub: progress across the whole video-scroll-region (hero + white + partners)
    if (videoReady && heroVideo && videoScrollRegion) {
      const vRect = videoScrollRegion.getBoundingClientRect();
      const vTotal = videoScrollRegion.offsetHeight - window.innerHeight;
      const vScrolled = Math.min(Math.max(-vRect.top, 0), vTotal);
      const vProgress = vTotal > 0 ? vScrolled / vTotal : 0;
      const t = Math.max(0, Math.min(videoDuration - 0.05, vProgress * videoDuration));
      if (Math.abs(heroVideo.currentTime - t) > 0.03) {
        try { heroVideo.currentTime = t; } catch (e) {}
      }
    }

    // Weighted state thresholds so the middle "one million" state holds longer.
    const stops = [0.22, 0.78, 1.0];
    let stateIdx = totalStates - 1;
    for (let i = 0; i < stops.length; i++) {
      if (heroProgress < stops[i]) { stateIdx = i; break; }
    }
    if (stateIdx !== lastState) {
      leftStates.forEach((el, i) => el.dataset.active = (i === stateIdx) ? 'true' : 'false');
      rightStates.forEach((el, i) => el.dataset.active = (i === stateIdx) ? 'true' : 'false');
      lastState = stateIdx;
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { update(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  // Brands slider — auto-rotate every 6s
  const slider = document.getElementById('brandsSlider');
  if (slider) {
    const slides = slider.querySelectorAll('.brands-slide');
    const dots = slider.querySelectorAll('.brands-dots button');
    let idx = 0;
    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.dataset.active = (k === idx) ? 'true' : 'false');
      dots.forEach((d, k) => d.classList.toggle('active', k === idx));
    }
    dots.forEach(d => d.addEventListener('click', () => {
      go(parseInt(d.dataset.i, 10));
      clearInterval(timer); timer = setInterval(() => go(idx + 1), 6000);
    }));
    let timer = setInterval(() => go(idx + 1), 6000);
  }

  // Active nav indicator
  const links = document.querySelectorAll('.nav-pill a');
  const sections = ['#work', '#topics', '#about', '#contact'].map(s => document.querySelector(s));
  window.addEventListener('scroll', () => {
    const y = window.scrollY + 200;
    let activeIdx = 0;
    sections.forEach((s, i) => { if (s && s.offsetTop <= y) activeIdx = i; });
    links.forEach((l, i) => l.classList.toggle('active', i === activeIdx));
  }, { passive: true });
})();
