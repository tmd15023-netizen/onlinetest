const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  notice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4"/><path d="M8 6v12"/><path d="M12 3l8 4v10l-8 4V3z"/></svg>`,
  exams: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M21.2 19c-.4-2.4-1.9-3.8-4-4.2"/></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/><path d="M15 16l4-4-4-4"/><path d="M10 12h9"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5v3h2.2L11 17V7L5.2 10.5H3z"/><path d="M14.8 8.2a4.8 4.8 0 0 1 0 7.6"/><path d="M17.2 6a7.8 7.8 0 0 1 0 12"/></svg>`,
};

const LOGO_SVG = `<img class="brand-mark" src="img/logo.png" alt="Oncodelab" />`;

const NAV = [
  { id: "dashboard", href: "#/", label: "대시보드", icon: ICONS.dashboard },
  { id: "notices", href: "#/notices", label: "공지사항", icon: ICONS.notice },
  { id: "exams", href: "#/exams", label: "시험 목록", icon: ICONS.exams },
  { id: "notes", href: "#/notes", label: "오답 노트", icon: ICONS.notes },
  { id: "history", href: "#/history", label: "응시 내역", icon: ICONS.history },
];

const CIRCLES = ["①", "②", "③", "④", "⑤"];

let state = {
  category: "all",
  noteExam: "all",
  sidebarOpen: false,
  modalExam: null,
  noticeId: null,
  examTimer: null,
  showAllQuestions: false,
  examObserver: null,
  examScroll: 0,
  jumpToIdx: null,
  examScrolling: false,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeImageSrc(src) {
  const value = String(src || "").trim();
  if (
    value.startsWith("data:image/") ||
    value.startsWith("/media/") ||
    value.startsWith("https://") ||
    value.startsWith("http://127.0.0.1") ||
    value.startsWith("http://localhost") ||
    (typeof location !== "undefined" && value.startsWith(location.origin))
  ) {
    if (value.startsWith("http://127.0.0.1") || value.startsWith("http://localhost")) {
      try {
        const parsed = new URL(value);
        if (parsed.pathname.startsWith("/media/")) return parsed.pathname.replace(/"/g, "");
      } catch (err) {
        /* keep original */
      }
    }
    return value.replace(/"/g, "");
  }
  return "";
}

function questionImagesHtml(images, extraClass = "") {
  const tags = (images || [])
    .map((src) => safeImageSrc(src))
    .filter(Boolean)
    .map((src) => `<img class="q-image" src="${src}" alt="문항 이미지" />`);
  if (!tags.length) return "";
  return `<div class="q-images ${extraClass}">${tags.join("")}</div>`;
}

function choiceBodyHtml(choice, choiceImages, idx) {
  return `<span class="cbt-choice-body"><span class="choice-text">${escapeHtml(choice || "")}</span>${questionImagesHtml(
    (choiceImages || [])[idx] || [],
    "q-images-choice"
  )}</span>`;
}

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  return { path, params };
}

function examNumber(user) {
  if (user && user.examNo) return String(user.examNo).padStart(4, "0");
  const src = String((user && (user.id || user.name)) || "1");
  let n = 0;
  for (let i = 0; i < src.length; i += 1) n = (n * 33 + src.charCodeAt(i)) % 9000;
  return String(1000 + n).padStart(4, "0");
}

function displayName(user) {
  if (!user) return "";
  if (user.nick) return `${user.name}(${user.nick})`;
  return user.name || "학습자";
}

function bestScoreFor(examId) {
  const list = window.MY_ATTEMPTS || Storage.getAttempts();
  const scores = list.filter((item) => item.examId === examId).map((item) => item.percent);
  return scores.length ? Math.max(...scores) : null;
}

function initialOf(user) {
  return (user.name || "온").slice(0, 1);
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function isLoginHostOk() {
  return location.protocol === "https:" || location.protocol === "http:";
}

function renderAuth(mode) {
  const admin = mode === "admin";
  const hostOk = isLoginHostOk();
  document.getElementById("app").innerHTML = `
    <div class="auth">
      <form class="auth-card" id="login-form" autocomplete="off">
        <div class="brand">${LOGO_SVG}<div class="brand-text"><strong>${APP.name}</strong><span>${APP.examHall}</span></div></div>
        <div class="auth-tabs">
          <button type="button" class="${admin ? "" : "active"}" data-mode="user">학습자</button>
          <button type="button" class="${admin ? "active" : ""}" data-mode="admin">관리자</button>
        </div>
        <h1>${admin ? "관리자 로그인" : "시험장 입장"}</h1>
        <p class="sub">${
          admin
            ? "관리자 아이디와 비밀번호를 입력하세요."
            : "학습자는 이름·비밀번호·입장코드를 입력하세요. 관리자는 위쪽 관리자 탭을 눌러 입장합니다."
        }</p>
        ${
          admin
            ? `
          <div class="field"><label for="admin-id">아이디</label><input id="admin-id" name="login_admin_id" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required /></div>
          <div class="field"><label for="admin-pw">비밀번호</label><input id="admin-pw" name="login_admin_pw" type="password" autocomplete="off" required /></div>
        `
            : `
          <div class="field"><label for="name">이름</label><input id="name" name="login_user_name" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required /></div>
          <div class="field"><label for="password">비밀번호</label><input id="password" name="login_user_pw" type="password" autocomplete="off" required /></div>
          <div class="field"><label for="entryCode">입장코드</label><input id="entryCode" name="login_entry_code" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required /></div>
        `
        }
        <p class="form-banner err" id="auth-error" ${hostOk ? "hidden" : ""}>${hostOk ? "" : "파일로 열면 로그인이 되지 않습니다. 웹 주소로 접속해 주세요."}</p>
        <button class="btn btn-primary" type="submit">${admin ? "관리자 입장" : "입장하기"}</button>
      </form>
    </div>
  `;
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = btn.dataset.mode === "admin" ? "#/admin-login" : "#/login";
      renderAuth(btn.dataset.mode);
    });
  });
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("auth-error");
    errorEl.hidden = true;
    try {
      const result = admin
        ? await Api.adminLogin({
            id: document.getElementById("admin-id").value.trim(),
            password: document.getElementById("admin-pw").value.trim(),
          })
        : await Api.login({
            name: document.getElementById("name").value.trim(),
            password: document.getElementById("password").value.trim(),
            entryCode: document.getElementById("entryCode").value.trim(),
          });
      Api.setSession(result.token, result.user);
      if (admin) sessionStorage.removeItem("oncodelab.view");
      location.hash = admin ? "#/admin" : "#/";
      render();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  });
}

function isLearnerView() {
  return sessionStorage.getItem("oncodelab.view") === "learner";
}

function switchToLearnerView() {
  sessionStorage.setItem("oncodelab.view", "learner");
  location.hash = "#/";
  render();
}

function switchToAdminView() {
  sessionStorage.removeItem("oncodelab.view");
  location.hash = "#/admin";
  render();
}

function viewSwitchHtml(target) {
  if (target === "learner") {
    return `<button class="view-switch" type="button" data-learner-view>학습자 화면</button>`;
  }
  return `<button class="view-switch" type="button" data-admin-view>관리자 화면</button>`;
}

function userMarkHtml(user) {
  const src = String((user && (user.id || user.examNo || user.name || user.role)) || "user");
  let seed = 0;
  for (let i = 0; i < src.length; i += 1) seed = (seed * 33 + src.charCodeAt(i)) >>> 0;
  const colors = ["#4d7dff", "#6b5cff", "#e25c5c", "#17a37a", "#f0a202", "#2f6bff", "#d44848", "#3aa0c8", "#8b5cf6", "#ef6d3b"];
  const icons = [
    `<path d="M12 3.2l2.2 5.3 5.8.5-4.4 3.7 1.4 5.6L12 15.6 6.9 18.3l1.4-5.6L4 9l5.8-.5L12 3.2z"/>`,
    `<path d="M12 4.2c.4 4.2 3.2 7.4 7.6 8.2-1.3 3.6-4.9 6.2-8.9 6.2A7.6 7.6 0 0 1 9.4 4.8 8.8 8.8 0 0 0 12 4.2z"/>`,
    `<path d="M12 4l1.7 4.8h5l-4 3 1.5 4.9L12 13.8 7.8 16.7l1.5-4.9-4-3h5L12 4z"/>`,
    `<path d="M12 3.5 19 12l-7 8.5L5 12l7-8.5z"/>`,
    `<path d="M13.2 3 6.5 13h4.2L10 21l7.4-11h-4.4L13.2 3z"/>`,
    `<path d="M12 4c3.2 2.2 5.6 5.4 5.6 8.8A5.6 5.6 0 1 1 6.4 12.8C6.4 9.4 8.8 6.2 12 4z"/>`,
    `<path d="M12 4.2 17.8 8v8L12 19.8 6.2 16V8L12 4.2z"/>`,
    `<path d="M12 5.2A6.8 6.8 0 1 1 5.2 12 6.8 6.8 0 0 1 12 5.2zm0 3.1A3.7 3.7 0 1 0 15.7 12 3.7 3.7 0 0 0 12 8.3z"/>`,
    `<path d="M12 3.5 14.2 9h5.8l-4.7 3.5 1.8 5.6L12 14.8 6.9 18.1l1.8-5.6L4 9h5.8L12 3.5z"/>`,
    `<path d="M12 3.8 18.4 7v5.4c0 4-2.7 6.6-6.4 7.8C8.3 19 5.6 16.4 5.6 12.4V7L12 3.8z"/>`,
    `<path d="M7.2 14.2a4 4 0 0 1 .4-7.4 4.6 4.6 0 0 1 8.8.8 3.6 3.6 0 0 1 .4 7.1H7.2z"/>`,
    `<path d="M12 5.2c.8 2.4 2.6 4.2 5 5-2.4.8-4.2 2.6-5 5-.8-2.4-2.6-4.2-5-5 2.4-.8 4.2-2.6 5-5z"/>`,
  ];
  const color = colors[seed % colors.length];
  const icon = icons[Math.floor(seed / colors.length) % icons.length];
  return `<span class="user-mark" style="background:${color}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">${icon}</svg></span>`;
}

function layout(active, content, options = {}) {
  const user = Storage.getUser();
  const name = displayName(user);
  const adminPreview = user && user.role === "admin";
  return `
    <div class="app-shell">
      <div class="sidebar-backdrop ${state.sidebarOpen ? "show" : ""}" data-close-menu></div>
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
        <a class="brand" href="#/">${LOGO_SVG}<div class="brand-text"><strong>${APP.name}</strong><span>${APP.examHall}</span></div></a>
        <nav class="nav">
          ${NAV.map((item) => `
            <a class="nav-item ${item.id === active ? "active" : ""}" href="${item.href}">
              ${item.icon}<span>${item.label}</span>
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-user">
          ${userMarkHtml(user)}
          <div class="user-meta"><strong>${escapeHtml(name)}</strong></div>
          ${adminPreview ? viewSwitchHtml("admin") : ""}
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
            <span class="user-chip-name">${escapeHtml(name)}</span>
            ${adminPreview ? viewSwitchHtml("admin") : ""}
            <button class="icon-btn" data-logout title="로그아웃">${ICONS.logout}</button>
          </div>
        </div>
        ${content}
      </main>
    </div>
    ${options.modal || ""}
  `;
}

function bindChrome() {
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Storage.clearSession();
      Api.clearSession();
      sessionStorage.setItem("oncodelab.loggedOut", "1");
      location.hash = "#/login";
      render();
    });
  });
  document.querySelectorAll("[data-learner-view]").forEach((btn) => {
    btn.addEventListener("click", switchToLearnerView);
  });
  document.querySelectorAll("[data-admin-view]").forEach((btn) => {
    btn.addEventListener("click", switchToAdminView);
  });
  const menu = document.querySelector("[data-menu]");
  if (menu) {
    menu.addEventListener("click", () => {
      state.sidebarOpen = !state.sidebarOpen;
      document.querySelector(".sidebar")?.classList.toggle("open", state.sidebarOpen);
      document.querySelector(".sidebar-backdrop")?.classList.toggle("show", state.sidebarOpen);
    });
  }
  document.querySelector("[data-close-menu]")?.addEventListener("click", () => {
    state.sidebarOpen = false;
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".sidebar-backdrop")?.classList.remove("show");
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.sidebarOpen = false;
    });
  });
}

