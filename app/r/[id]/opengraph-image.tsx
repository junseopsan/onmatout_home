import { ImageResponse } from "next/og";
import { getRoutineMeta } from "@/lib/routineMeta";

// 카카오톡/SNS 미리보기용 OG 이미지 (서버 렌더). 시퀀스 제목을 담은 다크 카드.
export const runtime = "nodejs";
export const alt = "요가 시퀀스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getRoutineMeta(id);
  const title = meta?.title ?? "요가 시퀀스";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0B0B0F 0%, #14101F 55%, #0B0B0F 100%)",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 40,
              height: 6,
              borderRadius: 3,
              background: "#8B5CF6",
            }}
          />
          <div
            style={{
              color: "#A78BFA",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            YOGA SEQUENCE
          </div>
        </div>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.1,
            display: "flex",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 48,
            color: "#8A8A93",
            fontSize: 34,
            fontWeight: 600,
            display: "flex",
          }}
        >
          ONMATOUT 온매트아웃
        </div>
      </div>
    ),
    { ...size },
  );
}
