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

const READY_ATTRIBUTE = 'data-landing-motion-ready';
const FALLBACK_STYLES = {
  opacity: '0',
  transform: 'translate3d(0, 40px, 0) scale(0.985)',
};
const VISIBLE_STYLES = {
  opacity: '1',
  transform: 'translate3d(0, 0, 0) scale(1)',
};

const getElements = () => [
  ...new Set(SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])),
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const prepareElement = (element) => {
  if (element.hasAttribute(READY_ATTRIBUTE)) return;

  element.setAttribute(READY_ATTRIBUTE, 'true');
  element.classList.add('landing-reveal');

  Object.assign(element.style, FALLBACK_STYLES);
};

const revealElement = (element) => {
  // Force the browser to commit the initial state before switching to the final state.
  void element.offsetHeight;

  Object.assign(element.style, VISIBLE_STYLES);
  element.classList.add('landing-reveal-visible');
};

let observer = null;
let rafId = null;

const enhance = () => {
  if (reducedMotion()) return;

  const elements = getElements();
  if (!elements.length) return;

  elements.forEach(prepareElement);

  if (!('IntersectionObserver' in window)) {
    elements.forEach(revealElement);
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -10% 0px',
    });
  }

  elements.forEach((element) => observer.observe(element));
};

const scheduleEnhance = () => {
  if (rafId !== null) return;

  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    enhance();
  });
};

enhance();
window.addEventListener('load', scheduleEnhance, { once: true });

const mutationObserver = new MutationObserver(scheduleEnhance);
mutationObserver.observe(document.body, { childList: true, subtree: true });
