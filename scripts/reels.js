(function() {
  var prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rail = document.getElementById('reelsRail');
  var viewport = document.getElementById('reelsViewport');
  if (!rail || !viewport) return;

  // ---- 0. Wire video src + poster from each .reel-frame's data-attrs
  // Run BEFORE the clone step so deep-cloned cards inherit the src/poster.
  Array.prototype.forEach.call(rail.querySelectorAll('.reel-frame'), function(frame) {
    var video = frame.querySelector('.reel-video');
    if (!video) return;
    var src = frame.getAttribute('data-video');
    var poster = frame.getAttribute('data-poster');
    if (src) video.setAttribute('src', src);
    if (poster) video.setAttribute('poster', poster);
    video.setAttribute('autoplay', '');
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function() {});
  });

  // ---- 1. Duplicate the cards so the marquee can loop seamlessly
  var originals = Array.prototype.slice.call(rail.children);
  originals.forEach(function(card) {
    var clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.dataset.clone = '1';
    rail.appendChild(clone);
  });

  // ---- 2. Auto-scroll loop (translate the rail)
  var trackWidth = 0;
  function measure() {
    // Width of one full set (originals only)
    var first = originals[0].getBoundingClientRect().left;
    var last = originals[originals.length - 1];
    var lastRect = last.getBoundingClientRect();
    var gap = parseFloat(getComputedStyle(rail).gap) || 16;
    trackWidth = (lastRect.right - first) + gap;
  }
  measure();
  window.addEventListener('resize', measure, { passive: true });

  var offset = 0;        // current translation
  var velocity = 0;      // px / frame, used for momentum after drag
  var paused = false;
  var dragging = false;
  var dragStartX = 0;
  var dragStartOffset = 0;
  var lastDragX = 0;
  var lastDragT = 0;
  var BASE_SPEED = trackWidth ? -(trackWidth / (90 * 60)) : -0.3; // ~90s loop at 60fps

  function step() {
    if (!paused && !dragging) {
      // Auto-scroll
      offset += BASE_SPEED;
      // Apply momentum velocity from drag, decay it
      offset += velocity;
      velocity *= 0.94;
      if (Math.abs(velocity) < 0.02) velocity = 0;
    }
    // Wrap
    if (trackWidth > 0) {
      while (offset <= -trackWidth) offset += trackWidth;
      while (offset > 0) offset -= trackWidth;
    }
    rail.style.transform = 'translate3d(' + offset.toFixed(2) + 'px, 0, 0)';
    requestAnimationFrame(step);
  }
  if (!prefersReduce) {
    requestAnimationFrame(step);
  } else {
    // Static layout — let the user scroll the viewport horizontally instead
    viewport.style.overflowX = 'auto';
  }

  // ---- 3. Pause on hover, resume on leave
  viewport.addEventListener('mouseenter', function() { paused = true; });
  viewport.addEventListener('mouseleave', function() { paused = false; });

  // ---- 4. Drag override
  function onDown(e) {
    dragging = true;
    paused = true;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    dragStartX = x;
    lastDragX = x;
    lastDragT = performance.now();
    dragStartOffset = offset;
    velocity = 0;
    rail.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0].clientX : e.clientX);
    offset = dragStartOffset + (x - dragStartX);
    var now = performance.now();
    var dt = Math.max(1, now - lastDragT);
    // Convert px/ms into px/frame (~16.67ms/frame)
    velocity = ((x - lastDragX) / dt) * 16.67;
    lastDragX = x;
    lastDragT = now;
    if (e.cancelable) e.preventDefault();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    rail.style.cursor = '';
    // Briefly keep paused so momentum carries before auto-scroll resumes
    setTimeout(function() {
      // Only un-pause if cursor isn't still over viewport
      if (!viewport.matches(':hover')) paused = false;
    }, 800);
  }
  viewport.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  viewport.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  // ---- 5. Tilt on hover (3D)
  if (!prefersReduce) {
    Array.prototype.forEach.call(rail.querySelectorAll('.reel-card'), function(card) {
      var frame = card.querySelector('.reel-frame');
      if (!frame) return;
      card.addEventListener('mousemove', function(e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;   // 0..1
        var py = (e.clientY - r.top) / r.height;   // 0..1
        var rotY = (px - 0.5) * 12;   // ±6°
        var rotX = (0.5 - py) * 12;
        card.style.transform = 'perspective(900px) rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg) translateZ(8px)';
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
      });
    });
  }

  // ---- 6. Like-count tickers — animate from 0 to value when in view
  function formatLikes(n) {
    if (n >= 1000) {
      var k = n / 1000;
      // 1 decimal if not a round number; trim trailing .0
      var s = (k >= 100 ? Math.round(k).toString() : k.toFixed(1));
      if (s.indexOf('.0') === s.length - 2) s = s.slice(0, -2);
      return s + 'K';
    }
    return Math.round(n).toString();
  }
  function animateTicker(el) {
    if (el.dataset.played === '1') return;
    el.dataset.played = '1';
    var target = parseFloat(el.getAttribute('data-likes'));
    if (!target) { el.textContent = '0'; return; }
    var start = performance.now();
    var DUR = 1200;
    function frame(now) {
      var t = Math.min(1, (now - start) / DUR);
      // ease-out cubic
      var eased = 1 - Math.pow(1 - t, 3);
      var v = target * eased;
      el.textContent = formatLikes(v);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // Only animate originals (not clones), but show clones at final value immediately
  var originalTickers = [];
  originals.forEach(function(card) {
    Array.prototype.forEach.call(card.querySelectorAll('[data-likes]'), function(el) {
      originalTickers.push(el);
    });
  });
  // Initialise clones to final formatted value
  Array.prototype.forEach.call(rail.querySelectorAll('[data-clone="1"] [data-likes]'), function(el) {
    el.textContent = formatLikes(parseFloat(el.getAttribute('data-likes')) || 0);
  });

  if (!('IntersectionObserver' in window)) {
    originalTickers.forEach(animateTicker);
  } else {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (en.isIntersecting) animateTicker(en.target);
      });
    }, { threshold: 0.4 });
    originalTickers.forEach(function(el) { io.observe(el); });
  }
})();