function examModalHtml() {
  if (!state.modalExam) return "";
  return `
    <div class="overlay" id="exam-modal">
      <div class="modal">
        <h2>${escapeHtml(state.modalExam.title)}</h2>
        <p>${escapeHtml(state.modalExam.desc)}</p>
        <div class="modal-meta">
          <span class="pill">문제 ${state.modalExam.questionCount}개</span>
          <span class="pill">${state.modalExam.minutes}분</span>
          <span class="pill">${escapeHtml(state.modalExam.category)}</span>
          ${state.modalExam.hasPassword ? `<span class="pill">비밀번호 필요</span>` : ""}
        </div>
        ${
          state.modalExam.hasPassword
            ? `<div class="field" style="text-align:left"><label>시험 비밀번호</label><input name="examPassword" type="password" autocomplete="new-password" /></div>`
            : ""
        }
        <p class="form-banner err" id="exam-pass-error" hidden></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>취소</button>
          <button class="btn btn-primary" data-start>시험 시작</button>
        </div>
      </div>
    </div>
  `;
}

function examListHtml() {
  const list = getExamList();
  const exams = list.filter((exam) => state.category === "all" || exam.category === state.category);
  const categories = [...new Set(list.map((exam) => exam.category))];
  return `
    <div class="filters">
      <button class="chip ${state.category === "all" ? "active" : ""}" data-cat="all">전체 (${list.length})</button>
      ${categories
        .map(
          (cat) => `
        <button class="chip ${state.category === cat ? "active" : ""}" data-cat="${escapeHtml(cat)}">
          <span class="dot"></span>${escapeHtml(cat)} (${list.filter((item) => item.category === cat).length})
        </button>
      `
        )
        .join("")}
    </div>
    <section class="card exam-card">
      <div class="exam-head">
        <h2>시험 목록</h2>
        <span class="exam-count">${exams.length}개</span>
      </div>
      ${exams
        .map((exam) => {
          const best = bestScoreFor(exam.id) ?? exam.demoBest;
          return `
            <button class="exam-item" data-exam="${exam.id}">
              <div class="exam-title-row">
                <h3>${escapeHtml(exam.title)}</h3>
                <span class="badge">${escapeHtml(exam.category)}</span>
                ${exam.hasPassword ? `<span class="badge lock">잠금</span>` : ""}
              </div>
              <p class="exam-desc">${escapeHtml(exam.desc)}</p>
              <div class="exam-meta">
                <span class="meta-q">문제 ${exam.questionCount}개</span>
                <span class="meta-t">${exam.minutes}분</span>
                <span class="meta-s">${best == null ? "미응시" : `최고 ${best}%`}</span>
                <span class="meta-tag">#${exam.tag}</span>
              </div>
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function bindExamList(rerender) {
  document.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.cat;
      rerender();
    });
  });
  document.querySelectorAll("[data-exam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.modalExam = getExamList().find((item) => item.id === btn.dataset.exam);
      rerender();
    });
  });
  document.querySelector("[data-close]")?.addEventListener("click", () => {
    state.modalExam = null;
    rerender();
  });
  document.querySelector("[data-start]")?.addEventListener("click", async () => {
    const exam = state.modalExam;
    const password = document.querySelector("[name=examPassword]")?.value || "";
    const errorEl = document.getElementById("exam-pass-error");
    try {
      await ExamEngine.start(exam, password);
      state.modalExam = null;
    } catch (err) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err.message;
      } else {
        alert(err.message);
      }
    }
  });
  document.getElementById("exam-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "exam-modal") {
      state.modalExam = null;
      rerender();
    }
  });
}

