(() => {
  const viewport = document.getElementById('worldViewport');
  const world = document.getElementById('worldContent');
  const panelTitle = document.getElementById('worldTitle');
  const panelLocation = document.getElementById('worldLocation');
  const panelCount = document.getElementById('worldCount');
  const panelDescription = document.getElementById('worldDescription');
  const panelAction = document.getElementById('worldAction');
  const sceneImage = document.querySelector('.world-scene-image');
  const markers = [...document.querySelectorAll('.map-pin')];
  if (!viewport || !world || !markers.length) return;

  if (sceneImage && location.protocol !== 'file:') {
    fetch('forest-world-image.txt')
      .then(response => response.ok ? response.text() : '')
      .then(data => { if (data) sceneImage.src = `data:image/jpeg;base64,${data.trim()}`; })
      .catch(() => {});
  }

  let zoom = 1.08;
  let offsetX = 0;
  let offsetY = 0;
  let pointerStart = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const keepInside = () => {
    const bounds = viewport.getBoundingClientRect();
    const limitX = bounds.width * (zoom - 1) / 2;
    const limitY = bounds.height * (zoom - 1) / 2;
    offsetX = clamp(offsetX, -limitX, limitX);
    offsetY = clamp(offsetY, -limitY, limitY);
  };
  const paint = () => {
    keepInside();
    world.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoom})`;
  };
  const setZoom = next => {
    zoom = clamp(next, 1, 2.6);
    if (zoom === 1) offsetX = offsetY = 0;
    paint();
  };

  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    pointerStart = {x:event.clientX, y:event.clientY, offsetX, offsetY};
    world.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointerStart) return;
    offsetX = pointerStart.offsetX + event.clientX - pointerStart.x;
    offsetY = pointerStart.offsetY + event.clientY - pointerStart.y;
    paint();
  });
  const stopDragging = event => {
    if (!pointerStart) return;
    pointerStart = null;
    world.classList.remove('is-dragging');
    if (event && viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup', stopDragging);
  viewport.addEventListener('pointercancel', stopDragging);
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.89));
  }, {passive:false});

  document.querySelectorAll('[data-map-zoom]').forEach(button => {
    button.addEventListener('click', () => setZoom(zoom * (button.dataset.mapZoom === 'in' ? 1.25 : 0.8)));
  });
  document.querySelector('[data-map-reset]')?.addEventListener('click', () => {
    zoom = 1.08;
    offsetX = offsetY = 0;
    paint();
  });

  markers.forEach((marker, index) => {
    marker.setAttribute('aria-pressed', 'false');
    marker.addEventListener('click', () => {
      markers.forEach(item => {
        item.classList.remove('is-active');
        item.setAttribute('aria-pressed', 'false');
      });
      marker.classList.add('is-active');
      marker.setAttribute('aria-pressed', 'true');
      panelLocation.textContent = marker.dataset.location || 'PROJEKT';
      panelCount.textContent = `${String(index + 1).padStart(2, '0')} / ${String(markers.length).padStart(2, '0')}`;
      panelTitle.textContent = marker.dataset.title || 'Projekt';
      panelDescription.textContent = marker.dataset.description || '';
      panelAction.href = marker.dataset.href || '#projekty';
      panelAction.innerHTML = `${marker.dataset.cta || 'Viac informácií'} <span>↗</span>`;
    });
  });
  window.addEventListener('resize', paint);
  paint();
})();