// Partner-grid stagger reveal — fades each tile in with a 40ms-per-tile delay
(function() {
  var prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var grids = document.querySelectorAll('.partner-grid');
  if (!grids.length) return;
  grids.forEach(function(grid) {
    var tiles = Array.prototype.slice.call(grid.querySelectorAll('.partner-tile'));
    if (prefersReduce) {
      tiles.forEach(function(t) { t.classList.add('is-revealed'); });
      return;
    }
    tiles.forEach(function(t, i) { t.style.setProperty('--reveal-delay', (i * 40) + 'ms'); });
    if (!('IntersectionObserver' in window)) {
      tiles.forEach(function(t) { t.classList.add('is-revealed'); });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (en.isIntersecting) {
          tiles.forEach(function(t) { t.classList.add('is-revealed'); });
          io.disconnect();
        }
      });
    }, { threshold: 0.18 });
    io.observe(grid);
  });
})();


// ---- Reel video: autoplay when in view, pause when out, fallback to poster bg
(function(){
  var videos = document.querySelectorAll('.reel-frame .reel-video');
  if (!videos.length) return;

  // Fallback colors per card index — used if video AND poster both fail to load
  var fallbacks = [
    'linear-gradient(160deg, #c1958a 0%, #6e3f3f 100%)',
    'linear-gradient(160deg, #d4b08c 0%, #6b4a2f 100%)',
    'linear-gradient(160deg, #2b2b2e 0%, #0a0a0c 100%)',
    'linear-gradient(160deg, #b8c0d2 0%, #4a5468 100%)',
    'linear-gradient(160deg, #e8a878 0%, #8b3f1f 100%)',
    'linear-gradient(160deg, #5a6d7a 0%, #1a2530 100%)'
  ];
  Array.prototype.forEach.call(document.querySelectorAll('.reels-rail > .reel-card'), function(card, i){
    var frame = card.querySelector('.reel-frame');
    if (frame && !frame.style.background) frame.style.background = fallbacks[i % fallbacks.length];
    // Mirror to clone if present (clones come after originals)
  });

  // If a poster image fails to load, hide the <video> entirely so the gradient bg shows
  Array.prototype.forEach.call(videos, function(v){
    v.addEventListener('error', function(){ v.style.display = 'none'; }, true);
    // Also hide if no <source> resolves after a moment (network 404)
    var src = v.currentSrc || (v.querySelector('source') && v.querySelector('source').src);
    if (src) {
      // Probe with HEAD via Image is unreliable for mp4; just rely on 'error' bubbling
    }
  });

  // Pause/play based on visibility
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var v = e.target;
        if (e.isIntersecting && e.intersectionRatio > 0.4) {
          var p = v.play();
          if (p && p.catch) p.catch(function(){});
        } else {
          v.pause();
        }
      });
    }, { threshold: [0, 0.4, 0.8] });
    Array.prototype.forEach.call(videos, function(v){ io.observe(v); });
  } else {
    Array.prototype.forEach.call(videos, function(v){
      var p = v.play(); if (p && p.catch) p.catch(function(){});
    });
  }
})();
