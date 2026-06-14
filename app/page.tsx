"use client";

import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  CalendarCheck,
  Download,
  GraduationCap,
  Heart,
  Instagram,
  ListChecks,
  Menu,
  MessageCircle,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

// 스토어 링크 (앱 운영 중)
const APP_STORE_URL =
  "https://apps.apple.com/kr/app/onmatout-%EC%98%A8%EB%A7%A4%ED%8A%B8%EC%95%84%EC%9B%83/id6746711838";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.onmatout.app";

// 사용 가능한 모든 아사나 이미지 리스트
const ALL_ASANA_IMAGES = [
  "001_001.png",
  "002_001.png",
  "003_001.png",
  "004_001.png",
  "005_001.png",
  "006_001.png",
  "006_002.png",
  "006_003.png",
  "007_001.png",
  "007_002.png",
  "008_001.png",
  "009_001.png",
  "010_001.png",
  "010_002.png",
  "011_001.png",
  "012_001.png",
  "018_001.png",
  "020_002.png",
  "021_002.png",
  "021_003.png",
  "021_004.png",
  "022_001.png",
  "023_001.png",
  "024_001.png",
  "025_001.png",
  "026_001.png",
  "026_002.png",
  "028_001.png",
  "029_001.png",
  "029_002.png",
  "029_003.png",
  "030_001.png",
  "031_001.png",
  "032_001.png",
  "032_002.png",
  "033_001.png",
  "033_002.png",
  "033_003.png",
  "034_001.png",
  "034_002.png",
  "034_003.png",
  "035_001.png",
  "036_001.png",
  "036_002.png",
  "037_001.png",
  "037_002.png",
  "038_001.png",
  "039_001.png",
  "040_001.png",
  "041_001.png",
  "042_001.png",
  "043_001.png",
  "044_001.png",
  "045_001.png",
  "046_001.png",
  "047_001.png",
  "048_001.png",
  "048_002.png",
  "049_001.png",
  "050_001.png",
  "051_001.png",
  "052_001.png",
  "052_002.png",
  "053_001.png",
  "054_001.png",
  "054_002.png",
  "054_003.png",
  "054_004.png",
  "055_001.png",
  "056_001.png",
  "057_001.png",
  "058_001.png",
  "058_002.png",
  "059_001.png",
  "059_002.png",
  "059_003.png",
  "060_001.png",
  "061_001.png",
  "062_001.png",
  "063_001.png",
  "064_001.png",
  "065_001.png",
  "065_002.png",
  "065_003.png",
  "066_001.png",
  "066_002.png",
  "067_001.png",
  "067_002.png",
  "068_001.png",
  "069_001.png",
  "069_002.png",
  "070_001.png",
  "070_002.png",
  "071_001.png",
  "072_001.png",
  "073_001.png",
  "073_002.png",
  "074_001.png",
  "074_002.png",
  "075_001.png",
  "075_002.png",
  "076_001.png",
  "076_002.png",
  "077_001.png",
  "078_001.png",
  "079_001.png",
  "080_001.png",
  "081_001.png",
  "082_001.png",
  "084_001.png",
  "085_001.png",
  "086_001.png",
  "086_002.png",
  "088_001.png",
  "089_001.png",
  "090_001.png",
  "091_001.png",
  "092_001.png",
  "092_002.png",
  "093_001.png",
  "093_002.png",
  "094_001.png",
  "095_001.png",
  "096_001.png",
  "097_001.png",
  "098_001.png",
  "098_002.png",
  "099_001.png",
  "100_001.png",
  "100_002.png",
  "101_001.png",
  "101_002.png",
  "102_001.png",
  "102_002.png",
  "103_001.png",
  "103_002.png",
  "104_001.png",
  "105_001.png",
  "105_002.png",
  "106_001.png",
  "107_001.png",
  "108_001.png",
  "109_001.png",
  "110_001.png",
  "111_001.png",
  "111_002.png",
  "112_001.png",
  "113_001.png",
  "114_001.png",
  "115_001.png",
  "116_001.png",
  "117_001.png",
  "118_001.png",
  "119_001.png",
  "120_001.png",
  "121_001.png",
  "121_002.png",
  "122_001.png",
  "122_002.png",
  "123_001.png",
  "124_001.png",
  "124_002.png",
  "125_001.png",
  "126_001.png",
  "127_001.png",
  "127_002.png",
  "127_003.png",
  "128_001.png",
  "128_002.png",
  "128_003.png",
  "129_001.png",
  "129_002.png",
  "130_001.png",
  "130_002.png",
  "131_001.png",
  "132_001.png",
  "132_002.png",
  "132_003.png",
  "133_001.png",
  "133_002.png",
  "133_003.png",
  "134_001.png",
  "134_002.png",
  "134_003.png",
  "135_001.png",
  "136_001.png",
  "136_002.png",
  "136_003.png",
  "137_001.png",
  "137_002.png",
  "138_001.png",
  "138_002.png",
  "139_001.png",
  "139_002.png",
  "139_003.png",
  "139_004.png",
  "140_001.png",
  "140_002.png",
  "140_003.png",
  "141_001.png",
  "141_002.png",
  "141_003.png",
  "141_004.png",
  "142_001.png",
  "142_002.png",
  "143_001.png",
  "144_001.png",
  "145_001.png",
  "145_002.png",
  "146_001.png",
  "146_002.png",
  "147_001.png",
  "148_001.png",
  "149_001.png",
  "150_001.png",
  "150_002.png",
  "150_003.png",
  "150_004.png",
  "151_001.png",
  "152_001.png",
  "153_001.png",
  "154_001.png",
  "155_002.png",
  "155_003.png",
  "155_004.png",
  "156_002.png",
  "157_001.png",
  "157_002.png",
  "158_001.png",
  "159_001.png",
  "160_001.png",
  "161_001.png",
  "162_001.png",
  "162_002.png",
  "163_001.png",
  "164_001.png",
  "164_002.png",
  "165_001.png",
  "165_002.png",
  "166_001.png",
  "166_002.png",
  "167_001.png",
  "168_001.png",
  "169_002.png",
  "170_001.png",
  "170_002.png",
  "170_003.png",
  "171_001.png",
  "171_002.png",
  "171_003.png",
  "171_004.png",
  "172_001.png",
  "172_002.png",
  "172_003.png",
  "173_001.png",
  "173_002.png",
  "173_003.png",
  "174_001.png",
  "174_002.png",
  "174_003.png",
  "175_001.png",
  "175_002.png",
  "175_003.png",
  "176_001.png",
  "177_001.png",
  "177_002.png",
  "177_003.png",
  "177_004.png",
  "177_005.png",
  "178_001.png",
  "178_002.png",
  "178_003.png",
  "179_001.png",
  "179_002.png",
  "179_003.png",
  "179_004.png",
  "179_005.png",
  "180_001.png",
  "180_002.png",
  "180_003.png",
  "180_004.png",
  "180_005.png",
  "181_001.png",
  "182_001.png",
  "182_002.png",
  "182_003.png",
  "182_004.png",
  "183_001.png",
  "183_002.png",
];

