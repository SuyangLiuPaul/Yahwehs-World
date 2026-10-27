import Foundation
import Vision

struct OCRHit: Encodable {
    let text: String
    let confidence: Float
    let box: [Double]
}

struct OCRResult: Encodable {
    let path: String
    let languages: [String]
    let hits: [OCRHit]
}

let paths = CommandLine.arguments.dropFirst()
guard !paths.isEmpty else {
    fputs("Usage: swift ocr_text_free_images.swift IMAGE [IMAGE ...]\n", stderr)
    exit(2)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
let languages = ["zh-Hans", "zh-Hant", "en-US"]

for path in paths {
    do {
        let url = URL(fileURLWithPath: path)
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = languages
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.006
        try VNImageRequestHandler(url: url).perform([request])

        let hits = (request.results ?? []).compactMap { observation -> OCRHit? in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return OCRHit(
                text: candidate.string,
                confidence: candidate.confidence,
                box: [Double(box.origin.x), Double(box.origin.y), Double(box.width), Double(box.height)]
            )
        }
        let result = OCRResult(path: url.path, languages: languages, hits: hits)
        let data = try encoder.encode(result)
        print(String(decoding: data, as: UTF8.self))
    } catch {
        fputs("OCR failed for \(path): \(error)\n", stderr)
        exit(1)
    }
}