function getNoticeList() {
  return window.LIVE_NOTICES && window.LIVE_NOTICES.length ? window.LIVE_NOTICES : NOTICES;
}

function renderDashboard() {
  const user = Storage.getUser();
  document.getElementById("app").innerHTML = layout(
    "dashboard",
    `
      <section class="page-head">
        <h1>안녕하세요, ${escapeHtml(displayName(user))}님 👋</h1>
        <p>응시 가능한 시험 목록입니다.</p>
      </section>
      <section class="card notice-card">
        <div class="card-head">
          <div class="card-title">${ICONS.pin} 공지사항</div>
          <a class="link-more" href="#/notices">전체 보기</a>
        </div>
        ${getNoticeList()
          .slice(0, 3)
          .map(
            (item) => `
          <a class="notice-row" href="#/notices?id=${item.id}">
            ${item.pinned ? `<span class="pin">고정</span>` : `<span style="width:36px"></span>`}
            <span class="notice-text">${escapeHtml(item.title)}</span>
            <span class="notice-date">${item.date}</span>
          </a>
        `
          )
          .join("")}
      </section>
      ${examListHtml()}
    `,
    { modal: examModalHtml() }
  );
  bindChrome();
  bindExamList(renderDashboard);
}

function renderExams() {
  document.getElementById("app").innerHTML = layout(
    "exams",
    `
      <section class="page-head">
        <h1>시험 목록</h1>
        <p>응시 가능한 시험 목록입니다.</p>
      </section>
      ${examListHtml()}
    `,
    { modal: examModalHtml() }
  );
  bindChrome();
  bindExamList(renderExams);
}

