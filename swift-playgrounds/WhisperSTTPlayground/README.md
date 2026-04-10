# WhisperSTTPlayground

這是一組可直接貼到 **Swift Playgrounds (iPadOS)** 的最小可運行程式碼，包含：

- 單一/多音檔選擇
- Whisper 模型選擇（tiny ~ turbo）
- 語言選擇（auto / zh / en / ja）
- 輸出格式選擇（txt / srt / md）
- 批次轉寫與匯出（目前為 Stub 引擎，可替換成 WhisperKit 或 whisper.cpp）

## 檔案

- `App.swift`: App 入口
- `ContentView.swift`: UI（輸入/模型/輸出）
- `Models.swift`: 模型、語言、輸出格式、結果資料結構
- `WhisperEngine.swift`: 推論抽象與 Stub 實作
- `TranscriptionViewModel.swift`: 批次流程與狀態管理
- `Exporter.swift`: TXT/SRT/Markdown 匯出

## 下一步

1. 把 `StubWhisperEngine` 改成 WhisperKit/whisper.cpp 真實推論。
2. 將模型檔放到可讀路徑，依 `WhisperModel.modelFileName` 對應。
3. 加入錯誤處理（記憶體不足時自動降級模型）。
