# iPadOS 26 Swift Playgrounds：Whisper On-Device 語音轉文字 App（高標準起手式）

> 目標：在 **iPadOS 26** 的 **Swift Playgrounds** 建立可用的 on-device Whisper 轉寫工具，具備：
>
> 1. 多音檔匯入（單檔 / 多檔）  
> 2. 模型切換（tiny / base / small / medium / large / turbo）  
> 3. 語言選擇  
> 4. 匯出格式：`.txt`、`.srt`、`.md`

---

## 1) 技術架構（建議）

- **UI**：SwiftUI（Playgrounds 原生）
- **檔案選擇**：`fileImporter`（支援多選）
- **推論引擎**：
  - 建議方案 A：`WhisperKit`（Swift-friendly，整合速度快）
  - 備案方案 B：`whisper.cpp` + C/ObjC bridge（更底層、可客製）
- **模型管理**：本地 Models 資料夾（依檔名辨識模型尺寸）
- **輸出**：
  - TXT：純文字
  - SRT：分段時間戳
  - Markdown：標題 + 段落 + 可選時間碼

---

## 2) 建議資料夾結構

```text
WhisperPlayground/
  App.swift
  ContentView.swift
  Features/
    TranscriptionViewModel.swift
    Exporter.swift
    Segment.swift
    WhisperService.swift
  Resources/
    Models/
      ggml-tiny.bin
      ggml-base.bin
      ggml-small.bin
      ggml-medium.bin
      ggml-large-v3.bin
      ggml-large-v3-turbo.bin
```

---

## 3) 核心資料模型

```swift
import Foundation

enum WhisperModel: String, CaseIterable, Identifiable {
    case tiny, base, small, medium, large, turbo

    var id: String { rawValue }

    /// 依你的實際模型檔命名調整
    var filename: String {
        switch self {
        case .tiny: return "ggml-tiny.bin"
        case .base: return "ggml-base.bin"
        case .small: return "ggml-small.bin"
        case .medium: return "ggml-medium.bin"
        case .large: return "ggml-large-v3.bin"
        case .turbo: return "ggml-large-v3-turbo.bin"
        }
    }
}

enum OutputFormat: String, CaseIterable, Identifiable {
    case txt = "TXT"
    case srt = "SRT"
    case markdown = "Markdown"

    var id: String { rawValue }

    var `extension`: String {
        switch self {
        case .txt: return "txt"
        case .srt: return "srt"
        case .markdown: return "md"
        }
    }
}

struct Segment: Identifiable, Hashable {
    let id = UUID()
    let start: TimeInterval
    let end: TimeInterval
    let text: String
}

struct TranscriptionResult {
    let language: String
    let fullText: String
    let segments: [Segment]
}
```

---

## 4) Whisper 服務層（可替換實作）

> 下方為 **介面優先** 設計。你可先把 app 流程跑起來，再替換實際推論邏輯。

```swift
import Foundation

protocol WhisperServiceProtocol {
    func transcribe(
        audioURL: URL,
        model: WhisperModel,
        language: String
    ) async throws -> TranscriptionResult
}

final class WhisperService: WhisperServiceProtocol {
    func transcribe(
        audioURL: URL,
        model: WhisperModel,
        language: String
    ) async throws -> TranscriptionResult {
        // TODO: 接 WhisperKit 或 whisper.cpp
        // 目前先給 stub，讓 UI/流程可先完成
        return TranscriptionResult(
            language: language,
            fullText: "[stub] \(audioURL.lastPathComponent) transcription",
            segments: [
                Segment(start: 0, end: 3.2, text: "這是第一段示例"),
                Segment(start: 3.2, end: 7.8, text: "這是第二段示例")
            ]
        )
    }
}
```

---

## 5) 匯出器（TXT / SRT / Markdown）

```swift
import Foundation

enum Exporter {
    static func render(_ result: TranscriptionResult, as format: OutputFormat) -> String {
        switch format {
        case .txt:
            return result.fullText
        case .srt:
            return renderSRT(result.segments)
        case .markdown:
            return renderMarkdown(result)
        }
    }

    static func renderSRT(_ segments: [Segment]) -> String {
        segments.enumerated().map { idx, seg in
            """
            \(idx + 1)
            \(srtTime(seg.start)) --> \(srtTime(seg.end))
            \(seg.text)

            """
        }.joined()
    }

    static func renderMarkdown(_ result: TranscriptionResult) -> String {
        var lines: [String] = []
        lines.append("# Transcription")
        lines.append("")
        lines.append("- Language: \(result.language)")
        lines.append("")
        for seg in result.segments {
            lines.append("## [\(mmss(seg.start)) - \(mmss(seg.end))]")
            lines.append(seg.text)
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }

    private static func srtTime(_ t: TimeInterval) -> String {
        let totalMs = Int((t * 1000).rounded())
        let ms = totalMs % 1000
        let totalSec = totalMs / 1000
        let sec = totalSec % 60
        let totalMin = totalSec / 60
        let min = totalMin % 60
        let hour = totalMin / 60
        return String(format: "%02d:%02d:%02d,%03d", hour, min, sec, ms)
    }

    private static func mmss(_ t: TimeInterval) -> String {
        let totalSec = Int(t.rounded())
        return String(format: "%02d:%02d", totalSec / 60, totalSec % 60)
    }
}
```

---

