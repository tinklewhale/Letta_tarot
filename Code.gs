// ================================================
// Code.gs - Google Apps Script 메인 라우터
// 배포: 실행 계정 = 나, 액세스 = 모든 사용자
// ================================================

// ── 설정 ──
// Google Sheet ID (URL에서 복사: /d/SHEET_ID/edit)
var SHEET_ID = '1Hw1MkdMCleE34ko24qtGH4CYqYBZToAVN-_dQGo20ao';
var CONSULTATIONS_SHEET = 'Consultations';
var SETTINGS_SHEET = 'Settings';

// ── 라우터 ──
function doGet(e) {
  var params = e.parameter || {};
  var action = params.action || '';
  var result;

  try {
    switch (action) {
      case 'getRemainingSlots':
        result = getRemainingSlots_(params); break;
      case 'getUserConsultation':
        result = getUserConsultation_(params); break;
      case 'submitConsultation':
        result = submitConsultation_(params); break;
      case 'submitFeedback':
        result = submitFeedback_(params); break;
      case 'adminLogin':
        result = adminLogin_(params); break;
      case 'getConsultationList':
        result = getConsultationList_(params); break;
      case 'submitAnswer':
        result = submitAnswer_(params); break;
      case 'updateStatus':
        result = updateStatus_(params); break;
      case 'checkNickname':
        result = checkNickname_(params); break;
      case 'getSettings':
        result = getSettings_(params); break;
      case 'updateSettings':
        result = updateSettings_(params); break;
      default:
        result = { success: false, message: '알 수 없는 액션입니다', code: 'UNKNOWN_ACTION' };
    }
  } catch (err) {
    console.error('doGet error:', err.toString());
    result = { success: false, message: '서버 오류가 발생했습니다', code: 'SERVER_ERROR' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST 라우터 (긴 텍스트 전송용) ──
function doPost(e) {
  var params = {};
  try {
    params = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: '잘못된 요청입니다', code: 'BAD_REQUEST' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return doGet({ parameter: params });
}

// ── 관리자 인증 ──
function adminLogin_(params) {
  var passwordHash = params.passwordHash || '';
  var storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');

  if (!storedHash) {
    return { success: false, message: '관리자 설정이 필요합니다', code: 'NOT_CONFIGURED' };
  }
  if (passwordHash !== storedHash) {
    return { success: false, message: '비밀번호가 올바르지 않습니다', code: 'AUTH_FAILED' };
  }

  var token = generateAdminToken_();
  return { success: true, adminToken: token };
}

function generateAdminToken_() {
  var hour = Math.floor(Date.now() / 3600000);
  var adminHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  var raw = adminHash + hour.toString();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function verifyAdminToken_(token) {
  if (!token) return false;
  var currentHour = Math.floor(Date.now() / 3600000);
  var adminHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');

  for (var offset = 0; offset <= 1; offset++) {
    var raw = adminHash + (currentHour - offset).toString();
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
    var hash = bytes.map(function(b) {
      return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
    }).join('');
    if (token === hash) return true;
  }
  return false;
}

// ── 잔여 슬롯 조회 ──
function getRemainingSlots_(params) {
  var settings = getSettingsRow_();
  resetDailyCountIfNeeded_(settings);
  settings = getSettingsRow_(); // 재조회

  return {
    success: true,
    remaining: Math.max(0, settings.dailyLimit - settings.todayCount),
    dailyLimit: settings.dailyLimit,
    serviceActive: settings.serviceActive,
  };
}

// ── 사용자 상담 조회 ──
function getUserConsultation_(params) {
  var nickname = sanitize_(params.nickname || '');
  var passwordHash = params.passwordHash || '';

  if (!nickname || !passwordHash) {
    return { success: false, message: '닉네임과 비밀번호를 입력해주세요', code: 'MISSING_PARAMS' };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();

  // 헤더: id(0) created_at(1) nickname(2) password(3) consent(4) story(5) answer(6) status(7) feedback(8) answered_at(9)
  var found = null;
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (row[2] === nickname) {
      if (row[3] && row[3] !== passwordHash) {
        return { success: false, message: '비밀번호가 올바르지 않습니다', code: 'AUTH_FAILED' };
      }
      found = rowToConsultation_(row);
      break;
    }
  }

  // 이전 답변 완료 상담 목록 (가장 최근 제외)
  var history = [];
  for (var j = 1; j < data.length; j++) {
    var hRow = data[j];
    if (hRow[2] === nickname && hRow[7] === 'answered' && (!found || hRow[0] !== found.id)) {
      history.push(rowToConsultation_(hRow));
    }
  }
  history.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  return { success: true, consultation: found, history: history };
}

// ── 닉네임 중복 확인 ──
function checkNickname_(params) {
  var nickname = sanitize_(params.nickname || '');
  if (!nickname) {
    return { success: true, exists: false };
  }
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === nickname) {
      return { success: true, exists: true };
    }
  }
  return { success: true, exists: false };
}

// ── 상담 신청 ──
function submitConsultation_(params) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var nickname = sanitize_(params.nickname || '');
    var passwordHash = params.passwordHash || '';
    var story = sanitize_(params.story || '');
    var consent = params.consent === '1';

    if (!nickname || !passwordHash || !story) {
      return { success: false, message: '필수 항목을 입력해주세요', code: 'MISSING_PARAMS' };
    }
    if (nickname.length < 2) {
      return { success: false, message: '닉네임은 2자 이상 입력해주세요', code: 'INVALID_NICKNAME' };
    }
    if (story.length < 50) {
      return { success: false, message: '사연은 최소 50자 이상 작성해주세요', code: 'STORY_TOO_SHORT' };
    }
    if (story.length > 1000) {
      return { success: false, message: '사연은 1000자 이하로 작성해주세요', code: 'STORY_TOO_LONG' };
    }

    var settings = getSettingsRow_();
    resetDailyCountIfNeeded_(settings);
    settings = getSettingsRow_();

    if (!settings.serviceActive) {
      return { success: false, message: '현재 서비스가 일시 중단 중입니다', code: 'SERVICE_INACTIVE' };
    }
    if (settings.dailyLimit - settings.todayCount <= 0) {
      return { success: false, message: '오늘의 상담이 마감되었습니다', code: 'NO_SLOTS' };
    }

    // 기존 대기중 상담 확인
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] === nickname && data[i][7] === 'pending') {
        return { success: false, message: '이미 진행 중인 상담이 있습니다', code: 'ALREADY_PENDING' };
      }
    }

    var newId = Utilities.getUuid();
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");

    sheet.appendRow([newId, now, nickname, passwordHash, consent, story, '', 'pending', '', '']);
    incrementTodayCount_();

    // 텔레그램 알림 (실패해도 상담 제출에 영향 없음)
    try {
      var msg = '🔮 <b>새 상담이 신청되었어요!</b>\n\n'
        + '👤 닉네임: ' + nickname + '\n'
        + '🕐 시간: ' + now + '\n'
        + '📋 동의: ' + (consent ? '✅ 동의' : '❌ 비동의') + '\n\n'
        + '📝 사연 미리보기:\n' + story.substring(0, 100) + (story.length > 100 ? '...' : '');
      sendTelegramNotification_(msg);
    } catch (e) {}

    return { success: true, id: newId };
  } finally {
    lock.releaseLock();
  }
}