function renderNotices() {
  const notices = getNoticeList();
  const selected = notices.find((item) => item.id === state.noticeId);
  const content = selected
    ? `
      <a class="back" href="#/notices">← 목록으로</a>
      <article class="card notice-detail" style="margin-top:12px">
        ${selected.pinned ? `<span class="pin">고정</span>` : ""}
        <h2>${escapeHtml(selected.title)}</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:18px">${selected.date}</p>
        <p style="font-size:15px;line-height:1.7">${escapeHtml(selected.body)}</p>
      </article>
    `
    : `
      <section class="page-head">
        <h1>공지사항</h1>
        <p>시험장 운영과 학습 자료 업데이트를 확인하세요.</p>
      </section>
      <section class="card page-card">
        ${
          notices.length
            ? notices
                .map(
                  (item) => `
          <a class="list-row" href="#/notices?id=${item.id}">
            ${item.pinned ? `<span class="pin">고정</span>` : `<span class="pin" style="background:#f3f5f9;color:#98a">일반</span>`}
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.body)}</p>
            </div>
            <time>${item.date}</time>
          </a>
        `
                )
                .join("")
            : `<div class="empty"><p>등록된 공지가 없습니다.</p></div>`
        }
      </section>
    `;
  document.getElementById("app").innerHTML = layout("notices", content);
  bindChrome();
}

function noteExplainHtml(item, options = {}) {
  const text = String(item.explain || "").trim();
  if (!text) {
    if (options.hideEmpty) return "";
    return `<div class="note-explain"><strong>해설</strong><p>등록된 해설이 없습니다.</p></div>`;
  }
  return `<div class="note-explain"><strong>해설</strong><p>${escapeHtml(text)}</p></div>`;
}

function noteAnswerHtml(item) {
  if (isShortQuestion(item)) {
    const selected = item.selected == null || item.selected === "" ? "(없음)" : String(item.selected);
    return `<p class="explain"><strong>제출</strong> ${escapeHtml(selected)}<br><strong>정답</strong> ${escapeHtml(String(item.answer || ""))}</p>`;
  }
  const selected =
    item.selected == null || item.selected === ""
      ? "(없음)"
      : `${Number(item.selected) + 1}번 · ${escapeHtml((item.choices && item.choices[item.selected]) || "")}`;
  return `<p class="explain"><strong>제출</strong> ${selected}<br><strong>정답</strong> ${item.answer + 1}번 · ${escapeHtml((item.choices && item.choices[item.answer]) || "")}</p>`;
}

function notesWithExplain(notes) {
  const attempts = Storage.getAttempts();
  return (notes || []).map((item) => {
    if (String(item.explain || "").trim()) return item;
    for (const attempt of attempts) {
      const found = (attempt.review || []).find(
        (row) => `${attempt.id}-${row.no}` === item.id || (attempt.title === item.examTitle && row.no === item.no && String(row.q || "") === String(item.q || ""))
      );
      if (found && String(found.explain || "").trim()) return { ...item, explain: found.explain };
    }
    return item;
  });
}

function renderNotes() {
  const notes = notesWithExplain(Storage.getWrong());
  const exams = [];
  notes.forEach((item) => {
    const title = String(item.examTitle || "기타").trim() || "기타";
    if (!exams.includes(title)) exams.push(title);
  });
  if (state.noteExam !== "all" && !exams.includes(state.noteExam)) state.noteExam = "all";
  const visible = notes.filter((item) => state.noteExam === "all" || String(item.examTitle || "기타").trim() === state.noteExam);
  const chip = (id, label, count, dotted) => `
    <button class="chip ${state.noteExam === id ? "active" : ""}" type="button" data-note-exam="${encodeURIComponent(id)}" title="${escapeHtml(label)}">
      ${dotted ? `<span class="dot"></span>` : ""}${escapeHtml(label)} (${count})
    </button>
  `;
  document.getElementById("app").innerHTML = layout(
    "notes",
    `
      <section class="page-head">
        <div class="page-head-row">
          <h1>오답 노트</h1>
          ${
            notes.length
              ? `<div class="filters note-filters">${chip("all", "전체", notes.length, false)}${exams
                  .map((title) => chip(title, title, notes.filter((item) => String(item.examTitle || "기타").trim() === title).length, true))
                  .join("")}</div>`
              : ""
          }
        </div>
        <p>틀린 문항을 다시 보며 약점을 보완하세요.</p>
      </section>
      <section class="card page-card">
        ${
          visible.length
            ? visible
                .map(
                  (item) => `
            <div class="review-item">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <span class="ox ng">오답</span>
                <span class="notice-date">${state.noteExam === "all" ? `${escapeHtml(item.examTitle)} · ` : ""}${item.no}번</span>
                <button class="link-more" data-del="${item.id}" style="margin-left:auto">삭제</button>
              </div>
              <h3 style="font-size:15px">${escapeHtml(item.q)}</h3>
              ${questionImagesHtml(item.images)}
              ${noteAnswerHtml(item)}
              ${noteExplainHtml(item)}
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>아직 오답이 없습니다.</p><h3>시험을 응시하면 틀린 문항이 여기에 모입니다.</h3></div>`
        }
      </section>
    `
  );
  bindChrome();
  document.querySelectorAll("[data-note-exam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.noteExam = decodeURIComponent(btn.dataset.noteExam || "all");
      renderNotes();
    });
  });
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      Storage.removeWrong(btn.dataset.del);
      renderNotes();
    });
  });
}