## 6) ViewModel（多音檔批次 + 模型/語言/格式設定）

```swift
import Foundation
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class TranscriptionViewModel: ObservableObject {
    @Published var selectedAudioURLs: [URL] = []
    @Published var selectedModel: WhisperModel = .tiny
    @Published var selectedLanguage: String = "zh"
    @Published var selectedFormat: OutputFormat = .txt
    @Published var isRunning = false
    @Published var logs: [String] = []

    private let service: WhisperServiceProtocol

    init(service: WhisperServiceProtocol = WhisperService()) {
        self.service = service
    }

    func runBatch() async {
        guard !selectedAudioURLs.isEmpty else {
            logs.append("請先選擇音檔")
            return
        }

        isRunning = true
        defer { isRunning = false }

        for audioURL in selectedAudioURLs {
            do {
                logs.append("開始轉寫：\(audioURL.lastPathComponent)")
                let result = try await service.transcribe(
                    audioURL: audioURL,
                    model: selectedModel,
                    language: selectedLanguage
                )
                try save(result: result, for: audioURL)
                logs.append("完成：\(audioURL.lastPathComponent)")
            } catch {
                logs.append("失敗：\(audioURL.lastPathComponent) - \(error.localizedDescription)")
            }
        }
    }

    private func save(result: TranscriptionResult, for audioURL: URL) throws {
        let content = Exporter.render(result, as: selectedFormat)
        let base = audioURL.deletingPathExtension().lastPathComponent
        let outputURL = audioURL.deletingLastPathComponent().appendingPathComponent(
            "\(base)_transcribed.\(selectedFormat.extension)"
        )
        try content.write(to: outputURL, atomically: true, encoding: .utf8)
    }
}
```

---

## 7) SwiftUI 畫面（你要的三大區塊）

```swift
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var vm = TranscriptionViewModel()
    @State private var showImporter = false

    var body: some View {
        NavigationStack {
            Form {
                Section("輸入") {
                    Button("選擇單一或多個音檔") {
                        showImporter = true
                    }
                    if vm.selectedAudioURLs.isEmpty {
                        Text("尚未選擇音檔")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(vm.selectedAudioURLs, id: \.self) { url in
                            Text(url.lastPathComponent)
                        }
                    }
                }

                Section("模型") {
                    Picker("Whisper 模型", selection: $vm.selectedModel) {
                        ForEach(WhisperModel.allCases) { m in
                            Text(m.rawValue).tag(m)
                        }
                    }
                    Picker("語言", selection: $vm.selectedLanguage) {
                        Text("中文").tag("zh")
                        Text("英文").tag("en")
                        Text("日文").tag("ja")
                        Text("自動偵測").tag("auto")
                    }
                }

                Section("輸出") {
                    Picker("格式", selection: $vm.selectedFormat) {
                        ForEach(OutputFormat.allCases) { format in
                            Text(format.rawValue).tag(format)
                        }
                    }
                }

                Section {
                    Button(vm.isRunning ? "轉寫中..." : "開始批次轉寫") {
                        Task { await vm.runBatch() }
                    }
                    .disabled(vm.isRunning || vm.selectedAudioURLs.isEmpty)
                }

                Section("執行紀錄") {
                    if vm.logs.isEmpty {
                        Text("尚無紀錄")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(Array(vm.logs.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.footnote)
                        }
                    }
                }
            }
            .navigationTitle("Whisper STT")
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: [
                UTType.audio,
                UTType.mp3,
                UTType.wav,
                UTType.mpeg4Audio
            ],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                vm.selectedAudioURLs = urls
            case .failure(let err):
                vm.logs.append("選檔失敗：\(err.localizedDescription)")
            }
        }
    }
}
```

---

## 8) Whisper 實作接線提示

### A. WhisperKit 路線（推薦先做）

- 優點：Swift API 友善、開發速度快。
- 你要做的事：
  1. 加入 package。
  2. 在 `WhisperService.transcribe` 中初始化模型路徑。
  3. 呼叫轉寫 API，將回傳段落映射成 `Segment`。

### B. whisper.cpp 路線（效能/控制）

- 優點：底層可控、社群成熟。
- 缺點：Playgrounds 上整合 C++ bridge 較繁瑣。
- 建議：先在 Xcode 專案驗證，成功後再搬到 Playgrounds。

---

## 9) 你現在就能先完成的里程碑

1. 先把上面的 `stub` 版本跑起來（UI + 多檔 + 匯出）。
2. 確認 `.txt/.srt/.md` 皆可產出。
3. 再替換 `WhisperService.transcribe` 為真實推論。
4. 針對大模型（large/turbo）加入「記憶體不足」提示與 fallback（例如自動降為 `small`）。

---

## 10) 高標準實務建議

- 批次作業加入每檔進度與取消按鈕。
- SRT 段落加上最大字數切分，避免單條字幕過長。
- 輸出檔名加入時間戳，避免覆蓋舊檔。
- 若 `language = auto`，完成後在報表標示偵測語言。
- 為 `tiny -> turbo` 建立預估速度 / 記憶體提示文案，提升 UX。

---

如果你要，我下一步可以直接給你 **可貼上 Swift Playgrounds 的完整檔案版（逐檔案）**，包含：
- `App.swift`
- `ContentView.swift`
- `TranscriptionViewModel.swift`
- `Exporter.swift`
- `WhisperService.swift`（WhisperKit 實作版）
