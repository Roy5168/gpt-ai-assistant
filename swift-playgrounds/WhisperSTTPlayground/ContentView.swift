import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @StateObject private var viewModel = TranscriptionViewModel()
    @State private var showFileImporter = false

    var body: some View {
        NavigationStack {
            Form {
                inputSection
                modelSection
                outputSection
                actionSection
                logsSection
            }
            .navigationTitle("Whisper STT")
        }
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.audio, .mp3, .wav, .mpeg4Audio],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                viewModel.selectedAudioFiles = urls
            case .failure(let error):
                viewModel.logs.append("選檔失敗：\(error.localizedDescription)")
            }
        }
    }

    private var inputSection: some View {
        Section("輸入") {
            Button("選擇單一或多個音檔") {
                showFileImporter = true
            }

            if viewModel.selectedAudioFiles.isEmpty {
                Text("尚未選擇音檔")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.selectedAudioFiles, id: \.self) { file in
                    Text(file.lastPathComponent)
                }
            }
        }
    }

    private var modelSection: some View {
        Section("模型") {
            Picker("Whisper 模型", selection: $viewModel.selectedModel) {
                ForEach(WhisperModel.allCases) { model in
                    Text(model.displayName).tag(model)
                }
            }

            Picker("語言", selection: $viewModel.selectedLanguage) {
                ForEach(WhisperLanguage.allCases) { language in
                    Text(language.displayName).tag(language)
                }
            }
        }
    }

    private var outputSection: some View {
        Section("輸出") {
            Picker("格式", selection: $viewModel.exportFormat) {
                ForEach(ExportFormat.allCases) { format in
                    Text(format.displayName).tag(format)
                }
            }
        }
    }

    private var actionSection: some View {
        Section {
            Button(viewModel.isTranscribing ? "轉寫中..." : "開始批次轉寫") {
                Task {
                    await viewModel.transcribeAll()
                }
            }
            .disabled(viewModel.isTranscribing || viewModel.selectedAudioFiles.isEmpty)
        }
    }

    private var logsSection: some View {
        Section("執行紀錄") {
            if viewModel.logs.isEmpty {
                Text("尚無紀錄")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(viewModel.logs.enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(.footnote)
                }
            }
        }
    }
}
