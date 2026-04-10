import Foundation

enum Exporter {
    static func makeContent(result: TranscriptionResult, format: ExportFormat) -> String {
        switch format {
        case .txt:
            return result.fullText
        case .srt:
            return makeSRT(result.segments)
        case .markdown:
            return makeMarkdown(result)
        }
    }

    static func export(
        result: TranscriptionResult,
        sourceAudioURL: URL,
        format: ExportFormat
    ) throws -> URL {
        let content = makeContent(result: result, format: format)
        let baseName = sourceAudioURL.deletingPathExtension().lastPathComponent
        let outputURL = sourceAudioURL
            .deletingLastPathComponent()
            .appendingPathComponent("\(baseName)_transcript.\(format.fileExtension)")

        try content.write(to: outputURL, atomically: true, encoding: .utf8)
        return outputURL
    }

    private static func makeSRT(_ segments: [TranscriptionSegment]) -> String {
        segments.enumerated().map { index, segment in
            """
            \(index + 1)
            \(formatSRTTime(segment.start)) --> \(formatSRTTime(segment.end))
            \(segment.text)

            """
        }
        .joined()
    }

    private static func makeMarkdown(_ result: TranscriptionResult) -> String {
        var lines: [String] = []
        lines.append("# Whisper Transcription")
        lines.append("")
        lines.append("- Language: \(result.language.displayName)")
        lines.append("")

        for segment in result.segments {
            lines.append("## [\(formatMinuteSecond(segment.start)) - \(formatMinuteSecond(segment.end))]")
            lines.append(segment.text)
            lines.append("")
        }

        return lines.joined(separator: "\n")
    }

    private static func formatSRTTime(_ t: TimeInterval) -> String {
        let totalMS = Int((t * 1000).rounded())
        let ms = totalMS % 1000
        let totalSec = totalMS / 1000
        let sec = totalSec % 60
        let totalMin = totalSec / 60
        let min = totalMin % 60
        let hour = totalMin / 60
        return String(format: "%02d:%02d:%02d,%03d", hour, min, sec, ms)
    }

    private static func formatMinuteSecond(_ t: TimeInterval) -> String {
        let sec = Int(t.rounded())
        return String(format: "%02d:%02d", sec / 60, sec % 60)
    }
}
