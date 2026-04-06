import { useState } from 'react';
import { Loader2, Mail, User, AlertCircle } from 'lucide-react';
import { signInOrCreateWithEmailOnly } from '../auth-service';
import { createOrUpdateUser } from '../firestore-service';

function isPermissionDeniedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('missing or insufficient permissions') || message.includes('permission-denied');
}

export default function OnboardingView({ onComplete }) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (!email.trim()) {
        throw new Error('이메일을 입력해주세요.');
      }
      if (!email.includes('@')) {
        throw new Error('유효한 이메일 형식을 입력해주세요.');
      }

      const user = signInOrCreateWithEmailOnly(email.trim(), nickname.trim());

      // Firestore에 사용자 저장
      const displayName = nickname.trim() || user.displayName || '사용자';
      const finalUser = {
        ...user,
        name: displayName,
        joinedAt: new Date().toISOString(),
      };

      console.log('Firestore에 사용자 저장 시작:', finalUser.uid);
      try {
        await createOrUpdateUser(user.uid, {
          uid: user.uid,
          name: displayName,
          email: user.email || '',
          photoURL: user.photoURL || '',
          provider: user.provider,
          shareConnections: [],
          shareOptions: { events: true, expenses: true, daily: true },
          notificationSettings: { enabled: false, defaultReminderMinutes: 10 },
          accounts: ['현금', '국민은행', '신한은행', '카카오뱅크'],
          salarySettings: { day: 25 },
          quickTitles: [],
          dailyCompletionMap: {},
          joinedAt: finalUser.joinedAt,
        });
        console.log('사용자 데이터 저장 성공');
      } catch (firestoreError) {
        if (!isPermissionDeniedError(firestoreError)) {
          throw firestoreError;
        }
        console.warn('로컬 모드로 진행: Firestore 권한 없음');
      }
      
      // localStorage에도 저장
      localStorage.setItem('currentUser', JSON.stringify(finalUser));
      console.log('localStorage에 사용자 정보 저장 완료');

      onComplete(finalUser);
    } catch (error) {
      const errorMsg = error.message || error.toString();
      console.error('회원가입/로그인 오류:', errorMsg);
      console.error('전체 에러 객체:', error);
      
      // Firebase 인증이 비활성화되었을 가능성
      if (errorMsg.includes('operation-not-allowed') || errorMsg.includes('OPERATION_NOT_ALLOWED')) {
        setErrorMessage('이메일/비밀번호 인증이 비활성화되어 있습니다. 관리자에게 문의하세요.');
      } else {
        setErrorMessage(errorMsg);
      }
      
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">스케줄</h1>
          <p className="text-sm text-slate-600">이메일만 입력하면 바로 시작됩니다</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="example@email.com"
                  disabled={isSubmitting}
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-xs font-semibold text-slate-600 mb-2">표시 이름 (선택)</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="예: 형일"
                  disabled={isSubmitting}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50 transition"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-lg bg-rose-50 border border-rose-300 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-rose-700 font-medium">{errorMessage}</p>
                  {errorMessage.includes('비활성화') && (
                    <p className="text-xs text-rose-600 mt-2">
                      💡 <a href="https://console.firebase.google.com/project/schedule-app-46575/authentication/providers" target="_blank" rel="noopener noreferrer" className="underline">
                        Firebase 콘솔 인증 설정
                      </a>에서 이메일/비밀번호를 활성화해주세요.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold py-2.5 rounded-xl hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  처리 중...
                </>
              ) : (
                '이메일로 시작하기'
              )}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <p className="mt-6 text-center text-xs text-slate-500">
          비밀번호 없이 이메일 기반으로 사용자를 구분합니다.<br />
          나중에 이메일로 일정 공유 대상을 쉽게 추가할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
