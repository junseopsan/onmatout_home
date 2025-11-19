"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black backdrop-blur supports-[backdrop-filter]:bg-black/90">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo_png.png"
              alt="ONMATOUT"
              width={240}
              height={120}
            />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-red-500"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>홈으로 돌아가기</span>
          </Link>

          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                ONMATOUT 개인정보처리방침
              </h1>
              <p className="text-lg text-zinc-400">
                온매트아웃(이하 "회사")는 사용자의 개인정보를 소중히 여기며,
                「개인정보 보호법」 등 관련 법령을 준수하고 있습니다. 본
                개인정보처리방침은 회사가 제공하는{" "}
                <span className="font-semibold text-white">
                  ONMATOUT 모바일 앱
                </span>
                (이하 "서비스") 이용과 관련하여 사용자의 개인정보가 어떻게
                수집, 이용, 보관, 제공되는지를 안내합니다.
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  1. 수집하는 개인정보 항목 및 수집 방법
                </h2>
                <p className="text-zinc-400">
                  회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      1. 회원가입 및 로그인 시
                    </h3>
                    <ul className="ml-6 list-disc space-y-1 text-zinc-400">
                      <li>
                        <span className="font-medium text-white">필수항목:</span>{" "}
                        전화번호, 인증코드
                      </li>
                      <li>
                        <span className="font-medium text-white">선택항목:</span>{" "}
                        이름, 닉네임, 프로필 이미지
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      2. 서비스 이용 과정에서 자동으로 수집되는 정보
                    </h3>
                    <ul className="ml-6 list-disc space-y-1 text-zinc-400">
                      <li>단말기 정보(모델명, OS 버전, 기기 식별자)</li>
                      <li>접속 로그, IP 주소, 쿠키</li>
                      <li>이용 기록(앱 내 기능 사용 내역, 수련 기록 등)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      3. 기록 기능 이용 시(선택)
                    </h3>
                    <ul className="ml-6 list-disc space-y-1 text-zinc-400">
                      <li>사용자가 직접 입력한 메모, 감정/상태 기록</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  2. 개인정보의 수집 및 이용 목적
                </h2>
                <p className="text-zinc-400">
                  회사는 수집한 개인정보를 아래의 목적으로 활용합니다.
                </p>
                <ul className="ml-6 list-disc space-y-2 text-zinc-400">
                  <li>서비스 가입 및 본인확인(전화번호 인증)</li>
                  <li>아사나 기록 및 개인 맞춤형 통계 제공</li>
                  <li>
                    요가원 탐색 등 위치 기반 서비스 제공(선택 동의 시)
                  </li>
                  <li>서비스 품질 개선 및 신규 기능 개발</li>
                  <li>부정 이용 방지, 법령 위반 행위 대응</li>
                  <li>고객 문의 대응 및 공지사항 전달</li>
                </ul>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  3. 개인정보의 보유 및 이용 기간
                </h2>
                <ul className="ml-6 list-disc space-y-2 text-zinc-400">
                  <li>회원 탈퇴 시 즉시 파기</li>
                  <li>
                    단, 법령에서 정한 보존 기간이 있을 경우 해당 기간 동안 보관
                    후 파기
                    <ul className="ml-6 mt-2 list-disc space-y-1">
                      <li>
                        전자상거래법에 따른 거래기록: 5년
                      </li>
                      <li>
                        통신비밀보호법에 따른 접속기록: 3개월
                      </li>
                    </ul>
                  </li>
                </ul>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  4. 개인정보의 제3자 제공
                </h2>
                <p className="text-zinc-400">
                  회사는 원칙적으로 사용자의 개인정보를 외부에 제공하지
                  않습니다.
                </p>
                <p className="text-zinc-400">
                  단, 아래의 경우 예외로 제공합니다.
                </p>
                <ul className="ml-6 list-disc space-y-2 text-zinc-400">
                  <li>사용자가 사전에 동의한 경우</li>
                  <li>
                    법령에 의거하여 수사기관·법원 등이 요청하는 경우
                  </li>
                </ul>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  5. 개인정보 처리의 위탁
                </h2>
                <p className="text-zinc-400">
                  회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를
                  위탁할 수 있습니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-zinc-800">
                    <thead>
                      <tr className="bg-zinc-900">
                        <th className="border border-zinc-800 px-4 py-3 text-left font-semibold text-white">
                          수탁자
                        </th>
                        <th className="border border-zinc-800 px-4 py-3 text-left font-semibold text-white">
                          위탁 업무
                        </th>
                        <th className="border border-zinc-800 px-4 py-3 text-left font-semibold text-white">
                          보유 및 이용 기간
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-zinc-800 px-4 py-3 text-zinc-400">
                          Supabase Inc.
                        </td>
                        <td className="border border-zinc-800 px-4 py-3 text-zinc-400">
                          인증 및 데이터베이스 관리
                        </td>
                        <td className="border border-zinc-800 px-4 py-3 text-zinc-400">
                          회원 탈퇴 또는 위탁 계약 종료 시까지
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">6. 이용자의 권리</h2>
                <p className="text-zinc-400">
                  이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며,
                  회원 탈퇴를 통해 개인정보 이용에 대한 동의를 철회할 수 있습니다.
                </p>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  7. 개인정보의 파기 절차 및 방법
                </h2>
                <ul className="ml-6 list-disc space-y-2 text-zinc-400">
                  <li>
                    전자적 파일 형태: 복구 불가능한 방법으로 영구 삭제
                  </li>
                  <li>종이 문서: 분쇄 또는 소각 처리</li>
                </ul>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  8. 개인정보의 안전성 확보 조치
                </h2>
                <p className="text-zinc-400">
                  회사는 개인정보를 안전하게 보호하기 위하여 다음과 같은 조치를
                  취하고 있습니다.
                </p>
                <ul className="ml-6 list-disc space-y-2 text-zinc-400">
                  <li>암호화 통신(SSL/TLS)</li>
                  <li>비밀번호 없는 전화번호 인증 방식 적용</li>
                  <li>접근 권한 최소화 및 내부 보안 교육</li>
                  <li>주기적 보안 점검 및 로그 모니터링</li>
                </ul>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  9. 개인정보 보호책임자
                </h2>
                <div className="space-y-2 text-zinc-400">
                  <p>
                    <span className="font-medium text-white">이름:</span> 박준섭
                  </p>
                  <p>
                    <span className="font-medium text-white">직책:</span>{" "}
                    개인정보보호책임자
                  </p>
                  <p>
                    <span className="font-medium text-white">이메일:</span>{" "}
                    <a
                      href="mailto:service@onmatout.com"
                      className="text-red-500 hover:underline"
                    >
                      service@onmatout.com
                    </a>
                  </p>
                  <p>
                    <span className="font-medium text-white">연락처:</span>{" "}
                    1544-5218
                  </p>
                </div>
              </section>
            </div>

            <div className="border-t border-zinc-800 pt-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  10. 개정 사항 고지
                </h2>
                <p className="text-zinc-400">
                  본 개인정보처리방침은 시행일로부터 적용되며, 내용 추가·삭제·변경이
                  있을 경우 앱 내 공지사항 또는 이메일을 통해 고지합니다.
                </p>
                <p className="text-zinc-400">
                  <span className="font-medium text-white">시행일자:</span>{" "}
                  2025년 8월 27일
                </p>
              </section>
            </div>
          </div>

          <div className="mt-12 border-t border-zinc-800 pt-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-3 text-white transition-colors hover:bg-zinc-800 hover:text-red-500"
              >
                홈으로 돌아가기
              </Link>
              <div className="flex flex-col gap-2 text-sm text-zinc-400 md:items-end">
                <p>문의사항이 있으시면 언제든지 연락주세요.</p>
                <a
                  href="mailto:service@onmatout.com"
                  className="text-red-500 hover:underline"
                >
                  service@onmatout.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-zinc-800 py-6 md:py-0 bg-black">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-zinc-500 md:text-left">
            © 2025 ONMATOUT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