// ── 후기 제출 ──
function submitFeedback_(params) {
  var id = params.id || '';
  var nickname = sanitize_(params.nickname || '');
  var passwordHash = params.passwordHash || '';
  var feedback = sanitize_(params.feedback || '');

  if (!id || !nickname || !passwordHash || !feedback) {
    return { success: false, message: '필수 항목을 입력해주세요', code: 'MISSING_PARAMS' };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id && data[i][2] === nickname && data[i][3] === passwordHash) {
      sheet.getRange(i + 1, 9).setValue(feedback); // feedback 컬럼 (0-indexed 8 → 1-indexed 9)

      // 텔레그램 알림 (실패해도 후기 제출에 영향 없음)
      try {
        var fbMsg = '🌸 <b>후기가 등록되었어요!</b>\n\n'
          + '👤 닉네임: ' + nickname + '\n\n'
          + '💬 후기:\n' + feedback.substring(0, 200);
        sendTelegramNotification_(fbMsg);
      } catch (e) {}

      return { success: true };
    }
  }

  return { success: false, message: '상담을 찾을 수 없습니다', code: 'NOT_FOUND' };
}

// ── 관리자: 상담 목록 조회 ──
function getConsultationList_(params) {
  if (!verifyAdminToken_(params.adminToken)) {
    return { success: false, message: '인증이 필요합니다', code: 'AUTH_FAILED' };
  }

  var statusFilter = params.status || '';
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();

  var consultations = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (statusFilter && row[7] !== statusFilter) continue;
    consultations.push(rowToConsultation_(row));
  }

  // 최신순 정렬
  consultations.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return { success: true, consultations: consultations };
}

// ── 관리자: 답변 저장 ──
function submitAnswer_(params) {
  if (!verifyAdminToken_(params.adminToken)) {
    return { success: false, message: '인증이 필요합니다', code: 'AUTH_FAILED' };
  }

  var id = params.id || '';
  var answer = sanitize_(params.answer || '');
  if (!id || !answer) {
    return { success: false, message: '필수 항목을 입력해주세요', code: 'MISSING_PARAMS' };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss");

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 7).setValue(answer);      // answer
      sheet.getRange(i + 1, 8).setValue('answered');  // status
      sheet.getRange(i + 1, 10).setValue(now);        // answered_at
      return { success: true };
    }
  }

  return { success: false, message: '상담을 찾을 수 없습니다', code: 'NOT_FOUND' };
}

