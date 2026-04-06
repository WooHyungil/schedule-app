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

      try {
        await createOrUpdateUser(user.uid, {
          uid: user.uid,
          name: displayName,
          email: user.email || '',
          photoURL: user.photoURL || '',
          provider: user.provider,
          accounts: ['현금', '국민은행', '신한은행', '카카오뱅크'],
          quickTitles: [],
          dailyCompletionMap: {},
          joinedAt: finalUser.joinedAt,
        });
      } catch (firestoreError) {
        if (!isPermissionDeniedError(firestoreError)) {
          throw firestoreError;
        }
        console.warn('로컬 모드로 진행: Firestore 권한 없음');
      }
      
      // localStorage에도 저장
      localStorage.setItem('currentUser', JSON.stringify(finalUser));

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
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="section-panel overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="max-w-xl">
            <p className="apple-section-title">Welcome</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">같은 이메일이면 어느 기기에서든 같은 하루가 이어집니다.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">가입 절차 없이 이메일과 이름만 입력하면 일정, 데일리, 가계부가 같은 공간으로 바로 연결됩니다.</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="soft-card rounded-[26px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Sync</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">자동 동기화</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">같은 이메일로 접속하면 같은 데이터가 즉시 이어집니다.</p>
            </div>
            <div className="soft-card rounded-[26px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Routine</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">루틴 관리</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">반복 일정과 오늘 할 일을 깔끔하게 정리합니다.</p>
            </div>
            <div className="soft-card rounded-[26px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Finance</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">월급 주기 추적</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">월급 입력과 사용 기간 기준으로 지출을 한 번에 봅니다.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel-strong rounded-[32px] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">바로 시작하기</h2>
            <p className="mt-2 text-sm text-slate-500">이메일과 표시 이름만 입력하면 됩니다.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-slate-500">이메일</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                  className="apple-input pl-11 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="nickname" className="mb-2 block text-xs font-semibold text-slate-500">표시 이름 (선택)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                  className="apple-input pl-11 disabled:opacity-50"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 flex items-start gap-3">
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="apple-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="mt-6 text-center text-xs leading-6 text-slate-500">
            같은 이메일로 다른 기기에서 들어오면 같은 데이터가 보입니다.<br />
            로그인하면 내 데이터가 자동 동기화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
