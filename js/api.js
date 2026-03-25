/* ================================================
   API 모듈 - Google Apps Script 통신 + Mock 모드
   ================================================ */

/* ── SHA-256 해싱 (Web Crypto API) ── */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── API 에러 클래스 ── */
class APIError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'APIError';
    this.code = code || 'UNKNOWN';
  }
}

/* ── 실제 API 호출 (GET 방식, CORS preflight 회피) ── */
async function callAPI(params) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new APIError(`서버 오류 (HTTP ${response.status})`, 'HTTP_ERROR');
  }

  const data = await response.json();

  if (data.success === false) {
    throw new APIError(data.message || '알 수 없는 오류가 발생했습니다', data.code);
  }

  return data;
}

/* ── POST API 호출 (긴 텍스트 전송용, Content-Type: text/plain → preflight 없음) ── */
async function callAPIPost(params) {
  const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new APIError(`서버 오류 (HTTP ${response.status})`, 'HTTP_ERROR');
  }

  const data = await response.json();

  if (data.success === false) {
    throw new APIError(data.message || '알 수 없는 오류가 발생했습니다', data.code);
  }

  return data;
}

/* ──────────────────────────────────────
   Mock 데이터 (MOCK_MODE: true 일 때 사용)
   ────────────────────────────────────── */
const _mockDB = {
  settings: {
    dailyLimit: 10,
    todayCount: 3,
    serviceActive: true,
    lastResetDate: new Date().toISOString().slice(0, 10),
  },
  consultations: [
    {
      id: 'mock-001',
      createdAt: '2025-03-20T10:30:00',
      nickname: '별빛소녀',
      passwordHash: '',
      consent: true,
      story: '최근 직장을 그만두고 새로운 일을 시작하려 하는데, 막막하고 두렵습니다. 이 선택이 옳은 건지 타로 카드로 봐주실 수 있을까요? 이미 계획은 세워뒀지만 자꾸만 흔들리네요.',
      answer: '별빛소녀님의 용기 있는 선택을 응원합니다 🌟\n\n뽑아주신 카드는 "별(The Star)"이에요. 이 카드는 희망과 새로운 시작을 의미해요. 두렵고 막막한 마음이 드는 건 당연하지만, 당신의 내면에는 이미 답이 있어요.\n\n변화를 두려워하지 마세요. 별이 어둠 속에서 빛나듯, 지금 이 시도가 훗날 당신의 빛이 될 거예요 ✨',
      status: 'answered',
      feedback: '정말 위로가 됐어요. 감사합니다!',
      answeredAt: '2025-03-21T14:00:00',
    },
    {
      id: 'mock-002',
      createdAt: '2025-03-22T09:00:00',
      nickname: '달토끼',
      passwordHash: '',
      consent: true,
      story: '좋아하는 사람이 생겼는데 고백을 해야 할지 모르겠어요. 오랜 친구인데 사귀다가 잘못되면 어떡하나 걱정도 되고, 이 마음을 계속 숨기는 것도 힘드네요.',
      answer: '',
      status: 'pending',
      feedback: '',
      answeredAt: '',
    },
  ],
};

async function mockCallAPI(params) {
  // 네트워크 딜레이 시뮬레이션
  await new Promise(r => setTimeout(r, 400 + Math.random() * 300));

  const action = params.action;

  if (action === 'getRemainingSlots') {
    const { settings } = _mockDB;
    return {
      success: true,
      remaining: Math.max(0, settings.dailyLimit - settings.todayCount),
      dailyLimit: settings.dailyLimit,
      serviceActive: settings.serviceActive,
    };
  }

  if (action === 'checkNickname') {
    const exists = _mockDB.consultations.some(c => c.nickname === params.nickname);
    return { success: true, exists };
  }

  if (action === 'getUserConsultation') {
    const { nickname, passwordHash } = params;
    const userConsults = _mockDB.consultations
      .filter(c => c.nickname === nickname)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (userConsults.length === 0) return { success: true, consultation: null, history: [] };
    const found = userConsults[0];
    if (found.passwordHash && found.passwordHash !== passwordHash) {
      throw new APIError('비밀번호가 올바르지 않습니다', 'AUTH_FAILED');
    }
    const history = userConsults.slice(1).filter(c => c.status === 'answered');
    return { success: true, consultation: found, history };
  }

  if (action === 'submitConsultation') {
    const settings = _mockDB.settings;
    if (!settings.serviceActive) throw new APIError('현재 서비스가 일시 중단 중입니다', 'SERVICE_INACTIVE');
    const remaining = settings.dailyLimit - settings.todayCount;
    if (remaining <= 0) throw new APIError('오늘의 상담이 마감되었습니다', 'NO_SLOTS');
    const existing = _mockDB.consultations.find(c => c.nickname === params.nickname && c.status === 'pending');
    if (existing) throw new APIError('이미 진행 중인 상담이 있습니다', 'ALREADY_PENDING');

    const newId = 'mock-' + Date.now();
    _mockDB.consultations.push({
      id: newId,
      createdAt: new Date().toISOString(),
      nickname: params.nickname,
      passwordHash: params.passwordHash,
      consent: params.consent === '1',
      story: params.story,
      answer: '',
      status: 'pending',
      feedback: '',
      answeredAt: '',
    });
    _mockDB.settings.todayCount++;
    return { success: true, id: newId };
  }

  if (action === 'submitFeedback') {
    const item = _mockDB.consultations.find(c => c.id === params.id);
    if (!item) throw new APIError('상담을 찾을 수 없습니다', 'NOT_FOUND');
    item.feedback = params.feedback;
    return { success: true };
  }

  if (action === 'adminLogin') {
    const adminHash = await sha256('admin1234'); // 기본 mock 비밀번호
    if (params.passwordHash !== adminHash) throw new APIError('비밀번호가 올바르지 않습니다', 'AUTH_FAILED');
    return { success: true, adminToken: 'mock-admin-token-' + Date.now() };
  }

  if (action === 'getConsultationList') {
    let list = [..._mockDB.consultations];
    if (params.status && params.status !== 'all') {
      list = list.filter(c => c.status === params.status);
    }
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, consultations: list };
  }

  if (action === 'submitAnswer') {
    const item = _mockDB.consultations.find(c => c.id === params.id);
    if (!item) throw new APIError('상담을 찾을 수 없습니다', 'NOT_FOUND');
    item.answer = params.answer;
    item.status = 'answered';
    item.answeredAt = new Date().toISOString();
    return { success: true };
  }

  if (action === 'updateStatus') {
    const item = _mockDB.consultations.find(c => c.id === params.id);
    if (!item) throw new APIError('상담을 찾을 수 없습니다', 'NOT_FOUND');
    item.status = params.status;
    return { success: true };
  }

  if (action === 'getSettings') {
    const total = _mockDB.consultations.length;
    const answered = _mockDB.consultations.filter(c => c.status === 'answered').length;
    const pending = _mockDB.consultations.filter(c => c.status === 'pending').length;
    return {
      success: true,
      settings: { ..._mockDB.settings },
      stats: { total, answered, pending, today: _mockDB.settings.todayCount },
    };
  }

  if (action === 'updateSettings') {
    if (params.dailyLimit !== undefined) {
      _mockDB.settings.dailyLimit = parseInt(params.dailyLimit, 10);
    }
    if (params.serviceActive !== undefined) {
      _mockDB.settings.serviceActive = params.serviceActive === 'true';
    }
    return { success: true };
  }

  throw new APIError('알 수 없는 액션입니다', 'UNKNOWN_ACTION');
}