function progressHtml() {
  const attempts = window.MY_ATTEMPTS || Storage.getAttempts();
  const best = attempts.length ? Math.max(...attempts.map((item) => item.percent)) : 0;
  const avg = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.percent, 0) / attempts.length)
    : 0;
  const examRows = getExamList()
    .map((exam) => {
    const score = bestScoreFor(exam.id) || 0;
    return `
      <div class="bar-row">
        <div class="bar-label"><span>${escapeHtml(exam.title)}</span><span>${score}%</span></div>
        <div class="bar"><span style="width:${score}%"></span></div>
      </div>
    `;
  }).join("");

  return `
    <section class="page-head progress-block">
      <h1>학습 성취도</h1>
      <p>응시 결과를 바탕으로 현재 실력을 한눈에 보여 줍니다.</p>
    </section>
    <div class="progress-grid">
      <article class="card stat"><div class="label">응시 횟수</div><div class="value">${attempts.length}</div></article>
      <article class="card stat"><div class="label">최고 점수</div><div class="value">${best}%</div></article>
      <article class="card stat"><div class="label">평균 점수</div><div class="value">${avg}%</div></article>
    </div>
    <section class="card">
      <div class="exam-head"><h2>시험별 최고 점수</h2></div>
      ${attempts.length ? examRows : `<div class="empty"><p>아직 데이터가 없습니다.</p></div>`}
    </section>
  `;
}

function renderHistory() {
  const attempts = window.MY_ATTEMPTS || Storage.getAttempts();
  document.getElementById("app").innerHTML = layout(
    "history",
    `
      <section class="page-head">
        <h1>응시 내역</h1>
        <p>지금까지 치른 시험 결과를 확인하세요.</p>
      </section>
      <section class="card page-card">
        ${
          attempts.length
            ? attempts
                .map(
                  (item) => `
            <div class="list-row">
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${item.correct}/${item.total}문항 정답 · ${formatDate(item.at)}</p>
              </div>
              <div class="aside" style="color:var(--teal);font-weight:800">${item.percent}점</div>
            </div>
          `
                )
                .join("")
            : `<div class="empty"><p>응시 내역이 없습니다.</p><h3>시험 목록에서 모의고사를 시작해 보세요.</h3></div>`
        }
      </section>
      ${progressHtml()}
    `
  );
  bindChrome();
}

function stopExamTimer() {
  if (state.examTimer) {
    clearInterval(state.examTimer);
    state.examTimer = null;
  }
  if (state.examObserver) {
    state.examObserver.disconnect();
    state.examObserver = null;
  }
}

function examSectionName(session, item) {
  return item.section || session.category || session.title;
}

function examAnsweredCount(session) {
  return session.questions.filter((item) => {
    const value = session.answers[item.no];
    return value !== undefined && value !== null && String(value).trim() !== "";
  }).length;
}

function captureExamScroll() {
  const pane = document.querySelector(".cbt-question");
  if (pane) state.examScroll = pane.scrollTop;
}

function scrollExamTo(idx, behavior = "smooth") {
  const session = Storage.getSession();
  if (!session) return;
  const item = session.questions[idx];
  if (!item) return;
  document.getElementById(`q-${item.no}`)?.scrollIntoView({ behavior, block: "start" });
  document.querySelector(`.omr-row[data-no="${item.no}"]`)?.scrollIntoView({ block: "nearest" });
}

function setExamCurrent(session, idx, { scroll } = {}) {
  if (idx < 0 || idx >= session.questions.length) return;
  session.index = idx;
  Storage.saveSession(session);
  const item = session.questions[idx];
  const section = examSectionName(session, item);
  document.querySelectorAll(".cbt-item").forEach((el) => {
    el.classList.toggle("current", Number(el.dataset.idx) === idx);
  });
  document.querySelectorAll(".omr-row").forEach((el) => {
    el.classList.toggle("current", Number(el.dataset.no) === item.no);
  });
  document.querySelectorAll(".cbt-sub").forEach((el) => {
    el.classList.toggle("on", el.dataset.section === section);
  });
  document.querySelector("[data-mark]")?.classList.toggle("on", !!session.marked[item.no]);
  if (scroll) {
    state.examScrolling = true;
    scrollExamTo(idx);
    setTimeout(() => {
      state.examScrolling = false;
    }, 420);
  }
}

function updateExamProgress(session) {
  const progress = document.querySelector(".cbt-progress");
  if (progress) progress.textContent = `${examAnsweredCount(session)} / ${session.questions.length} 응답`;
}

function setExamMcq(session, no, choiceIdx) {
  session.answers[no] = choiceIdx;
  Storage.saveSession(session);
  document.querySelectorAll(`.cbt-item[data-no="${no}"] [data-choice]`).forEach((btn) => {
    btn.classList.toggle("selected", Number(btn.dataset.choice) === choiceIdx);
  });
  document.querySelectorAll(`.omr-dot[data-omr-q="${no}"]`).forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.omrIdx) === choiceIdx);
  });
  updateExamProgress(session);
}

function setExamShort(session, no, value) {
  session.answers[no] = value;
  Storage.saveSession(session);
  document.querySelector(`.omr-row[data-no="${no}"] .omr-short`)?.classList.toggle("on", String(value).trim() !== "");
  updateExamProgress(session);
}

function toggleExamMark(session, no) {
  session.marked[no] = !session.marked[no];
  Storage.saveSession(session);
  const on = !!session.marked[no];
  document.querySelector(`.cbt-item[data-no="${no}"]`)?.classList.toggle("marked", on);
  const check = document.querySelector(`.cbt-item[data-no="${no}"] .cbt-q-check`);
  if (check) check.textContent = on ? "☑" : "☐";
  document.querySelector(`.omr-row[data-no="${no}"]`)?.classList.toggle("marked", on);
  const current = session.questions[session.index];
  if (current && current.no === no) {
    document.querySelector("[data-mark]")?.classList.toggle("on", on);
  }
}

