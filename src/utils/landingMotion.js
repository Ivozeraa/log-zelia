const SELECTORS = [
  '#recursos > div',
  '#como-funciona > div',
  '#portal > div',
  '#feedback > div',
  'main > section:last-of-type > div',
  '#recursos .grid > article',
  '#como-funciona .space-y-3 > div',
  '#portal .grid > div',
  '#feedback .space-y-3 > div',
];

const REVEAL = 'landing-reveal';
const VISIBLE = 'landing-reveal-visible';

function enhance() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const elements = [...new Set(SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)]))];
  if (!elements.length) return;

  elements.forEach((element) => {
    if (element.dataset.motionReady === 'true') return;
    element.dataset.motionReady = 'true';
    element.classList.add(REVEAL);
    element.classList.add('translate-y-8', 'opacity-0', 'scale-[0.985]');
    element.classList.add('transition-all', 'duration-700', 'ease-out', 'will-change-transform');
  });

  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add(VISIBLE, 'translate-y-0', 'opacity-100', 'scale-100'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('translate-y-8', 'opacity-0', 'scale-[0.985]');
      entry.target.classList.add(VISIBLE, 'translate-y-0', 'opacity-100', 'scale-100');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  elements.forEach((element) => observer.observe(element));
}

let scheduled = false;
const scheduleEnhance = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
};

enhance();
window.addEventListener('load', scheduleEnhance, { once: true });
const mutationObserver = new MutationObserver(scheduleEnhance);
mutationObserver.observe(document.body, { childList: true, subtree: true });
