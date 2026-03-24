/* ================================================
   설정 파일 - Apps Script 배포 후 URL을 입력하세요
   ================================================ */

const CONFIG = Object.freeze({
  // Google Apps Script 배포 URL
  // 배포 후 아래 URL을 실제 URL로 교체하세요
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwhh2VnfeOPeqp2jsGr9t9yF6wMqYgxHV3z5Kx4Udd53_mWIYtKWE4nPICfV8SH4mWC/exec',

  // 앱 이름
  APP_NAME: '레타의 타로 상담',

  // 사연 글자 수 제한
  STORY_MIN: 50,
  STORY_MAX: 1000,

  // 후기 글자 수 제한
  FEEDBACK_MAX: 500,

  // Mock 모드: Apps Script 배포 전 UI 테스트용
  // 실제 배포 시 false로 변경
  MOCK_MODE: false,
});
