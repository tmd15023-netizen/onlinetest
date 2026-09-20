const ADMIN_NAV = [
  { id: "admin-notices", href: "#/admin/notices", label: "공지사항 관리", icon: ICONS.notice },
  { id: "admin-exams", href: "#/admin", label: "시험 관리", icon: ICONS.exams },
  { id: "admin-users", href: "#/admin/users", label: "회원 관리", icon: ICONS.users },
  { id: "admin-attempts", href: "#/admin/attempts", label: "응시 현황", icon: ICONS.history },
  { id: "admin-settings", href: "#/admin/settings", label: "입장코드", icon: ICONS.notice },
];

function adminLayout(active, content) {
  const user = Storage.getUser();
  return `
    <div class="app-shell">
      <div class="sidebar-backdrop ${state.sidebarOpen ? "show" : ""}" data-close-menu></div>
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
        <a class="brand" href="#/admin">${LOGO_SVG}<div class="brand-text"><strong>${APP.name}</strong><span>관리자</span></div></a>
        <nav class="nav">
          ${ADMIN_NAV.map(
            (item) => `
            <a class="nav-item ${item.id === active ? "active" : ""}" href="${item.href}">
              ${item.icon}<span>${item.label}</span>
            </a>
          `
          ).join("")}
        </nav>
        <div class="sidebar-user">
          ${userMarkHtml(user)}
          <div class="user-meta"><strong>${escapeHtml(user.name)}</strong></div>
          ${viewSwitchHtml("learner")}
          <button class="icon-btn" data-logout title="로그아웃">${ICONS.logout}</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <button class="menu-btn" data-menu aria-label="메뉴">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div class="user-chip">
            ${userMarkHtml(user)}
            <span class="user-chip-name">관리자</span>
            ${viewSwitchHtml("learner")}
            <button class="icon-btn" data-logout title="로그아웃">${ICONS.logout}</button>
          </div>
        </div>
        ${content}
      </main>
    </div>
  `;
}

function examGradeSelectHtml(name, category) {
  const current = examGradeLabel(category);
  const known = EXAM_GRADES.includes(current);
  return `
    <select name="categoryPreset" class="grade-preset">
      ${EXAM_GRADES.map(
        (grade) => `<option value="${escapeHtml(grade)}" ${known && grade === current ? "selected" : ""}>${escapeHtml(grade)}</option>`
      ).join("")}
      <option value="__custom__" ${known ? "" : "selected"}>직접 입력</option>
    </select>
    <div class="grade-custom" data-grade-custom ${known ? "hidden" : ""}>
      <label>직접 입력</label>
      <input name="${name}" value="${escapeHtml(current)}" placeholder="예: AI 프롬프트 활용능력 1급 실기" />
    </div>
  `;
}

function syncGradeCustom(form) {
  const select = form.querySelector('[name="categoryPreset"]');
  const wrap = form.querySelector("[data-grade-custom]");
  const input = form.querySelector('[name="category"]');
  if (!select || !wrap || !input) return;
  const custom = select.value === "__custom__";
  wrap.hidden = !custom;
  if (custom) {
    if (EXAM_GRADES.includes(input.value.trim())) input.value = "";
    input.required = true;
    setTimeout(() => input.focus(), 0);
  } else {
    input.required = false;
    input.value = select.value;
  }
}

function bindGradeFields(form) {
  if (!form) return;
  const select = form.querySelector('[name="categoryPreset"]');
  if (!select) return;
  select.addEventListener("change", () => syncGradeCustom(form));
  syncGradeCustom(form);
}

function examGradeClass(category) {
  const short = examGradeShort(category);
  if (short === "2급") return "grade-2";
  if (short === "1급") return "grade-1";
  return "grade-other";
}

function formField(form, name) {
  const el = form.elements.namedItem(name);
  if (!el) return "";
  return String(el.value || "");
}

function formChecked(form, name) {
  const el = form.elements.namedItem(name);
  return Boolean(el && el.checked);
}

function setBanner(el, message, ok) {
  if (!el) return;
  el.textContent = message;
  el.className = ok ? "form-banner ok" : "form-banner err";
}

function questionImageEditorHtml(images) {
  const list = (images || []).filter(Boolean);
  return `
    <div class="q-image-edit">
      ${list
        .map(
          (src, i) => `
        <div class="q-image-chip">
          <img src="${safeImageSrc(src)}" alt="문항 이미지" />
          <button type="button" class="btn btn-ghost" data-remove-img="${i}">삭제</button>
        </div>
      `
        )
        .join("")}
      <label class="q-image-add">
        이미지 첨부
        <input type="file" accept="image/*" multiple hidden data-add-img />
      </label>
    </div>
  `;
}

function bindQuestionImages(root, images, onChange) {
  if (!root) return;
  const box = root.querySelector(".q-image-edit");
  if (!box) return;
  const current = () => (Array.isArray(images) ? images : []);
  const redraw = (next) => {
    images = next;
    box.outerHTML = questionImageEditorHtml(next);
    bindQuestionImages(root, next, onChange);
    if (typeof onChange === "function") onChange(next);
  };
  box.querySelector("[data-add-img]")?.addEventListener("change", async (e) => {
    const files = [...(e.currentTarget.files || [])];
    e.currentTarget.value = "";
    const next = current().slice();
    for (const file of files) {
      if (!String(file.type || "").startsWith("image/")) continue;
      if (file.size > 2.5 * 1024 * 1024) {
        alert("이미지는 장당 2.5MB 이하로 올려 주세요.");
        continue;
      }
      if (next.length >= 8) {
        alert("문항 이미지는 최대 8장까지 첨부할 수 있습니다.");
        break;
      }
      next.push(await readFileAsDataUrl(file));
    }
    redraw(next);
  });
  box.querySelectorAll("[data-remove-img]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.removeImg);
      redraw(current().filter((_, i) => i !== idx));
    });
  });
}

