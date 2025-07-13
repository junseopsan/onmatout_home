"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  MapPin,
  Search,
  User,
  Star,
  Rocket,
  Instagram,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

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
              href="#practice-record"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              기록
            </Link>
            <Link
              href="#studio-search"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              요가원
            </Link>
            <Link
              href="#philosophy"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              철학
            </Link>
            <Link
              href="#benefits"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              혜택
            </Link>
            <Link
              href="#download"
              className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500"
            >
              준비중
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
                href="#practice-record"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                기록
              </Link>
              <Link
                href="#practice-record"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                요가원
              </Link>
              <Link
                href="#philosophy"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                철학
              </Link>
              <Link
                href="#benefits"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                혜택
              </Link>
              <Link
                href="#download"
                className="text-base font-medium text-zinc-400 transition-colors hover:text-red-500"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                준비중
              </Link>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1">
        <section id="asanas" className="w-full py-4 md:py-8 lg:py-12 bg-black">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-4xl py-4">
              <div className="flex flex-col items-center space-y-8 rounded-lg bg-black p-8">
                <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                  <Search className="h-8 w-8" />
                </div>
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                      풍부한 요가 아사나 사전
                    </h2>
                  </div>
                </div>
                <div className="space-y-4 text-center">
                  <p className="text-zinc-400 max-w-2xl text-left text-xl">
                    한글과 영문으로 검색하고, 카테고리별로 필터링하여 <br />
                    원하는 아사나를 빠르게 찾아보세요. <br />각 아사나의 상세
                    정보와 효과를 확인할 수 있습니다.
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
                    <div className="text-2xl font-bold text-red-500">필터</div>
                    <div className="text-sm text-zinc-400">카테고리별 분류</div>
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

        <section
          id="practice-record"
          className="w-full py-4 md:py-8 lg:py-12 bg-black"
        >
          <div className="container px-4 md:px-6">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 py-4 md:grid-cols-2">
              <div className="flex flex-col items-center space-y-8 rounded-lg bg-black p-8">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                    <Heart className="h-8 w-8" />
                  </div>
                  <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                      <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                        나만의 수련 일지
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-4 text-center">
                    <p className="text-zinc-400 max-w-2xl text-center text-xl">
                      오늘의 수련 아사나를 선택하고 메모를 남겨보세요. <br />{" "}
                      감정과 에너지 상태를 기록하며 스스로를 더 깊이 이해할 수
                      있습니다.{" "}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3 w-full">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">기록</div>
                    <div className="text-sm text-zinc-400">
                      수련 메모 & 시퀀스
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">통계</div>
                    <div className="text-sm text-zinc-400">주/월/년별 확인</div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">감정</div>
                    <div className="text-sm text-zinc-400">
                      에너지 상태 추적
                    </div>
                  </div>
                </div>
              </div>
              <div
                id="studio-search"
                className="flex flex-col items-center space-y-8 rounded-lg bg-black p-8"
              >
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                    <MapPin className="h-8 w-8" />
                  </div>
                  <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="space-y-2">
                      <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                        요가원 검색
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-4 text-center">
                    <p className="text-zinc-400 max-w-2xl text-center text-xl">
                      모든 요가원을 찾아보고, <br /> 원하는 장소에서 함께
                      수련해보세요.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3 w-full">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">위치</div>
                    <div className="text-sm text-zinc-400">
                      모든 요가원 정보
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">정보</div>
                    <div className="text-sm text-zinc-400">
                      요가원 상세 정보
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-red-500">연결</div>
                    <div className="text-sm text-zinc-400">조용한 커뮤니티</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          id="philosophy"
          className="w-full py-4 md:py-8 lg:py-12 bg-black"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <User className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                  매트 위에서 나만의 시간을
                </h2>
                <p className="max-w-[800px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  남과 비교하거나, 누군가에게 보여주기 위한 수련이 아닌
                  <br />
                  매트 위에서 나만의 호흡, 나만의 시간을 쌓아갈 수 있도록
                </p>
              </div>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-4xl">
                <div className="space-y-3">
                  <div className="text-2xl">🧘‍♀️</div>
                  <h3 className="text-2xl font-semibold text-white">
                    요가를 사랑하게 되길
                  </h3>
                  <p className="text-xl text-zinc-400">
                    단지 더 많은 사람들이 요가를 좋아하게 되길 바랍니다. 운동의
                    하나로서가 아니라, 요가를 통해 삶에 공간을 만들고 스스로를
                    보살펴 주길 바랍니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">✨</div>
                  <h3 className="text-2xl font-semibold text-white">
                    매일의 수련이 여행처럼
                  </h3>
                  <p className="text-xl text-zinc-400">
                    앱을 통해 매일의 수련이 하나의 여행처럼 이어지며, 힘겨운
                    현대 사회 일상으로부터 회복이 되기를 바랍니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">🌱</div>
                  <h3 className="text-2xl font-semibold text-white">
                    스스로를 더 잘 이해하기
                  </h3>
                  <p className="text-xl text-zinc-400">
                    매트 위에서 느끼는 경험은 매우 소중합니다. 자신만의 감정과
                    에너지를 기록하며 스스로를 더 잘 이해하고, 같은 길을 걷는
                    사람들과 조용히 연결되는 경험을 제공합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="benefits"
          className="w-full py-4 md:py-8 lg:py-12 bg-black"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full border border-zinc-800 bg-red-900/20 p-4 text-red-500">
                <Star className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                  함께하는 요가 수련의 이점
                </h2>
                <p className="max-w-[900px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  매일의 수련이 하나의 여행처럼 이어지며, 힘겨운 현대 사회
                  일상으로부터 회복이 됩니다.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 py-4 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 rounded-lg bg-black p-6">
                <div className="text-4xl font-bold text-red-500">01</div>
                <h3 className="text-2xl font-bold text-white">
                  요가 지식 확장
                </h3>
                <p className="text-xl text-zinc-400 text-center">
                  다양한 아사나 카드로 다양한 요가 포즈와 그 효과에 대해 배우며,
                  <br /> 온/오프라인에서 언제든 접근할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg bg-black p-6">
                <div className="text-4xl font-bold text-red-500">02</div>
                <h3 className="text-2xl font-bold text-white">
                  나만의 수련 여정
                </h3>
                <p className="text-xl text-zinc-400 text-center">
                  수련 기록과 통계를 통해 요가를 일상의 습관으로 만들고, 매일의
                  수련이 하나의 여행처럼 이어집니다.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg bg-black p-6">
                <div className="text-4xl font-bold text-red-500">03</div>
                <h3 className="text-2xl font-bold text-white">
                  자기 인식과 회복
                </h3>
                <p className="text-xl text-zinc-400 text-center">
                  감정과 에너지 상태를 기록하며 스스로를 더 잘 이해하고, 힘겨운
                  <br /> 일상으로부터 회복할 수 있습니다.
                </p>
              </div>
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
                <Rocket className="h-8 w-8" />
              </div>
              <div className="space-y-4">
                <div className="inline-block rounded-lg bg-red-900/20 px-4 py-2 text-lg font-semibold text-red-500">
                  2025년 8월 초 오픈 예정
                </div>
                <h2 className="text-4xl font-bold tracking-tighter sm:text-6xl lg:text-7xl text-white">
                  <span className="bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
                    COMING SOON
                  </span>
                </h2>
                <p className="max-w-[700px] text-zinc-300 text-xl md:text-2xl font-medium leading-relaxed">
                  곧 여러분을 찾아갑니다. <br />
                  매트 위에서 깨어나고, 세상으로 확장해나가는 <br />
                  <span className="text-red-400 font-semibold">
                    요가 여정을 함께 시작해요.
                  </span>
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-6">
                  <div className="px-8 py-3 bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 font-semibold">
                    📱 iOS & Android 동시 출시
                  </div>
                  <div className="px-8 py-3 bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 font-semibold">
                    🎯 300+ 아사나 정보 제공
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t border-zinc-800 py-6 md:py-0 bg-black">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-zinc-500 md:text-left">
            © 2025 ONMATOUT. All rights reserved.
          </p>
          <div className="flex gap-4">
            {/* <Link
              href="#"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500"
            >
              개인정보 처리방침
            </Link>
            <Link
              href="#"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500"
            >
              이용약관
            </Link> */}
            {/* <Link
              href="#"
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500"
            >
              문의하기
            </Link> */}
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
