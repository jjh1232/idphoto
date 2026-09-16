/*
 * 증명사진 규격 맞추기 — 자르기.
 *
 * 하는 일은 셋이다.
 *   1. 규격 비율로 자른다        (틀 안이 곧 결과물이다)
 *   2. 인쇄 해상도를 맞춘다      (mm × dpi → px, 그리고 JFIF 에 dpi 를 적는다)
 *   3. 파일 크기 제한을 맞춘다   (JPEG 품질을 이분 탐색)
 *
 * 서버가 없다. 사진은 브라우저 밖으로 안 나간다.
 *
 * 문장은 여기 없다. 페이지가 빌드 때 심어둔 strings 를 읽는다 —
 * 스크립트에 문장을 두면 언어판을 늘릴 때 조용히 한국어가 남는다.
 */

const MM_PER_INCH = 25.4;

/*
 * 규격표.
 *
 * head·face·eye 는 mm 다. **strict 가 규정이냐 관행이냐를 가른다** —
 * 여권·비자는 실제 규정이라 안내선을 진하게 그리고 보정을 잠근다.
 * 이력서는 관행이라 흐리게 그리고 자유롭게 둔다.
 *
 * 미국만 눈높이로 규정한다(바닥에서 몇 mm). 나머지는 head+face 로 턱을 낸다.
 */
export const PRESETS = [
  { id: 'kr-resume',   group: 'kr', w: 30, h: 40, strict: false, head: [3, 5], face: [25, 30] },
  { id: 'kr-passport', group: 'kr', w: 35, h: 45, strict: true,  head: [3, 5], face: [32, 36] },
  { id: 'us',          group: 'us', w: 51, h: 51, strict: true,  face: [25, 35], eyeFromBottom: [28, 35] },
  { id: 'jp-resume',   group: 'jp', w: 30, h: 40, strict: false, head: [3, 5], face: [25, 30] },
  { id: 'jp-passport', group: 'jp', w: 35, h: 45, strict: true,  head: [2, 6], face: [32, 36] },

  /*
   * 직접 입력. w·h 를 사용자가 고친다.
   *
   * **안내선을 그리지 않는다**(head·face 가 없다). 어떤 규격인지 모르는데 띠를 그리면
   * 근거 없는 값이 규정처럼 보인다. 규정이 있는 것만 규정처럼 보여야 한다.
   */
  { id: 'custom', group: 'etc', w: 30, h: 40, strict: false, custom: true },
];

/** 직접 입력 범위(mm). 너무 작으면 픽셀이 안 나오고, 너무 크면 증명사진이 아니다. */
const CUSTOM_MIN = 10, CUSTOM_MAX = 200;

const DPIS = [300, 600];

/** 온라인 지원 서식이 흔히 거는 제한들(KB). 0 = 제한 없음. */
const CAPS = [0, 100, 200, 500];

/** 판이 아무리 좁아도 이만큼은 확보한다(CSS px). 평소 높이는 판이 정한다. */
const STAGE_MIN_H = 360;

/** 모서리 손잡이의 반지름(CSS px). 손가락으로도 잡히게 넉넉히 둔다. */
const GRIP = 11;

