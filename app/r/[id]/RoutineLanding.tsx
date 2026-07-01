"use client";

import { useCallback, useEffect } from "react";

const APP_STORE = "https://apps.apple.com/app/id6746711838";
const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.onmatout.app";
const ANDROID_PACKAGE = "com.onmatout.app";

// 설치된 앱을 우선 열고(딥링크), 미설치면 스토어로 유도.
// - iOS: onmatout://r/{id} 로 스킴 오픈 시도 → 안 열리면 App Store
// - Android: intent:// 로 앱 오픈 + 미설치 시 Play Store 자동 폴백
// - 카카오톡 인앱 브라우저는 유니버설/앱 링크가 안 걸리므로 이 방식이 필요.
export default function RoutineLanding({ id }: { id: string }) {
  const openApp = useCallback(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      const fallback = encodeURIComponent(PLAY_STORE);
      window.location.href =
        `intent://r/${encodeURIComponent(id)}` +
        `#Intent;scheme=onmatout;package=${ANDROID_PACKAGE};` +
        `S.browser_fallback_url=${fallback};end`;
    } else {
      window.location.href = `onmatout://r/${encodeURIComponent(id)}`;
    }
  }, [id]);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (!isIOS && !isAndroid) return; // 데스크톱은 버튼만 노출

    let storeTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      if (storeTimer) clearTimeout(storeTimer);
    };
    // 앱이 열리면 페이지가 백그라운드로 → 스토어 이동 취소
    const onHide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", cancel);

    // 앱 열기 시도
    openApp();

    // iOS 는 미설치 시 스킴이 조용히 실패하므로 타이머로 스토어 폴백.
    // Android intent 는 자체 폴백이 있어 타이머 불필요.
    if (isIOS) {
      storeTimer = setTimeout(() => {
        window.location.href = APP_STORE;
      }, 1600);
    }

    return () => {
      cancel();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", cancel);
    };
  }, [openApp]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0B0B0F",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: "#8b5cf6",
            }}
          />
          <span
            style={{
              color: "#a78bfa",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            YOGA SEQUENCE
          </span>
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>요가 시퀀스가 도착했어요</h1>
        <p
          style={{
            color: "#a1a1aa",
            fontSize: 14,
            lineHeight: 1.5,
            margin: "0 0 24px",
          }}
        >
          앱이 설치돼 있으면 자동으로 열려요.
          <br />
          열리지 않으면 아래 버튼을 눌러주세요.
        </p>
        <button
          onClick={openApp}
          style={{ ...btnStyle, width: "100%" }}
        >
          앱에서 시퀀스 열기
        </button>
        <a href={APP_STORE} style={{ ...btnStyle, ...secondaryStyle }}>
          App Store에서 받기
        </a>
        <a href={PLAY_STORE} style={{ ...btnStyle, ...secondaryStyle }}>
          Google Play에서 받기
        </a>
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
