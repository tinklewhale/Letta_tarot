/* ================================================
   admin-settings.js - 관리자 설정 페이지 로직
   ================================================ */

(async function () {
  const adminToken = sessionStorage.getItem('adminToken');
  if (!adminToken) {
    location.href = 'admin.html';
    return;
  }

  const settingsContent = document.getElementById('settings-content');
  let currentSettings = null;
  let currentStats = null;
  let pendingLimit = null;

  await loadSettings();

  async function loadSettings() {
    settingsContent.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>불러오는 중...</p></div>`;
    try {
      const result = await API.getSettings(adminToken);
      currentSettings = result.settings;
      currentStats = result.stats;
      pendingLimit = currentSettings.dailyLimit;
      render();
    } catch (err) {
      if (err.code === 'AUTH_FAILED') {
        sessionStorage.removeItem('adminToken');
        location.href = 'admin.html';
      } else {
        settingsContent.innerHTML = `
          <div class="card text-center">
            <p class="hint">${UI.escapeHtml(err.message)}</p>
            <button class="btn btn--secondary mt-md" onclick="location.reload()">다시 시도</button>
          </div>
        `;
      }
    }
  }

  function render() {
    const s = currentSettings;
    const stats = currentStats;

    settingsContent.innerHTML = `
      <!-- 서비스 활성화 -->
      <div class="card" style="animation-delay:0s;">
        <div class="card__title">서비스 상태</div>
        <div class="toggle-row">
          <div>
            <div class="toggle-label">서비스 활성화</div>
            <div class="toggle-desc" id="service-status-desc">
              ${s.serviceActive ? '🌟 현재 서비스가 활성화되어 있어요' : '🌙 현재 서비스가 일시 중단되어 있어요'}
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="service-toggle" ${s.serviceActive ? 'checked' : ''}>
            <span class="toggle-switch__track"></span>
          </label>
        </div>
      </div>

      <!-- 일일 한도 -->
      <div class="card" style="animation-delay:0.08s;">
        <div class="card__title">일일 상담 한도</div>
        <p class="hint mb-md text-center">오늘 신청 수: <strong style="color:var(--color-gold)">${stats.today}</strong> / ${s.dailyLimit}</p>
        <div class="limit-control">
          <button class="limit-control__btn" id="limit-minus">－</button>
          <span class="limit-control__value" id="limit-value">${s.dailyLimit}</span>
          <button class="limit-control__btn" id="limit-plus">＋</button>
        </div>
        <p class="hint text-center mb-md" style="font-size:var(--fs-xs);">0 ~ 50 사이로 설정 가능해요</p>
        <button class="btn btn--primary btn--full" id="save-limit-btn">한도 저장하기</button>
      </div>

      <!-- 통계 -->
      <div class="card" style="animation-delay:0.16s;">
        <div class="flex-between mb-md">
          <div class="card__title" style="margin:0;">통계</div>
          <button class="btn btn--ghost btn--sm" onclick="location.reload()">🔄 새로고침</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-card__value" style="color:var(--color-gold);">${stats.today}</span>
            <div class="stat-card__label">오늘 신청</div>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">${stats.total}</span>
            <div class="stat-card__label">전체 상담</div>
          </div>
          <div class="stat-card">
            <span class="stat-card__value" style="color:#2A6A30;">${stats.answered}</span>
            <div class="stat-card__label">답변 완료</div>
          </div>
          <div class="stat-card">
            <span class="stat-card__value" style="color:#8A7020;">${stats.pending}</span>
            <div class="stat-card__label">대기중</div>
          </div>
        </div>
      </div>
    `;

    setupEvents();
  }

  function setupEvents() {
    const serviceToggle = document.getElementById('service-toggle');
    const serviceStatusDesc = document.getElementById('service-status-desc');
    const limitValue = document.getElementById('limit-value');
    const limitMinus = document.getElementById('limit-minus');
    const limitPlus = document.getElementById('limit-plus');
    const saveLimitBtn = document.getElementById('save-limit-btn');

    // 서비스 토글
    serviceToggle.addEventListener('change', async () => {
      const newVal = serviceToggle.checked;
      try {
        await API.updateSettings({ serviceActive: String(newVal) }, adminToken);
        currentSettings.serviceActive = newVal;
        serviceStatusDesc.textContent = newVal
          ? '🌟 현재 서비스가 활성화되어 있어요'
          : '🌙 현재 서비스가 일시 중단되어 있어요';
        UI.showToast(newVal ? '서비스가 활성화되었어요 🌟' : '서비스가 일시 중단되었어요 🌙', 'success');
      } catch (err) {
        // 실패 시 원상복구
        serviceToggle.checked = !newVal;
        UI.showToast(err.message || '저장에 실패했습니다.', 'error');
      }
    });

    // 한도 조절
    limitMinus.addEventListener('click', () => {
      if (pendingLimit > 0) {
        pendingLimit--;
        limitValue.textContent = pendingLimit;
      }
    });

    limitPlus.addEventListener('click', () => {
      if (pendingLimit < 50) {
        pendingLimit++;
        limitValue.textContent = pendingLimit;
      }
    });

    // 한도 저장
    saveLimitBtn.addEventListener('click', async () => {
      if (pendingLimit === currentSettings.dailyLimit) {
        UI.showToast('변경된 내용이 없어요.', 'warning');
        return;
      }
      UI.showLoading(saveLimitBtn, '저장 중...');
      try {
        await API.updateSettings({ dailyLimit: String(pendingLimit) }, adminToken);
        currentSettings.dailyLimit = pendingLimit;
        UI.showToast(`일일 한도가 ${pendingLimit}건으로 저장되었어요 ✨`, 'success');
      } catch (err) {
        UI.showToast(err.message || '저장에 실패했습니다.', 'error');
      } finally {
        UI.hideLoading(saveLimitBtn);
      }
    });
  }
})();