function registeredQuestionEditHtml(item, index) {
  const short = isShortQuestion(item);
  const choices = item.choices && item.choices.length ? item.choices.concat(["", "", "", "", ""]).slice(0, 5) : ["", "", "", "", ""];
  const picked = new Set(mcqAnswerIndexes(item));
  return `
    <div class="review-item editing" data-q-index="${index}" data-q-editor>
      <div class="pdf-item-head">
        <strong>${index + 1}번 수정</strong>
        <button class="btn btn-primary pdf-del" type="button" data-save-q="${index}">저장</button>
        <button class="btn btn-ghost pdf-del" type="button" data-cancel-q="${index}">취소</button>
      </div>
      <div class="pdf-edit">
        <label>문항 유형
          <select data-edit-type>
            <option value="mcq" ${short ? "" : "selected"}>객관식</option>
            <option value="short" ${short ? "selected" : ""}>주관식</option>
          </select>
        </label>
        <label>문제
          <textarea data-edit-stem rows="3">${escapeHtml(item.q || "")}</textarea>
        </label>
        <div class="field">
          <label>문항 이미지</label>
          ${questionImageEditorHtml(item.images)}
        </div>
        <div data-edit-short ${short ? "" : "hidden"}>
          <label>주관식 정답 <input data-edit-answer-text value="${escapeHtml(String(item.answer || ""))}" placeholder="여러 정답은 쉼표로 구분" /></label>
        </div>
        <div data-edit-mcq ${short ? "hidden" : ""}>
          ${choices
            .map(
              (choice, cidx) =>
                `<label>보기 ${cidx + 1}${cidx === 4 ? " (선택)" : ""} <input data-edit-choice="${cidx}" value="${escapeHtml(choice)}" /></label>`
            )
            .join("")}
          <label>정답 (여러 개 선택 가능)
            <div class="answer-checks">
              ${choices
                .map(
                  (_, cidx) =>
                    `<label class="check-row"><input type="checkbox" data-edit-answer value="${cidx}" ${picked.has(cidx) ? "checked" : ""} /> ${cidx + 1}번</label>`
                )
                .join("")}
            </div>
          </label>
        </div>
        <label>해설 <textarea data-edit-explain rows="3">${escapeHtml(item.explain || "")}</textarea></label>
      </div>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadMammothBrowser() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mammoth@1.12.3/mammoth.browser.min.js";
    script.onload = () => (window.mammoth ? resolve(window.mammoth) : reject(new Error("Word 분석 모듈을 불러오지 못했습니다.")));
    script.onerror = () => reject(new Error("Word 분석 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function dataUriToBlob(dataUri) {
  const match = String(dataUri || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

async function replaceHtmlDataImages(examId, html, onProgress) {
  const found = [...String(html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(data:image\/[\s\S]*?)\1/gi)].map((item) => item[2]);
  const unique = [...new Set(found)];
  if (!unique.length) return html;
  const urls = new Map();
  for (let i = 0; i < unique.length; i += 1) {
    const src = unique[i];
    const blob = dataUriToBlob(src);
    if (!blob || blob.size < 32) {
      urls.set(src, "");
      continue;
    }
    if (onProgress) onProgress(`문항 이미지 ${i + 1}/${unique.length}장 저장 중...`);
    try {
      const saved = await Api.uploadExamMedia(examId, blob, blob.type);
      urls.set(src, saved && saved.url ? saved.url : "");
    } catch (err) {
      urls.set(src, src.length < 3500000 ? src : "");
    }
  }
  let out = html;
  urls.forEach((url, src) => {
    out = out.split(src).join(url || "");
  });
  return out;
}

async function importDocxSmart(id, file, onProgress) {
  try {
    if (onProgress) onProgress("Word 문항을 브라우저에서 읽는 중입니다...");
    const mammoth = await loadMammothBrowser();
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer },
      { convertImage: mammoth.images.dataUri, ignoreEmptyParagraphs: false }
    );
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    const html = await replaceHtmlDataImages(id, htmlResult.value || "", onProgress);
    if (onProgress) onProgress("문항 번호를 인식하는 중입니다...");
    return await Api.importDocxParsed(id, {
      filename: file.name,
      html,
      rawText: rawResult.value || "",
    });
  } catch (err) {
    const msg = String(err && err.message ? err.message : "");
    if (/문항을 찾지/.test(msg) || file.size > 3800000) throw err;
    if (onProgress) onProgress("서버에서 Word 문항을 다시 읽는 중입니다...");
    return Api.importDocxFile(id, file);
  }
}

function importKind(file) {
  const name = String(file && file.name ? file.name : "").toLowerCase();
  const type = String(file && file.type ? file.type : "");
  return {
    name,
    isDocx: name.endsWith(".docx") || type.includes("wordprocessingml"),
    isPdf: name.endsWith(".pdf") || type === "application/pdf",
    isText: name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".tsv") || type.startsWith("text/"),
    isOldDoc: name.endsWith(".doc") && !name.endsWith(".docx"),
  };
}

function previewAnswerStatus(item) {
  if (item.answerMatched) return `<span class="pdf-flag ok">파일 정답 반영</span>`;
  return `<span class="pdf-flag warn">정답을 확인해 주세요</span>`;
}

function previewExplainStatus(item) {
  if (String(item.explain || "").trim()) return `<span class="pdf-flag ok">파일 해설 반영</span>`;
  return `<span class="pdf-flag warn">해설 없음</span>`;
}

function ensurePreviewEditing() {
  if (!(window._pdfEditing instanceof Set)) window._pdfEditing = new Set();
  return window._pdfEditing;
}

function mcqAnswerChecksHtml(item, index, count) {
  const picked = new Set(mcqAnswerIndexes(item));
  const n = count || Math.max(2, (item.choices || []).length || 4);
  return `
    <div class="answer-checks">
      ${Array.from({ length: n }, (_, cidx) => `
        <label class="check-row">
          <input type="checkbox" data-pdf-answer-idx="${cidx}" value="${cidx}" ${picked.has(cidx) ? "checked" : ""} />
          ${cidx + 1}번
        </label>
      `).join("")}
    </div>
    <p class="exam-desc">여러 개를 고르면 복수 정답 문항이 됩니다.</p>
  `;
}

function readMcqAnswerFrom(root, item) {
  const boxes = [...(root || document).querySelectorAll("[data-pdf-answer-idx]")];
  if (!boxes.length) return item.answer;
  const picked = boxes.filter((el) => el.checked).map((el) => Number(el.value));
  return normalizeMcqAnswer(picked, (item.choices || boxes).length) ?? picked;
}

function previewChoiceCount(item) {
  const n = Array.isArray(item.choices) ? item.choices.length : 0;
  return Math.max(4, Math.min(5, n || 4));
}

function readPreviewItemFromDom(item, index) {
  const root = document.querySelector(`[data-preview-idx="${index}"]`);
  const readExplain = (scope) => {
    const el = (scope || document).querySelector(`[data-pdf-explain="${index}"]`);
    return el ? el.value.trim() : item.explain || "";
  };
  if (!root) {
    if (isShortQuestion(item)) {
      const input = document.querySelector(`[data-pdf-answer-text="${index}"]`);
      return { ...item, type: "short", answer: input ? input.value.trim() : item.answer, explain: readExplain(document) };
    }
    const rootDoc = document.querySelector(`[data-preview-idx="${index}"]`) || document;
    return { ...item, type: "mcq", answer: readMcqAnswerFrom(rootDoc, item), explain: readExplain(document) };
  }
  const typeEl = root.querySelector("[data-pdf-type]");
  const qEl = root.querySelector("[data-pdf-q]");
  if (!typeEl && !qEl) {
    if (isShortQuestion(item)) {
      const input = root.querySelector(`[data-pdf-answer-text="${index}"]`);
      return { ...item, type: "short", answer: input ? input.value.trim() : item.answer, explain: readExplain(root) };
    }
    return { ...item, type: "mcq", answer: readMcqAnswerFrom(root, item), explain: readExplain(root) };
  }
  const type = typeEl ? typeEl.value : isShortQuestion(item) ? "short" : "mcq";
  const explainEl = root.querySelector(`[data-pdf-explain="${index}"]`) || root.querySelector("[data-pdf-explain]");
  const next = {
    ...item,
    type,
    q: qEl ? qEl.value.trim() : item.q,
    explain: explainEl ? explainEl.value.trim() : item.explain || "",
    answerMatched: true,
  };
  if (type === "short") {
    const input = root.querySelector(`[data-pdf-answer-text="${index}"]`);
    next.choices = [];
    next.choiceImages = [];
    next.choiceLabels = [];
    next.answer = input ? input.value.trim() : String(item.answer || "");
  } else {
    const choiceInputs = [...root.querySelectorAll("[data-pdf-choice]")];
    next.choices = (choiceInputs.length ? choiceInputs.map((el) => el.value.trim()) : item.choices || []).filter(
      (choice, idx, arr) => choice || idx < 4 || arr.slice(0, idx).some(Boolean)
    );
    if (next.choices.length < 2) next.choices = item.choices && item.choices.length >= 2 ? item.choices : ["", ""];
    next.answer = readMcqAnswerFrom(root, next);
    next.answerMatched = mcqAnswerIndexes({ answer: next.answer }).length > 0;
  }
  return next;
}

function readPreviewEdits(questions) {
  return (questions || []).map((item, index) => readPreviewItemFromDom(item, index));
}

function writePreviewItemLive(index) {
  if (!window._pdfDraft || !window._pdfDraft[index]) return;
  window._pdfDraft[index] = readPreviewItemFromDom(window._pdfDraft[index], index);
}

function previewBannerFor(questions) {
  const list = questions || [];
  if (!list.length) return { message: "미리보기 문항을 모두 삭제했습니다. 파일을 다시 읽거나 아래에서 직접 추가하세요.", ok: false };
  const answers = list.filter((item) => item.answerMatched).length;
  const explains = list.filter((item) => String(item.explain || "").trim()).length;
  const missingA = list.length - answers;
  const missingE = list.length - explains;
  let message = `문항 ${list.length}개 · 정답 ${answers}개 · 해설 ${explains}개입니다.`;
  if (missingA) message += ` 정답 ${missingA}개는 직접 확인해 주세요.`;
  if (missingE) message += ` 해설 ${missingE}개는 해설 파일을 올리거나 직접 적어 주세요.`;
  else message += " 응시 후 틀린 문항의 해설만 오답 노트에 보입니다.";
  if (!missingA) message += " 확인 후 등록하세요.";
  return { message, ok: missingA === 0 };
}

function previewItemViewHtml(item, index, marks) {
  return `
    <div class="pdf-item-head">
      <strong>${item.no || index + 1}번${item.section ? ` · ${escapeHtml(item.section)}` : ""} ${isShortQuestion(item) ? "· 주관식" : "· 객관식"} ${previewAnswerStatus(item)} ${previewExplainStatus(item)}</strong>
      <button class="btn btn-ghost pdf-del" type="button" data-preview-edit="${index}">수정</button>
      <button class="btn btn-danger pdf-del" type="button" data-preview-del="${index}">삭제</button>
    </div>
    <p>${escapeHtml(item.q)}</p>
    ${questionImagesHtml(item.images)}
    ${
      isShortQuestion(item)
        ? `<label>주관식 정답 <input data-pdf-answer-text="${index}" value="${escapeHtml(String(item.answer || ""))}" placeholder="여러 정답은 쉼표로 구분" /></label>`
        : `<ol>
      ${(item.choices || [])
        .map((choice, cidx) => {
          const label = (item.choiceLabels && item.choiceLabels[cidx]) || marks[cidx] || cidx + 1;
          return `<li>${label} ${escapeHtml(choice)}${questionImagesHtml((item.choiceImages || [])[cidx] || [], "q-images-choice")}</li>`;
        })
        .join("")}
    </ol>
    <label>정답
      ${mcqAnswerChecksHtml(item, index, (item.choices || []).length)}
    </label>`
    }
    <label>해설 <textarea data-pdf-explain="${index}" rows="2" placeholder="채점 후 오답 노트에 표시됩니다">${escapeHtml(item.explain || "")}</textarea></label>
  `;
}

function previewItemEditHtml(item, index, marks) {
  const short = isShortQuestion(item);
  const count = previewChoiceCount(item);
  return `
    <div class="pdf-item-head">
      <strong>${item.no || index + 1}번 수정</strong>
      <button class="btn btn-primary pdf-del" type="button" data-preview-done="${index}">완료</button>
    </div>
    <div class="pdf-edit">
      <label>문항 유형
        <select data-pdf-type="${index}">
          <option value="mcq" ${short ? "" : "selected"}>객관식</option>
          <option value="short" ${short ? "selected" : ""}>주관식</option>
        </select>
      </label>
      <label>문제
        <textarea data-pdf-q="${index}" rows="3">${escapeHtml(item.q || "")}</textarea>
      </label>
      ${questionImagesHtml(item.images)}
      ${
        short
          ? `<label>주관식 정답 <input data-pdf-answer-text="${index}" value="${escapeHtml(String(item.answer || ""))}" placeholder="여러 정답은 쉼표로 구분, 예: 프롬프트, 지시문" /></label>`
          : `${Array.from({ length: count }, (_, cidx) => {
              const label = (item.choiceLabels && item.choiceLabels[cidx]) || marks[cidx] || cidx + 1;
              return `<label>보기 ${label} <input data-pdf-choice="${cidx}" value="${escapeHtml((item.choices && item.choices[cidx]) || "")}" /></label>`;
            }).join("")}
      <label>정답
        ${mcqAnswerChecksHtml(item, index, count)}
      </label>`
      }
      <label>해설 <textarea data-pdf-explain="${index}" rows="3" placeholder="채점 후 오답 노트에 표시됩니다">${escapeHtml(item.explain || "")}</textarea></label>
    </div>
  `;
}

function restorePreviewPosition(box, focusIndex, pageY) {
  const list = box.querySelector(".pdf-preview-list");
  if (!list) return;
  const items = list.querySelectorAll(".pdf-item");
  if (!items.length) return;
  const idx = Math.max(0, Math.min(Number(focusIndex) || 0, items.length - 1));
  const target = items[idx];
  if (!target) return;
  list.scrollTop += target.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
  target.classList.add("pdf-item-focus");
  if (Number.isFinite(pageY)) window.scrollTo(0, pageY);
}

function showQuestionPreview(id, questions, bannerMessage, ok, options = {}) {
  const banner = document.getElementById("pdf-banner");
  const box = document.getElementById("pdf-preview");
  const marks = ["①", "②", "③", "④", "⑤"];
  window._pdfDraft = questions || [];
  if (!options.keepEditing) window._pdfEditing = new Set();
  const editing = ensurePreviewEditing();
  if (!window._pdfDraft.length) {
    setBanner(banner, bannerMessage || previewBannerFor([]).message, false);
    box.innerHTML = `<div class="empty" style="padding:18px 0"><p>등록할 미리보기 문항이 없습니다.</p></div>`;
    if (Number.isFinite(options.pageY)) window.scrollTo(0, options.pageY);
    return;
  }
  setBanner(banner, bannerMessage, ok);

  function bindPreviewItem(article, index) {
    article.querySelector("[data-preview-edit]")?.addEventListener("click", () => {
      window._pdfDraft = readPreviewEdits(window._pdfDraft);
      ensurePreviewEditing().add(index);
      refreshItem(index);
    });
    article.querySelector("[data-preview-done]")?.addEventListener("click", () => {
      writePreviewItemLive(index);
      ensurePreviewEditing().delete(index);
      refreshItem(index);
    });
    article.querySelector("[data-preview-del]")?.addEventListener("click", () => {
      if (!confirm(`${window._pdfDraft[index]?.no || index + 1}번 문항을 미리보기에서 삭제할까요?`)) return;
      const pageY = window.scrollY;
      const next = readPreviewEdits(window._pdfDraft);
      next.splice(index, 1);
      const kept = new Set();
      ensurePreviewEditing().forEach((i) => {
        if (i === index) return;
        kept.add(i > index ? i - 1 : i);
      });
      window._pdfEditing = kept;
      const status = previewBannerFor(next);
      showQuestionPreview(id, next, status.message, status.ok, {
        focusIndex: Math.min(index, Math.max(0, next.length - 1)),
        pageY,
        keepEditing: true,
      });
    });
    article.querySelector("[data-pdf-type]")?.addEventListener("change", () => {
      const prev = window._pdfDraft[index] || {};
      const savedChoices = prev.choices;
      const savedAnswer = prev.answer;
      writePreviewItemLive(index);
      const item = window._pdfDraft[index];
      if (isShortQuestion(item)) {
        item._mcqChoices = savedChoices;
        item._mcqAnswer = savedAnswer;
      } else if (!(item.choices && item.choices.length >= 2)) {
        item.choices = prev._mcqChoices && prev._mcqChoices.length >= 2 ? prev._mcqChoices : ["", "", "", ""];
        item.answer = prev._mcqAnswer != null ? prev._mcqAnswer : 0;
      }
      refreshItem(index);
    });
    article.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el.hasAttribute("data-pdf-type")) return;
      el.addEventListener("input", () => writePreviewItemLive(index));
      el.addEventListener("change", () => writePreviewItemLive(index));
    });
  }

  function refreshItem(index) {
    const item = window._pdfDraft[index];
    const article = box.querySelector(`[data-preview-idx="${index}"]`);
    if (!item || !article) return;
    const on = ensurePreviewEditing().has(index);
    article.className = `pdf-item ${item.answerMatched ? "matched" : "unmatched"} ${on ? "editing" : ""}`;
    article.innerHTML = on ? previewItemEditHtml(item, index, marks) : previewItemViewHtml(item, index, marks);
    bindPreviewItem(article, index);
  }

  box.innerHTML = `
    <div class="pdf-preview-list">
      ${window._pdfDraft
        .map((item, index) => {
          const on = editing.has(index);
          return `
        <article class="pdf-item ${item.answerMatched ? "matched" : "unmatched"} ${on ? "editing" : ""}" data-preview-idx="${index}">
          ${on ? previewItemEditHtml(item, index, marks) : previewItemViewHtml(item, index, marks)}
        </article>`;
        })
        .join("")}
    </div>
    <button class="btn btn-primary" id="pdf-commit" type="button" style="margin-top:12px">이 문항 등록</button>
  `;
  box.querySelectorAll("[data-preview-idx]").forEach((article) => bindPreviewItem(article, Number(article.dataset.previewIdx)));
  if (Number.isFinite(options.focusIndex) && options.focusIndex >= 0) {
    requestAnimationFrame(() => restorePreviewPosition(box, options.focusIndex, options.pageY));
  }
  document.getElementById("pdf-commit")?.addEventListener("click", async () => {
    const packed = readPreviewEdits(window._pdfDraft);
    if (!packed.length) {
      alert("등록할 문항이 없습니다.");
      return;
    }
    const missing = packed.filter((item) => {
      if (isShortQuestion(item) && !String(item.answer || "").trim()) return true;
      return !item.answerMatched;
    }).length;
    if (missing && !confirm(`정답을 확인하지 않은 문항이 ${missing}개입니다. 그대로 등록할까요?`)) return;
    try {
      await Api.bulkQuestions(id, packed);
      window._pdfDraft = null;
      window._pdfEditing = new Set();
      alert("문항을 등록했습니다.");
      renderAdminExam(id);
    } catch (err) {
      alert(err.message);
    }
  });
}

async function applyAnswerFile(id) {
  const file = document.getElementById("answer-file")?.files && document.getElementById("answer-file").files[0];
  const banner = document.getElementById("pdf-banner");
  if (!file) return null;
  if (!window._pdfDraft || !window._pdfDraft.length) {
    setBanner(banner, "문항 파일을 먼저 올려 주세요.", false);
    return null;
  }
  window._pdfDraft = readPreviewEdits(window._pdfDraft);
  const kind = importKind(file);
  if (kind.isOldDoc) {
    setBanner(banner, "옛 .doc 파일은 지원하지 않습니다. Word에서 .docx로 저장해 주세요.", false);
    return null;
  }
  if (!kind.isDocx && !kind.isPdf && !kind.isText) {
    setBanner(banner, "정답 파일은 PDF, Word(.docx), 텍스트(.txt)만 올릴 수 있습니다.", false);
    return null;
  }
  setBanner(banner, "정답 파일을 문항 번호와 맞추는 중입니다...", true);
  const dataUrl = await readFileAsDataUrl(file);
  const result = await Api.importAnswers(id, dataUrl, file.name, window._pdfDraft);
  const status = previewBannerFor(result.questions);
  showQuestionPreview(id, result.questions, status.message, status.ok);
  return result;
}

async function applyExplainFile(id) {
  const file = document.getElementById("explain-file")?.files && document.getElementById("explain-file").files[0];
  const banner = document.getElementById("pdf-banner");
  if (!file) return null;
  if (!window._pdfDraft || !window._pdfDraft.length) {
    setBanner(banner, "문항 파일을 먼저 올려 주세요.", false);
    return null;
  }
  window._pdfDraft = readPreviewEdits(window._pdfDraft);
  const kind = importKind(file);
  if (kind.isOldDoc) {
    setBanner(banner, "옛 .doc 파일은 지원하지 않습니다. Word에서 .docx로 저장해 주세요.", false);
    return null;
  }
  if (!kind.isDocx && !kind.isPdf && !kind.isText) {
    setBanner(banner, "해설 파일은 PDF, Word(.docx), 텍스트(.txt)만 올릴 수 있습니다.", false);
    return null;
  }
  setBanner(banner, "해설 파일을 문항 번호와 맞추는 중입니다...", true);
  const dataUrl = await readFileAsDataUrl(file);
  const result = await Api.importExplains(id, dataUrl, file.name, window._pdfDraft);
  const status = previewBannerFor(result.questions);
  showQuestionPreview(id, result.questions, status.message, status.ok);
  return result;
}

async function runImportFiles(id) {
  const qFile = document.getElementById("import-file")?.files && document.getElementById("import-file").files[0];
  const banner = document.getElementById("pdf-banner");
  const box = document.getElementById("pdf-preview");
  if (!qFile) {
    setBanner(banner, "문항 파일을 선택해 주세요.", false);
    return;
  }
  const kind = importKind(qFile);
  if (kind.isOldDoc) {
    setBanner(banner, "옛 .doc 파일은 지원하지 않습니다. Word에서 .docx로 저장해 주세요.", false);
    return;
  }
  if (!kind.isDocx && !kind.isPdf) {
    setBanner(banner, "문항 파일은 PDF 또는 Word(.docx)만 올릴 수 있습니다.", false);
    return;
  }
  setBanner(banner, kind.isDocx ? "Word 문항을 읽는 중입니다..." : "PDF 문항을 읽는 중입니다...", true);
  try {
    const result = kind.isDocx
      ? await importDocxSmart(id, qFile, (msg) => setBanner(banner, msg, true))
      : await Api.importPdfFile(id, qFile);
    window._pdfDraft = result.questions;
    const answerInput = document.getElementById("answer-file");
    const explainInput = document.getElementById("explain-file");
    if (answerInput && answerInput.files && answerInput.files[0]) {
      await applyAnswerFile(id);
    }
    if (explainInput && explainInput.files && explainInput.files[0]) {
      await applyExplainFile(id);
      return;
    }
    if (answerInput && answerInput.files && answerInput.files[0]) return;
    const status = previewBannerFor(result.questions);
    showQuestionPreview(id, result.questions, status.message, status.ok);
  } catch (err) {
    setBanner(banner, err.message, false);
    if (box) box.innerHTML = "";
  }
}

async function renderAdminExams() {
  let exams = [];
  let error = "";
  try {
    exams = await Api.adminExams();
  } catch (err) {
    error = err.message;
  }
  document.getElementById("app").innerHTML = adminLayout(
    "admin-exams",
    `
      <section class="page-head">
        <h1>시험 관리</h1>
        <p>시험을 만들고, 등록된 시험을 수정하거나 삭제할 수 있습니다.</p>
      </section>
      ${error ? `<p class="form-banner err">${escapeHtml(error)}</p>` : ""}
      <section class="card page-card" style="padding:20px 24px 24px">
        <h2 style="font-size:15px;margin-bottom:12px">새 시험 만들기</h2>
        <form id="create-exam" class="admin-form">
          <div class="field"><label>시험 제목</label><input name="title" required placeholder="예: 3회차 모의고사" /></div>
          <div class="field"><label>설명</label><input name="desc" placeholder="응시자에게 보이는 안내" /></div>
          <div class="field">
            <label>급수</label>
            ${examGradeSelectHtml("category", EXAM_GRADES[0])}
          </div>
          <div class="admin-grid">
            <div class="field"><label>제한 시간(분)</label><input name="minutes" type="number" min="1" value="40" /></div>
            <div class="field"><label>시험 비밀번호</label><input name="password" placeholder="없으면 비워 두세요" /></div>
          </div>
          <button class="btn btn-primary" type="submit">시험 추가</button>
        </form>
      </section>
      <section class="card exam-card" style="margin-top:16px">
        <div class="exam-head"><h2>등록된 시험</h2><span class="exam-count">${exams.length}개</span></div>
        ${exams
          .map(
            (exam) => `
          <div class="exam-item">
            <div class="exam-main">
              <div class="exam-title-row">
                <h3>${escapeHtml(exam.title)}</h3>
                <span class="badge ${examGradeClass(exam.category)}">${escapeHtml(examGradeShort(exam.category))}</span>
                ${exam.hasPassword ? `<span class="badge lock">비밀번호</span>` : ""}
              </div>
              <div class="exam-grade ${examGradeClass(exam.category)}">
                <span class="exam-grade-label">급수</span>
                <strong>${escapeHtml(examGradeLabel(exam.category))}</strong>
              </div>
              <p class="exam-desc">${escapeHtml(exam.desc || "설명 없음")}</p>
              <div class="exam-meta">
                <span class="meta-q">문제 ${exam.questionCount}개</span>
                <span class="meta-t">${exam.minutes}분</span>
                <span class="meta-tag">#${escapeHtml(exam.tag)}</span>
              </div>
            </div>
            <div class="exam-actions">
              <a class="btn btn-ghost" href="#/admin/exam/${exam.id}">수정</a>
              <button class="btn btn-ghost danger-text" type="button" data-del-exam="${escapeHtml(exam.id)}" data-del-title="${escapeHtml(exam.title)}">삭제</button>
            </div>
          </div>
        `
          )
          .join("")}
      </section>
    `
  );
  bindChrome();
  bindGradeFields(document.getElementById("create-exam"));
  document.getElementById("create-exam")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await Api.createExam({
        title: formField(form, "title"),
        desc: formField(form, "desc"),
        minutes: formField(form, "minutes"),
        password: formField(form, "password"),
        tag: "시험",
        category: formField(form, "category"),
      });
      renderAdminExams();
    } catch (err) {
      alert(err.message);
    }
  });
  document.querySelectorAll("[data-del-exam]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`‘${btn.dataset.delTitle}’ 시험을 삭제할까요? 문항도 함께 삭제됩니다.`)) return;
      try {
        await Api.deleteExam(btn.dataset.delExam);
        renderAdminExams();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderAdminExam(id, options = {}) {
  let pack;
  try {
    pack = await Api.examQuestions(id);
  } catch (err) {
    document.getElementById("app").innerHTML = adminLayout(
      "admin-exams",
      `<p class="form-banner err">${escapeHtml(err.message)}</p><a class="back" href="#/admin">← 시험 관리</a>`
    );
    bindChrome();
    return;
  }
  const exam = pack.exam;
  document.getElementById("app").innerHTML = adminLayout(
    "admin-exams",
    `
      <a class="back" href="#/admin">← 시험 관리</a>
      <section class="page-head" style="margin-top:10px">
        <h1>${escapeHtml(exam.title)}</h1>
        <p>${pack.usingBank ? "아직 직접 넣은 문항이 없어 기본 문제은행으로 출제됩니다." : `등록된 문항 ${pack.questions.length}개`}</p>
      </section>
      <section class="card page-card" style="padding:20px 24px 24px;margin-bottom:16px">
        <h2 style="font-size:15px;margin-bottom:12px">시험 정보 · 비밀번호</h2>
        <form id="exam-meta" class="admin-form">
          <div class="field"><label>제목</label><input name="title" value="${escapeHtml(exam.title)}" required /></div>
          <div class="field"><label>설명</label><input name="desc" value="${escapeHtml(exam.desc || "")}" /></div>
          <div class="field">
            <label>급수</label>
            ${examGradeSelectHtml("category", exam.category)}
          </div>
          <div class="admin-grid">
            <div class="field"><label>제한 시간(분)</label><input name="minutes" type="number" min="1" value="${exam.minutes}" /></div>
            <div class="field">
              <label>시험 비밀번호 ${exam.hasPassword ? "(설정됨)" : "(없음)"}</label>
              <input name="password" placeholder="${exam.hasPassword ? "새 비밀번호 입력, 비우면 유지" : "없으면 비워 두세요"}" />
            </div>
          </div>
          <div class="admin-grid">
            <div class="field"><label>태그</label><input name="tag" value="${escapeHtml(exam.tag || "")}" /></div>
          </div>
          <label class="check-row"><input type="checkbox" name="clearPassword" /> 비밀번호 제거</label>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:12px">
            <button class="btn btn-primary" type="submit">저장</button>
            <button class="btn btn-ghost danger-text" id="del-exam" type="button">시험 삭제</button>
            <span id="meta-banner"></span>
          </div>
        </form>
      </section>
      <section class="card page-card" style="padding:20px 24px 24px;margin-bottom:16px">
        <h2 style="font-size:15px;margin-bottom:8px">파일로 문항·정답·해설 넣기</h2>
        <p class="exam-desc" style="margin-bottom:12px">문항, 정답, 해설 파일을 각각 고른 뒤 <strong>문항·정답·해설 읽기</strong>를 누르면 번호끼리 맞춥니다. 해설은 시험 중에는 보이지 않고, 틀린 문항만 오답 노트에 나옵니다.</p>
        <p class="exam-desc" style="margin-bottom:12px">정답 예: <code>1. ③</code>, <code>1번 3</code>, <code>1,3</code>. 해설 예: <code>1. 역할 지정은 전문가 관점으로 답하게 하는 기법입니다.</code> 또는 <code>1번</code> 다음 줄에 해설 본문.</p>
        <div class="admin-grid admin-grid-3">
          <div class="field">
            <label>문항 파일 (PDF, DOCX)</label>
            <input id="import-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </div>
          <div class="field">
            <label>정답 파일 (PDF, DOCX, TXT)</label>
            <input id="answer-file" type="file" accept=".pdf,.docx,.txt,.csv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </div>
          <div class="field">
            <label>해설 파일 (PDF, DOCX, TXT)</label>
            <input id="explain-file" type="file" accept=".pdf,.docx,.txt,.csv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;margin-top:4px">
          <button class="btn btn-primary" id="import-read" type="button">문항·정답·해설 읽기</button>
        </div>
        <p class="form-banner" id="pdf-banner"></p>
        <div id="pdf-preview"></div>
      </section>
      <section class="card page-card" style="padding:20px 24px 24px;margin-bottom:16px">
        <h2 style="font-size:15px;margin-bottom:12px">문항 추가</h2>
        <form id="add-q" class="admin-form">
          <div class="field">
            <label>문항 유형</label>
            <select id="q-type" name="type">
              <option value="mcq">객관식</option>
              <option value="short">주관식 (단답형)</option>
            </select>
          </div>
          <div class="field"><label>문제</label><textarea name="q" rows="3" required></textarea></div>
          <div class="q-mcq">
            <div class="field"><label>보기 1</label><input name="c1" required /></div>
            <div class="field"><label>보기 2</label><input name="c2" required /></div>
            <div class="field"><label>보기 3</label><input name="c3" required /></div>
            <div class="field"><label>보기 4</label><input name="c4" required /></div>
            <div class="field"><label>보기 5 (선택)</label><input name="c5" /></div>
            <div class="field">
              <label>정답 (여러 개 선택 가능)</label>
              <div class="answer-checks">
                <label class="check-row"><input type="checkbox" data-mcq-answer value="0" /> 1번</label>
                <label class="check-row"><input type="checkbox" data-mcq-answer value="1" /> 2번</label>
                <label class="check-row"><input type="checkbox" data-mcq-answer value="2" /> 3번</label>
                <label class="check-row"><input type="checkbox" data-mcq-answer value="3" /> 4번</label>
                <label class="check-row"><input type="checkbox" data-mcq-answer value="4" /> 5번</label>
              </div>
              <p class="exam-desc">정답을 2개 이상 고르면 응시자도 복수로 선택합니다. 모두 맞혀야 정답입니다.</p>
            </div>
          </div>
          <div class="q-short" hidden>
            <div class="field"><label>주관식 정답</label><input id="short-answer-key" name="answerText" placeholder="예: 프롬프트, 지시문" /></div>
            <p class="exam-desc">응시자는 답을 하나만 입력합니다. 정답지에 여러 형태를 쉼표(,)로 적어 두면, 그중 하나와 같으면 정답입니다. 띄어쓰기는 채점에서 무시됩니다.</p>
          </div>
          <div class="field"><label>해설</label><input name="explain" placeholder="채점 후 보여줄 설명" /></div>
          <div class="field">
            <label>문항 이미지</label>
            ${questionImageEditorHtml([])}
          </div>
          <button class="btn btn-primary" type="submit">문제 추가</button>
        </form>
      </section>
      <section class="card page-card">
        ${
          pack.questions.length
            ? pack.questions
                .map((item, index) =>
                  options.editIndex === index
                    ? registeredQuestionEditHtml(item, index)
                    : `
            <div class="review-item" data-q-index="${index}">
              <div class="pdf-item-head">
                <span class="q-no">${index + 1}번</span>
                ${isShortQuestion(item) ? `<span class="badge">주관식</span>` : `<span class="badge">${isMultiMcq(item) ? "객관식 · 복수" : "객관식"}</span>`}
                <button class="btn btn-ghost pdf-del" data-open-q="${index}" type="button">수정</button>
                <button class="btn btn-danger pdf-del" data-del-q="${index}" type="button">삭제</button>
              </div>
              <h3 style="font-size:15px">${escapeHtml(item.q)}</h3>
              ${questionImagesHtml(item.images)}
              <p class="exam-desc">${
                isShortQuestion(item)
                  ? `정답 ${escapeHtml(String(item.answer || ""))}`
                  : `정답 ${escapeHtml(formatMcqAnswerText(item))}${isMultiMcq(item) ? " · 복수" : ""}`
              }</p>
              ${item.explain ? `<div class="note-explain"><strong>해설</strong><p>${escapeHtml(item.explain)}</p></div>` : ""}
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>직접 추가한 문항이 없습니다.</p><h3>문제를 추가하면 이 시험은 기본 문제은행 대신 등록한 문항으로 출제됩니다.</h3></div>`
        }
      </section>
    `
  );
  bindChrome();
  bindGradeFields(document.getElementById("exam-meta"));
  document.getElementById("exam-meta").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const banner = document.getElementById("meta-banner");
    const body = {
      title: formField(form, "title"),
      desc: formField(form, "desc"),
      minutes: formField(form, "minutes"),
      category: formField(form, "category"),
      tag: formField(form, "tag"),
    };
    if (formChecked(form, "clearPassword")) body.password = "";
    else if (formField(form, "password")) body.password = formField(form, "password");
    try {
      await Api.updateExam(id, body);
      setBanner(banner, "저장했습니다.", true);
      renderAdminExam(id);
    } catch (err) {
      setBanner(banner, err.message, false);
    }
  });
  document.getElementById("del-exam")?.addEventListener("click", async () => {
    if (!confirm(`‘${exam.title}’ 시험을 삭제할까요? 문항도 함께 삭제됩니다.`)) return;
    try {
      await Api.deleteExam(id);
      location.hash = "#/admin";
      renderAdminExams();
    } catch (err) {
      alert(err.message);
    }
  });
  document.getElementById("import-file")?.addEventListener("change", () => {
    if (document.getElementById("import-file").files[0]) runImportFiles(id);
  });
  document.getElementById("answer-file")?.addEventListener("change", () => {
    if (window._pdfDraft && window._pdfDraft.length) applyAnswerFile(id);
    else if (document.getElementById("import-file").files[0]) runImportFiles(id);
  });
  document.getElementById("explain-file")?.addEventListener("change", () => {
    if (window._pdfDraft && window._pdfDraft.length) applyExplainFile(id);
    else if (document.getElementById("import-file").files[0]) runImportFiles(id);
  });
  document.getElementById("import-read")?.addEventListener("click", () => runImportFiles(id));
  const syncQType = () => {
    const short = document.getElementById("q-type")?.value === "short";
    document.querySelectorAll(".q-mcq").forEach((el) => {
      el.hidden = short;
    });
    document.querySelectorAll(".q-short").forEach((el) => {
      el.hidden = !short;
    });
    document.querySelectorAll(".q-mcq input[name='c1'], .q-mcq input[name='c2'], .q-mcq input[name='c3'], .q-mcq input[name='c4']").forEach((el) => {
      el.required = !short;
    });
    const key = document.getElementById("short-answer-key");
    if (key) key.required = short;
  };
  document.getElementById("q-type")?.addEventListener("change", syncQType);
  syncQType();
  const addForm = document.getElementById("add-q");
  let addImages = [];
  bindQuestionImages(addForm, addImages, (next) => {
    addImages = next;
  });
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const type = document.getElementById("q-type").value;
    try {
      if (type === "short") {
        await Api.addQuestion(id, {
          q: form.q.value,
          type: "short",
          answerText: form.answerText.value,
          explain: form.explain.value,
          images: addImages,
        });
      } else {
        await Api.addQuestion(id, {
          q: form.q.value,
          type: "mcq",
          choices: [form.c1.value, form.c2.value, form.c3.value, form.c4.value, form.c5.value].filter(Boolean),
          answer: [...form.querySelectorAll("[data-mcq-answer]:checked")].map((el) => Number(el.value)),
          explain: form.explain.value,
          images: addImages,
        });
      }
      renderAdminExam(id);
    } catch (err) {
      alert(err.message);
    }
  });
  document.querySelectorAll("[data-open-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.openQ);
      renderAdminExam(id, { editIndex: index });
    });
  });
  const editor = document.querySelector("[data-q-editor]");
  if (editor) {
    const index = Number(editor.dataset.qIndex);
    let images = ((pack.questions[index] && pack.questions[index].images) || []).slice();
    bindQuestionImages(editor, images, (next) => {
      images = next;
    });
    editor.querySelector("[data-edit-type]")?.addEventListener("change", (e) => {
      const short = e.currentTarget.value === "short";
      const shortBox = editor.querySelector("[data-edit-short]");
      const mcqBox = editor.querySelector("[data-edit-mcq]");
      if (shortBox) shortBox.hidden = !short;
      if (mcqBox) mcqBox.hidden = short;
    });
    editor.querySelector("[data-save-q]")?.addEventListener("click", async () => {
      const type = editor.querySelector("[data-edit-type]").value;
      const body = {
        q: editor.querySelector("[data-edit-stem]").value,
        type,
        explain: editor.querySelector("[data-edit-explain]").value,
        images,
      };
      if (type === "short") {
        body.answerText = editor.querySelector("[data-edit-answer-text]").value;
      } else {
        body.choices = [...editor.querySelectorAll("[data-edit-choice]")].map((el) => el.value.trim()).filter(Boolean);
        body.answer = [...editor.querySelectorAll("[data-edit-answer]:checked")].map((el) => Number(el.value));
      }
      try {
        await Api.updateQuestion(id, index, body);
        await renderAdminExam(id);
        document.querySelector(`[data-q-index="${index}"]`)?.scrollIntoView({ block: "start" });
      } catch (err) {
        alert(err.message);
      }
    });
    editor.querySelector("[data-cancel-q]")?.addEventListener("click", () => renderAdminExam(id));
    editor.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  document.querySelectorAll("[data-del-q]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.delQ);
      if (!confirm("이 문항을 삭제할까요?")) return;
      try {
        await Api.deleteQuestion(id, index);
        await renderAdminExam(id);
        const items = document.querySelectorAll(".review-item");
        const target = items[Math.min(index, Math.max(0, items.length - 1))];
        target?.scrollIntoView({ block: "start", behavior: "auto" });
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderAdminSettings() {
  let settings = { entryCode: "", adminId: "oncodlab" };
  try {
    settings = await Api.adminSettings();
  } catch (err) {
    document.getElementById("app").innerHTML = adminLayout(
      "admin-settings",
      `<p class="form-banner err">${escapeHtml(err.message)}</p>`
    );
    bindChrome();
    return;
  }
  document.getElementById("app").innerHTML = adminLayout(
    "admin-settings",
    `
      <section class="page-head">
        <h1>입장코드 · 비밀번호</h1>
        <p>학습자 입장코드와 관리자 비밀번호를 여기서 바꾸고 저장합니다.</p>
      </section>
      <section class="card page-card" style="padding:20px 24px 24px">
        <form id="settings-form" class="admin-form">
          <div class="field"><label>현재 관리자 아이디</label><input value="${escapeHtml(settings.adminId)}" disabled /></div>
          <div class="field"><label>입장코드</label><input name="entryCode" value="${escapeHtml(settings.entryCode)}" required /></div>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:12px">
            <button class="btn btn-primary" type="submit">입장코드 저장</button>
            <span id="settings-banner"></span>
          </div>
        </form>
      </section>
      <section class="card page-card" style="padding:20px 24px 24px;margin-top:16px">
        <h2 style="font-size:15px;margin-bottom:8px">관리자 비밀번호</h2>
        <p class="exam-desc" style="margin-bottom:12px">바꾼 비밀번호는 서버에 저장되며, 다음 로그인부터 새 비밀번호로 입장합니다.</p>
        <form id="password-form" class="admin-form" autocomplete="off">
          <div class="field"><label>새 비밀번호</label><input id="new-admin-pw" name="newAdminPassword" type="password" autocomplete="new-password" minlength="4" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input id="new-admin-pw2" name="newAdminPassword2" type="password" autocomplete="new-password" minlength="4" required /></div>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:12px">
            <button class="btn btn-primary" type="submit">비밀번호 저장</button>
            <span id="password-banner"></span>
          </div>
        </form>
      </section>
    `
  );
  bindChrome();
  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const banner = document.getElementById("settings-banner");
    try {
      await Api.saveSettings({
        entryCode: form.entryCode.value.trim(),
      });
      setBanner(banner, "입장코드를 저장했습니다.", true);
    } catch (err) {
      setBanner(banner, err.message, false);
    }
  });
  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const banner = document.getElementById("password-banner");
    const nextPassword = document.getElementById("new-admin-pw").value.trim();
    const confirmPassword = document.getElementById("new-admin-pw2").value.trim();
    if (nextPassword.length < 4) {
      setBanner(banner, "비밀번호는 4자 이상이어야 합니다.", false);
      return;
    }
    if (nextPassword !== confirmPassword) {
      setBanner(banner, "비밀번호 확인이 일치하지 않습니다.", false);
      return;
    }
    try {
      const result = await Api.saveSettings({
        adminPassword: nextPassword,
        adminPasswordConfirm: confirmPassword,
      });
      document.getElementById("new-admin-pw").value = "";
      document.getElementById("new-admin-pw2").value = "";
      setBanner(banner, result.passwordChanged ? "비밀번호를 저장했습니다. 다음 로그인부터 이 비밀번호를 사용하세요." : "저장하지 못했습니다.", result.passwordChanged);
    } catch (err) {
      setBanner(banner, err.message, false);
    }
  });
}

async function renderAdminNotices() {
  let notices = [];
  let error = "";
  try {
    notices = await Api.adminNotices();
  } catch (err) {
    error = err.message;
  }
  document.getElementById("app").innerHTML = adminLayout(
    "admin-notices",
    `
      <section class="page-head">
        <h1>공지사항 관리</h1>
        <p>학습자 화면에 보이는 공지를 등록하고 수정하거나 삭제할 수 있습니다.</p>
      </section>
      ${error ? `<p class="form-banner err">${escapeHtml(error)}</p>` : ""}
      <section class="card page-card" style="padding:20px 24px 24px">
        <h2 style="font-size:15px;margin-bottom:12px" id="notice-form-title">새 공지 등록</h2>
        <form id="notice-form" class="admin-form">
          <input type="hidden" name="noticeId" value="" />
          <div class="field"><label>제목</label><input name="noticeTitle" required placeholder="예: 모의고사 3회차가 공개되었습니다." /></div>
          <div class="field">
            <label>내용</label>
            <div class="notice-editor">
              <div class="notice-toolbar">
                <button type="button" data-notice-cmd="bold" title="굵게"><b>가</b></button>
                <button type="button" data-notice-cmd="justifyLeft" title="왼쪽 정렬">왼쪽</button>
                <button type="button" data-notice-cmd="justifyCenter" title="가운데 정렬">가운데</button>
                <button type="button" data-notice-cmd="justifyRight" title="오른쪽 정렬">오른쪽</button>
              </div>
              <div class="notice-compose" contenteditable="true" data-notice-compose data-placeholder="학습자에게 보여줄 내용을 입력하세요. Enter로 줄을 바꾸고, 굵게·정렬 단추를 사용할 수 있습니다."></div>
            </div>
          </div>
          <label class="check-row"><input type="checkbox" name="noticePinned" /> 상단 고정</label>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:12px">
            <button class="btn btn-primary" type="submit" id="notice-submit">공지 등록</button>
            <button class="btn btn-ghost" type="button" id="notice-cancel" hidden>취소</button>
            <span id="notice-banner"></span>
          </div>
        </form>
      </section>
      <section class="card page-card" style="margin-top:16px">
        ${
          notices.length
            ? notices
                .map(
                  (item) => `
            <div class="list-row">
              <div>
                <h3>${item.pinned ? `<span class="pin">고정</span> ` : ""}${escapeHtml(item.title)}</h3>
                <p>${noticeExcerpt(item.body)}</p>
                <p>${escapeHtml(item.date || "")}</p>
              </div>
              <div class="aside member-actions">
                <button class="link-more" type="button" data-edit-notice="${escapeHtml(item.id)}">수정</button>
                <button class="link-more" type="button" data-del-notice="${escapeHtml(item.id)}">삭제</button>
              </div>
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>등록된 공지가 없습니다.</p><h3>위에서 공지를 등록하면 학습자 화면에 표시됩니다.</h3></div>`
        }
      </section>
    `
  );
  bindChrome();
  const form = document.getElementById("notice-form");
  const cancel = document.getElementById("notice-cancel");
  const submit = document.getElementById("notice-submit");
  const titleEl = document.getElementById("notice-form-title");
  const banner = document.getElementById("notice-banner");
  const compose = form.querySelector("[data-notice-compose]");
  const readNoticeBody = () => (window.NoticeFormat ? NoticeFormat.sanitizeNoticeHtml(compose.innerHTML) : compose.innerText);
  const setNoticeBody = (html) => {
    compose.innerHTML = window.NoticeFormat ? NoticeFormat.noticeToEditorHtml(html) : escapeHtml(html || "").replace(/\n/g, "<br>");
  };
  const resetForm = () => {
    form.reset();
    form.noticeId.value = "";
    setNoticeBody("");
    submit.textContent = "공지 등록";
    titleEl.textContent = "새 공지 등록";
    cancel.hidden = true;
  };
  form.querySelectorAll("[data-notice-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      compose.focus();
      document.execCommand(btn.dataset.noticeCmd, false, null);
    });
  });
  compose.addEventListener("focus", () => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (err) {
      /* ignore */
    }
  });
  compose.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const insert = window.NoticeFormat
      ? NoticeFormat.sanitizeNoticeHtml(html || text)
      : escapeHtml(text).replace(/\n/g, "<br>");
    document.execCommand("insertHTML", false, insert || escapeHtml(text).replace(/\n/g, "<br>"));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      title: form.noticeTitle.value.trim(),
      body: readNoticeBody(),
      pinned: form.noticePinned.checked,
    };
    if (!body.title || !(window.NoticeFormat ? NoticeFormat.noticePlainText(body.body) : body.body.trim())) {
      setBanner(banner, "제목과 내용을 입력해 주세요.", false);
      return;
    }
    try {
      if (form.noticeId.value) await Api.updateNotice(form.noticeId.value, body);
      else await Api.createNotice(body);
      renderAdminNotices();
    } catch (err) {
      setBanner(banner, err.message, false);
    }
  });
  cancel.addEventListener("click", resetForm);
  document.querySelectorAll("[data-edit-notice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = notices.find((notice) => notice.id === btn.dataset.editNotice);
      if (!item) return;
      form.noticeId.value = item.id;
      form.noticeTitle.value = item.title;
      setNoticeBody(item.body);
      form.noticePinned.checked = Boolean(item.pinned);
      submit.textContent = "공지 저장";
      titleEl.textContent = "공지 수정";
      cancel.hidden = false;
      form.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-del-notice]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 공지를 삭제할까요?")) return;
      try {
        await Api.deleteNotice(btn.dataset.delNotice);
        renderAdminNotices();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderAdminAttempts() {
  let attempts = [];
  try {
    attempts = await Api.adminAttempts();
  } catch (err) {
    document.getElementById("app").innerHTML = adminLayout(
      "admin-attempts",
      `<p class="form-banner err">${escapeHtml(err.message)}</p>`
    );
    bindChrome();
    return;
  }
  document.getElementById("app").innerHTML = adminLayout(
    "admin-attempts",
    `
      <section class="page-head">
        <h1>응시 현황</h1>
        <p>학습자들이 제출한 시험 결과입니다. 삭제하면 응시 기록에서 사라집니다.</p>
      </section>
      <section class="card page-card">
        ${
          attempts.length
            ? attempts
                .map(
                  (item) => `
            <div class="list-row">
              <div>
                <h3>${escapeHtml(item.userName)} · ${escapeHtml(item.title)}</h3>
                <p>${item.correct}/${item.total}문항 정답 · ${formatDate(item.at)}</p>
              </div>
              <div class="aside member-actions">
                <strong class="attempt-score">${item.percent}점</strong>
                ${
                  item.id
                    ? `<button class="link-more" type="button" data-del-attempt="${escapeHtml(item.id)}" data-del-label="${escapeHtml(item.userName)} · ${escapeHtml(item.title)}">삭제</button>`
                    : ""
                }
              </div>
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>아직 제출된 응시 기록이 없습니다.</p></div>`
        }
      </section>
    `
  );
  bindChrome();
  document.querySelectorAll("[data-del-attempt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`‘${btn.dataset.delLabel}’ 시험 결과를 삭제할까요?`)) return;
      try {
        await Api.deleteAttempt(btn.dataset.delAttempt);
        renderAdminAttempts();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderAdminUsers() {
  let payload = { mongo: false, users: [] };
  let error = "";
  try {
    payload = await Api.adminUsers();
  } catch (err) {
    error = err.message;
  }
  const users = payload.users || [];
  document.getElementById("app").innerHTML = adminLayout(
    "admin-users",
    `
      <section class="page-head">
        <h1>회원 관리</h1>
        <p>학습자가 이름·비밀번호·입장코드로 들어오면 회원으로 저장됩니다. 정지, 비밀번호 변경, 삭제를 할 수 있습니다.</p>
      </section>
      ${
        error
          ? `<p class="form-banner err">${escapeHtml(error)}</p>`
          : `<p class="form-banner ok">등록 회원 ${users.length}명${payload.mongo ? " · MongoDB" : ""}</p>`
      }
      <section class="card page-card">
        ${
          users.length
            ? users
                .map(
                  (item) => `
            <div class="list-row">
              <div>
                <h3>${item.examNo ? `<span class="exam-no">${escapeHtml(item.examNo)}</span> ` : ""}<span class="member-name">${escapeHtml(item.name || "이름 없음")}</span> ${item.disabled ? '<span class="badge">정지</span>' : ""}</h3>
                <p>가입 ${formatDate(item.createdAt)} · 최근 로그인 ${item.lastLoginAt ? formatDate(item.lastLoginAt) : "없음"} · 응시 ${item.attemptCount || 0}회</p>
              </div>
              <div class="aside member-actions">
                <button class="link-more" data-toggle-user="${escapeHtml(item.id)}" data-disabled="${item.disabled ? "1" : "0"}">${item.disabled ? "정지 해제" : "정지"}</button>
                <button class="link-more" data-reset-user="${escapeHtml(item.id)}">비밀번호</button>
                <button class="link-more" data-del-user="${escapeHtml(item.id)}">삭제</button>
              </div>
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>아직 등록된 회원이 없습니다.</p><h3>학습자가 입장하면 이 목록에 나타납니다.</h3></div>`
        }
      </section>
    `
  );
  bindChrome();
  document.querySelectorAll("[data-toggle-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await Api.setUserDisabled(btn.dataset.toggleUser, btn.dataset.disabled !== "1");
        renderAdminUsers();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll("[data-reset-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const password = prompt("새 비밀번호를 입력하세요. (4자 이상)");
      if (!password) return;
      try {
        await Api.resetUserPassword(btn.dataset.resetUser, password);
        alert("비밀번호를 저장했습니다.");
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 회원과 응시 기록을 삭제할까요?")) return;
      try {
        await Api.deleteUser(btn.dataset.delUser);
        renderAdminUsers();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}
