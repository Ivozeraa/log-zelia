const SELECTORS = [
  '#recursos .grid > article',
  '#como-funciona .space-y-3 > div',
  '#portal .grid > div',
  '#feedback .space-y-3 > div',
  'main > section:last-of-type > div',
];

const READY_ATTRIBUTE = 'data-landing-motion-ready';
const TRANSITION = 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';

let observer = null;
let rafId = null;
let initialized = false;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getElements = () => [
  ...new Set(SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])),
];

const prepareElement = (element) => {
  if (element.hasAttribute(READY_ATTRIBUTE)) return;
  element.setAttribute(READY_ATTRIBUTE, 'true');
  element.style.opacity = '0';
  element.style.transform = 'translate3d(0, 40px, 0) scale(0.985)';
  element.style.transition = TRANSITION;
  element.style.willChange = 'opacity, transform';
};

const revealElement = (element) => {
  element.style.opacity = '1';
  element.style.transform = 'translate3d(0, 0, 0) scale(1)';
  element.style.willChange = 'auto';
};

const enhance = () => {
  const elements = getElements();
  if (!elements.length) return;

  if (reducedMotion()) {
    elements.forEach(revealElement);
    initialized = true;
    return;
  }

  elements.forEach(prepareElement);

  if (!('IntersectionObserver' in window)) {
    elements.forEach(revealElement);
    initialized = true;
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        observer?.unobserve(entry.target);
      });
    }, {
      threshold: 0.01,
      rootMargin: '80px 0px -40px 0px',
    });
  }

  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;

    if (alreadyVisible) {
      window.setTimeout(() => revealElement(element), Math.min(index * 70, 350));
    } else {
      observer.observe(element);
    }
  });

  initialized = true;
};

const scheduleEnhance = () => {
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    enhance();
  });
};

const boot = () => {
  if (initialized) return;
  scheduleEnhance();
};

boot();
window.addEventListener('DOMContentLoaded', boot, { once: true });
window.addEventListener('load', scheduleEnhance, { once: true });

const mutationObserver = new MutationObserver(scheduleEnhance);
mutationObserver.observe(document.body, { childList: true, subtree: true });
