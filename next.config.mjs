/** @type {import('next').NextConfig} */
const nextConfig = {
  // 좌하단 Next.js 개발 인디케이터("N" 배지) 숨김
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // 확장자 없는 AASA 파일을 application/json 으로 서빙 (iOS 유니버설 링크)
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ]
  },
}

export default nextConfig
