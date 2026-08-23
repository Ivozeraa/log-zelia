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
const TRANSITION = 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';

const getElements = () => [
  ...new Set(SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])),
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const prepareElement = (element) => {
  if (element.hasAttribute(READY_ATTRIBUTE)) return;

  element.setAttribute(READY_ATTRIBUTE, 'true');
  element.classList.add('landing-reveal');
  element.style.transition = TRANSITION;
  element.style.willChange = 'opacity, transform';
  element.style.opacity = '0';
  element.style.transform = 'translate3d(0, 40px, 0) scale(0.985)';
};

const revealElement = (element) => {
  // Force a layout pass so the browser cannot collapse the initial and final states.
  void element.offsetHeight;
  element.style.opacity = '1';
  element.style.transform = 'translate3d(0, 0, 0) scale(1)';
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
    observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        currentObserver.unobserve(entry.target);
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