function renderQuestionItem(session, item, idx) {
  const selected = session.answers[item.no];
  const marked = session.marked[item.no];
  const current = idx === session.index;
  const short = isShortQuestion(item);
  return `
    <article class="cbt-item ${current ? "current" : ""} ${marked ? "marked" : ""}" id="q-${item.no}" data-no="${item.no}" data-idx="${idx}">
      <div class="cbt-q-head">
        <span class="cbt-q-no"><span class="cbt-q-num">${item.no}</span>${short ? `<span class="cbt-q-kind">주관식</span>` : ""}</span>
      </div>
      <h2 class="cbt-stem">${escapeHtml(item.q)}</h2>
      ${questionImagesHtml(item.images)}
      ${
        short
          ? `
        <label class="cbt-short-label" for="short-${item.no}">주관식 답안</label>
        <input id="short-${item.no}" class="cbt-short" type="text" data-short="${item.no}" value="${escapeHtml(selected == null ? "" : String(selected))}" placeholder="답을 입력하세요" autocomplete="off" />
      `
          : `<div class="cbt-choices">
        ${(item.choices || [])
          .map((choice, choiceIdx) => {
            const on = selected === choiceIdx;
            return `
              <button class="cbt-choice ${on ? "selected" : ""}" data-q="${item.no}" data-choice="${choiceIdx}">
                <span class="cbt-mark">${(item.choiceLabels && item.choiceLabels[choiceIdx]) || CIRCLES[choiceIdx] || choiceIdx + 1}</span>
                ${choiceBodyHtml(choice, item.choiceImages, choiceIdx)}
              </button>
            `;
          })
          .join("")}
      </div>`
      }
    </article>
  `;
}

function renderExamSheet(session, sections) {
  let lastSection = null;
  return session.questions
    .map((item, idx) => {
      const name = examSectionName(session, item);
      let heading = "";
      if (name && name !== lastSection) {
        lastSection = name;
        const secIdx = sections.indexOf(name);
        heading = `<h3 class="cbt-section-title" id="sec-${secIdx}">${escapeHtml(name)}</h3>`;
      }
      return heading + renderQuestionItem(session, item, idx);
    })
    .join("");
}

