// Display contract v2: true input prefixes and saved reads; schematic memory.
let heroInViewport = true;
if (window.self !== window.top) {
  document.documentElement.classList.add('hero-embedded');
  const page = document.querySelector('.page');
  const reportHeight = () => window.parent.postMessage({
    type: 'wtm-hero-height', height: Math.ceil(page.getBoundingClientRect().height)
  }, '*');
  new ResizeObserver(reportHeight).observe(page);
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'wtm-hero-measure') reportHeight();
    if (event.data?.type === 'wtm-hero-visibility') heroInViewport = event.data.visible;
  });
}
function heroDisplayCounts(d) {
  return d.playback.display_write_counts || d.observations.map(o => o.write_count);
}

function heroStateAt(d, ms) {
  const { duration_ms: total, intro_ms: intro, final_hold_ms: hold } = d.playback;
  const counts = heroDisplayCounts(d), n = counts.length, period = (total - intro - hold) / n;
  const end = total - hold;
  if (ms < intro) return { kind: 'intro', displayed: 0, observed: 0, written: 0, readable: 0, phase: 'intro', progress: 0 };
  if (ms >= end) return { kind: 'final', displayed: n, observed: counts[n - 1], written: counts[n - 1], readable: counts[n - 1], phase: 'final', progress: 1 };
  const index = Math.min(n - 1, Math.floor((ms - intro) / period));
  const fraction = (ms - intro - index * period) / period;
  const count = counts[index], previous = index ? counts[index - 1] : 0;
  const hasRead = d.checkpoints.some(c => c.write_count === count);
  const phase = fraction < .3 ? 'observe' : fraction < .6 ? 'write' : hasRead && fraction < .85 ? 'read' : 'result';
  const progress = phase === 'write' ? (fraction - .3) / .3 : phase === 'read' ? (fraction - .6) / .25 : 1;
  return { kind: 'input', displayed: index + 1, observed: count, written: fraction >= .6 ? count : previous,
    readable: fraction >= .85 ? count : previous, phase, progress };
}

function heroCheckpointAt(d, prefix) {
  return d.checkpoints.findLast(c => c.write_count <= prefix) || null;
}

function heroDescriptionAt(d, s) {
  if (s.kind === 'intro') return 'Move through the scene and build memory.';
  if (s.kind === 'final') return `Compare predictions at the ${d.queries.length} fixed query poses.`;
  const step = `Step ${s.displayed}: `;
  if (s.phase === 'observe') return step + 'Move to a new view.';
  if (s.phase === 'write') return step + 'Write this view into memory.';
  return step + `Read memory at ${d.queries.length} fixed query poses.`;
}

