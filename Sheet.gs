// ================================================
// Sheet.gs - Google Sheets 초기화 및 유틸리티
// Apps Script 편집기에서 이 함수를 직접 실행하여 시트를 초기화하세요
// ================================================

/**
 * 초기 설정 함수 - Apps Script 편집기에서 직접 실행하세요
 * 실행 방법: Sheet.gs 파일 선택 → initializeSheets 함수 선택 → ▶ 실행
 */
function initializeSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // ── Consultations 시트 초기화 ──
  var consultSheet = ss.getSheetByName(CONSULTATIONS_SHEET);
  if (!consultSheet) {
    consultSheet = ss.insertSheet(CONSULTATIONS_SHEET);
  }
  if (consultSheet.getLastRow() === 0) {
    consultSheet.appendRow([
      'id',
      'created_at',
      'nickname',
      'password',      // SHA-256 해시 저장
      'consent',
      'story',
      'answer',
      'status',        // pending / answered / rejected
      'feedback',
      'answered_at',
    ]);
    // 헤더 스타일
    consultSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    consultSheet.setFrozenRows(1);
    // 열 너비 설정
    consultSheet.setColumnWidth(1, 200);  // id
    consultSheet.setColumnWidth(2, 150);  // created_at
    consultSheet.setColumnWidth(3, 100);  // nickname
    consultSheet.setColumnWidth(4, 200);  // password
    consultSheet.setColumnWidth(5, 70);   // consent
    consultSheet.setColumnWidth(6, 300);  // story
    consultSheet.setColumnWidth(7, 300);  // answer
    consultSheet.setColumnWidth(8, 80);   // status
    consultSheet.setColumnWidth(9, 200);  // feedback
    consultSheet.setColumnWidth(10, 150); // answered_at
  }

  // ── Settings 시트 초기화 ──
  var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET);
  }
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['daily_limit', 'today_count', 'service_active', 'last_reset_date']);
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    settingsSheet.appendRow([10, 0, true, today]);
    settingsSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    settingsSheet.setFrozenRows(1);
  }

  Logger.log('✅ 시트 초기화 완료!');
  Logger.log('Consultations 시트: ' + consultSheet.getSheetId());
  Logger.log('Settings 시트: ' + settingsSheet.getSheetId());
}

/**
 * 관리자 비밀번호 설정 함수
 * 사용법: setAdminPassword 함수에서 아래 password 변수를 원하는 비밀번호로 변경 후 실행
 */
function setAdminPassword() {
  var password = 'YOUR_ADMIN_PASSWORD_HERE'; // ← 여기를 변경하세요!

  // SHA-256 해시 계산
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password
  );
  var hash = bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');

  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  Logger.log('✅ 관리자 비밀번호가 설정되었습니다.');
  Logger.log('해시: ' + hash.substring(0, 10) + '...');
}

/**
 * 설정 상태 확인 함수 - 실행하여 현재 설정을 확인
 */
function checkSetup() {
  var adminHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  Logger.log('관리자 비밀번호 설정: ' + (adminHash ? '✅ 완료' : '❌ 미설정'));

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var consultSheet = ss.getSheetByName(CONSULTATIONS_SHEET);
    var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
    Logger.log('Consultations 시트: ' + (consultSheet ? '✅ 존재' : '❌ 없음'));
    Logger.log('Settings 시트: ' + (settingsSheet ? '✅ 존재' : '❌ 없음'));

    if (settingsSheet && settingsSheet.getLastRow() >= 2) {
      var row = settingsSheet.getRange(2, 1, 1, 4).getValues()[0];
      Logger.log('일일 한도: ' + row[0]);
      Logger.log('오늘 카운트: ' + row[1]);
      Logger.log('서비스 활성화: ' + row[2]);
      Logger.log('마지막 리셋: ' + row[3]);
    }
  } catch (err) {
    Logger.log('❌ 시트 접근 오류: ' + err.toString());
    Logger.log('SHEET_ID가 올바른지 확인해주세요: ' + SHEET_ID);
  }
}

/**
 * 테스트용: doGet 함수를 직접 테스트
 */
function testGetRemainingSlots() {
  var result = doGet({ parameter: { action: 'getRemainingSlots' } });
  Logger.log(result.getContent());
}
