import Foundation

@MainActor
final class TranscriptionViewModel: ObservableObject {
    @Published var selectedAudioFiles: [URL] = []
    @Published var selectedModel: WhisperModel = .tiny
    @Published var selectedLanguage: WhisperLanguage = .zh
    @Published var exportFormat: ExportFormat = .txt
    @Published var isTranscribing = false
    @Published var logs: [String] = []

    private let engine: WhisperEngine

    init(engine: WhisperEngine = StubWhisperEngine()) {
        self.engine = engine
    }

    func transcribeAll() async {
        guard !selectedAudioFiles.isEmpty else {
            logs.append("請先選擇至少一個音檔。")
            return
        }

        isTranscribing = true
        defer { isTranscribing = false }

        for audioURL in selectedAudioFiles {
            do {
                logs.append("開始：\(audioURL.lastPathComponent)")

                let result = try await engine.transcribe(
                    audioURL: audioURL,
                    model: selectedModel,
                    language: selectedLanguage
                )

                let outputURL = try Exporter.export(
                    result: result,
                    sourceAudioURL: audioURL,
                    format: exportFormat
                )

                logs.append("完成：\(outputURL.lastPathComponent)")
            } catch {
                logs.append("失敗：\(audioURL.lastPathComponent) | \(error.localizedDescription)")
            }
        }
    }
}