// Fisher-Yates 셔플 알고리즘을 사용한 랜덤 선택 함수
function getRandomImages(images: string[], count: number): string[] {
  const shuffled = [...images];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export default function Home() {
  const [randomAsanas, setRandomAsanas] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 랜덤으로 24개 이미지 선택
    setRandomAsanas(getRandomImages(ALL_ASANA_IMAGES, 24));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black backdrop-blur supports-[backdrop-filter]:bg-black/90">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo_png.png"
              alt="ONMATOUT"
              width={240}
              height={120}
            />
          </div>

          {/* 데스크탑 네비게이션 */}
          <nav className="hidden md:flex gap-6">
            <Link
              href="#asanas"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              아사나
            </Link>
            <Link
              href="#teacher"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              선생님
            </Link>
            <Link
              href="#member"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              회원
            </Link>
            <Link
              href="#ai"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              요가톡 AI
            </Link>
            <Link
              href="#download"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              다운로드
            </Link>
          </nav>

          {/* 모바일 햄버거 메뉴 버튼 */}
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-red-500 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="메뉴 토글"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-black">
            <nav className="container py-4 flex flex-col space-y-4">
              <Link
                href="#asanas"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                아사나
              </Link>
              <Link
                href="#teacher"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                선생님
              </Link>
              <Link
                href="#member"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                회원
              </Link>
              <Link
                href="#ai"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                요가톡 AI
              </Link>
              <Link
                href="#download"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                다운로드
              </Link>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1">
        {/* 히어로 */}
        <section className="w-full bg-black pt-10 pb-6 md:pt-16 md:pb-10">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-red-900/20 px-4 py-1.5 text-sm font-semibold text-red-400">
                <Sparkles className="h-4 w-4" />
                AI 클래스 케어
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tighter text-white sm:text-6xl">
                수업은 끝나도,
                <br />
                <span className="bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
                  수련은 이어집니다
                </span>
              </h1>
              <p className="max-w-2xl text-lg text-zinc-300 md:text-xl">
                온매트아웃은 요가 선생님과 회원을 수업 밖에서도 연결하는 AI
                클래스 케어 앱입니다. 아사나 사전, 회원·출석 관리, 복습 루틴,
                요가톡 AI를 한 곳에 담았어요.
              </p>
              <div className="grid w-full max-w-2xl grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
                {[
                  { v: "300+", l: "아사나 사전" },
                  { v: "출석·수업권", l: "회원 관리" },
                  { v: "복습 루틴", l: "수업 후 공유" },
                  { v: "요가톡 AI", l: "수련 도우미" },
                ].map((s) => (
                  <div key={s.l} className="space-y-1">
                    <div className="text-lg font-bold text-red-500">{s.v}</div>
                    <div className="text-xs text-zinc-400">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="asanas" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-4xl py-4">
              <div className="flex flex-col items-center space-y-8 rounded-lg bg-black p-8">
                <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                  <BookOpen className="h-8 w-8" />
                </div>
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                      AI가 답하는 지식의 기반, 아사나 사전
                    </h2>
                  </div>
                </div>
                <div className="space-y-4 text-center">
                  <p className="text-zinc-400 max-w-2xl text-xl">
                    300여 개의 아사나를 한글·영문으로 검색하고 카테고리별로
                    살펴보세요. 이 사전은 단순 콘텐츠를 넘어, 요가톡 AI가 답변할
                    때 참고하는 지식의 기반이 됩니다.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3 w-full">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">300+</div>
                    <div className="text-sm text-zinc-400">아사나 카드</div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">한영</div>
                    <div className="text-sm text-zinc-400">이중 언어 검색</div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">
                      AI 지식
                    </div>
                    <div className="text-sm text-zinc-400">
                      요가톡 답변 근거
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-1 py-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {randomAsanas.map((imageName, index) => (
                <div
                  key={index}
                  className="aspect-square overflow-hidden rounded-lg border border-gray-400/30 bg-gray-100/90 p-2"
                >
                  <Image
                    src={`/images/asanas/${imageName}`}
                    alt="Yoga Pose"
                    width={160}
                    height={160}
                    className="h-full w-full object-contain transition-transform hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 선생님 */}
        <section id="teacher" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                선생님을 위한 클래스 관리
              </h2>
              <p className="max-w-2xl text-xl text-zinc-400">
                회원과 수업을 한 곳에서 관리하고, 수업에서 끝나지 않는 케어를
                이어가세요.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-8 md:grid-cols-3">
              <FeatureCard
                icon={<CalendarCheck className="h-7 w-7" />}
                title="회원 · 출석 관리"
                desc="회원 명단과 수업권을 관리하고 출석을 체크하세요. 횟수권·기간권 차감까지 자동으로 이어집니다."
              />
              <FeatureCard
                icon={<ListChecks className="h-7 w-7" />}
                title="복습 루틴 공유"
                desc="수업에서 진행한 아사나 시퀀스를 루틴으로 만들어 클래스와 회원에게 공유하세요."
              />
              <FeatureCard
                icon={<MessageCircle className="h-7 w-7" />}
                title="요가톡으로 케어"
                desc="회원의 질문과 AI 답변을 함께 확인하고, 수업 밖에서도 가볍게 회원을 케어하세요."
              />
            </div>
          </div>
        </section>

        {/* 회원 */}
        <section id="member" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <Users className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                회원을 위한 수련 동반자
              </h2>
              <p className="max-w-2xl text-xl text-zinc-400">
                수업에서 배운 걸 복습하고, 궁금한 점은 바로 물어보세요.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-8 md:grid-cols-3">
              <FeatureCard
                icon={<ListChecks className="h-7 w-7" />}
                title="복습 루틴 확인"
                desc="선생님이 공유한 복습 루틴으로 수업에서 배운 아사나를 집에서도 다시 따라가 보세요."
              />
              <FeatureCard
                icon={<Heart className="h-7 w-7" />}
                title="나의 수련 기록"
                desc="수련한 아사나와 감정·에너지 상태를 기록하며 나만의 수련 여정을 쌓아갑니다."
              />
              <FeatureCard
                icon={<MessageCircle className="h-7 w-7" />}
                title="요가톡으로 질문"
                desc="수련 중 생긴 궁금증을 요가톡 AI에게 묻고, 필요하면 선생님에게 바로 이어서 물어보세요."
              />
            </div>
          </div>
        </section>
        {/* 요가톡 AI */}
        <section id="ai" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                요가톡 AI — 수련 중 궁금증을 바로
              </h2>
              <p className="max-w-[800px] text-zinc-400 md:text-xl/relaxed">
                아사나 사전을 지식 기반으로 학습한 AI가, 수련 중 떠오른 질문에
                근거 있는 답을 건넵니다. 안전이 필요한 질문은 가이드와 함께,
                필요하면 선생님에게 자연스럽게 이어집니다.
              </p>
              <div className="grid gap-8 md:grid-cols-3 max-w-4xl pt-4">
                <div className="space-y-3">
                  <div className="text-2xl">📚</div>
                  <h3 className="text-2xl font-semibold text-white">
                    아사나 지식 기반
                  </h3>
                  <p className="text-lg text-zinc-400">
                    300여 개 아사나 사전을 근거로 답변해, 막연한 추측이 아닌
                    출처 있는 정보를 전합니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">🛟</div>
                  <h3 className="text-2xl font-semibold text-white">
                    안전을 먼저
                  </h3>
                  <p className="text-lg text-zinc-400">
                    통증·부상 등 주의가 필요한 질문에는 안전 안내를 함께 보여
                    무리한 수련을 막습니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">🤝</div>
                  <h3 className="text-2xl font-semibold text-white">
                    선생님으로 연결
                  </h3>
                  <p className="text-lg text-zinc-400">
                    AI로 충분하지 않을 땐, 같은 질문을 선생님에게 이어서 물어볼
                    수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 브랜드 */}
        <section id="brand" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-6 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <Heart className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                매트 위에서 시작해, 수업 밖으로
              </h2>
              <p className="max-w-[820px] text-xl text-zinc-400 md:text-2xl/relaxed">
                요가는 수업 한 시간으로 끝나지 않습니다. 선생님은 회원을 더
                가까이 돌보고, 회원은 배운 것을 일상에서 이어갑니다.
                온매트아웃은 그 연결을 가장 가볍게 만드는 도구가 되고자 합니다.
              </p>
            </div>
          </div>
        </section>
        <section
          id="download"
          className="w-full py-4 md:py-8 lg:py-12 bg-black"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <Download className="h-8 w-8" />
              </div>
              <div className="space-y-6">
                <h2 className="text-4xl font-bold tracking-tighter sm:text-6xl text-white">
                  지금{" "}
                  <span className="bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
                    온매트아웃
                  </span>
                  과 함께하세요
                </h2>
                <p className="mx-auto max-w-[640px] text-xl text-zinc-300 md:text-2xl">
                  iOS와 Android에서 만나보세요. 선생님과 회원, 모두를 위한 AI
                  클래스 케어.
                </p>
                <div className="pt-2">
                  <StoreButtons />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t border-zinc-800 py-6 md:py-0 bg-black">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-zinc-500 md:text-left">
            © 2026 ONMATOUT. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link
              href="/privacy-policy"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500"
            >
              개인정보 처리방침
            </Link>
            <Link
              href="/terms-of-service"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500"
            >
              이용약관
            </Link>
            <Link
              href="https://www.instagram.com/onmatout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500 flex items-center gap-1"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StoreButtons() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        <Download className="h-5 w-5" />
        App Store
      </Link>
      <Link
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-600/20 px-6 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-600/30"
      >
        <Download className="h-5 w-5" />
        Google Play
      </Link>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center">
      <div className="rounded-full border border-zinc-800 bg-red-900/20 p-3 text-red-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-base text-zinc-400">{desc}</p>
    </div>
  );
}
