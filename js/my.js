/* ================================================
   my.js - 사용자 상담 페이지 로직 (5가지 상태)
   ================================================ */

(async function () {
  // 인증 확인
  const userRaw = sessionStorage.getItem('taroUser');
  if (!userRaw) {
    location.href = 'index.html';
    return;
  }
  const user = JSON.parse(userRaw);

  const mainContent = document.getElementById('main-content');
  const headerNickname = document.getElementById('header-nickname');
  const logoutBtn = document.getElementById('logout-btn');

  headerNickname.textContent = user.nickname + '님';

  logoutBtn.addEventListener('click', () => {
    UI.showModal(`
      <div class="modal-box__title">로그아웃 하시겠어요?</div>
      <p class="hint text-center">로그아웃 후에는 닉네임과 비밀번호로 다시 로그인할 수 있어요.</p>
      <div class="modal-box__actions">
        <button class="btn btn--secondary" onclick="UI.closeModal()">취소</button>
        <button class="btn btn--primary" onclick="sessionStorage.removeItem('taroUser'); location.href='index.html'">로그아웃</button>
      </div>
    `);
  });

  // 데이터 로드
  await loadPage();

  async function loadPage() {
    mainContent.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>불러오는 중...</p></div>`;
    try {
      const [slotResult, consultResult] = await Promise.all([
        API.getRemainingSlots(),
        API.getUserConsultation(user.nickname, user.password),
      ]);
      renderState(slotResult, consultResult.consultation);
    } catch (err) {
      if (err.code === 'AUTH_FAILED') {
        sessionStorage.removeItem('taroUser');
        location.href = 'index.html';
      } else {
        mainContent.innerHTML = `
          <div class="card text-center">
            <span class="status-icon">😔</span>
            <p class="status-title">오류가 발생했어요</p>
            <p class="hint mt-sm">${UI.escapeHtml(err.message)}</p>
            <button class="btn btn--secondary mt-md" onclick="location.reload()">다시 시도</button>
          </div>
        `;
      }
    }
  }

  /* ── 상태별 렌더링 ── */
  function renderState(slotResult, consultation) {
    const status = consultation ? consultation.status : null;

    // 상태 1: 신규 + 슬롯 없음 또는 서비스 비활성
    if (!consultation && (!slotResult.serviceActive || slotResult.remaining <= 0)) {
      renderClosed(slotResult.serviceActive);
      return;
    }
    // 상태 2: 신규 + 슬롯 있음 → 신청 폼
    if (!consultation) {
      renderNewForm(slotResult.remaining, slotResult.dailyLimit);
      return;
    }
    // 상태 3: 대기중
    if (status === 'pending') {
      renderPending(consultation);
      return;
    }
    // 상태 4: 답변 완료
    if (status === 'answered') {
      renderAnswered(consultation);
      return;
    }
    // 상태 5: 거절
    if (status === 'rejected') {
      renderRejected(consultation, slotResult);
      return;
    }
  }

  /* ── 상태 1: 마감 ── */
  function renderClosed(serviceActive) {
    mainContent.innerHTML = `
      <div class="card card--magical">
        <div class="status-section">
          <span class="status-icon">${serviceActive ? '🌙' : '✨'}</span>
          <h2 class="status-title">${serviceActive ? '오늘은 마감되었어요' : '서비스 준비 중이에요'}</h2>
          <p class="status-desc">${serviceActive
            ? '오늘의 상담 신청이 모두 마감되었어요.\n내일 다시 찾아와 주세요 🌸'
            : '현재 서비스가 일시 중단 중이에요.\n조금만 기다려 주세요 ✨'}</p>
        </div>
      </div>
      <div class="text-center">
        <a href="index.html" class="btn btn--secondary">← 메인으로</a>
      </div>
    `;
  }

  /* ── 상태 2: 신규 사용자 신청 폼 ── */
  function renderNewForm(remaining, total) {
    mainContent.innerHTML = `
      <div class="card card--magical" style="animation-delay:0s;">
        <div class="slot-counter" style="padding: var(--sp-md) 0;">
          <div class="slot-counter__label">✦ 오늘의 남은 상담 ✦</div>
          <div><span class="slot-counter__number">${remaining}</span><span class="slot-counter__total"> / ${total}</span></div>
        </div>
      </div>

      <div class="card" id="consent-card" style="animation-delay:0.08s;">
        <div class="card__title">상담 전 동의</div>
        <div class="consent-box">
          <p class="consent-text">
            📜 <strong>콘텐츠 활용 동의 안내</strong><br><br>
            제출하신 사연과 답변은 익명으로 처리되어 인스타그램 웹툰 콘텐츠 제작에 활용될 수 있습니다.<br><br>
            개인을 특정할 수 있는 정보는 수집하지 않으며, 닉네임도 변경하여 사용될 수 있습니다.<br><br>
            동의하지 않으실 경우에도 상담은 정상적으로 진행되며, 해당 사연은 콘텐츠로 제작되지 않습니다.
          </p>
          <div style="display:flex;flex-direction:column;gap:var(--sp-sm);margin-top:var(--sp-sm);">
            <label class="consent-check">
              <input type="radio" name="consent" id="consent-yes" value="yes">
              <span class="consent-check__label">위 내용을 읽었으며, 콘텐츠 활용에 동의합니다</span>
            </label>
            <label class="consent-check">
              <input type="radio" name="consent" id="consent-no" value="no">
              <span class="consent-check__label">동의하지 않습니다</span>
            </label>
          </div>
          <p class="error-msg hidden" id="consent-error">항목을 선택해주세요.</p>
        </div>
        <button class="btn btn--primary btn--full mt-md" id="consent-next-btn">다음으로 →</button>
      </div>

      <div class="card hidden" id="story-card" style="animation-delay:0.16s;">
        <div class="card__title">사연 작성</div>
        <p class="hint mb-md">✍️ 고민이나 상황을 자유롭게 적어주세요. 구체적일수록 좋은 답변을 드릴 수 있어요.</p>
        <div class="form-group">
          <label class="label" for="story-input">나의 이야기</label>
          <textarea
            class="textarea"
            id="story-input"
            placeholder="예) 요즘 직장에서 인간관계가 너무 힘들어요. 특히 상사와의 갈등이 심한데..."
            style="min-height: 180px;"
          ></textarea>
          <div class="char-counter" id="story-counter">0 / ${CONFIG.STORY_MAX}자 (최소 ${CONFIG.STORY_MIN}자)</div>
        </div>
        <p class="error-msg hidden" id="story-error"></p>
        <div class="flex-between" style="gap: var(--sp-sm);">
          <button class="btn btn--secondary" id="story-back-btn">← 이전</button>
          <button class="btn btn--accent" id="submit-btn">✨ 상담 신청하기</button>
        </div>
      </div>
    `;

    const consentNextBtn = document.getElementById('consent-next-btn');
    const consentError = document.getElementById('consent-error');
    const consentCard = document.getElementById('consent-card');
    const storyCard = document.getElementById('story-card');
    const storyInput = document.getElementById('story-input');
    const storyCounter = document.getElementById('story-counter');
    const storyError = document.getElementById('story-error');
    const storyBackBtn = document.getElementById('story-back-btn');
    const submitBtn = document.getElementById('submit-btn');

    // 라디오 선택 시 에러 숨기기
    document.querySelectorAll('input[name="consent"]').forEach(radio => {
      radio.addEventListener('change', () => consentError.classList.add('hidden'));
    });

    // 동의 다음 버튼
    consentNextBtn.addEventListener('click', () => {
      const selected = document.querySelector('input[name="consent"]:checked');
      if (!selected) {
        consentError.classList.remove('hidden');
        return;
      }
      consentCard.classList.add('hidden');
      storyCard.classList.remove('hidden');
      storyInput.focus();
    });

    // 뒤로가기
    storyBackBtn.addEventListener('click', () => {
      storyCard.classList.add('hidden');
      consentCard.classList.remove('hidden');
    });

    // 글자 수 카운터
    storyInput.addEventListener('input', () => {
      const len = storyInput.value.length;
      storyCounter.textContent = `${len} / ${CONFIG.STORY_MAX}자 (최소 ${CONFIG.STORY_MIN}자)`;
      storyCounter.className = 'char-counter';
      if (len > CONFIG.STORY_MAX) storyCounter.classList.add('char-counter--error');
      else if (len < CONFIG.STORY_MIN && len > 0) storyCounter.classList.add('char-counter--warning');
      storyError.classList.add('hidden');
    });

    // 제출
    submitBtn.addEventListener('click', async () => {
      const story = storyInput.value.trim();
      if (story.length < CONFIG.STORY_MIN) {
        storyError.textContent = `최소 ${CONFIG.STORY_MIN}자 이상 작성해주세요.`;
        storyError.classList.remove('hidden');
        return;
      }
      if (story.length > CONFIG.STORY_MAX) {
        storyError.textContent = `${CONFIG.STORY_MAX}자 이하로 작성해주세요.`;
        storyError.classList.remove('hidden');
        return;
      }

      // 확인 모달
      UI.showModal(`
        <div class="modal-box__title">상담을 신청하시겠어요?</div>
        <div class="story-card" style="max-height:120px; overflow-y:auto; font-size:var(--fs-xs); margin:var(--sp-sm) 0;">${UI.nl2br(story.slice(0, 200))}${story.length > 200 ? '...' : ''}</div>
        <p class="hint text-center mt-sm">✦ 제출 후에는 수정이 어려워요</p>
        <div class="modal-box__actions">
          <button class="btn btn--secondary" onclick="UI.closeModal()">다시 확인</button>
          <button class="btn btn--accent" id="confirm-submit-btn">신청하기 ✨</button>
        </div>
      `);

      document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
        UI.closeModal();
        UI.showLoading(submitBtn, '신청 중...');
        try {
          const consentSelected = document.querySelector('input[name="consent"]:checked');
          const consentGiven = consentSelected ? consentSelected.value === 'yes' : false;
          await API.submitConsultation(user.nickname, user.password, story, consentGiven);
          UI.showToast('상담이 신청되었어요! ✨', 'success');
          await loadPage();
        } catch (err) {
          UI.showToast(err.message || '오류가 발생했습니다.', 'error');
          UI.hideLoading(submitBtn);
        }
      });
    });
  }

  /* ── 상태 3: 대기중 ── */
  function renderPending(c) {
    mainContent.innerHTML = `
      <div class="card card--magical" style="animation-delay:0s;">
        <div class="status-section">
          <span class="status-icon">🔮</span>
          <h2 class="status-title">답변을 기다리는 중이에요</h2>
          <p class="status-desc">사연을 잘 받았어요! 레타가 카드를 살펴보고\n정성껏 답변을 드릴게요 ✨</p>
          <span class="badge badge--pending mt-md" style="display:inline-flex;">⏳ 대기중</span>
        </div>
      </div>

      <div class="card" style="animation-delay:0.08s;">
        <div class="card__title">나의 이야기</div>
        <div class="card-label">
          <span>✍️ 제출한 사연</span>
          <span class="meta-date">${UI.formatDate(c.createdAt)}</span>
        </div>
        <div class="story-card">${UI.nl2br(c.story)}</div>
        <p class="hint mt-md text-center">📬 답변이 완료되면 이 페이지에서 확인하실 수 있어요</p>
      </div>

      <div class="text-center">
        <button class="btn btn--ghost" onclick="loadPage()">🔄 새로고침</button>
      </div>
    `;

    // loadPage를 전역에서 접근 가능하게
    window.loadPage = loadPage;
  }

  /* ── 상태 4: 답변 완료 ── */
  function renderAnswered(c) {
    const hasFeedback = c.feedback && c.feedback.trim();

    mainContent.innerHTML = `
      <div class="card card--magical" style="animation-delay:0s;">
        <div class="status-section">
          <span class="status-icon" style="animation-duration:5s;">🌟</span>
          <h2 class="status-title">답변이 도착했어요!</h2>
          <p class="status-desc">레타가 ${UI.escapeHtml(c.nickname)}님만을 위한\n타로 메시지를 전해드려요 ✨</p>
          <span class="badge badge--answered mt-md" style="display:inline-flex;">✅ 답변 완료</span>
        </div>
      </div>

      <div class="card" style="animation-delay:0.08s;">
        <div class="card__title">나의 이야기</div>
        <div class="card-label">
          <span>✍️ 제출한 사연</span>
          <span class="meta-date">${UI.formatDate(c.createdAt)}</span>
        </div>
        <div class="story-card">${UI.nl2br(c.story)}</div>
      </div>

      <div class="card card--glow" style="animation-delay:0.16s;">
        <div class="card__title">레타의 답변</div>
        <div class="card-label">
          <span>🌙 타로 메시지</span>
          <span class="meta-date">${UI.formatDate(c.answeredAt)}</span>
        </div>
        <div class="answer-card">${UI.nl2br(c.answer)}</div>
      </div>

      ${hasFeedback ? renderFeedbackSubmitted(c.feedback) : renderFeedbackForm(c.id)}
    `;

    if (!hasFeedback) {
      setupFeedbackForm(c);
    }
  }

  function renderFeedbackForm(id) {
    return `
      <div class="card" style="animation-delay:0.24s;" id="feedback-section">
        <div class="card__title">후기 남기기</div>
        <p class="hint mb-md">🌸 답변이 도움이 되었다면 짧은 후기를 남겨주세요 (선택)</p>
        <div class="feedback-box">
          <textarea class="textarea" id="feedback-input"
            placeholder="예) 정말 위로가 됐어요. 감사합니다!"
            style="min-height:90px; background:transparent; border-color:transparent;"
            maxlength="${CONFIG.FEEDBACK_MAX}"></textarea>
          <div class="char-counter" id="feedback-counter">0 / ${CONFIG.FEEDBACK_MAX}자</div>
        </div>
        <button class="btn btn--accent btn--full mt-md" id="feedback-submit-btn">후기 제출하기 🌸</button>
      </div>
    `;
  }

  function renderFeedbackSubmitted(feedback) {
    return `
      <div class="card" style="animation-delay:0.24s;">
        <div class="card__title">나의 후기</div>
        <div class="feedback-box">
          <p class="feedback-submitted">"${UI.nl2br(feedback)}"</p>
        </div>
        <p class="hint text-center mt-sm">💜 소중한 후기 감사해요!</p>
      </div>
    `;
  }

  function setupFeedbackForm(c) {
    const feedbackInput = document.getElementById('feedback-input');
    const feedbackCounter = document.getElementById('feedback-counter');
    const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');

    if (!feedbackInput) return;

    feedbackInput.addEventListener('input', () => {
      feedbackCounter.textContent = `${feedbackInput.value.length} / ${CONFIG.FEEDBACK_MAX}자`;
    });

    feedbackSubmitBtn.addEventListener('click', async () => {
      const feedback = feedbackInput.value.trim();
      if (!feedback) {
        UI.showToast('후기 내용을 입력해주세요.', 'warning');
        return;
      }
      UI.showLoading(feedbackSubmitBtn, '제출 중...');
      try {
        await API.submitFeedback(c.id, user.nickname, user.password, feedback);
        UI.showToast('후기가 전달되었어요 🌸', 'success');
        // 해당 섹션만 교체
        const section = document.getElementById('feedback-section');
        if (section) section.outerHTML = renderFeedbackSubmitted(feedback);
      } catch (err) {
        UI.showToast(err.message || '오류가 발생했습니다.', 'error');
        UI.hideLoading(feedbackSubmitBtn);
      }
    });
  }

  /* ── 상태 5: 거절 ── */
  function renderRejected(c, slotResult) {
    const canApply = slotResult.serviceActive && slotResult.remaining > 0;
    mainContent.innerHTML = `
      <div class="card card--magical" style="animation-delay:0s;">
        <div class="status-section">
          <span class="status-icon">🌸</span>
          <h2 class="status-title">이번 상담은 어렵게 됐어요</h2>
          <p class="status-desc">죄송해요, 이번 사연은 진행이 어려운 상황이에요.\n다음에 새로운 이야기로 다시 찾아주세요 💜</p>
          <span class="badge badge--rejected mt-md" style="display:inline-flex;">🌙 상담 종료</span>
        </div>
      </div>

      ${canApply ? `
      <div class="card text-center" style="animation-delay:0.08s;">
        <p class="hint mb-md">새로운 이야기로 다시 신청하실 수 있어요 ✨</p>
        <button class="btn btn--primary" id="reapply-btn">새 상담 신청하기 ✨</button>
      </div>
      ` : `
      <div class="card text-center text-muted" style="animation-delay:0.08s;">
        오늘의 상담은 마감되었어요. 내일 다시 찾아주세요 🌙
      </div>
      `}
    `;

    const reapplyBtn = document.getElementById('reapply-btn');
    if (reapplyBtn) {
      reapplyBtn.addEventListener('click', () => {
        renderNewForm(slotResult.remaining, slotResult.dailyLimit);
      });
    }
  }
})();
