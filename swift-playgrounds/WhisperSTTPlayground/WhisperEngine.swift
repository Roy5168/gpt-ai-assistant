import Foundation

protocol WhisperEngine {
    func transcribe(
        audioURL: URL,
        model: WhisperModel,
        language: WhisperLanguage
    ) async throws -> TranscriptionResult
}

/// Replace this stub with a real WhisperKit / whisper.cpp integration.
struct StubWhisperEngine: WhisperEngine {
    func transcribe(
        audioURL: URL,
        model: WhisperModel,
        language: WhisperLanguage
    ) async throws -> TranscriptionResult {
        try await Task.sleep(nanoseconds: 300_000_000)

        let simulatedText = "[\(model.rawValue)] \(audioURL.lastPathComponent) 轉寫完成（\(language.rawValue)）"

        return TranscriptionResult(
            language: language,
            fullText: simulatedText,
            segments: [
                .init(start: 0.0, end: 2.5, text: "這是第一段語音示例。"),
                .init(start: 2.5, end: 6.0, text: "你可以把這裡替換成 Whisper 真實輸出。")
            ]
        )
    }
}