/* ── API 공개 인터페이스 ── */
window.API = (() => {
  const call = CONFIG.MOCK_MODE ? mockCallAPI : callAPI;

  return {
    /* 사용자 API */
    getRemainingSlots: () =>
      call({ action: 'getRemainingSlots' }),

    getUserConsultation: async (nickname, password) => {
      const passwordHash = await sha256(password);
      return call({ action: 'getUserConsultation', nickname, passwordHash });
    },

    submitConsultation: async (nickname, password, story, consent) => {
      const passwordHash = await sha256(password);
      return call({ action: 'submitConsultation', nickname, passwordHash, story, consent: consent ? '1' : '0' });
    },

    submitFeedback: async (id, nickname, password, feedback) => {
      const passwordHash = await sha256(password);
      return call({ action: 'submitFeedback', id, nickname, passwordHash, feedback });
    },

    checkNickname: (nickname) =>
      call({ action: 'checkNickname', nickname }),

    /* 관리자 API */
    adminLogin: async (password) => {
      const passwordHash = await sha256(password);
      return call({ action: 'adminLogin', passwordHash });
    },

    getConsultationList: (status, adminToken) => {
      const params = { action: 'getConsultationList' };
      if (status && status !== 'all') params.status = status;
      if (adminToken) params.adminToken = adminToken;
      return call(params);
    },

    submitAnswer: (id, answer, adminToken) =>
      CONFIG.MOCK_MODE
        ? call({ action: 'submitAnswer', id, answer, adminToken })
        : callAPIPost({ action: 'submitAnswer', id, answer, adminToken }),

    updateStatus: (id, status, adminToken) =>
      call({ action: 'updateStatus', id, status, adminToken }),

    getSettings: (adminToken) =>
      call({ action: 'getSettings', adminToken }),

    updateSettings: (updates, adminToken) =>
      call({ action: 'updateSettings', ...updates, adminToken }),
  };
})();

/* ── UI 유틸리티 ── */
window.UI = (() => {
  // 토스트 컨테이너 생성
  let toastContainer = null;
  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  return {
    showLoading(btn, text = '처리 중...') {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = text;
      btn.disabled = true;
      btn.classList.add('btn--loading');
    },

    hideLoading(btn) {
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
      btn.disabled = false;
      btn.classList.remove('btn--loading');
    },

    showToast(message, type = 'info', duration = 3000) {
      const container = getToastContainer();
      const toast = document.createElement('div');
      toast.className = `toast${type !== 'info' ? ` toast--${type}` : ''}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    showModal(contentHTML, options = {}) {
      let overlay = document.getElementById('modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-box" id="modal-box"></div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => {
          if (e.target === overlay && !options.noClose) this.closeModal();
        });
      }
      document.getElementById('modal-box').innerHTML = contentHTML;
      requestAnimationFrame(() => overlay.classList.add('is-open'));
      return overlay;
    },

    closeModal() {
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 300);
      }
    },

    formatDate(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    },

    truncate(text, len = 60) {
      if (!text) return '';
      return text.length > len ? text.slice(0, len) + '...' : text;
    },

    escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    nl2br(str) {
      return this.escapeHtml(str).replace(/\n/g, '<br>');
    },
  };
})();
