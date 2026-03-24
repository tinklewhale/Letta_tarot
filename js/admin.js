/* ================================================
   admin.js - 관리자 콘솔 로직
   ================================================ */

(async function () {
  const loginSection = document.getElementById('login-section');
  const adminSection = document.getElementById('admin-section');
  const adminHeaderActions = document.getElementById('admin-header-actions');
  const adminPasswordInput = document.getElementById('admin-password');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminPwError = document.getElementById('admin-pw-error');
  const statsSummary = document.getElementById('stats-summary');
  const consultationList = document.getElementById('consultation-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const tabBar = document.getElementById('tab-bar');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');

  let adminToken = sessionStorage.getItem('adminToken');
  let currentTab = 'all';
  let allConsultations = [];

  // 세션 토큰이 있으면 바로 메인 표시
  if (adminToken) {
    showAdminSection();
    await loadConsultations();
  }

  /* ── 비밀번호 표시/숨기기 토글 ── */
  const EYE_ON  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  const adminPwToggle = document.getElementById('admin-pw-toggle');
  adminPwToggle.addEventListener('click', () => {
    const isHidden = adminPasswordInput.type === 'password';
    adminPasswordInput.type = isHidden ? 'text' : 'password';
    adminPwToggle.innerHTML = isHidden ? EYE_OFF : EYE_ON;
  });

  /* ── 로그인 ── */
  adminLoginBtn.addEventListener('click', handleLogin);
  adminPasswordInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
    adminPwError.classList.add('hidden');
    adminPasswordInput.classList.remove('input--error');
  });

  async function handleLogin() {
    const pw = adminPasswordInput.value;
    if (!pw) {
      adminPwError.textContent = '비밀번호를 입력해주세요.';
      adminPwError.classList.remove('hidden');
      return;
    }
    UI.showLoading(adminLoginBtn, '확인 중...');
    try {
      const result = await API.adminLogin(pw);
      sessionStorage.setItem('adminToken', result.adminToken);
      adminToken = result.adminToken;
      showAdminSection();
      await loadConsultations();
    } catch (err) {
      if (err.code === 'AUTH_FAILED') {
        adminPwError.textContent = '비밀번호가 올바르지 않습니다.';
        adminPwError.classList.remove('hidden');
        adminPasswordInput.classList.add('input--error');
      } else {
        adminPwError.textContent = err.message || '오류가 발생했습니다.';
        adminPwError.classList.remove('hidden');
      }
    } finally {
      UI.hideLoading(adminLoginBtn);
    }
  }

  /* ── 섹션 전환 ── */
  function showAdminSection() {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    adminHeaderActions.style.display = 'flex';
  }

  /* ── 로그아웃 ── */
  adminLogoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('adminToken');
    location.reload();
  });

  /* ── 탭 ── */
  tabBar.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentTab = btn.dataset.status;
    renderList();
  });

  /* ── 새로고침 ── */
  refreshBtn.addEventListener('click', () => loadConsultations());

  /* ── 데이터 로드 ── */
  async function loadConsultations() {
    consultationList.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>불러오는 중...</p></div>`;
    statsSummary.textContent = '로딩 중...';
    try {
      const result = await API.getConsultationList(undefined, adminToken);
      allConsultations = result.consultations || [];
      updateStats();
      renderList();
    } catch (err) {
      if (err.code === 'AUTH_FAILED') {
        sessionStorage.removeItem('adminToken');
        location.reload();
      } else {
        consultationList.innerHTML = `<div class="card text-center"><p class="hint">${UI.escapeHtml(err.message)}</p></div>`;
      }
    }
  }

  /* ── 통계 업데이트 ── */
  function updateStats() {
    const total = allConsultations.length;
    const pending = allConsultations.filter(c => c.status === 'pending').length;
    const answered = allConsultations.filter(c => c.status === 'answered').length;
    const rejected = allConsultations.filter(c => c.status === 'rejected').length;
    statsSummary.innerHTML = `전체 <strong>${total}</strong> &nbsp;|&nbsp; ⏳ 대기 <strong style="color:var(--color-gold)">${pending}</strong> &nbsp;|&nbsp; ✅ 완료 <strong style="color:#2A6A30">${answered}</strong> &nbsp;|&nbsp; 거절 <strong>${rejected}</strong>`;
  }

  /* ── 목록 렌더링 ── */
  function renderList() {
    const filtered = currentTab === 'all'
      ? allConsultations
      : allConsultations.filter(c => c.status === currentTab);

    if (filtered.length === 0) {
      consultationList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state__icon">🌙</span>
          <p class="empty-state__text">표시할 상담이 없어요</p>
        </div>
      `;
      return;
    }

    consultationList.innerHTML = filtered.map(c => renderConsultItem(c)).join('');

    // 확장/축소 이벤트
    consultationList.querySelectorAll('.consult-item__header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.consult-item');
        item.classList.toggle('is-expanded');
      });
    });

    // textarea 드래프트 복구
    consultationList.querySelectorAll('.answer-textarea').forEach(ta => {
      const id = ta.dataset.id;
      const draft = localStorage.getItem('draft_' + id);
      if (draft) ta.value = draft;

      ta.addEventListener('input', () => {
        localStorage.setItem('draft_' + id, ta.value);
        const counter = document.getElementById('counter-' + id);
        if (counter) counter.textContent = `${ta.value.length}자`;
      });
    });

    // 답변 저장 버튼
    consultationList.querySelectorAll('.save-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => handleSaveAnswer(btn));
    });

    // 거절 버튼
    consultationList.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => handleReject(btn));
    });

    // 수정 버튼 (answered 상태)
    consultationList.querySelectorAll('.edit-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const readEl = document.getElementById('answer-read-' + id);
        const editEl = document.getElementById('answer-edit-' + id);
        if (readEl && editEl) {
          readEl.classList.add('hidden');
          editEl.classList.remove('hidden');
          editEl.querySelector('.answer-textarea').focus();
        }
      });
    });
  }

  /* ── 상담 아이템 HTML ── */
  function renderConsultItem(c) {
    const statusBadge = {
      pending:  `<span class="badge badge--pending">⏳ 대기중</span>`,
      answered: `<span class="badge badge--answered">✅ 완료</span>`,
      rejected: `<span class="badge badge--rejected">🌙 거절</span>`,
    }[c.status] || '';

    const consentTag = c.consent
      ? `<span style="font-size:var(--fs-xs);color:var(--color-primary);background:rgba(200,168,232,0.15);padding:2px 6px;border-radius:4px;">📋 활용동의</span>`
      : `<span style="font-size:var(--fs-xs);color:#999;background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;">🚫 비동의</span>`;

    const bodyContent = c.status === 'pending'
      ? renderPendingBody(c)
      : c.status === 'answered'
        ? renderAnsweredBody(c)
        : renderRejectedBody(c);

    return `
      <div class="consult-item consult-item--${c.status}" id="item-${c.id}">
        <div class="consult-item__header">
          <span class="consult-item__name">🌸 ${UI.escapeHtml(c.nickname)}</span>
          ${statusBadge}
          ${consentTag}
          <span class="consult-item__date">${UI.formatDate(c.createdAt)}</span>
          <span class="consult-item__preview">${UI.escapeHtml(UI.truncate(c.story, 30))}</span>
          <span class="consult-item__toggle">▼</span>
        </div>
        <div class="consult-item__body">
          <div class="card-label mb-sm">✍️ 사연</div>
          <div class="story-card" style="margin-bottom:var(--sp-md);">${UI.nl2br(c.story)}</div>
          ${c.feedback ? `
            <div class="card-label mb-sm">💜 후기</div>
            <div class="feedback-box" style="margin-bottom:var(--sp-md);">
              <p class="feedback-submitted">"${UI.nl2br(c.feedback)}"</p>
            </div>
          ` : ''}
          ${bodyContent}
        </div>
      </div>
    `;
  }

  function renderPendingBody(c) {
    return `
      <div id="answer-edit-${c.id}">
        <div class="card-label mb-sm" style="justify-content:space-between;">
          <span>🌙 답변 작성</span>
          <span id="counter-${c.id}" style="font-size:var(--fs-xs);color:var(--color-text-light);">0자</span>
        </div>
        <textarea class="textarea answer-textarea" data-id="${c.id}"
          placeholder="타로 메시지를 정성껏 적어주세요..."
          style="min-height:160px;"></textarea>
        <div class="consult-item__actions">
          <button class="btn btn--primary btn--sm save-answer-btn" data-id="${c.id}">💾 답변 저장</button>
          <button class="btn btn--danger btn--sm reject-btn" data-id="${c.id}">거절</button>
        </div>
      </div>
    `;
  }

  function renderAnsweredBody(c) {
    return `
      <div id="answer-read-${c.id}">
        <div class="card-label mb-sm">
          <span>🌙 작성된 답변</span>
          <span class="meta-date">${UI.formatDate(c.answeredAt)}</span>
        </div>
        <div class="answer-card" style="margin-bottom:var(--sp-md);">${UI.nl2br(c.answer)}</div>
        <div class="consult-item__actions">
          <button class="btn btn--secondary btn--sm edit-answer-btn" data-id="${c.id}">✏️ 수정</button>
        </div>
      </div>
      <div id="answer-edit-${c.id}" class="hidden">
        <div class="card-label mb-sm" style="justify-content:space-between;">
          <span>✏️ 답변 수정</span>
          <span id="counter-${c.id}" style="font-size:var(--fs-xs);color:var(--color-text-light);">0자</span>
        </div>
        <textarea class="textarea answer-textarea" data-id="${c.id}"
          style="min-height:160px;">${UI.escapeHtml(c.answer)}</textarea>
        <div class="consult-item__actions">
          <button class="btn btn--primary btn--sm save-answer-btn" data-id="${c.id}">💾 저장</button>
          <button class="btn btn--ghost btn--sm" onclick="
            document.getElementById('answer-read-${c.id}').classList.remove('hidden');
            document.getElementById('answer-edit-${c.id}').classList.add('hidden');
          ">취소</button>
        </div>
      </div>
    `;
  }

  function renderRejectedBody(c) {
    return `
      <p class="hint text-center" style="padding:var(--sp-sm) 0;">🌙 거절된 상담입니다</p>
    `;
  }

  /* ── 답변 저장 ── */
  async function handleSaveAnswer(btn) {
    const id = btn.dataset.id;
    const ta = document.querySelector(`.answer-textarea[data-id="${id}"]`);
    const answer = ta ? ta.value.trim() : '';

    if (!answer) {
      UI.showToast('답변 내용을 작성해주세요.', 'warning');
      return;
    }

    UI.showLoading(btn, '저장 중...');
    try {
      await API.submitAnswer(id, answer, adminToken);
      localStorage.removeItem('draft_' + id);

      // 로컬 상태 업데이트
      const idx = allConsultations.findIndex(c => c.id === id);
      if (idx !== -1) {
        allConsultations[idx].answer = answer;
        allConsultations[idx].status = 'answered';
        allConsultations[idx].answeredAt = new Date().toISOString();
      }

      UI.showToast('답변이 저장되었어요 ✨', 'success');
      updateStats();
      renderList();
    } catch (err) {
      UI.showToast(err.message || '저장에 실패했습니다.', 'error');
      UI.hideLoading(btn);
    }
  }

  /* ── 거절 ── */
  async function handleReject(btn) {
    const id = btn.dataset.id;
    const item = allConsultations.find(c => c.id === id);
    if (!item) return;

    UI.showModal(`
      <div class="modal-box__title">상담을 거절하시겠어요?</div>
      <p class="hint text-center" style="margin:var(--sp-sm) 0;">
        <strong>${UI.escapeHtml(item.nickname)}</strong>님의 상담을 거절합니다.<br>
        사용자에게는 거절 사실만 안내됩니다.
      </p>
      <div class="modal-box__actions">
        <button class="btn btn--secondary" onclick="UI.closeModal()">취소</button>
        <button class="btn btn--danger" id="confirm-reject-btn">거절하기</button>
      </div>
    `);

    document.getElementById('confirm-reject-btn').addEventListener('click', async () => {
      UI.closeModal();
      try {
        await API.updateStatus(id, 'rejected', adminToken);
        const idx = allConsultations.findIndex(c => c.id === id);
        if (idx !== -1) allConsultations[idx].status = 'rejected';
        UI.showToast('상담이 거절 처리되었습니다.', 'success');
        updateStats();
        renderList();
      } catch (err) {
        UI.showToast(err.message || '처리에 실패했습니다.', 'error');
      }
    });
  }
})();
