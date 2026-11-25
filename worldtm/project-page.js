const heroFrame = document.getElementById('hero-frame');
let heroVisible = true;
const reportVisibility = () => heroFrame.contentWindow.postMessage({ type: 'wtm-hero-visibility', visible: heroVisible }, '*');
heroFrame.addEventListener('load', () => {
  heroFrame.contentWindow.postMessage({ type: 'wtm-hero-measure' }, '*');
  reportVisibility();
});
new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  reportVisibility();
}).observe(heroFrame);
window.addEventListener('message', event => {
  if (event.source !== heroFrame.contentWindow || event.data?.type !== 'wtm-hero-height') return;
  const height = event.data.height;
  if (Number.isFinite(height) && height > 0) heroFrame.style.height = `${height}px`;
});

const routingFigure = document.querySelector('.routing-figure');
if (matchMedia('(min-width: 1101px) and (prefers-reduced-motion: no-preference)').matches) {
  routingFigure.classList.add('animate-route');
  const routingObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    routingFigure.classList.add('route-running');
    routingObserver.disconnect();
  }, { threshold: .35 });
  routingObserver.observe(routingFigure);
}
