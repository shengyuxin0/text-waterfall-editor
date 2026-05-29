const DEFAULT_TEXT =
  "夜里有一盏很小的灯，像没说出口的话，慢慢落进水里。I write your name where the rain becomes quiet. Some words fall, some words shine, some words stay at the bottom of the blue.";

const DEFAULT_FLOW = {
  boxW: 170,
  boxH: 630,
  fontMin: 9,
  fontMax: 17,
  pileW: 140,
  pileTop: 22,
  pileBottom: 38,
};

const QUALITY = {
  "流畅": { drops: 140, settledMax: 220, settledTrim: 40 },
  "标准": { drops: 220, settledMax: 360, settledTrim: 40 },
  "高清": { drops: 320, settledMax: 520, settledTrim: 50 },
};

const keywords = ["雨", "夜", "水", "灯", "落", "blue", "rain", "quiet", "shine", "fall", "name"];

const dom = {
  host: document.querySelector("#canvasHost"),
  media: document.querySelector("#mediaInput"),
  ratio: document.querySelector("#ratioSelect"),
  quality: document.querySelector("#qualitySelect"),
  showBox: document.querySelector("#showBox"),
  showFlow: document.querySelector("#showFlow"),
  finishFlow: document.querySelector("#finishFlow"),
  exportStill: document.querySelector("#exportStill"),
  deleteFlow: document.querySelector("#deleteFlow"),
  resetFlow: document.querySelector("#resetFlow"),
  text: document.querySelector("#textInput"),
  download: document.querySelector("#downloadPng"),
  record: document.querySelector("#recordVideo"),
  boxW: document.querySelector("#boxW"),
  boxH: document.querySelector("#boxH"),
  fontMin: document.querySelector("#fontMin"),
  fontMax: document.querySelector("#fontMax"),
  pileW: document.querySelector("#pileW"),
  pileTop: document.querySelector("#pileTop"),
  pileBottom: document.querySelector("#pileBottom"),
  boxWValue: document.querySelector("#boxWValue"),
  boxHValue: document.querySelector("#boxHValue"),
  fontMinValue: document.querySelector("#fontMinValue"),
  fontMaxValue: document.querySelector("#fontMaxValue"),
  pileWValue: document.querySelector("#pileWValue"),
  pileTopValue: document.querySelector("#pileTopValue"),
  pileBottomValue: document.querySelector("#pileBottomValue"),
};

const state = {
  emitters: [],
  selected: null,
  bgImg: null,
  bgVideo: null,
  bgVideoUrl: null,
  mediaNativeW: 600,
  mediaNativeH: 800,
  canvasW: 600,
  canvasH: 800,
  chars: DEFAULT_TEXT.split(""),
  pressEmitter: null,
  pressWasSelected: false,
  pressX: 0,
  pressY: 0,
  didDrag: false,
  recorder: null,
  chunks: [],
  isExporting: false,
};

let p5Instance;

const sketch = (p) => {
  let cnv;

  p.setup = () => {
    cnv = p.createCanvas(state.canvasW, state.canvasH);
    cnv.parent(dom.host);
    p.pixelDensity(1);
    p.textFont("Helvetica, Arial, sans-serif");
    bindCanvasPointer(cnv.elt, p);
  };

  p.draw = () => {
    drawBackground(p);

    for (const emitter of state.emitters) {
      if (dom.showFlow.checked || emitter !== state.selected) {
        drawTextWaterfall(p, emitter);
        drawSettledText(p, emitter);
      }
    }

    if (state.selected && dom.showBox.checked && !state.isExporting) {
      drawSelectionBox(p, state.selected);
    }
  };

  p.windowResized = () => {
    fitCanvasDisplay();
  };

  p5Instance = p;
};

new p5(sketch);

bindDomControls();
updateValueLabels();

function bindDomControls() {
  dom.media.addEventListener("change", handleMediaUpload);
  dom.ratio.addEventListener("change", applyCanvasRatio);
  dom.quality.addEventListener("change", applyQualityToEmitters);
  dom.showBox.addEventListener("change", () => {});
  dom.showFlow.addEventListener("change", () => {});
  dom.finishFlow.addEventListener("click", finishCurrentFlow);
  dom.exportStill.addEventListener("click", downloadPng);
  dom.deleteFlow.addEventListener("click", deleteSelectedEmitter);
  dom.resetFlow.addEventListener("click", resetSelectedDefaults);
  dom.text.addEventListener("input", updateTextSource);
  dom.download.addEventListener("click", downloadPng);
  dom.record.addEventListener("click", toggleRecording);

  for (const input of flowInputs()) {
    input.addEventListener("input", () => {
      applyControlValues();
      updateValueLabels();
    });
  }
}

