import Link from "next/link"
import Image from "next/image"
import { Heart, MapPin, Search } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/images/onmatout-logo.png" alt="ONMATOUT" width={120} height={40} className="h-8 w-auto" />
          </div>
          <nav className="flex gap-6">
            <Link href="#features" className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500">
              기능
            </Link>
            <Link href="#philosophy" className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500">
              철학
            </Link>
            <Link href="#benefits" className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500">
              혜택
            </Link>
            <Link href="#download" className="text-sm font-medium text-zinc-400 transition-colors hover:text-red-500">
              준비중
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-b from-black to-zinc-900">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <Image
                    src="/images/onmatout-logo.png"
                    alt="ONMATOUT"
                    width={300}
                    height={100}
                    className="w-64 md:w-80"
                  />
                  <p className="text-xl text-zinc-400 mt-4">매트 위에서 깨어나고, 세상으로 확장해나가자!</p>
                  <p className="text-lg text-zinc-500">요가 입문자와 중급자를 위한 요가 플랫폼</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[600px] w-[300px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  <Image
                    src="/images/app-mockup.png"
                    alt="App Screenshot"
                    className="object-cover"
                    width={300}
                    height={600}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-zinc-900">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-red-900/20 px-3 py-1 text-sm text-red-500">핵심 기능</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                  나만의 요가 여정을 위한 도구
                </h2>
                <p className="max-w-[900px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  수련 습관 형성을 돕고, 수련 기록과 주변 요가원 탐색까지 서포트합니다.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="rounded-full border border-zinc-800 bg-red-900/20 p-2 text-red-500">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">아사나 탐색</h3>
                <p className="text-sm text-zinc-400 text-center">
                  300개 아사나 온/오프라인 카드 제공
                  <br />
                  한글/영문 검색, 카테고리 필터
                  <br />
                  아사나 즐겨찾기 및 상세 정보 제공
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="rounded-full border border-zinc-800 bg-red-900/20 p-2 text-red-500">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">수련 기록 및 통계</h3>
                <p className="text-sm text-zinc-400 text-center">
                  오늘의 수련 아사나 선택 후 메모 및 시퀀스 기록
                  <br />
                  수련 데이터 주/월/년별 확인
                  <br />
                  나만의 감정과 에너지 기록
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="rounded-full border border-zinc-800 bg-red-900/20 p-2 text-red-500">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">요가원 탐색</h3>
                <p className="text-sm text-zinc-400 text-center">
                  지역 기반 요가원 탐색 및 정보 제공
                  <br />
                  같은 길을 걷는 사람들과의 조용한 연결
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="philosophy" className="w-full py-12 md:py-24 lg:py-32 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-8 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-red-900/20 px-3 py-1 text-sm text-red-500">우리의 철학</div>
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
                  <h3 className="text-lg font-semibold text-white">요가를 사랑하게 되길</h3>
                  <p className="text-sm text-zinc-400">
                    단지 더 많은 사람들이 요가를 좋아하게 되길 바랍니다. 운동의 하나로서가 아니라, 요가를 통해 삶에
                    공간을 만들고 스스로를 보살펴 주길 바랍니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">✨</div>
                  <h3 className="text-lg font-semibold text-white">매일의 수련이 여행처럼</h3>
                  <p className="text-sm text-zinc-400">
                    앱을 통해 매일의 수련이 하나의 여행처럼 이어지며, 힘겨운 현대 사회 일상으로부터 회복이 되기를
                    바랍니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="text-2xl">🌱</div>
                  <h3 className="text-lg font-semibold text-white">스스로를 더 잘 이해하기</h3>
                  <p className="text-sm text-zinc-400">
                    매트 위에서 느끼는 경험은 매우 소중합니다. 자신만의 감정과 에너지를 기록하며 스스로를 더 잘
                    이해하고, 같은 길을 걷는 사람들과 조용히 연결되는 경험을 제공합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-zinc-900">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-red-900/20 px-3 py-1 text-sm text-red-500">앱 특징</div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white">
                    요가 수련을 더 깊게, 더 강렬하게
                  </h2>
                  <p className="max-w-[600px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    ONMATOUT은 요가 수련을 기록하고 추적하는 것을 넘어, 당신의 요가 여정을 더 풍요롭게 만들어줍니다.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-red-900/20 p-1">
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-zinc-300">300개 아사나 온/오프라인 카드 제공</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-red-900/20 p-1">
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-zinc-300">한글/영문 검색 및 카테고리 필터</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-red-900/20 p-1">
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-zinc-300">메모 및 시퀀스 기록 기능</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-red-900/20 p-1">
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-zinc-300">수련 데이터 주/월/년별 확인</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-red-900/20 p-1">
                      <svg
                        className="h-4 w-4 text-red-500"
                        fill="none"
                        height="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-zinc-300">지역 기반 요가원 정보 제공</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4">
                  <img
                    alt="App Screenshot 1"
                    className="aspect-[4/3] overflow-hidden rounded-xl object-cover object-center border border-zinc-800"
                    height="400"
                    src="/placeholder.svg?height=400&width=300"
                    width="300"
                  />
                  <img
                    alt="App Screenshot 2"
                    className="aspect-[4/3] overflow-hidden rounded-xl object-cover object-center border border-zinc-800"
                    height="400"
                    src="/placeholder.svg?height=400&width=300"
                    width="300"
                  />
                  <img
                    alt="App Screenshot 3"
                    className="aspect-[4/3] overflow-hidden rounded-xl object-cover object-center border border-zinc-800"
                    height="400"
                    src="/placeholder.svg?height=400&width=300"
                    width="300"
                  />
                  <img
                    alt="App Screenshot 4"
                    className="aspect-[4/3] overflow-hidden rounded-xl object-cover object-center border border-zinc-800"
                    height="400"
                    src="/placeholder.svg?height=400&width=300"
                    width="300"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="benefits" className="w-full py-12 md:py-24 lg:py-32 bg-black">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-red-900/20 px-3 py-1 text-sm text-red-500">혜택</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">
                  ONMATOUT과 함께하는 요가 수련의 이점
                </h2>
                <p className="max-w-[900px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  매일의 수련이 하나의 여행처럼 이어지며, 힘겨운 현대 사회 일상으로부터 회복이 됩니다.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 py-12 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="text-4xl font-bold text-red-500">01</div>
                <h3 className="text-xl font-bold text-white">요가 지식 확장</h3>
                <p className="text-sm text-zinc-400 text-center">
                  300개의 아사나 카드로 다양한 요가 포즈와 그 효과에 대해 배우며, 온/오프라인에서 언제든 접근할 수
                  있습니다.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="text-4xl font-bold text-red-500">02</div>
                <h3 className="text-xl font-bold text-white">나만의 수련 여정</h3>
                <p className="text-sm text-zinc-400 text-center">
                  수련 기록과 통계를 통해 요가를 일상의 습관으로 만들고, 매일의 수련이 하나의 여행처럼 이어집니다.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="text-4xl font-bold text-red-500">03</div>
                <h3 className="text-xl font-bold text-white">자기 인식과 회복</h3>
                <p className="text-sm text-zinc-400 text-center">
                  감정과 에너지 상태를 기록하며 스스로를 더 잘 이해하고, 힘겨운 일상으로부터 회복할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="download" className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-black to-zinc-900">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-white">ONMATOUT 출시 준비중</h2>
                <p className="max-w-[600px] text-zinc-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  곧 여러분을 찾아갑니다. 매트 위에서 깨어나고, 세상으로 확장해나가는 요가 여정을 함께 시작해요.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t border-zinc-800 py-6 md:py-0 bg-black">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-zinc-500 md:text-left">
            © 2024 ONMATOUT. 모든 권리 보유.
          </p>
          <div className="flex gap-4">
            <Link href="#" className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500">
              개인정보 처리방침
            </Link>
            <Link href="#" className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500">
              이용약관
            </Link>
            <Link href="#" className="text-sm font-medium text-zinc-500 transition-colors hover:text-red-500">
              문의하기
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
