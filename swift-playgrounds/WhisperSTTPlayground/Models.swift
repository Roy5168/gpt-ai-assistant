import Foundation

enum WhisperModel: String, CaseIterable, Identifiable {
    case tiny
    case base
    case small
    case medium
    case large
    case turbo

    var id: String { rawValue }

    var displayName: String {
        rawValue.capitalized
    }

    // Adjust to your local model filenames.
    var modelFileName: String {
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

enum WhisperLanguage: String, CaseIterable, Identifiable {
    case auto
    case zh
    case en
    case ja

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .auto: return "Auto"
        case .zh: return "中文"
        case .en: return "English"
        case .ja: return "日本語"
        }
    }
}

enum ExportFormat: String, CaseIterable, Identifiable {
    case txt
    case srt
    case markdown

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .txt: return "Text (.txt)"
        case .srt: return "SubRip (.srt)"
        case .markdown: return "Markdown (.md)"
        }
    }

    var fileExtension: String {
        switch self {
        case .txt: return "txt"
        case .srt: return "srt"
        case .markdown: return "md"
        }
    }
}

struct TranscriptionSegment: Identifiable, Hashable {
    let id = UUID()
    let start: TimeInterval
    let end: TimeInterval
    let text: String
}

struct TranscriptionResult {
    let language: WhisperLanguage
    let fullText: String
    let segments: [TranscriptionSegment]
}