function bindCanvasPointer(canvas, p) {
  const pointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * state.canvasW,
      y: ((event.clientY - rect.top) / rect.height) * state.canvasH,
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const pos = pointer(event);
    startPress(pos.x, pos.y, p);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pressEmitter) return;
    event.preventDefault();
    const pos = pointer(event);
    dragPress(pos.x, pos.y, p);
  });

  canvas.addEventListener("pointerup", (event) => {
    event.preventDefault();
    endPress();
  });

  canvas.addEventListener("pointercancel", endPress);
}

function startPress(x, y, p) {
  state.pressX = x;
  state.pressY = y;
  state.didDrag = false;

  const hit = findEmitterAt(x, y);
  state.pressEmitter = hit;
  state.pressWasSelected = hit && hit === state.selected;

  if (hit) {
    state.selected = hit;
    syncControlsToSelected();
    return;
  }

  if (state.emitters.length < 2) {
    addEmitter(x, y, p);
    return;
  }

  state.selected = null;
}

function dragPress(x, y, p) {
  if (!state.pressEmitter || state.pressEmitter !== state.selected) return;

  const dx = x - (p._lastDragX ?? state.pressX);
  const dy = y - (p._lastDragY ?? state.pressY);
  p._lastDragX = x;
  p._lastDragY = y;

  if (Math.hypot(x - state.pressX, y - state.pressY) > 4) {
    state.didDrag = true;
  }

  moveEmitter(state.pressEmitter, dx, dy, p);
}

function endPress() {
  if (!state.pressEmitter) return;

  if (!state.didDrag) {
    state.selected = state.pressWasSelected ? null : state.pressEmitter;
    syncControlsToSelected();
  }

  if (p5Instance) {
    p5Instance._lastDragX = undefined;
    p5Instance._lastDragY = undefined;
  }
  state.pressEmitter = null;
}

function drawBackground(p) {
  if (state.bgVideo) {
    imageCover(p, state.bgVideo);
    return;
  }

  if (state.bgImg) {
    imageCover(p, state.bgImg);
    return;
  }

  drawInstructionBackground(p);
}

function drawInstructionBackground(p) {
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  p.background(dark ? "#0f1f3d" : "#f7f3e8");
  p.noStroke();
  p.fill(dark ? "#d8e9ff" : "#4f765e");
  p.textAlign(p.LEFT, p.TOP);
  p.textSize(15);
  p.textLeading(24);
  p.text(
    "上传图片或视频后，点击画面生成文字水流。\n" +
      "最多保留两条水流。\n" +
      "点击水流区域可选中，再次点击可取消选中。\n" +
      "按住选中区域拖动，可以微调眼泪位置。\n" +
      "切换画幅时，水流会跟随画面相对位置移动。",
    28,
    32,
    state.canvasW - 56,
    state.canvasH - 64,
  );
}

function imageCover(p, img) {
  const iw = img.videoWidth || img.width || state.mediaNativeW;
  const ih = img.videoHeight || img.height || state.mediaNativeH;
  const s = Math.max(state.canvasW / iw, state.canvasH / ih);
  const nw = iw * s;
  const nh = ih * s;
  const nx = (state.canvasW - nw) / 2;
  const ny = (state.canvasH - nh) / 2;
  p.image(img, nx, ny, nw, nh);
}

function drawTextWaterfall(p, emitter) {
  p.textFont("Helvetica, Arial, sans-serif");
  p.textAlign(p.CENTER, p.CENTER);

  for (const drop of emitter.drops) {
    if (drop.done) continue;

    drop.life += 1;
    drop.y += drop.speed;
    drop.x += p.sin(drop.y * 0.035 + p.frameCount * 0.03 + drop.phase) * drop.sway;
    drop.x += p.random(-0.05, 0.05);

    const spread = p.map(drop.y, emitter.y, emitter.basinY, emitter.boxW * 0.03, emitter.boxW * 0.18);
    drop.x += p.random(-spread, spread) * 0.006;

    if (drop.y > emitter.basinY + p.random(-20, 45)) {
      emitter.settled.push({
        ch: drop.ch,
        x: drop.x + p.random(-emitter.pileW * 0.5, emitter.pileW * 0.5),
        y: emitter.basinY + p.random(-emitter.pileTop, emitter.pileBottom),
        size: drop.size + p.random(-2, 4),
        alpha: p.random(45, 115),
      });

      if (emitter.finished) {
        drop.done = true;
      } else {
        Object.assign(drop, makeDrop(emitter, drop.life, p));
      }
    }

    p.noStroke();
    p.fill(100, 205, 245, drop.alpha);
    p.textSize(drop.size);
    p.text(drop.ch, drop.x, drop.y);
  }

  if (emitter.finished) {
    emitter.drops = emitter.drops.filter((drop) => !drop.done);
  }

  const q = QUALITY[dom.quality.value];
  if (emitter.settled.length > q.settledMax) {
    emitter.settled.splice(0, q.settledTrim);
  }
}

