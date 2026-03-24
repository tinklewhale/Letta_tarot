/* ================================================
   index.js - 메인 페이지 로직
   ================================================ */

(async function () {
  const loginForm = document.getElementById('login-form');
  const nicknameInput = document.getElementById('nickname');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const slotDisplay = document.getElementById('slot-display');
  const nicknameError = document.getElementById('nickname-error');
  const nicknameInfo  = document.getElementById('nickname-info');
  const passwordError = document.getElementById('password-error');
  const formError = document.getElementById('form-error');

  // 이미 로그인된 세션이 있으면 my.html로
  const savedUser = sessionStorage.getItem('taroUser');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    // 세션이 있어도 재로그인 옵션 제공
    showReturningUserHint(user.nickname);
  }

  // 잔여 상담 수 로드
  await loadSlotCount();

  // 폼 제출
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;

    UI.showLoading(loginBtn, '확인 중...');
    clearErrors();

    try {
      const result = await API.getUserConsultation(nickname, password);
      // 성공: 세션 저장 후 my.html로
      sessionStorage.setItem('taroUser', JSON.stringify({ nickname, password }));
      location.href = 'my.html';
    } catch (err) {
      if (err.code === 'AUTH_FAILED') {
        showError(passwordError, '비밀번호가 올바르지 않습니다.');
        passwordInput.classList.add('input--error');
        passwordInput.focus();
      } else if (err.code === 'SERVICE_INACTIVE') {
        showError(formError, '현재 서비스가 일시 중단 중입니다. 잠시 후 다시 시도해주세요 🌙');
      } else {
        showError(formError, err.message || '오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      UI.hideLoading(loginBtn);
    }
  });

  // 비밀번호 표시/숨기기 토글
  const EYE_ON  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  document.getElementById('pw-toggle').addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    document.getElementById('pw-toggle').innerHTML = isHidden ? EYE_OFF : EYE_ON;
  });

  // 닉네임 포커스 해제 시 중복 확인
  nicknameInput.addEventListener('blur', async () => {
    const nickname = nicknameInput.value.trim();
    nicknameInfo.classList.add('hidden');
    nicknameInfo.textContent = '';
    if (nickname.length < 2) return;
    try {
      const result = await API.checkNickname(nickname);
      if (result.exists) {
        nicknameInfo.textContent = '이미 사용 중인 닉네임이에요. 다른 닉네임을 사용하거나, 기존 상담이 있으시면 입장 후 [상담 조회]에서 확인해보세요.';
        nicknameInfo.classList.remove('hidden');
      }
    } catch (_) {
      // 중복 확인 실패는 조용히 무시 (UX 차단 안 함)
    }
  });

  // 입력 시 에러·안내 초기화
  nicknameInput.addEventListener('input', () => {
    nicknameInput.classList.remove('input--error');
    nicknameError.classList.add('hidden');
    nicknameInfo.classList.add('hidden');
    nicknameInfo.textContent = '';
    formError.classList.add('hidden');
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('input--error');
    passwordError.classList.add('hidden');
    formError.classList.add('hidden');
  });

  /* ── 잔여 상담 수 로드 ── */
  async function loadSlotCount() {
    try {
      const result = await API.getRemainingSlots();
      renderSlotCount(result.remaining, result.dailyLimit, result.serviceActive);
    } catch (err) {
      slotDisplay.innerHTML = `
        <div class="text-center" style="padding: var(--sp-sm) 0;">
          <span style="font-size: var(--fs-sm); color: var(--color-text-light);">상담 현황을 불러오는 중입니다...</span>
        </div>
      `;
    }
  }

  function renderSlotCount(remaining, total, serviceActive) {
    if (!serviceActive) {
      slotDisplay.innerHTML = `
        <div class="slot-counter slot-counter--closed">
          <div class="slot-counter__label">✦ 오늘의 상담 현황 ✦</div>
          <span class="slot-counter__number">🌙</span>
          <div class="slot-counter__subtitle">서비스가 일시 중단되었습니다</div>
        </div>
      `;
      return;
    }

    if (remaining <= 0) {
      slotDisplay.innerHTML = `
        <div class="slot-counter slot-counter--closed">
          <div class="slot-counter__label">✦ 오늘의 상담 현황 ✦</div>
          <span class="slot-counter__number" style="font-size: var(--fs-xl); color: #C0B0C8;">마감</span>
          <div class="slot-counter__subtitle">오늘의 상담이 마감되었어요 🌙<br>내일 또 만나요!</div>
        </div>
      `;
      // 로그인 버튼 비활성화
      loginBtn.disabled = true;
      loginBtn.textContent = '오늘은 마감되었어요 🌙';
      return;
    }

    const pct = Math.round((remaining / total) * 100);
    const urgency = remaining <= 2 ? '⚡ 마감 임박!' : remaining <= Math.ceil(total / 2) ? '✦ 여유 있어요' : '✨ 충분해요';

    slotDisplay.innerHTML = `
      <div class="slot-counter">
        <div class="slot-counter__label">✦ 오늘의 남은 상담 ✦</div>
        <div>
          <span class="slot-counter__number">${remaining}</span><span class="slot-counter__total"> / ${total}</span>
        </div>
        <div class="slot-counter__subtitle">${urgency}</div>
      </div>
    `;
  }

  /* ── 유효성 검사 ── */
  function validateForm() {
    let valid = true;
    clearErrors();

    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;

    if (!nickname) {
      showError(nicknameError, '닉네임을 입력해주세요.');
      nicknameInput.classList.add('input--error');
      nicknameInput.focus();
      valid = false;
    } else if (nickname.length < 2) {
      showError(nicknameError, '닉네임은 2자 이상 입력해주세요.');
      nicknameInput.classList.add('input--error');
      valid = false;
    }

    if (!password) {
      showError(passwordError, '비밀번호를 입력해주세요.');
      passwordInput.classList.add('input--error');
      if (valid) passwordInput.focus();
      valid = false;
    } else if (password.length < 8) {
      showError(passwordError, '비밀번호는 8자 이상 입력해주세요.');
      passwordInput.classList.add('input--error');
      valid = false;
    } else if (!/[A-Z]/.test(password) && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      showError(passwordError, '대문자 또는 특수문자를 1개 이상 포함해주세요.');
      passwordInput.classList.add('input--error');
      valid = false;
    }

    return valid;
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearErrors() {
    [nicknameError, passwordError, formError].forEach(el => {
      el.textContent = '';
      el.classList.add('hidden');
    });
    nicknameInput.classList.remove('input--error');
    passwordInput.classList.remove('input--error');
  }

  /* ── 재방문 사용자 힌트 ── */
  function showReturningUserHint(nickname) {
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-bottom: var(--sp-md);';
    hint.innerHTML = `
      <div class="card" style="padding: var(--sp-md); background: rgba(200,168,232,0.12); border-color: var(--color-primary);">
        <div class="flex-between" style="gap: var(--sp-sm);">
          <span class="hint">🌙 <strong>${UI.escapeHtml(nickname)}</strong>님으로 로그인되어 있어요</span>
          <div style="display: flex; gap: var(--sp-xs);">
            <a href="my.html" class="btn btn--primary btn--sm">내 상담 보기</a>
            <button class="btn btn--ghost btn--sm" id="logout-btn">로그아웃</button>
          </div>
        </div>
      </div>
    `;
    loginForm.parentNode.insertBefore(hint, loginForm);
    nicknameInput.value = nickname;

    document.getElementById('logout-btn').addEventListener('click', () => {
      sessionStorage.removeItem('taroUser');
      hint.remove();
      nicknameInput.value = '';
    });
  }
})();
