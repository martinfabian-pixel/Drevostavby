/**
 * DREVOFORM camera controller.
 * buildings: Map<string, { group, center: THREE.Vector3, radius, height }>.
 * update(dt) takes seconds; onSelect receives viewport client coordinates.
 * zoomBy(1) zooms in and zoomBy(-1) zooms out.
 */
export function createForestCamera({
  THREE, camera, element, terrainHeight, buildings,
  onSelect = () => {}, onInteraction = () => {},
  quality = 'high', reducedMotion = false,
}) {
  const clamp = THREE.MathUtils.clamp;
  const target = new THREE.Vector3(0, 1.4, 0);
  const wantedTarget = target.clone();
  const overviewTarget = target.clone();
  const eye = new THREE.Vector3();
  const pointers = new Map();
  const listeners = [];
  const previousTouchAction = element.style.touchAction;
  const previousTabIndex = element.getAttribute('tabindex');
  const previousAriaLabel = element.getAttribute('aria-label');
  let enabled = true;
  let hasInteracted = false;
  let selectedId = null;
  let overviewRadius = 53;
  let maximumRadius = 78;
  let minimumRadius = 7.5;
  let theta = 0.48;
  let phi = 1.03;
  let radius = 61;
  let wantedTheta = 0.6;
  let wantedPhi = 0.94;
  let wantedRadius = overviewRadius;
  let angularVelocityX = 0;
  let angularVelocityY = 0;
  let zoomVelocity = 0;
  let gestureHadMultiplePointers = false;
  let pinchDistance = 0;
  let transition = null;
  let disposed = false;

  element.style.touchAction = 'none';
  if (previousTabIndex === null) element.tabIndex = 0;
  if (previousAriaLabel === null) {
    element.setAttribute('aria-label', 'Interaktívny les. Potiahnutím otáčate pohľad, dvoma prstami alebo kolieskom približujete. Kliknutím vyberiete stavbu.');
  }

  function listen(node, name, handler, options) {
    node.addEventListener(name, handler, options);
    listeners.push(() => node.removeEventListener(name, handler, options));
  }

  function floorAt(x, z) {
    const height = terrainHeight ? terrainHeight(x, z) : 0;
    return Number.isFinite(height) ? height : 0;
  }

  function buildingInfo(id) {
    const item = buildings?.get(id);
    if (!item) return null;
    const group = item.group || item;
    const center = item.center || group.getWorldPosition(new THREE.Vector3());
    return { center, radius: item.radius || 4.5, height: item.height || 5.5 };
  }

  function cancelTransition() {
    if (!transition) return;
    transition = null;
    wantedTheta = theta;
    wantedPhi = phi;
    wantedRadius = radius;
    wantedTarget.copy(target);
  }

  function interact(type) {
    hasInteracted = true;
    cancelTransition();
    onInteraction(type);
  }

  function startTransition(endTarget, endTheta, endPhi, endRadius, duration, kind = 'focus') {
    angularVelocityX = angularVelocityY = zoomVelocity = 0;
    wantedTarget.copy(endTarget);
    wantedTheta = theta + Math.atan2(Math.sin(endTheta - theta), Math.cos(endTheta - theta));
    wantedPhi = clamp(endPhi, 0.3, 1.35);
    wantedRadius = clamp(endRadius, minimumRadius, maximumRadius);
    if (reducedMotion) {
      target.copy(wantedTarget);
      theta = wantedTheta;
      phi = wantedPhi;
      radius = wantedRadius;
      transition = null;
      placeCamera();
      return;
    }
    transition = {
      elapsed: 0, duration, kind,
      target: target.clone(), theta, phi, radius,
    };
  }

  function focus(id) {
    if (disposed || !enabled) return;
    const info = buildingInfo(id);
    if (!info) return;
    hasInteracted = true;
    selectedId = id;
    minimumRadius = Math.max(7.5, info.radius * 1.5 + 1.5);
    const focusTarget = info.center.clone();
    focusTarget.y += Math.max(1.35, info.height * 0.43);
    const angles = { vlciaren: 0.64, maka: 0.49, family: 0.68, cabin: 0.73, studio: 0.64 };
    const aspectCompensation = Math.max(1, 0.88 / Math.max(camera.aspect || 1, 0.45));
    const framingRadius = Math.max(info.radius * 3.1, info.height * 2.25, 12) * aspectCompensation;
    startTransition(focusTarget, angles[id] ?? 0.62, 1.12, framingRadius, 1.85);
    onInteraction('focus');
  }

  function resetCamera(animate = true) {
    selectedId = null;
    minimumRadius = 7.5;
    if (animate) startTransition(overviewTarget, 0.6, 0.94, overviewRadius, 1.75, 'reset');
    else {
      target.copy(overviewTarget);
      wantedTarget.copy(overviewTarget);
      theta = wantedTheta = 0.6;
      phi = wantedPhi = 0.94;
      radius = wantedRadius = overviewRadius;
      angularVelocityX = angularVelocityY = zoomVelocity = 0;
      transition = null;
      placeCamera();
    }
  }

  function reset() {
    if (disposed || !enabled) return;
    // The scene resets its project panel immediately after shader compilation.
    // Preserve the already-framed opening move until a person actually acts.
    if (!hasInteracted && !selectedId) return;
    hasInteracted = true;
    resetCamera(true);
    onInteraction('reset');
  }

  function zoomBy(direction) {
    if (disposed || !enabled || !Number.isFinite(direction)) return;
    interact('zoom');
    // Multiplicative zoom naturally makes each step smaller near a building.
    wantedRadius = clamp(wantedRadius * Math.exp(-direction * 0.14), minimumRadius, maximumRadius);
    zoomVelocity = 0;
  }

  function rotationScale() {
    return 0.0031 * clamp(radius / overviewRadius, 0.3, 1.1);
  }

  function touchSeparation() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  function pointerDown(event) {
    if (!enabled || disposed || (event.pointerType === 'mouse' && event.button !== 0)) return;
    angularVelocityX = angularVelocityY = zoomVelocity = 0;
    pointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY,
      time: event.timeStamp, started: event.timeStamp,
      travel: 0,
    });
    if (pointers.size > 1) {
      gestureHadMultiplePointers = true;
      pinchDistance = touchSeparation();
      interact('zoom');
    } else gestureHadMultiplePointers = false;
    try { element.setPointerCapture(event.pointerId); } catch (_) { /* Older touch implementations. */ }
  }

  function pointerMove(event) {
    const point = pointers.get(event.pointerId);
    if (!enabled || !point) return;
    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;
    const elapsed = clamp((event.timeStamp - point.time) / 1000, 0.008, 0.06);
    point.x = event.clientX;
    point.y = event.clientY;
    point.time = event.timeStamp;
    point.travel = Math.max(point.travel, Math.hypot(point.x - point.startX, point.y - point.startY));
    if (pointers.size > 1) {
      const nextDistance = touchSeparation();
      if (pinchDistance > 12 && nextDistance > 12) {
        interact('zoom');
        // Dampen tiny touch-distance variations without delaying larger gestures.
        const pinchRatio = Math.pow(pinchDistance / nextDistance, 0.82);
        wantedRadius = clamp(wantedRadius * pinchRatio, minimumRadius, maximumRadius);
      }
      pinchDistance = nextDistance;
      angularVelocityX = angularVelocityY = 0;
      return;
    }
    if (point.travel < 3) return;
    interact('rotate');
    const scale = rotationScale();
    wantedTheta -= dx * scale;
    wantedPhi = clamp(wantedPhi - dy * scale * 0.72, 0.3, 1.35);
    // Filter recent speed for a restrained, frame-rate independent release.
    angularVelocityX = angularVelocityX * 0.65 + clamp(-dx * scale / elapsed, -2.1, 2.1) * 0.35;
    angularVelocityY = angularVelocityY * 0.65 + clamp(-dy * scale * 0.72 / elapsed, -1.25, 1.25) * 0.35;
  }

  function pointerUp(event) {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    const tap = enabled && event.type === 'pointerup' && !gestureHadMultiplePointers &&
      point.travel < 7 && event.timeStamp - point.started < 600;
    pointers.delete(event.pointerId);
    try { element.releasePointerCapture(event.pointerId); } catch (_) { /* Capture may already be lost. */ }
    if (!pointers.size) {
      pinchDistance = 0;
      if (event.timeStamp - point.time > 110 || reducedMotion) angularVelocityX = angularVelocityY = 0;
      gestureHadMultiplePointers = false;
    } else {
      const remaining = pointers.values().next().value;
      remaining.startX = remaining.x;
      remaining.startY = remaining.y;
      remaining.travel = 0;
      angularVelocityX = angularVelocityY = 0;
    }
    if (tap) {
      angularVelocityX = angularVelocityY = 0;
      onSelect(event.clientX, event.clientY);
    }
  }

  function wheel(event) {
    if (!enabled || disposed) return;
    event.preventDefault();
    interact('zoom');
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
    const delta = clamp(event.deltaY * unit, -160, 160);
    wantedRadius = clamp(wantedRadius * Math.exp(delta * 0.0012), minimumRadius, maximumRadius);
    zoomVelocity = 0;
  }

  function keydown(event) {
    if (!enabled || disposed || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = 0.09 * clamp(radius / overviewRadius, 0.35, 1);
    if (event.key === '+' || event.key === '=') zoomBy(1);
    else if (event.key === '-' || event.key === '_') zoomBy(-1);
    else if (event.key === 'Home' || event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      // Use the page's reset action so the selected project panel and markers
      // return to their overview state along with the camera.
      const resetButton=element.closest?.('#worldViewport')?.querySelector('[data-map-reset]');
      if(resetButton)resetButton.click();else reset();
    }
    else if (event.key.startsWith('Arrow')) {
      interact('rotate');
      if (event.key === 'ArrowLeft') wantedTheta += step;
      if (event.key === 'ArrowRight') wantedTheta -= step;
      if (event.key === 'ArrowUp') wantedPhi = clamp(wantedPhi - step, 0.3, 1.35);
      if (event.key === 'ArrowDown') wantedPhi = clamp(wantedPhi + step, 0.3, 1.35);
    } else return;
    event.preventDefault();
  }

  function cancelPointers() {
    for (const pointerId of pointers.keys()) {
      try { element.releasePointerCapture(pointerId); } catch (_) { /* No active capture. */ }
    }
    pointers.clear();
    pinchDistance = 0;
    gestureHadMultiplePointers = false;
    angularVelocityX = angularVelocityY = zoomVelocity = 0;
  }

  function placeCamera() {
    const horizontalDistance = radius * Math.sin(phi);
    eye.set(
      target.x + horizontalDistance * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + horizontalDistance * Math.cos(theta),
    );
    // Terrain clearance is checked under and just ahead of the camera.
    let clearance = floorAt(eye.x, eye.z) + 2.25;
    for (const fraction of [0.035, 0.075]) {
      const sampleX = THREE.MathUtils.lerp(eye.x, target.x, fraction);
      const sampleZ = THREE.MathUtils.lerp(eye.z, target.z, fraction);
      clearance = Math.max(clearance, floorAt(sampleX, sampleZ) + 1.8);
    }
    // A soft roof-height skirt keeps the lens outside nearby architecture.
    buildings?.forEach((item, id) => {
      const info = buildingInfo(id);
      if (!info) return;
      const distance = Math.hypot(eye.x - info.center.x, eye.z - info.center.z);
      const skirt = info.radius + 2.2;
      if (distance >= skirt) return;
      const influence = 1 - THREE.MathUtils.smoothstep(distance, info.radius + 0.25, skirt);
      const roofClearance = info.center.y + info.height + 1.2;
      clearance = Math.max(clearance, THREE.MathUtils.lerp(clearance, roofClearance, influence));
    });
    eye.y = Math.max(eye.y, clearance);
    camera.position.copy(eye);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function update(dt = 1 / 60) {
    if (disposed) return;
    dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 0, 0.05);
    if (transition) {
      transition.elapsed += dt;
      const t = clamp(transition.elapsed / transition.duration, 0, 1);
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      target.lerpVectors(transition.target, wantedTarget, eased);
      theta = THREE.MathUtils.lerp(transition.theta, wantedTheta, eased);
      phi = THREE.MathUtils.lerp(transition.phi, wantedPhi, eased);
      radius = THREE.MathUtils.lerp(transition.radius, wantedRadius, eased);
      if (t === 1) transition = null;
    } else {
      if (!pointers.size && !reducedMotion) {
        wantedTheta += angularVelocityX * dt;
        wantedPhi = clamp(wantedPhi + angularVelocityY * dt, 0.3, 1.35);
        const friction = Math.exp(-7.5 * dt);
        angularVelocityX *= friction;
        angularVelocityY *= friction;
        if (Math.abs(angularVelocityX) < 0.001) angularVelocityX = 0;
        if (Math.abs(angularVelocityY) < 0.001) angularVelocityY = 0;
      }
      wantedRadius = clamp(wantedRadius, minimumRadius, maximumRadius);
      const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
      theta = THREE.MathUtils.lerp(theta, wantedTheta, smoothing);
      phi = THREE.MathUtils.lerp(phi, wantedPhi, smoothing);
      radius = THREE.MathUtils.lerp(radius, wantedRadius, smoothing);
      target.lerp(wantedTarget, smoothing);
    }
    placeCamera();
  }

  function resize(width, height) {
    if (disposed || width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const framing = Math.max(1, Math.min(1.65, 1.16 / camera.aspect));
    overviewRadius = 53 * framing;
    maximumRadius = Math.max(78, overviewRadius * 1.12);
    if (!hasInteracted) {
      resetCamera(false);
      if (!reducedMotion) {
        radius = overviewRadius * 1.12;
        theta = 0.49;
        phi = 1.03;
        startTransition(overviewTarget, 0.6, 0.94, overviewRadius, 3.1, 'intro');
        placeCamera();
      }
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) cancelPointers();
  }

  function getState() {
    return {
      selectedId, mode: selectedId ? 'project' : 'overview',
      theta, phi, radius, target: target.clone(),
      position: camera.position.clone(),
      isInteracting: pointers.size > 0,
      isTransitioning: Boolean(transition),
      enabled, quality,
    };
  }

  function dispose() {
    if (disposed) return;
    cancelPointers();
    listeners.forEach(remove => remove());
    element.style.touchAction = previousTouchAction;
    if (previousTabIndex === null) element.removeAttribute('tabindex');
    else element.setAttribute('tabindex', previousTabIndex);
    if (previousAriaLabel === null) element.removeAttribute('aria-label');
    else element.setAttribute('aria-label', previousAriaLabel);
    disposed = true;
  }

  listen(element, 'pointerdown', pointerDown);
  listen(element, 'pointermove', pointerMove);
  listen(element, 'pointerup', pointerUp);
  listen(element, 'pointercancel', pointerUp);
  listen(element, 'wheel', wheel, { passive: false });
  listen(element, 'keydown', keydown);
  listen(element, 'contextmenu', event => { if (enabled) event.preventDefault(); });
  if (typeof window !== 'undefined') listen(window, 'blur', cancelPointers);
  if (reducedMotion) resetCamera(false);
  else startTransition(overviewTarget, 0.6, 0.94, overviewRadius, 3.1, 'intro');
  placeCamera();

  return { update, resize, focus, reset, zoomBy, setEnabled, dispose, getState };
}