async function loadHero() {
  const embedded = document.getElementById('hero-data');
  const url = embedded ? null : new URL(document.body.dataset.manifest, location.href);
  let data;
  if (embedded) data = JSON.parse(embedded.textContent);
  else {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Manifest returned HTTP ${response.status}`);
    data = await response.json();
  }
  if (data.schema_version !== 2 || !data.observations?.length || !data.queries?.length || data.memory?.visualization !== 'schematic') {
    throw new Error('Expected a filled Hero v2 manifest with schematic memory');
  }
  const asset = path => embedded ? path : new URL(path, url).href;
  const paths = new Set([...data.observations.map(o => o.rgb), ...data.queries.flatMap(q => Object.values(q.images)),
    ...data.checkpoints.flatMap(c => Object.values(c.images).flatMap(images => Object.values(images)))].filter(path => path !== null));
  if (data.scene.map.image) paths.add(data.scene.map.image);
  await Promise.all([...paths].map(path => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => reject(new Error(`Missing image: ${path.slice(0, 100)}`));
    img.src = asset(path);
  })));
  initHero(data, asset);
}

function initHero(d, asset) {
  const $ = id => document.getElementById(id), svgNS = 'http://www.w3.org/2000/svg';
  const displayCounts = heroDisplayCounts(d), displayObservations = displayCounts.map(count => d.observations[count - 1]);
  const n = displayCounts.length, total = d.playback.duration_ms;
  const period = (total - d.playback.intro_ms - d.playback.final_hold_ms) / n;
  const commitTime = count => count ? d.playback.intro_ms + (count - .06) * period : 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentMs = motion.matches ? total - d.playback.final_hold_ms : 0;
  let playing = !motion.matches, speed = 1, lastFrame = 0;
  let lastObs = -1, lastWritten = -1, lastRead = null, lastPhase = '';
  const stage = $('hero-stage');
  $('scrub').max = total;
  stage.style.setProperty('--output-columns', d.columns.length);
  const map = d.scene.map, mapWidth = 1000, mapHeight = mapWidth / map.aspect_ratio;
  $('map').style.aspectRatio = map.aspect_ratio;
  $('route-map').setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
  const points = path => path.map(p => `${p.x * mapWidth},${p.y * mapHeight}`).join(' ');
  $('route-map').querySelectorAll('.route-halo, .route-full').forEach(path => path.setAttribute('points', points(map.path)));
  if (map.kind === 'floorplan') {
    $('map').classList.add('has-floorplan');
    $('scene-title').textContent = 'Scene top-down';
    $('floorplan').src = asset(map.image);
    $('floorplan').classList.remove('hide');
  }
  const dots = displayObservations.map(o => {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', o.pose.x * mapWidth); circle.setAttribute('cy', o.pose.y * mapHeight);
    circle.setAttribute('r', 15); circle.setAttribute('class', 'route-point'); circle.dataset.writeCount = o.write_count;
    $('route-map').append(circle);
    return circle;
  });
  function camera(id, pose, type) {
    const el = document.createElement('div'); el.className = `camera ${type}`;
    el.setAttribute('aria-hidden', 'true');
    const glyph = document.createElement('span'); glyph.className = 'glyph';
    el.append(glyph);
    if (id) {
      const label = document.createElement('span'); label.className = 'id'; label.textContent = id;
      el.append(label);
    }
    $('map').append(el);
    positionCamera(el, pose);
    return el;
  }
  function positionCamera(el, pose) {
    el.style.left = `${pose.x * 100}%`; el.style.top = `${pose.y * 100}%`;
    el.querySelector('.glyph').style.rotate = `${pose.yaw_deg}deg`;
  }
  const currentCamera = camera('', d.observations[0].pose, 'current hide');
  d.queries.forEach(q => {
    camera(q.id, q.pose, 'query');
    const chip = document.createElement('span'); chip.textContent = q.id; $('query-list').append(chip);
  });
  const slots = Array.from({ length: d.memory.display_slots }, () => {
    const el = document.createElement('div'); el.className = 'slot';
    $('slots').append(el); return el;
  });
  $('keyframes').classList.toggle('hide', !d.playback.display_write_counts);
  const keyframes = d.playback.display_write_counts ? displayObservations.map((o, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'keyframe';
    button.setAttribute('aria-label', `Show key view ${i + 1}`);
    const image = document.createElement('img'); image.src = asset(o.rgb); image.alt = ''; image.width = 64; image.height = 64;
    const label = document.createElement('span'); label.textContent = i + 1;
    button.append(image, label); button.addEventListener('click', () => seek(commitTime(i + 1)));
    $('keyframes').append(button); return button;
  }) : [];
  const emptyHeading = document.createElement('div'); $('matrix-head').append(emptyHeading);
  const columnLabels = { rgb: ['GT image', 'GT RGB'], gt: ['GT feature', 'GT feat.'], wtm: ['WTM pred.', 'WTM'], vggt: ['VGGT-Ω', 'VGGT-Ω'] };
  d.columns.forEach(c => {
    const heading = document.createElement('div'); heading.title = c.title;
    const labels = columnLabels[c.id] || [c.title, c.title];
    labels.forEach((text, i) => {
      const label = document.createElement('span'); label.className = i ? 'column-label-short' : 'column-label-long'; label.textContent = text;
      heading.append(label);
    });
    if (c.id === 'wtm') heading.className = 'wtm-heading';
    $('matrix-head').append(heading);
  });
  const rows = d.queries.map(q => {
    const row = document.createElement('div'); row.className = 'result-row'; row.dataset.query = q.id;
    const label = document.createElement('span'); label.className = 'query-label'; label.textContent = q.id;
    row.append(label);
    const cells = {};
    d.columns.forEach(c => {
      const cell = document.createElement('div'); cell.className = 'result-cell'; cell.dataset.column = c.id;
      const frame = document.createElement('div'); frame.className = `view-image ${c.id === 'wtm' ? 'pred' : c.id === 'gt' ? 'gt' : ''}`;
      const blank = document.createElement('div'); blank.className = 'view-blank';
      blank.textContent = c.role === 'baseline' ? 'Not reconstructed yet' : 'Not read yet';
      const img = document.createElement('img'); img.width = 256; img.height = 256;
      img.alt = `${c.title} at fixed query ${q.id}`;
      if (c.temporal === 'fixed') { img.src = asset(q.images[c.id]); blank.classList.add('hide'); }
      else img.classList.add('hide');
      frame.append(blank, img); cell.append(frame);
      row.append(cell); cells[c.id] = { img, blank };
    });
    const template = $('baseline-notes').content.querySelector(`[data-for-query="${q.id}"]`);
    const note = template ? template.cloneNode(true) : null;
    if (note) row.append(note);
    $('resultrows').append(row); return { q, cells, note };
  });
  for (let i = 0; i < n; i++) {
    const tick = document.createElement('i'); tick.style.left = `${commitTime(i + 1) / total * 100}%`;
    $('timeline-marks').append(tick);
  }
  const connections = ['input-writer', 'writer-memory', 'memory-reader', 'reader-output', 'map-query', 'query-reader'].map(id => {
    const group = $(id); return { group, path: group.querySelector('path'), pulse: group.querySelector('circle'), length: 0 };
  });
  function drawConnections() {
    const stacked = window.matchMedia('(max-width: 1279px)').matches;
    const tablet = window.matchMedia('(min-width: 900px) and (max-width: 1279px)').matches;
    const origin = stage.getBoundingClientRect();
    $('connections').setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    const anchor = (el, side) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - origin.left + (side === 'left' ? -3 : side === 'right' ? r.width + 3 : r.width / 2),
        y: r.top - origin.top + (side === 'top' ? -3 : side === 'bottom' ? r.height + 3 : r.height / 2) };
    };
    const pairs = [[document.querySelector('.observation'), 'right', $('writer'), 'left'],
      [$('writer'), 'right', $('memory-module'), 'left'], [$('memory-module'), 'right', $('reader'), 'left'],
      [$('reader'), 'right', $('output-module'), 'left'], [$('map'), 'right', $('query-module'), 'left'],
      [$('query-module'), 'bottom', $('reader'), 'top']];
    if (stacked) {
      pairs[0] = [$('input-module'), 'bottom', $('writer'), 'top'];
      pairs[3] = [$('reader'), 'bottom', $('output-module'), 'top'];
    }
    const ends = pairs.map(([a, as, b, bs]) => [anchor(a, as), anchor(b, bs)]);
    if (stacked) {
      if (!tablet) ends[0][0].x = ends[0][1].x;
      ends[3][1].x = ends[3][0].x;
    } else {
      ends[0][0].y = ends[0][1].y;
      ends[3][1].y = ends[3][0].y;
    }
    const approachY = tablet ? Math.min(...['writer', 'memory-module', 'reader'].map(id => $(id).getBoundingClientRect().top - origin.top)) - 18 : 0;
    ends.forEach(([a, b], i) => {
      const path = tablet && i === 0 ? `M ${a.x} ${a.y} V ${approachY} H ${b.x} V ${b.y}`
        : stacked && (i === 0 || i === 3) ? `M ${a.x} ${a.y} V ${b.y}`
        : i <= 3 ? `M ${a.x} ${a.y} H ${b.x}`
        : i === 5 ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
        : `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;
      connections[i].path.setAttribute('d', path);
    });
    connections.forEach(c => { c.length = c.path.getTotalLength(); });
    paintFlow(heroStateAt(d, currentMs));
  }
  function paintFlow(s) {
    const writing = s.phase === 'write', reading = s.phase === 'read';
    connections.forEach((c, i) => {
      const active = i < 2 ? writing : reading; c.group.classList.toggle('active', active);
      if (active && c.length) {
        const point = c.path.getPointAtLength(s.progress * c.length);
        c.pulse.setAttribute('cx', point.x); c.pulse.setAttribute('cy', point.y);
      }
    });
    $('writer').classList.toggle('active', writing); $('reader').classList.toggle('active', reading);
    $('memory-module').classList.toggle('active', writing || reading);
    $('query-module').classList.toggle('active', reading);
  }
  function slotGate(i, count) {
    return Math.abs(Math.sin((i + 1) * 1.317 + count * 2.43));
  }
  function slotValue(i, count) {
    let value = .06;
    for (let j = 1; j <= count; j++) {
      const gate = slotGate(i, j);
      if (gate > .80) value = Math.min(.94, value + .20 + .24 * (gate - .80) / .20);
    }
    return value;
  }
  function render(ms) {
    const s = heroStateAt(d, ms), read = heroCheckpointAt(d, s.readable);
    stage.dataset.displayed = s.displayed;
    stage.dataset.phase = s.phase; stage.dataset.observations = s.observed;
    stage.dataset.writes = s.written; stage.dataset.predictions = read ? read.write_count : -1;
    if (lastObs !== s.observed) {
      lastObs = s.observed;
      $('obs-empty').classList.toggle('hide', s.observed > 0); $('observation').classList.toggle('hide', s.observed === 0);
      currentCamera.classList.toggle('hide', s.observed === 0);
      if (s.observed) {
        const o = d.observations[s.observed - 1]; $('observation').src = asset(o.rgb);
        positionCamera(currentCamera, o.pose);
      }
    }
    if (lastWritten !== s.written) {
      lastWritten = s.written; dots.forEach((dot, i) => dot.classList.toggle('written', displayCounts[i] <= s.written));
      const pathIndex = s.written ? d.observations[s.written - 1].path_index : -1;
      $('route-map').querySelector('.route-written').setAttribute('points', points(map.path.slice(0, pathIndex + 1)));
    }
    $('obs-counter').textContent = `${d.playback.display_write_counts ? 'Key view ' : ''}${s.displayed} / ${n}`;
    keyframes.forEach((button, i) => {
      const current = i + 1 === s.displayed;
      button.classList.toggle('current', current); button.classList.toggle('seen', i + 1 <= s.displayed);
      button.setAttribute('aria-pressed', String(current));
    });
    paintFlow(s);
    slots.forEach((el, i) => {
      let value = slotValue(i, s.written);
      const delta = s.phase === 'write' ? slotValue(i, s.observed) - value : 0;
      const updating = s.phase === 'write' && Array.from({ length: s.observed - s.written }, (_, j) => j + s.written + 1).some(count => slotGate(i, count) > .80);
      el.classList.toggle('updating', updating);
      value += delta * s.progress;
      el.style.setProperty('--slot-strength', value);
    });
    const readCount = read ? read.write_count : -1;
    if (readCount !== lastRead) {
      lastRead = readCount;
      rows.forEach(({ q, cells, note }) => {
        d.columns.forEach(c => {
          const cell = cells[c.id], path = read?.images[q.id][c.id];
          const visible = c.temporal === 'fixed' ? c.role !== 'prediction' || readCount >= 1 : path != null;
          cell.img.classList.toggle('hide', !visible); cell.blank.classList.toggle('hide', visible);
          if (c.temporal === 'checkpoint') {
            if (visible) cell.img.src = asset(path);
            else cell.img.removeAttribute('src');
          }
        });
        if (note) note.classList.toggle('pending', read?.images[q.id][note.dataset.baseline] == null);
      });
    }
    const phase = s.kind === 'intro' ? 'Ready' : s.kind === 'final' ? 'Complete'
      : s.phase === 'observe' ? 'Observing' : s.phase === 'write' ? 'Writing'
      : s.phase === 'read' ? 'Reading' : 'Reviewing';
    const phaseKey = `${s.kind}-${s.phase}-${s.displayed}`;
    if (phaseKey !== lastPhase) {
      lastPhase = phaseKey; $('phase-label').textContent = phase;
      const description = heroDescriptionAt(d, s);
      if ($('phase-copy').textContent !== description) $('phase-copy').replaceChildren(...description.split(/\b(move|write|read)\b/i).map(word => {
        if (!/^(move|write|read)$/i.test(word)) return word;
        const action = document.createElement('strong');
        action.className = `phase-action ${word.toLowerCase()}`;
        action.textContent = word;
        return action;
      }));
    }
    $('clock').textContent = `00:${String(Math.floor(ms / 1000)).padStart(2, '0')} / 00:${String(Math.round(total / 1000)).padStart(2, '0')}`;
    $('scrub').value = ms;
    $('scrub').setAttribute('aria-valuetext', `Key view ${s.displayed} of ${n}; source prefix ${s.written}; prediction after ${Math.max(0, readCount)} writes`);
  }
  function updateButton() {
    $('toggle').querySelector('span').textContent = playing ? 'Pause' : 'Play';
    $('toggle').querySelector('path').setAttribute('d', playing ? 'M5 3v10M11 3v10' : 'm5 3 8 5-8 5Z');
  }
  function seek(ms) { playing = false; updateButton(); currentMs = ms; render(ms); }
  function togglePlayback() {
    if (!playing && currentMs >= total - d.playback.final_hold_ms) currentMs = 0;
    playing = !playing; updateButton(); render(currentMs);
  }
  $('toggle').addEventListener('click', togglePlayback);
  $('reset').addEventListener('click', () => { currentMs = 0; render(0); });
  $('speed').addEventListener('change', e => { speed = Number(e.target.value); });
  $('scrub').addEventListener('input', e => seek(Number(e.target.value)));
  $('prev').addEventListener('click', () => seek(commitTime(Math.max(0, heroStateAt(d, currentMs).displayed - 1))));
  $('next').addEventListener('click', () => seek(commitTime(Math.min(n, heroStateAt(d, currentMs).displayed + 1))));
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT', 'BUTTON', 'SELECT', 'A'].includes(document.activeElement.tagName)) {
      e.preventDefault(); togglePlayback();
    }
  });
  motion.addEventListener('change', e => { if (e.matches) { playing = false; updateButton(); } });
  function tick(timestamp) {
    if (lastFrame) {
      if (playing && heroInViewport) { currentMs = (currentMs + Math.min(100, timestamp - lastFrame) * speed) % total; render(currentMs); }
    }
    lastFrame = timestamp; requestAnimationFrame(tick);
  }
  updateButton(); render(currentMs); new ResizeObserver(drawConnections).observe(stage); requestAnimationFrame(tick);
}

loadHero().catch(error => {
  const notice = document.createElement('div'); notice.className = 'failure'; notice.setAttribute('role', 'alert');
  notice.textContent = `Could not load this example: ${error.message}. For offline viewing, open wtm-hero-living-room.html.`;
  document.getElementById('board').replaceChildren(notice); console.error(error);
});
