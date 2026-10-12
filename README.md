# 《2026 決策智慧》DIVE

dentsu Taiwan《2026 決策智慧 Decision Intelligence》的 3D 互動版本：從雨夜屋頂往下潛，經過運河、水下、深網，22 篇觀點在不同深度等你。按住空白鍵開啟魂視。

網站：[`/shell/`](shell/)（根目錄會自動轉過去）

還有「螺旋書塔」：[`/tower/`](tower/)——196 頁從書裡飛出，繞成一座可以漫步的螺旋書塔；每篇有重點摘要、原文翻閱與主題線索。

還有影像版「The New Distance」：[`/film/`](film/)——六支短片（Higgsfield：GPT Image 2.5 關鍵影格 → Kling 3.0）：序章、People、Model、A.I 各一支，最後是一張可以探索 22 篇的地圖。影片經過即時 shader 播放：游標是「AI 的眼睛」（圈內變成 ASCII），換場時畫面碎成字元飛散。影片在 `film/media/`（1080p 與 720p 兩種），關鍵影格與原始檔在 `film/media/key/`、`film/media/raw/`（不上傳）。

純靜態網站（three.js r170，從 jsDelivr 載入），不需要建置。本機預覽：雙擊 `start-shell.bat`（DIVE）、`start-film.bat`（影像版）或 `start.bat`（螺旋書塔），或在這個資料夾執行 `python -m http.server 8765`，再打開 http://localhost:8765/shell/、http://localhost:8765/film/ 或 http://localhost:8765/tower/。

© 電通行銷傳播集團。書中內容版權所有。
