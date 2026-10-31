const SELECTORS = [
  '#recursos .grid > article',
  '#como-funciona .space-y-3 > div',
  '#portal .grid > div',
  '#feedback .space-y-3 > div',
  'main > section:last-of-type > div',
];

const READY_ATTRIBUTE = 'data-landing-motion-ready';
const TRANSITION = 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';

// Executado somente enquanto a página pública está montada; nada de observadores
// globais acompanhando os renders frequentes do painel autenticado.
export function startLandingMotion() {
  let intersectionObserver = null;
  let mutationObserver = null;
  let animationFrame = null;
  const pendingTimers = new Set();
  const alreadyScheduled = new WeakSet();

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getElements = () => [
    ...new Set(SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])),
  ];

  const revealElement = (element) => {
    element.style.opacity = '1';
    element.style.transform = 'translate3d(0, 0, 0) scale(1)';
    element.style.willChange = 'auto';
  };

  const prepareElement = (element) => {
    if (element.hasAttribute(READY_ATTRIBUTE)) return;
    element.setAttribute(READY_ATTRIBUTE, 'true');
    element.style.opacity = '0';
    element.style.transform = 'translate3d(0, 40px, 0) scale(0.985)';
    element.style.transition = TRANSITION;
    element.style.willChange = 'opacity, transform';
  };

  const enhance = () => {
    const elements = getElements();
    if (!elements.length) return;

    if (reducedMotion() || !('IntersectionObserver' in window)) {
      elements.forEach(revealElement);
      return;
    }

    if (!intersectionObserver) {
      intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealElement(entry.target);
          intersectionObserver?.unobserve(entry.target);
        });
      }, { threshold: 0.01, rootMargin: '80px 0px -40px 0px' });
    }

    elements.forEach((element, index) => {
      if (alreadyScheduled.has(element)) return;
      alreadyScheduled.add(element);
      prepareElement(element);
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const timer = window.setTimeout(() => {
          pendingTimers.delete(timer);
          revealElement(element);
        }, Math.min(index * 70, 350));
        pendingTimers.add(timer);
      } else {
        intersectionObserver.observe(element);
      }
    });
  };

  const scheduleEnhance = () => {
    if (animationFrame !== null) return;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = null;
      enhance();
    });
  };

  scheduleEnhance();
  window.addEventListener('load', scheduleEnhance);
  mutationObserver = new MutationObserver(scheduleEnhance);
  const landingRoot = document.querySelector('main') || document.body;
  mutationObserver.observe(landingRoot, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('load', scheduleEnhance);
    mutationObserver?.disconnect();
    intersectionObserver?.disconnect();
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
  };
}
