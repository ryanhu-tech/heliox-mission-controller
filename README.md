# Heliox Diving Mission Controller (V1.0)
> 引用美海軍潛水教範 V7 (U.S. Navy Diving Manual Rev 7) 的進階潛水物理模擬器

![Version](https://img.shields.io/badge/version-1.0.0-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

這是一個專為進階潛水物理教學與模擬設計的 Web 應用程式。基於美海軍潛水教範 V7，提供直覺的 Heliox 減壓路徑視覺化、氣體消耗預估以及專業 PDF 任務報表導出。

## 🚀 核心功能 (Key Features)

- **非線性動態圖表 (Non-linear Depth Axis)**：專利級視覺優化，給予減壓停留區（0-130 fsw）高達 80% 的垂直顯示空間，極大化關鍵數據的清晰度。
- **即時減壓計算**：支援 SURD O2 與 In-Water 模式切換。
- **任務報表導出 (PDF Export)**：針對 PDF 渲染引擎進行佈局優化，支援一鍵生成高清潛水任務計畫書。
- **響應式 UI (Responsive Design)**：支援手機與電腦端，並針對手機縮放操作進行了懸浮看板鎖定優化。
- **多語系支援**：內建繁體中文與英文介面。

## ⚠️ 免責聲明 (Disclaimer)

### 中文 (Traditional Chinese)
**本工具僅供學術討論與教學演示使用，嚴禁直接用於實際潛水計畫之制定。**  
潛水是一項具有潛在危險的活動，錯誤的計畫可能導致嚴重的減壓病甚至死亡。使用者在進行任何實際潛水活動前，必須取得專業機構的訓練認證，並使用經過驗證的潛水電腦表或官方教範表格。開發者不對因使用本軟體而導致的任何傷亡或損失承擔法律責任。

### English
**This tool is for educational and simulation purposes ONLY. DO NOT use it for actual dive planning.**  
Diving is a high-risk activity; incorrect planning can lead to decompression sickness or death. Always consult official diving tables or certified dive computers and ensure you have proper certification before diving. The developers are not liable for any injuries, deaths, or damages resulting from the use of this software.

## 🛠️ 技術棧 (Tech Stack)

- **Frontend**: React, Vite
- **Styling**: TailwindCSS, Lucide Icons
- **Charts**: Recharts
- **PDF Generation**: jsPDF, html2canvas

## 📅 開發日誌
詳細的開發細節與技術突破請參閱 [DEVELOPMENT_LOG.md](./docs/DEVELOPMENT_LOG.md)。

---
*Developed with ❤️ for the diving community.*