function drawSettledText(p, emitter) {
  p.textAlign(p.CENTER, p.CENTER);
  p.noStroke();

  for (const item of emitter.settled) {
    p.fill(95, 205, 245, item.alpha);
    p.textSize(item.size);
    p.text(item.ch, item.x, item.y);
  }
}

function drawSelectionBox(p, emitter) {
  p.push();
  p.noFill();
  p.stroke(110, 205, 245, 210);
  p.strokeWeight(1.5);
  p.drawingContext.setLineDash([7, 6]);
  p.rectMode(p.CENTER);
  p.rect(emitter.x, emitter.y + emitter.boxH / 2, emitter.boxW, emitter.boxH, 8);

  p.drawingContext.setLineDash([]);
  p.noStroke();
  p.fill(110, 205, 245, 220);
  p.circle(emitter.x, emitter.y, 8);
  p.pop();
}

function addEmitter(x, y, p) {
  const emitter = {
    x,
    y,
    basinY: p.constrain(y + DEFAULT_FLOW.boxH, y + 120, state.canvasH - 40),
    boxW: DEFAULT_FLOW.boxW,
    boxH: DEFAULT_FLOW.boxH,
    fontMin: DEFAULT_FLOW.fontMin,
    fontMax: DEFAULT_FLOW.fontMax,
    pileW: DEFAULT_FLOW.pileW,
    pileTop: DEFAULT_FLOW.pileTop,
    pileBottom: DEFAULT_FLOW.pileBottom,
    finished: false,
    drops: [],
    settled: [],
  };

  const q = QUALITY[dom.quality.value];
  for (let i = 0; i < q.drops; i += 1) {
    emitter.drops.push(makeDrop(emitter, i, p));
  }

  state.emitters.push(emitter);
  state.selected = emitter;
  syncControlsToSelected();
}

function makeDrop(emitter, seed, p) {
  const ch = state.chars[p.floor(p.random(state.chars.length))] || " ";

  return {
    ch,
    x: emitter.x + p.random(-emitter.boxW * 0.07, emitter.boxW * 0.07),
    y: emitter.y + p.random(0, 20),
    speed: p.random(1.2, 3.2),
    sway: p.random(0.1, 0.5),
    phase: p.random(p.TWO_PI),
    size: randomTextSize(emitter, ch, p),
    alpha: p.random(65, 175),
    life: seed,
  };
}

function randomTextSize(emitter, ch, p) {
  const minSize = Math.min(emitter.fontMin, emitter.fontMax);
  const maxSize = Math.max(emitter.fontMin, emitter.fontMax);
  if (isKeywordChar(ch) && p.random() < 0.6) {
    return p.floor(p.random(Math.max(minSize, maxSize - 2), maxSize + 1));
  }
  return p.floor(p.random(minSize, maxSize + 1));
}

function isKeywordChar(ch) {
  return keywords.some((word) => word.includes(ch));
}

function findEmitterAt(x, y) {
  for (let i = state.emitters.length - 1; i >= 0; i -= 1) {
    const emitter = state.emitters[i];
    const left = emitter.x - emitter.boxW / 2;
    const right = emitter.x + emitter.boxW / 2;
    const top = emitter.y;
    const bottom = emitter.y + emitter.boxH;
    if (x >= left && x <= right && y >= top && y <= bottom) return emitter;
  }
  return null;
}

function moveEmitter(emitter, dx, dy, p) {
  emitter.x = p.constrain(emitter.x + dx, 0, state.canvasW);
  emitter.y = p.constrain(emitter.y + dy, 0, state.canvasH - 40);
  emitter.basinY = p.constrain(emitter.basinY + dy, emitter.y + 120, state.canvasH - 20);

  for (const drop of emitter.drops) {
    drop.x += dx;
    drop.y += dy;
  }

  for (const item of emitter.settled) {
    item.x += dx;
    item.y += dy;
  }
}

