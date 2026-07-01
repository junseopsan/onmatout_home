import type { Metadata } from "next";
import { getRoutineMeta } from "@/lib/routineMeta";
import RoutineLanding from "./RoutineLanding";

const SITE = "https://onmatout.com";

// 시퀀스 공유 랜딩: onmatout.com/r/{id}
// 서버에서 OG 메타(카카오톡/SNS 미리보기)를 생성하고,
// 클라이언트에서 설치된 앱을 우선 열도록(딥링크) 처리한다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = await getRoutineMeta(id);
  const title = meta ? `${meta.title} | 요가 시퀀스` : "요가 시퀀스";
  const description = meta
    ? `온매트아웃에서 "${meta.title}" 시퀀스를 확인해보세요.`
    : "온매트아웃에서 이 요가 시퀀스를 확인해보세요.";

  return {
    metadataBase: new URL(SITE),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/r/${id}`,
      siteName: "온매트아웃",
      type: "website",
      locale: "ko_KR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoutineLanding id={id} />;
}