export function mount(root, strings) {
  const t = (k, ...a) => {
    let s = strings[k] ?? k;
    a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); });
    return s;
  };
  const $ = (id) => root.querySelector('[data-el="' + id + '"]');

  let img = null;              // ImageBitmap. EXIF 회전은 이미 적용된 상태
  let preset = PRESETS[0];
  let dpi = 300;
  let cap = 0;

  /*
   * 자르기 상태는 **이미지 좌표계**로 들고 있다.
   *
   *   cropH  잘라낼 높이(원본 px). 폭은 규격 비율로 따라간다
   *   cx,cy  그 조각의 한가운데
   *
   * 화면과 저장이 같은 조각을 크기만 다른 캔버스에 그릴 뿐이다.
   * 배율을 각자 계산하면 반올림이 갈려 조용히 어긋난다 — 그 자리를 없앴다.
   */
  let cropH = 0, cx = 0, cy = 0, fitH = 0;

  /*
   * 판 위에 사진을 펼치는 변환. 이미지 좌표 → 판 좌표(CSS px).
   *   판점 = (이미지점 - 0) * vs + (vx, vy)
   * 자르는 틀은 이 위에 겹쳐 그린다.
   */
  let vs = 1, vx = 0, vy = 0;

  const stage = $('stage');
  const cv = $('cv');

  /* ─── 계산 ──────────────────────────────────────────────────────── */

  /** mm 와 dpi 로 출력 픽셀 수를 낸다. 반올림은 여기 한 곳에서만 한다. */
  const outPx = () => ({
    w: Math.round(preset.w / MM_PER_INCH * dpi),
    h: Math.round(preset.h / MM_PER_INCH * dpi),
  });

  /** 규격 비율(폭/높이). 반올림 전 값이라 화면과 출력이 같은 비율을 쓴다. */
  const ratio = () => preset.w / preset.h;

  /** 규격 비율을 지키면서 원본 안에 들어가는 가장 큰 조각의 높이. */
  const fitCropH = () => Math.min(img.height, img.width / ratio());

  /** 지금 자르는 네모. 이미지 좌표. */
  const rect = () => {
    const w = cropH * ratio();
    return { x: cx - w / 2, y: cy - cropH / 2, w, h: cropH };
  };

  /** 조각이 사진 밖으로 나가지 않게 붙든다. 여백이 생기면 그건 결과물의 구멍이다. */
  function clamp() {
    cropH = Math.min(Math.max(cropH, fitH / 8), fitH);   // 최대 8배까지 좁힐 수 있다
    const halfW = cropH * ratio() / 2, halfH = cropH / 2;
    cx = Math.min(Math.max(cx, halfW), img.width - halfW);
    cy = Math.min(Math.max(cy, halfH), img.height - halfH);
  }

  /** 확대 슬라이더를 지금 조각 크기에 맞춘다(모서리를 끌어도 숫자가 따라오게). */
  function syncZoom() {
    const pct = Math.round(fitH / cropH * 100);
    $('zoom').value = Math.min(800, Math.max(100, pct));
    $('zoomv').textContent = pct + '%';
  }

  /* ─── 보정 ──────────────────────────────────────────────────────── */

  /**
   * 밝기·대비.
   *
   * **규정이 있는 규격에서는 잠근다.** 외교부는 「사진 편집 프로그램, 사진 필터
   * 기능 등을 사용하여 임의로 보정한 사진(AI 를 활용한 편집·가공·합성 포함)」 을
   * 허용하지 않고, 미 국무부도 2026-01 부터 같은 취지로 자동 반려한다.
   * 켜둔 채로 내보내면 **화면으로는 멀쩡해 보이는데 제출처에서 튕긴다.**
   */
  const adjustable = () => !preset.strict;
  const filterStr = () =>
    adjustable()
      ? 'brightness(' + $('bright').value + '%) contrast(' + $('contrast').value + '%)'
      : 'none';

  /* ─── 저장용 그리기 ─────────────────────────────────────────────── */

  /**
   * 잘라낸 조각을 목적지 캔버스 가득 그린다. **저장이 쓰는 것이 이 함수다.**
   * 화면의 틀 안과 같은 네모를 같은 방식으로 그리므로 보이는 대로 나온다.
   */
  function paint(ctx, w, h, withGuide) {
    const r = rect();
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.filter = filterStr();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
    ctx.restore();
    if (withGuide) drawGuide(ctx, 0, 0, w, h);
  }

  /**
   * 얼굴 위치 안내선.
   * mm 로 적힌 규정을 **틀 높이**에 대한 비율로 바꿔 띠 두 개를 그린다.
   * 규정이 있는 규격은 진하게, 관행인 것은 흐리게 — 규정인 것처럼 보이면 안 된다.
   */
  function drawGuide(ctx, ox, oy, w, h) {
    if (!$('showguide').checked) return;
    // 직접 입력한 규격은 얼굴 규정을 모른다. 아무것도 그리지 않는다.
    if (!preset.head && !preset.eyeFromBottom) return;
    const band = (fromMm, toMm, text) => {
      const y1 = oy + fromMm / preset.h * h, y2 = oy + toMm / preset.h * h;
      ctx.fillStyle = preset.strict ? 'rgba(47,111,78,.22)' : 'rgba(47,111,78,.12)';
      ctx.fillRect(ox, y1, w, y2 - y1);
      ctx.strokeStyle = preset.strict ? 'rgba(47,111,78,.75)' : 'rgba(47,111,78,.4)';
      ctx.lineWidth = Math.max(1, h / 420);
      ctx.beginPath();
      ctx.moveTo(ox, y1); ctx.lineTo(ox + w, y1);
      ctx.moveTo(ox, y2); ctx.lineTo(ox + w, y2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.62)';
      ctx.font = Math.max(10, Math.round(h / 38)) + 'px system-ui, sans-serif';
      ctx.fillText(text, ox + 6, y2 - 4);
    };

    if (preset.eyeFromBottom) {
      // 미국은 눈높이로 정한다. 바닥 기준이라 위에서 재는 값으로 뒤집는다.
      const a = preset.eyeFromBottom[0], b = preset.eyeFromBottom[1];
      band(preset.h - b, preset.h - a, t('guide.eye'));
      return;
    }
    band(preset.head[0], preset.head[1], t('guide.head'));
    // 턱 = 머리 끝 + 얼굴 길이. 양쪽 범위를 합치면 턱이 놓일 수 있는 띠가 된다.
    band(preset.head[0] + preset.face[0], preset.head[1] + preset.face[1], t('guide.chin'));
  }

  /* ─── 판에 그리기 ───────────────────────────────────────────────── */

  /** 사진 전체를 판 안에 들어가게 맞춘다. */
  function fitView(w, h) {
    vs = Math.min(w / img.width, h / img.height);
    vx = (w - img.width * vs) / 2;
    vy = (h - img.height * vs) / 2;
  }

  /**
   * 판 크기를 다시 재고 캔버스 뒷면을 화면 배율에 맞춘다.
   * 높이는 **판이 정한다** — 옆 레일이 길면 판도 따라 길어지고, 사진이 그만큼 커진다.
   * (캔버스가 absolute 라서 여기서 잰 값이 판 높이를 다시 밀지 않는다)
   */
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = stage.clientWidth;
    const h = Math.max(STAGE_MIN_H, stage.clientHeight);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    return { dpr, w, h };
  }

  /**
   * 사진 전체를 펼치고, 그 위에 자르는 틀을 겹친다.
   *
   * 틀 **밖은 어둡게** 덮는다. 어디가 결과물인지 한눈에 보여야 한다.
   * 안내선은 틀 안쪽에만 그린다 — 안내선은 결과물 기준의 값이다.
   */
  function draw() {
    if (!img) return;
    const { dpr, w: W, h: H } = sizeCanvas();
    fitView(W, H);
    const ctx = cv.getContext('2d');

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1. 사진 전체
    ctx.save();
    ctx.filter = filterStr();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, vx, vy, img.width * vs, img.height * vs);
    ctx.restore();

    // 2. 틀 밖을 덮는다
    const r = rect();
    const bx = vx + r.x * vs, by = vy + r.y * vs, bw = r.w * vs, bh = r.h * vs;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, W, by);
    ctx.fillRect(0, by + bh, W, H - by - bh);
    ctx.fillRect(0, by, bx, bh);
    ctx.fillRect(bx + bw, by, W - bx - bw, bh);

    // 3. 안내선 — 틀 안쪽 기준
    drawGuide(ctx, bx, by, bw, bh);

    // 4. 틀 테두리와 모서리 손잡이
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + .75, by + .75, bw - 1.5, bh - 1.5);
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of corners(bx, by, bw, bh)) {
      ctx.beginPath();
      ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const corners = (bx, by, bw, bh) => [
    [bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh],
  ];

  /* ─── 틀 잡기 ───────────────────────────────────────────────────── */

  /** 규격이 바뀌면 틀의 비율이 바뀐다. 가장 크게 잡고 가운데로 맞춘다. */
  function layout() {
    if (!img) return;
    fitH = fitCropH();
    cropH = fitH;
    cx = img.width / 2;
    cy = img.height / 2;

    syncAdjust();
    clamp();
    syncZoom();
    showOut();
    draw();
  }

  /** 보정 칸의 잠금 상태를 규격에 맞춘다. */
  function syncAdjust() {
    const on = adjustable();
    const ids = ['bright', 'contrast'];
    for (const id of ids) {
      const el = $(id);
      el.disabled = !on;
      if (!on) el.value = 100;
      $(id + 'v').textContent = el.value + '%';
    }
    $('adjust').classList.toggle('locked', !on);
    $('adjustnote').hidden = on;
  }

  function showOut() {
    const o = outPx();
    $('px').textContent = o.w + ' × ' + o.h + ' px';
    $('mm').textContent = preset.w + ' × ' + preset.h + ' mm · ' + dpi + ' dpi';
    $('guidesrc').textContent = t('src.' + preset.id);
  }

  /* ─── 고르기 ────────────────────────────────────────────────────── */

  function buildSizes() {
    const host = $('sizes');
    host.textContent = '';
    let group = null;
    for (const p of PRESETS) {
      if (p.group !== group) {
        group = p.group;
        const g = document.createElement('p');
        g.className = 'grp';
        g.textContent = t('group.' + group);
        host.appendChild(g);
      }
      const lab = document.createElement('label');
      lab.className = 'opt' + (p === preset ? ' on' : '');
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'preset'; r.checked = p === preset;
      r.addEventListener('change', () => { preset = p; buildSizes(); layout(); });
      const nm = document.createElement('span');
      nm.className = 'nm'; nm.textContent = t('preset.' + p.id);
      lab.append(r, nm);
      if (!p.custom) {           // 직접 입력은 바로 아래 칸이 치수를 보여준다
        const mm = document.createElement('span');
        mm.className = 'mm'; mm.textContent = p.w + '×' + p.h + ' mm';
        lab.appendChild(mm);
      }
      host.appendChild(lab);

      // 직접 입력 칸은 그 항목을 고른 동안에만 펼친다.
      if (p.custom && p === preset) host.appendChild(customFields(p));
    }
  }

  /**
   * 직접 입력 칸 두 개(mm).
   *
   * 빈 칸이나 범위 밖 값으로 곧바로 다시 그리면 틀이 사라지거나 0 으로 나눈다.
   * **값이 성할 때만** 규격에 반영하고, 아니면 화면은 그대로 두고 칸만 표시한다.
   */
  function customFields(p) {
    const box = document.createElement('div');
    box.className = 'custom';

    const field = (key, get, set) => {
      const lab = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = t('custom.' + key);
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = String(CUSTOM_MIN); inp.max = String(CUSTOM_MAX); inp.step = '0.5';
      inp.value = String(get());
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        const ok = Number.isFinite(v) && v >= CUSTOM_MIN && v <= CUSTOM_MAX;
        inp.classList.toggle('bad', !ok);
        if (!ok) return;
        set(v);
        // 비율이 바뀌었으니 틀을 다시 잡는다. 목록은 다시 그리지 않는다 —
        // 그러면 지금 타이핑 중인 칸이 사라져 포커스를 잃는다.
        if (img) layout();
        showOut();
      });
      lab.append(span, inp);
      return lab;
    };

    box.append(
      field('w', () => p.w, (v) => { p.w = v; }),
      field('h', () => p.h, (v) => { p.h = v; }),
    );
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = t('custom.note', CUSTOM_MIN, CUSTOM_MAX);
    box.appendChild(note);
    return box;
  }

  function buildChips(host, items, cur, label, pick) {
    host.textContent = '';
    for (const v of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (v === cur ? ' on' : '');
      b.textContent = label(v);
      b.addEventListener('click', () => pick(v));
      host.appendChild(b);
    }
  }

  const drawDpis = () =>
    buildChips($('dpis'), DPIS, dpi, (v) => String(v), (v) => { dpi = v; drawDpis(); showOut(); });
  const drawCaps = () =>
    buildChips($('caps'), CAPS, cap, (v) => (v ? v + ' KB' : t('cap.none')), (v) => { cap = v; drawCaps(); });

  /* ─── 틀 끌기 ───────────────────────────────────────────────────── */

  /*
   * 두 가지를 받는다.
   *   모서리를 잡으면  크기 바꾸기 (반대쪽 모서리를 고정하고 비율은 유지)
   *   안쪽을 잡으면    위치 옮기기
   *
   * 「아래를 좀 더 자르고 싶다」 가 모서리 하나 끄는 일이 되어야 한다.
   * 사진을 뒤에서 미는 방식으로는 그게 확대 + 이동 두 동작이 된다.
   */
  let mode = null;            // 'nw' | 'ne' | 'sw' | 'se' | 'move'
  let anchorX = 0, anchorY = 0;   // 크기 바꿀 때 고정되는 반대쪽 모서리(이미지 좌표)
  let grabX = 0, grabY = 0;       // 옮길 때 잡은 지점과 중심의 차이

  /** 판 좌표(CSS px) → 이미지 좌표. */
  const toImg = (px, py) => ({ x: (px - vx) / vs, y: (py - vy) / vs });

  /** 포인터가 캔버스 어디를 눌렀는지. */
  function at(e) {
    const b = cv.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  /** 모서리 손잡이 위인가, 틀 안인가. */
  function hit(p) {
    const r = rect();
    const bx = vx + r.x * vs, by = vy + r.y * vs, bw = r.w * vs, bh = r.h * vs;
    const names = ['nw', 'ne', 'sw', 'se'];
    const pts = corners(bx, by, bw, bh);
    for (let i = 0; i < 4; i++) {
      if (Math.hypot(p.x - pts[i][0], p.y - pts[i][1]) <= GRIP) return names[i];
    }
    if (p.x >= bx && p.x <= bx + bw && p.y >= by && p.y <= by + bh) return 'move';
    return null;
  }

  cv.addEventListener('pointerdown', (e) => {
    if (!img) return;
    const p = at(e);
    mode = hit(p);
    if (!mode) return;
    cv.setPointerCapture(e.pointerId);
    const r = rect();
    if (mode === 'move') {
      const m = toImg(p.x, p.y);
      grabX = m.x - cx; grabY = m.y - cy;
    } else {
      // 잡은 모서리의 **반대쪽**을 고정한다.
      anchorX = mode === 'nw' || mode === 'sw' ? r.x + r.w : r.x;
      anchorY = mode === 'nw' || mode === 'ne' ? r.y + r.h : r.y;
    }
    cv.classList.add('grabbing');
  });

  cv.addEventListener('pointermove', (e) => {
    if (!img) return;
    const p = at(e);

    if (!mode) {   // 누르지 않았을 때는 커서로 무엇을 할 수 있는지 알린다
      const h = hit(p);
      cv.style.cursor = h === 'move' ? 'move'
        : h === 'nw' || h === 'se' ? 'nwse-resize'
        : h === 'ne' || h === 'sw' ? 'nesw-resize'
        : 'default';
      return;
    }

    const m = toImg(p.x, p.y);
    if (mode === 'move') {
      cx = m.x - grabX;
      cy = m.y - grabY;
    } else {
      // 비율은 고정이므로 높이 하나로 정한다. 가로세로 중 더 많이 끈 쪽을 따른다.
      const dh = Math.abs(m.y - anchorY);
      const dw = Math.abs(m.x - anchorX) / ratio();
      cropH = Math.max(dh, dw);
      cropH = Math.min(Math.max(cropH, fitH / 8), fitH);
      const w = cropH * ratio();
      cx = anchorX + (mode === 'nw' || mode === 'sw' ? -w / 2 : w / 2);
      cy = anchorY + (mode === 'nw' || mode === 'ne' ? -cropH / 2 : cropH / 2);
    }
    clamp(); syncZoom(); draw();
  });

  for (const ev of ['pointerup', 'pointercancel'])
    cv.addEventListener(ev, () => { mode = null; cv.classList.remove('grabbing'); });

  cv.addEventListener('wheel', (e) => {
    if (!img) return;
    e.preventDefault();
    setZoom(+$('zoom').value * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }, { passive: false });

  /** 가운데를 잡고 틀 크기만 바꾼다. */
  function setZoom(pct) {
    pct = Math.min(800, Math.max(100, pct));
    cropH = fitH * 100 / pct;      // 확대할수록 틀이 작아진다
    clamp(); syncZoom(); draw();
  }

  $('zoom').addEventListener('input', () => setZoom(+$('zoom').value));
  $('fit').addEventListener('click', () => { layout(); });
  for (const id of ['bright', 'contrast'])
    $(id).addEventListener('input', () => {
      $(id + 'v').textContent = $(id).value + '%';
      draw();
    });
  $('showguide').addEventListener('change', draw);
  window.addEventListener('resize', () => { if (img) draw(); });

  /* ─── 저장 ──────────────────────────────────────────────────────── */

  const toBlob = (c, q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q));

  /**
   * 용량 제한에 맞춰 품질을 고른다.
   * 품질과 용량은 단조 증가라 이분 탐색이 먹는다. 못 맞추면 **줄이다 만 파일을
   * 주는 대신 실패로 말한다** — 제출처에서 튕기는 것보다 여기서 알려주는 편이 낫다.
   */
  async function encodeUnder(c, limitBytes) {
    if (!limitBytes) return { blob: await toBlob(c, 0.92), q: 0.92 };

    // 최고 품질로도 제한 안에 들면 굳이 깎지 않는다.
    const top = await toBlob(c, 0.95);
    if (top.size <= limitBytes) return { blob: top, q: 0.95 };

    let lo = 0.3, hi = 0.95, best = null, bestQ = 0;
    for (let i = 0; i < 10; i++) {
      const q = (lo + hi) / 2;
      const b = await toBlob(c, q);
      if (b.size <= limitBytes) { best = b; bestQ = q; lo = q; } else { hi = q; }
    }
    if (!best) {
      const b = await toBlob(c, 0.3);
      if (b.size <= limitBytes) return { blob: b, q: 0.3 };
      throw new Error('CAP:' + Math.round(b.size / 1024));
    }
    return { blob: best, q: bestQ };
  }

  /**
   * JPEG 에 인쇄 해상도를 적어 넣는다.
   *
   * canvas.toBlob 이 만든 JPEG 은 JFIF 머리의 해상도가 1×1(단위 없음)이라
   * 인쇄 프로그램이 72dpi 로 읽는다. 300dpi 로 뽑아도 인화하면 크기가 네 배로 나온다.
   * **화면으로는 멀쩡해 보인다** — 픽셀 수는 맞기 때문이다. 머리의 숫자만 고친다.
   *
   *    0  FFD8  SOI       2  FFE0  APP0      4  길이(2)
   *    6  JFIF+NUL(5)    11  버전(2)        13  단위(1=인치당)
   *   14  가로 해상도(2) 16  세로 해상도(2)   ※ big-endian
   *
   * 머리 모양이 다르면 손대지 않는다. 어설프게 고치면 파일이 아예 안 열린다.
   */
  function stampDpi(bytes, d) {
    if (bytes.length < 18) return bytes;
    const okMarker = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0;
    const okJfif = bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46 && bytes[10] === 0x00;
    if (!okMarker || !okJfif) return bytes;
    const out = bytes.slice();
    out[13] = 1;
    out[14] = (d >> 8) & 0xff; out[15] = d & 0xff;
    out[16] = (d >> 8) & 0xff; out[17] = d & 0xff;
    return out;
  }

  async function save() {
    const btn = $('save');
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = t('save.working');
    $('err').textContent = '';
    try {
      const o = outPx();
      const out = document.createElement('canvas');
      out.width = o.w; out.height = o.h;
      // 화면의 틀과 같은 네모를, 안내선만 빼고 출력 크기로 그린다.
      paint(out.getContext('2d'), o.w, o.h, false);

      const enc = await encodeUnder(out, cap * 1024);
      const stamped = stampDpi(new Uint8Array(await enc.blob.arrayBuffer()), dpi);

      const url = URL.createObjectURL(new Blob([stamped], { type: 'image/jpeg' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = t('save.filename') + '_' + preset.w + 'x' + preset.h + '_' + dpi + 'dpi.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      $('saveinfo').textContent =
        o.w + '×' + o.h + ' px · ' + (stamped.length / 1024).toFixed(0) + ' KB · ' +
        t('save.quality') + ' ' + Math.round(enc.q * 100);
    } catch (e) {
      const msg = String(e.message);
      const over = msg.startsWith('CAP:') ? msg.slice(4) : null;
      fail(t('err.saveFail'), over ? t('err.capFail', over, cap) : msg);
    }
    btn.textContent = was;
    btn.disabled = false;
  }

  /* ─── 받기 ──────────────────────────────────────────────────────── */

  /** 오류 표시. textContent 로만 넣는다 — 파일 이름이 그대로 HTML 이 되면 안 된다. */
  function fail(head, body) {
    const box = $('err');
    box.textContent = '';
    const d = document.createElement('div');
    d.className = 'msg err';
    const b = document.createElement('b');
    b.textContent = head;
    d.append(b, document.createElement('br'), document.createTextNode(body));
    box.appendChild(d);
  }

  async function load(file) {
    $('err').textContent = '';
    try {
      if (!file.type.startsWith('image/')) throw new Error(t('err.notImage'));
      // from-image: 휴대폰 사진은 EXIF 로 눕혀져 있는 게 많다. 여기서 세워 둔다.
      img = await createImageBitmap(file, { imageOrientation: 'from-image' });

      $('fname').textContent = file.name || t('pasted');
      $('fmeta').textContent = img.width + ' × ' + img.height + ' px';
      $('work').hidden = false;
      $('drop').hidden = true;
      layout();

      // 원본이 너무 작으면 규격을 채워도 흐리다. 미리 말해 준다.
      const o = outPx();
      if (img.width < o.w || img.height < o.h) {
        fail(t('err.tooSmallHead'),
          t('err.tooSmall', img.width + '×' + img.height, o.w + '×' + o.h));
      }
    } catch (e) {
      fail(t('err.openFail'), e.message);
    }
  }

  /* ─── 연결 ──────────────────────────────────────────────────────── */

  const drop = $('drop');
  drop.addEventListener('click', () => $('file').click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); }
  });
  $('file').addEventListener('change', (e) => e.target.files[0] && load(e.target.files[0]));
  for (const ev of ['dragenter', 'dragover'])
    document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
  for (const ev of ['dragleave', 'drop'])
    document.addEventListener(ev, (e) => {
      e.preventDefault();
      if (e.type === 'dragleave' && e.relatedTarget) return;
      drop.classList.remove('over');
    });
  document.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) load(f); });
  document.addEventListener('paste', (e) => { const f = e.clipboardData.files[0]; if (f) load(f); });
  $('reset').addEventListener('click', () => location.reload());
  $('save').addEventListener('click', save);

  buildSizes();
  drawDpis();
  drawCaps();
  syncAdjust();
  showOut();
}
