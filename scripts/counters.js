// Counter animation for [data-counter] numbers — fires once when scrolled into view
(function() {
  var counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  function animate(el) {
    if (el.dataset.playing === '1') return;
    el.dataset.playing = '1';
    var target = parseFloat(el.getAttribute('data-counter')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var duration = 1600;
    var start = performance.now();
    function ease(t) { return 1 - Math.pow(1 - t, 3); } // easeOutCubic
    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      var v = target * ease(p);
      el.textContent = (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = (decimals > 0 ? target.toFixed(decimals) : Math.round(target).toLocaleString()) + suffix;
        el.dataset.playing = '0';
      }
    }
    requestAnimationFrame(frame);
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach(animate);
    return;
  }
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        animate(e.target);
      } else {
        // Reset to 0 when out of view so re-entry replays the count
        if (e.target.dataset.playing !== '1') {
          var suffix = e.target.getAttribute('data-suffix') || '';
          var decimals = parseInt(e.target.getAttribute('data-decimals') || '0', 10);
          e.target.textContent = (decimals > 0 ? (0).toFixed(decimals) : '0') + suffix;
        }
      }
    });
  }, { threshold: 0.4 });
  counters.forEach(function(el) { io.observe(el); });
})();