function renderExam() {
  const session = Storage.getSession();
  if (!session) {
    location.hash = "#/";
    return;
  }
  if (!window.__liveExam) {
    window.__liveExam = session;
    Api.liveExam()
      .then((live) => {
        const current = Storage.getSession();
        if (!current || current.examId !== live.examId) return;
        current.questions = current.questions.map((q) => {
          const src = (live.questions || []).find((item) => item.no === q.no);
          return src ? { ...q, images: src.images || [], choiceImages: src.choiceImages || [] } : q;
        });
        window.__liveExam = current;
        Storage.saveSession(current);
        renderExam();
      })
      .catch(() => {});
  }
  session.marked = session.marked || {};
  session.fontScale = session.fontScale || 1;
  session.layout = session.layout || "side";
  if (!session.questions.length) session.index = 0;
  else if (session.index < 0 || session.index >= session.questions.length) session.index = 0;
  const user = Storage.getUser() || { name: "응시자", id: "-" };
  const q = session.questions[session.index] || { no: 1, section: session.title };
  const remain = ExamEngine.remaining(session);
  if (remain <= 0) {
    stopExamTimer();
    ExamEngine.submit(session).catch((err) => alert(err.message));
    return;
  }
  const mcqLens = session.questions.filter((item) => !isShortQuestion(item)).map((item) => (item.choices || []).length);
  const bubbleCount = Math.min(5, Math.max(4, ...(mcqLens.length ? mcqLens : [4])));
  const sections = [];
  session.questions.forEach((item) => {
    const name = examSectionName(session, item);
    if (name && !sections.includes(name)) sections.push(name);
  });
  const currentSection = examSectionName(session, q);
  const answeredCount = examAnsweredCount(session);

  if (state.examObserver) {
    state.examObserver.disconnect();
    state.examObserver = null;
  }

  document.getElementById("app").innerHTML = `
    <div class="cbt-shell ${session.layout === "stack" ? "is-stack" : ""}" style="--exam-font:${session.fontScale}">
      <header class="cbt-head">
        <div class="cbt-cell"><span class="cbt-k">종목</span><strong>${escapeHtml(session.title)}</strong></div>
        <div class="cbt-cell cbt-time"><span class="cbt-k">남은시간</span><strong class="cbt-timer ${remain < 5 * 60 * 1000 ? "warn" : ""}">${ExamEngine.formatTime(remain)}</strong></div>
        <div class="cbt-cell"><span class="cbt-k">수험번호/이름</span><strong>${escapeHtml(examNumber(user))} / ${escapeHtml(user.name || "")}</strong></div>
      </header>
      <div class="cbt-body">
        <section class="cbt-question">
          <div class="cbt-sticky">
            <div class="cbt-subjects">
              <span class="cbt-k">과목</span>
              <div class="cbt-sub-list">
                ${sections
                  .map((name, idx) => {
                    const on = name === currentSection;
                    return `<button class="cbt-sub ${on ? "on" : ""}" data-section="${escapeHtml(name)}">[${idx + 1}. ${escapeHtml(name)}]</button>`;
                  })
                  .join("")}
              </div>
            </div>
            <div class="cbt-q-head cbt-sheet-head">
              <span class="cbt-q-no">전체 문항</span>
              <span class="cbt-progress">${answeredCount} / ${session.questions.length} 응답</span>
            </div>
          </div>
          <div class="cbt-sheet">
            ${renderExamSheet(session, sections)}
          </div>
        </section>
        <aside class="cbt-omr">
          <h2>답안 표기란</h2>
          <div class="omr-list">
            ${session.questions
              .map((item, idx) => {
                const selected = session.answers[item.no];
                const current = idx === session.index;
                return `
                  <div class="omr-row ${current ? "current" : ""} ${session.marked[item.no] ? "marked" : ""}" data-no="${item.no}">
                    <button class="omr-no" data-go="${idx}">${item.no}</button>
                    ${
                      isShortQuestion(item)
                        ? `<button class="omr-short ${selected !== undefined && String(selected).trim() !== "" ? "on" : ""}" data-go="${idx}">주관식</button>`
                        : `<div class="omr-bubbles">
                      ${Array.from({ length: bubbleCount }, (_, choiceIdx) => {
                        const enabled = choiceIdx < (item.choices || []).length;
                        return `<button class="omr-dot ${selected === choiceIdx ? "on" : ""}" data-omr-q="${item.no}" data-omr-idx="${choiceIdx}" data-omr-i="${idx}" ${enabled ? "" : "disabled"} title="${item.no}번 ${choiceIdx + 1}">${choiceIdx + 1}</button>`;
                      }).join("")}
                    </div>`
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        </aside>
      </div>
      <footer class="cbt-bar">
        <button class="cbt-btn" data-font>글자크기 <span class="cbt-font-pct">${Math.round((session.fontScale || 1) * 100)}%</span></button>
        <button class="cbt-btn" data-layout>배치</button>
        <button class="cbt-btn ${session.marked[q.no] ? "on" : ""}" data-mark>체크문제</button>
        <button class="cbt-btn" data-all>전체문제</button>
        <button class="cbt-btn danger" data-submit>제출</button>
      </footer>
      ${
        state.showAllQuestions
          ? `
        <div class="overlay" id="all-q">
          <div class="modal" style="width:min(560px,100%)">
            <h2>전체 문제</h2>
            <p>번호를 누르면 해당 문항으로 이동합니다. 색칠은 응답, 테두리는 체크입니다.</p>
            <div class="all-grid">
              ${session.questions
                .map((item, idx) => {
                  const answered = session.answers[item.no] !== undefined && String(session.answers[item.no]).trim() !== "";
                  const current = idx === session.index;
                  const marked = session.marked[item.no];
                  return `<button class="all-btn ${answered ? "answered" : ""} ${current ? "current" : ""} ${marked ? "marked" : ""}" data-go="${idx}">${item.no}</button>`;
                })
                .join("")}
            </div>
            <div class="modal-actions"><button class="btn btn-ghost" data-close-all>닫기</button></div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  const pane = document.querySelector(".cbt-question");
  if (pane) {
    if (state.jumpToIdx != null) {
      scrollExamTo(state.jumpToIdx, "instant");
      state.jumpToIdx = null;
    } else {
      pane.scrollTop = state.examScroll || 0;
    }
  }

  document.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const no = Number(btn.dataset.q);
      const idx = session.questions.findIndex((item) => item.no === no);
      setExamMcq(session, no, Number(btn.dataset.choice));
      if (idx >= 0) setExamCurrent(session, idx);
    });
  });
  document.querySelectorAll("[data-short]").forEach((input) => {
    input.addEventListener("focus", () => {
      const no = Number(input.dataset.short);
      const idx = session.questions.findIndex((item) => item.no === no);
      if (idx >= 0) setExamCurrent(session, idx);
    });
    input.addEventListener("input", (e) => {
      setExamShort(session, Number(input.dataset.short), e.currentTarget.value);
    });
  });
  document.querySelectorAll("[data-omr-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const no = Number(btn.dataset.omrQ);
      const idx = Number(btn.dataset.omrI);
      setExamMcq(session, no, Number(btn.dataset.omrIdx));
      setExamCurrent(session, idx, { scroll: true });
    });
  });
  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.go);
      state.showAllQuestions = false;
      document.getElementById("all-q")?.remove();
      setExamCurrent(session, idx, { scroll: true });
    });
  });
  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.section;
      const found = session.questions.findIndex((item) => examSectionName(session, item) === name);
      if (found >= 0) setExamCurrent(session, found, { scroll: true });
    });
  });
  document.querySelector("[data-font]")?.addEventListener("click", () => {
    captureExamScroll();
    const steps = [1, 1.25, 1.5];
    const current = Number(session.fontScale || 1);
    const idx = steps.findIndex((step) => Math.abs(step - current) < 0.02);
    session.fontScale = steps[(idx < 0 ? 0 : idx + 1) % steps.length];
    Storage.saveSession(session);
    renderExam();
  });
  document.querySelector("[data-layout]")?.addEventListener("click", () => {
    captureExamScroll();
    session.layout = session.layout === "side" ? "stack" : "side";
    Storage.saveSession(session);
    renderExam();
  });
  document.querySelector("[data-mark]")?.addEventListener("click", () => {
    const current = session.questions[session.index];
    if (current) toggleExamMark(session, current.no);
  });
  document.querySelector("[data-all]")?.addEventListener("click", () => {
    captureExamScroll();
    state.showAllQuestions = true;
    Storage.saveSession(session);
    renderExam();
  });
  document.querySelector("[data-close-all]")?.addEventListener("click", () => {
    captureExamScroll();
    state.showAllQuestions = false;
    renderExam();
  });
  document.getElementById("all-q")?.addEventListener("click", (e) => {
    if (e.target.id === "all-q") {
      captureExamScroll();
      state.showAllQuestions = false;
      renderExam();
    }
  });
  document.querySelector("[data-submit]").addEventListener("click", () => {
    const unanswered = session.questions.filter((item) => {
      const value = session.answers[item.no];
      return value === undefined || value === null || String(value).trim() === "";
    }).length;
    const ok = unanswered
      ? confirm(`아직 ${unanswered}문항이 비어 있습니다. 제출할까요?`)
      : confirm("시험을 제출할까요?");
    if (ok) {
      stopExamTimer();
      ExamEngine.submit(session).catch((err) => alert(err.message));
    }
  });

  if (pane) {
    state.examObserver = new IntersectionObserver(
      (entries) => {
        if (state.examScrolling || state.showAllQuestions) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const idx = Number(visible[0].target.dataset.idx);
        if (Number.isFinite(idx) && idx !== session.index) setExamCurrent(session, idx);
      },
      { root: pane, rootMargin: "-72px 0px -58% 0px", threshold: 0.01 }
    );
    document.querySelectorAll(".cbt-item").forEach((el) => state.examObserver.observe(el));
  }

  if (!state.examTimer) {
    state.examTimer = setInterval(() => {
      const live = Storage.getSession();
      if (!live) {
        stopExamTimer();
        return;
      }
      const left = ExamEngine.remaining(live);
      const el = document.querySelector(".cbt-timer");
      if (el) {
        el.textContent = ExamEngine.formatTime(left);
        el.classList.toggle("warn", left < 5 * 60 * 1000);
      }
      if (left <= 0) {
        stopExamTimer();
        ExamEngine.submit(live).catch((err) => alert(err.message));
      }
    }, 1000);
  }
}

function renderResult() {
  const raw = sessionStorage.getItem("oncodelab.lastResult");
  const attempt = raw ? JSON.parse(raw) : Storage.getAttempts()[0];
  if (!attempt) {
    location.hash = "#/";
    return;
  }
  document.getElementById("app").innerHTML = layout(
    "history",
    `
      <section class="card result-hero">
        <p style="color:var(--text-sub);font-weight:700">응시 완료</p>
        <h1 style="margin-top:6px">${escapeHtml(attempt.title)}</h1>
        <div class="score-ring" style="--p:${attempt.percent}"><span>${attempt.percent}점</span></div>
        <p>${attempt.correct} / ${attempt.total}문항 정답</p>
        <div class="modal-actions" style="justify-content:center;margin-top:18px">
          <a class="btn btn-ghost" href="#/notes">오답 노트</a>
          <a class="btn btn-primary" href="#/exams">시험 목록</a>
        </div>
      </section>
      <section class="card page-card">
        ${attempt.review
          .map(
            (item) => `
          <div class="review-item">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <span class="ox ${item.ok ? "ok" : "ng"}">${item.ok ? "정답" : "오답"}</span>
              <span class="q-no">${item.no}번</span>
            </div>
            <h3 style="font-size:15px;margin-bottom:10px">${escapeHtml(item.q)} ${isShortQuestion(item) ? `<span class="badge">주관식</span>` : ""}</h3>
            ${questionImagesHtml(item.images)}
            ${
              isShortQuestion(item)
                ? `<p class="explain"><strong>제출</strong> ${escapeHtml(item.selected == null || item.selected === "" ? "(없음)" : String(item.selected))}<br><strong>정답</strong> ${escapeHtml(String(item.answer || ""))}</p>`
                : `<div class="choices">
              ${(item.choices || [])
                .map((choice, idx) => {
                  const cls = [
                    idx === item.answer ? "correct" : "",
                    idx === item.selected && !item.ok ? "wrong" : "",
                    idx === item.selected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return `<div class="choice ${cls}"><span class="choice-no">${idx + 1}</span>${choiceBodyHtml(choice, item.choiceImages, idx)}</div>`;
                })
                .join("")}
            </div>`
            }
            ${item.ok ? "" : noteExplainHtml(item)}
          </div>
        `
          )
          .join("")}
      </section>
    `
  );
  bindChrome();
}

function render() {
  stopExamTimer();
  state.sidebarOpen = false;
  const { path, params } = route();
  const user = Storage.getUser();
  const loggedIn = Boolean(user && Api.token());

  if (path === "/login" || path === "/admin-login") {
    renderAuth(path === "/admin-login" ? "admin" : "user");
    return;
  }

  if (!loggedIn) {
    renderAuth(path.startsWith("/admin") ? "admin" : "user");
    return;
  }

  if (path.startsWith("/admin") && user.role !== "admin") {
    renderAuth("admin");
    return;
  }

  if (user.role === "admin" && (path.startsWith("/admin") || !isLearnerView())) {
    sessionStorage.removeItem("oncodelab.view");
    if (path.startsWith("/admin/exam/")) {
      renderAdminExam(path.replace("/admin/exam/", ""));
      return;
    }
    if (path === "/admin/settings") {
      renderAdminSettings();
      return;
    }
    if (path === "/admin/notices") {
      renderAdminNotices();
      return;
    }
    if (path === "/admin/users") {
      renderAdminUsers();
      return;
    }
    if (path === "/admin/attempts") {
      renderAdminAttempts();
      return;
    }
    renderAdminExams();
    return;
  }

  if (path === "/exam") {
    renderExam();
    return;
  }

  loadExams()
    .then(() => Api.notices().catch(() => NOTICES))
    .then((notices) => {
      window.LIVE_NOTICES = notices;
      return Api.myAttempts();
    })
    .then((attempts) => {
      window.MY_ATTEMPTS = attempts;
      state.noticeId = params.get("id");
      if (path === "/notices") renderNotices();
      else if (path === "/exams") renderExams();
      else if (path === "/notes") renderNotes();
      else if (path === "/history" || path === "/progress") renderHistory();
      else if (path === "/result") renderResult();
      else renderDashboard();
    })
    .catch(() => {
      Api.clearSession();
      sessionStorage.setItem("oncodelab.loggedOut", "1");
      renderAuth();
    });
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);
