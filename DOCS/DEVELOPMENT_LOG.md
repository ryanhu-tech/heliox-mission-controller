# 開發經驗與故障排除記錄 (Lessons Learned)

## 1. PDF 導出與 Tailwind 4 色彩相容性 (CRITICAL)
*   **錯誤訊息**：`Attempting to parse an unsupported color function "oklab"`
*   **根本原因**：
    *   Tailwind 4 預設使用現代色彩空間 (`oklch`, `oklab`) 來處理陰影 (`shadow-2xl`)、濾鏡 (`backdrop-blur`) 與環繞線 (`ring`)。
    *   `html2canvas` 1.4.1 版尚未支援解析這類現代色彩函數。
*   **解決方案**：
    *   **避免使用高階特效**：在報表區域內，嚴禁使用 `shadow-2xl`, `backdrop-blur-xl` 等會觸發 oklab 的類名。
    *   **強制 HEX 化**：所有的顏色變數、背景色、邊框色必須明確指定為 `#RRGGBB` 格式。
    *   **降級考慮**：若專案高度依賴視覺特效且需導出 PDF，建議使用 Tailwind 3。

## 2. GitHub Actions 部署分支設定
*   **錯誤現象**：Push 後 Actions 沒有觸發，或是 Pages 顯示 404。
*   **檢查清單**：
    *   `.github/workflows/deploy.yml` 中的 `on.push.branches` 必須與目前的 `master` 分支名稱完全一致。
    *   Vite 的 `base` 設定必須是 `'./'` 或正確的 Repo 路徑。

## 3. PDF 導出的 DOM 穩定性
*   **經驗**：不要在導出的瞬間進行過於複雜的 DOM 切換（如頻繁切換主題），這會導致擷取到的畫面與預期不符。
*   **優化**：使用 `onclone` 回調來對擷取用的 DOM 副本進行微調，而不是改動使用者正在看的畫面。