function updateTextSource() {
  state.chars = dom.text.value.split("");
  if (!state.chars.length) state.chars = [" "];
}

function flowInputs() {
  return [dom.boxW, dom.boxH, dom.fontMin, dom.fontMax, dom.pileW, dom.pileTop, dom.pileBottom];
}

function updateValueLabels() {
  dom.boxWValue.textContent = dom.boxW.value;
  dom.boxHValue.textContent = dom.boxH.value;
  dom.fontMinValue.textContent = dom.fontMin.value;
  dom.fontMaxValue.textContent = dom.fontMax.value;
  dom.pileWValue.textContent = dom.pileW.value;
  dom.pileTopValue.textContent = dom.pileTop.value;
  dom.pileBottomValue.textContent = dom.pileBottom.value;
}

function syncControlsToSelected() {
  if (!state.selected) return;

  dom.boxW.value = Math.round(state.selected.boxW);
  dom.boxH.value = Math.round(state.selected.boxH);
  dom.fontMin.value = Math.round(state.selected.fontMin);
  dom.fontMax.value = Math.round(state.selected.fontMax);
  dom.pileW.value = Math.round(state.selected.pileW);
  dom.pileTop.value = Math.round(state.selected.pileTop);
  dom.pileBottom.value = Math.round(state.selected.pileBottom);
  updateValueLabels();
}

function applyControlValues() {
  if (!state.selected || !p5Instance) return;

  state.selected.boxW = Number(dom.boxW.value);
  state.selected.boxH = Number(dom.boxH.value);
  state.selected.fontMin = Number(dom.fontMin.value);
  state.selected.fontMax = Number(dom.fontMax.value);
  state.selected.pileW = Number(dom.pileW.value);
  state.selected.pileTop = Number(dom.pileTop.value);
  state.selected.pileBottom = Number(dom.pileBottom.value);
  state.selected.basinY = p5Instance.constrain(
    state.selected.y + state.selected.boxH,
    state.selected.y + 120,
    state.canvasH - 20,
  );
}

function resetSelectedDefaults() {
  if (!state.selected || !p5Instance) return;

  Object.assign(state.selected, {
    boxW: DEFAULT_FLOW.boxW,
    boxH: DEFAULT_FLOW.boxH,
    fontMin: DEFAULT_FLOW.fontMin,
    fontMax: DEFAULT_FLOW.fontMax,
    pileW: DEFAULT_FLOW.pileW,
    pileTop: DEFAULT_FLOW.pileTop,
    pileBottom: DEFAULT_FLOW.pileBottom,
    finished: false,
  });
  state.selected.basinY = p5Instance.constrain(
    state.selected.y + state.selected.boxH,
    state.selected.y + 120,
    state.canvasH - 20,
  );

  const q = QUALITY[dom.quality.value];
  while (state.selected.drops.length < q.drops) {
    state.selected.drops.push(makeDrop(state.selected, state.selected.drops.length, p5Instance));
  }

  syncControlsToSelected();
}

function deleteSelectedEmitter() {
  if (!state.selected) return;
  state.emitters = state.emitters.filter((emitter) => emitter !== state.selected);
  state.selected = null;
}

function finishCurrentFlow() {
  const targets = state.selected ? [state.selected] : state.emitters;

  for (const emitter of targets) {
    emitter.finished = true;
  }
}

function applyQualityToEmitters() {
  if (!p5Instance) return;
  const q = QUALITY[dom.quality.value];

  for (const emitter of state.emitters) {
    if (emitter.finished) continue;

    if (emitter.drops.length > q.drops) {
      emitter.drops.splice(q.drops);
    }

    while (emitter.drops.length < q.drops) {
      emitter.drops.push(makeDrop(emitter, emitter.drops.length, p5Instance));
    }

    if (emitter.settled.length > q.settledMax) {
      emitter.settled.splice(0, emitter.settled.length - q.settledMax);
    }
  }
}

function handleMediaUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file || !p5Instance) return;

  if (state.bgVideo) {
    state.bgVideo.pause();
    state.bgVideo.removeAttribute("src");
    state.bgVideo.load();
    state.bgVideo = null;
  }

  if (state.bgVideoUrl) {
    URL.revokeObjectURL(state.bgVideoUrl);
    state.bgVideoUrl = null;
  }

  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    p5Instance.loadImage(url, (img) => {
      state.bgImg = img;
      state.mediaNativeW = img.width || 600;
      state.mediaNativeH = img.height || 800;
      dom.ratio.value = "原尺寸";
      applyCanvasRatio();
      URL.revokeObjectURL(url);
    });
    return;
  }

  if (file.type.startsWith("video/")) {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    state.bgVideoUrl = url;
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    video.addEventListener("loadedmetadata", () => {
      state.bgImg = null;
      state.bgVideo = video;
      state.mediaNativeW = video.videoWidth || 600;
      state.mediaNativeH = video.videoHeight || 800;
      dom.ratio.value = "原尺寸";
      applyCanvasRatio();
      video.play().catch(() => {});
    });
  }
}

function applyCanvasRatio() {
  if (!p5Instance) return;

  const oldW = state.canvasW;
  const oldH = state.canvasH;
  const choice = dom.ratio.value;
  let newW;
  let newH;

  if (choice === "原尺寸") {
    newW = state.mediaNativeW;
    newH = state.mediaNativeH;
    const scale = Math.min(900 / newW, 1000 / newH, 1);
    newW *= scale;
    newH *= scale;
  } else {
    const [rw, rh] = choice.split(":").map(Number);
    const maxW = 900;
    const maxH = 1000;

    if (rw >= rh) {
      newW = maxW;
      newH = (maxW * rh) / rw;
    } else {
      newH = maxH;
      newW = (maxH * rw) / rh;
    }
  }

  newW = p5Instance.constrain(Math.round(newW), 260, 1100);
  newH = p5Instance.constrain(Math.round(newH), 260, 1100);

  state.canvasW = newW;
  state.canvasH = newH;
  p5Instance.resizeCanvas(newW, newH);
  scaleEmittersToCanvas(oldW, oldH, newW, newH);
  fitCanvasDisplay();
  syncControlsToSelected();
}

function scaleEmittersToCanvas(oldW, oldH, newW, newH) {
  if (!oldW || !oldH || !p5Instance) return;

  const sx = newW / oldW;
  const sy = newH / oldH;

  for (const emitter of state.emitters) {
    emitter.x *= sx;
    emitter.y *= sy;
    emitter.basinY *= sy;
    emitter.boxW = p5Instance.constrain(emitter.boxW * sx, 70, 320);
    emitter.boxH = p5Instance.constrain(emitter.boxH * sy, 160, 760);
    emitter.pileW = p5Instance.constrain(emitter.pileW * sx, 30, 360);
    emitter.pileTop = p5Instance.constrain(emitter.pileTop * sy, 0, 160);
    emitter.pileBottom = p5Instance.constrain(emitter.pileBottom * sy, 0, 180);
    emitter.x = p5Instance.constrain(emitter.x, 0, newW);
    emitter.y = p5Instance.constrain(emitter.y, 0, newH - 40);
    emitter.basinY = p5Instance.constrain(emitter.basinY, emitter.y + 120, newH - 20);

    for (const drop of emitter.drops) {
      drop.x *= sx;
      drop.y *= sy;
    }

    for (const item of emitter.settled) {
      item.x *= sx;
      item.y *= sy;
    }
  }
}

function fitCanvasDisplay() {
  const canvas = dom.host.querySelector("canvas");
  if (!canvas) return;
  canvas.style.maxWidth = "100%";
}

function downloadPng() {
  if (!p5Instance) return;
  state.isExporting = true;
  p5Instance.redraw();
  p5Instance.saveCanvas("text-waterfall", "png");
  state.isExporting = false;
}

function toggleRecording() {
  const canvas = dom.host.querySelector("canvas");
  if (!canvas) return;

  if (!window.MediaRecorder || !canvas.captureStream) {
    alert("当前浏览器暂不支持直接录制，可以先使用导出 PNG。");
    return;
  }

  if (state.recorder && state.recorder.state === "recording") {
    state.recorder.stop();
    dom.record.textContent = "录制 WebM";
    return;
  }

  const stream = canvas.captureStream(30);
  state.chunks = [];
  const options = MediaRecorder.isTypeSupported("video/webm") ? { mimeType: "video/webm" } : undefined;
  state.recorder = new MediaRecorder(stream, options);
  state.recorder.ondataavailable = (event) => {
    if (event.data.size) state.chunks.push(event.data);
  };
  state.recorder.onstop = () => {
    const blob = new Blob(state.chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text-waterfall.webm";
    a.click();
    URL.revokeObjectURL(url);
  };
  state.recorder.start();
  dom.record.textContent = "停止录制";
}