// ── 관리자: 상태 변경 ──
function updateStatus_(params) {
  if (!verifyAdminToken_(params.adminToken)) {
    return { success: false, message: '인증이 필요합니다', code: 'AUTH_FAILED' };
  }

  var id = params.id || '';
  var status = params.status || '';
  var validStatuses = ['pending', 'answered', 'rejected'];
  if (!id || validStatuses.indexOf(status) === -1) {
    return { success: false, message: '올바르지 않은 요청입니다', code: 'INVALID_PARAMS' };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 8).setValue(status);
      return { success: true };
    }
  }

  return { success: false, message: '상담을 찾을 수 없습니다', code: 'NOT_FOUND' };
}

// ── 관리자: 설정 조회 ──
function getSettings_(params) {
  if (!verifyAdminToken_(params.adminToken)) {
    return { success: false, message: '인증이 필요합니다', code: 'AUTH_FAILED' };
  }

  var settings = getSettingsRow_();

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONSULTATIONS_SHEET);
  var data = sheet.getDataRange().getValues();
  var total = Math.max(0, data.length - 1);
  var answered = 0, pending = 0;

  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var todayCount = 0;

  for (var i = 1; i < data.length; i++) {
    var s = data[i][7];
    if (s === 'answered') answered++;
    if (s === 'pending') pending++;
    var createdAt = String(data[i][1] || '');
    if (createdAt.startsWith(today)) todayCount++;
  }

  return {
    success: true,
    settings: settings,
    stats: { total: total, answered: answered, pending: pending, today: todayCount },
  };
}

// ── 관리자: 설정 저장 ──
function updateSettings_(params) {
  if (!verifyAdminToken_(params.adminToken)) {
    return { success: false, message: '인증이 필요합니다', code: 'AUTH_FAILED' };
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_SHEET);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: false, message: '설정 시트가 초기화되지 않았습니다', code: 'NOT_INITIALIZED' };
  }

  if (params.dailyLimit !== undefined) {
    var limit = parseInt(params.dailyLimit, 10);
    if (!isNaN(limit) && limit >= 0 && limit <= 50) {
      sheet.getRange(2, 1).setValue(limit);
    }
  }
  if (params.serviceActive !== undefined) {
    sheet.getRange(2, 3).setValue(params.serviceActive === 'true');
  }

  return { success: true };
}

// ── 헬퍼 함수들 ──

function getSettingsRow_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_SHEET);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    // 기본값 초기화
    initSettings_();
    data = sheet.getDataRange().getValues();
  }
  var row = data[1];
  var rawDate = row[3];
  var lastResetDate = rawDate instanceof Date
    ? Utilities.formatDate(rawDate, 'Asia/Seoul', 'yyyy-MM-dd')
    : String(rawDate || '');
  return {
    dailyLimit:    parseInt(row[0], 10) || 10,
    todayCount:    parseInt(row[1], 10) || 0,
    serviceActive: row[2] !== false && row[2] !== 'FALSE',
    lastResetDate: lastResetDate,
  };
}

function initSettings_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_SHEET);
  sheet.clearContents();
  sheet.appendRow(['daily_limit', 'today_count', 'service_active', 'last_reset_date']);
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  sheet.appendRow([10, 0, true, today]);
}

function resetDailyCountIfNeeded_(settings) {
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  if (settings.lastResetDate !== today) {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_SHEET);
    sheet.getRange(2, 2).setValue(0);      // today_count
    sheet.getRange(2, 4).setValue(today);  // last_reset_date
  }
}

function incrementTodayCount_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SETTINGS_SHEET);
  var current = parseInt(sheet.getRange(2, 2).getValue(), 10) || 0;
  sheet.getRange(2, 2).setValue(current + 1);
}

function rowToConsultation_(row) {
  return {
    id:          String(row[0] || ''),
    createdAt:   String(row[1] || ''),
    nickname:    String(row[2] || ''),
    consent:     row[4] === true || row[4] === 'TRUE',
    story:       String(row[5] || ''),
    answer:      String(row[6] || ''),
    status:      String(row[7] || 'pending'),
    feedback:    String(row[8] || ''),
    answeredAt:  String(row[9] || ''),
  };
  // 비밀번호 해시(row[3])는 반환하지 않음
}

function sanitize_(str) {
  // CSV 인젝션 방지: 셀 값 앞의 수식 문자 제거
  return String(str).replace(/^[=+\-@\t\r]/, "'$&").trim();
}

// ── 텔레그램 알림 ──
function sendTelegramNotification_(message) {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return; // 설정 없으면 조용히 스킵

  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    }),
    muteHttpExceptions: true
  });
}
