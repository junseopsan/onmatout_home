"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

const APP_STORE = "https://apps.apple.com/app/id6746711838";
const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.onmatout.app";

// 초대 링크 랜딩: onmatout.com/a/CODE
// - 앱 설치 시: iOS/Android 가 유니버설/앱 링크로 이 페이지 대신 앱을 직접 엶
// - 미설치 시: 이 페이지가 보이고, 모바일이면 스토어로 자동 이동
export default function InvitePage() {
  const params = useParams();
  const code = String(
    (Array.isArray(params?.code) ? params?.code[0] : params?.code) ?? "",
  ).toUpperCase();

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const t = setTimeout(() => {
      if (/iPhone|iPad|iPod/i.test(ua)) {
        window.location.href = APP_STORE;
      } else if (/Android/i.test(ua)) {
        window.location.href = PLAY_STORE;
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const openApp = () => {
    window.location.href = `onmatout://invite?code=${encodeURIComponent(code)}`;
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>온매트아웃 초대</h1>
        <p
          style={{
            color: "#a1a1aa",
            fontSize: 14,
            lineHeight: 1.5,
            margin: "0 0 20px",
          }}
        >
          앱을 설치하고 열면 선생님과 자동으로 연결돼요.
        </p>
        {code ? (
          <div
            style={{
              display: "inline-block",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 2,
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "12px 18px",
              marginBottom: 24,
            }}
          >
            {code}
          </div>
        ) : null}
        <a href={APP_STORE} style={btnStyle}>
          App Store에서 받기
        </a>
        <a href={PLAY_STORE} style={btnStyle}>
          Google Play에서 받기
        </a>
        <button
          onClick={openApp}
          style={{ ...btnStyle, ...secondaryStyle, width: "100%" }}
        >
          이미 설치했어요 — 앱 열기
        </button>
      </div>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#fff",
  background: "#8b5cf6",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
  fontSize: 15,
  marginBottom: 10,
  border: "none",
  cursor: "pointer",
};

const secondaryStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
};
