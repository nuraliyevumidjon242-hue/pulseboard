/* PulseBoard presentation deck — keyboard, hash, touch and fullscreen navigation. */
(() => {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counter = document.querySelector('[data-counter]');
  const progress = document.querySelector('[data-progress]');
  const dotsRoot = document.querySelector('[data-dots]');
  const prevBtn = document.querySelector('[data-prev]');
  const nextBtn = document.querySelector('[data-next]');
  const total = slides.length;
  let index = 0;

  const pad = (n) => String(n).padStart(2, '0');

  slides.forEach((_, i) => {
    if (!dotsRoot) return;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.addEventListener('click', () => go(i));
    dotsRoot.appendChild(dot);
  });

  const dots = dotsRoot ? Array.from(dotsRoot.children) : [];

  function render() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    if (counter) counter.innerHTML = `<b>${pad(index + 1)}</b> / ${pad(total)}`;
    if (progress) progress.style.width = `${((index + 1) / total) * 100}%`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;
    const slide = slides[index];
    if (slide) {
      const title = slide.getAttribute('data-title');
      if (title) document.title = `${title} · PulseBoard`;
      const id = slide.id;
      if (id && location.hash !== `#${id}`) {
        history.replaceState(null, '', `#${id}`);
      }
    }
  }

  function go(next) {
    index = Math.max(0, Math.min(total - 1, next));
    render();
  }

  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);

  document.addEventListener('keydown', (event) => {
    const tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.metaKey || event.ctrlKey || event.altKey)
      return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        event.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        prev();
        break;
      case 'Home':
        event.preventDefault();
        go(0);
        break;
      case 'End':
        event.preventDefault();
        go(total - 1);
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        break;
      default:
        break;
    }
  });

  let touchX = null;
  document.addEventListener(
    'touchstart',
    (event) => {
      touchX = event.changedTouches[0]?.clientX ?? null;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (touchX === null) return;
      const delta = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
      if (Math.abs(delta) > 48) {
        if (delta < 0) next();
        else prev();
      }
      touchX = null;
    },
    { passive: true },
  );

  const fromHash = () => {
    const id = location.hash.replace('#', '');
    const found = slides.findIndex((slide) => slide.id === id);
    return found >= 0 ? found : 0;
  };

  window.addEventListener('hashchange', () => go(fromHash()));

  index = fromHash();
  render();
})();
