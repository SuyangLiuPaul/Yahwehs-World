import Foundation
import Vision
import ImageIO
import CoreGraphics

struct HitResult: Encodable {
    let text: String
    let confidence: Float
    let uncoveredPixels: Int
    let checkedPixels: Int
    let uncoveredBoundsXYXY: [Int]?
}

struct Report: Encodable {
    let source: String
    let mask: String
    let maskConvention: String
    let hits: [HitResult]
    let allHitsCovered: Bool
}

func loadCGImage(_ path: String) throws -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "TextMaskOCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not load image: \(path)"])
    }
    return image
}

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift verify_text_mask_ocr.swift SOURCE_IMAGE MASK_PNG\n", stderr)
    exit(2)
}

let sourcePath = CommandLine.arguments[1]
let maskPath = CommandLine.arguments[2]

do {
    let sourceImage = try loadCGImage(sourcePath)
    let maskImage = try loadCGImage(maskPath)
    guard sourceImage.width == maskImage.width, sourceImage.height == maskImage.height else {
        throw NSError(domain: "TextMaskOCR", code: 3, userInfo: [NSLocalizedDescriptionKey: "Source and mask dimensions must match"])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.006
    try VNImageRequestHandler(url: URL(fileURLWithPath: sourcePath)).perform([request])

    guard maskImage.bitsPerPixel == 32,
          maskImage.alphaInfo == .last || maskImage.alphaInfo == .premultipliedLast,
          let maskData = maskImage.dataProvider?.data as Data? else {
        throw NSError(domain: "TextMaskOCR", code: 2, userInfo: [NSLocalizedDescriptionKey: "Mask must be an 8-bit RGBA PNG with alpha in the last channel"])
    }
    let width = maskImage.width
    let height = maskImage.height
    let bytesPerPixel = maskImage.bitsPerPixel / 8
    let hits = (request.results ?? []).compactMap { observation -> HitResult? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        let minX = max(0, Int(floor(box.minX * CGFloat(width))) - 1)
        let maxX = min(width, Int(ceil(box.maxX * CGFloat(width))) + 1)
        let minY = max(0, Int(floor((1 - box.maxY) * CGFloat(height))) - 1)
        let maxY = min(height, Int(ceil((1 - box.minY) * CGFloat(height))) + 1)
        var checked = 0
        var uncovered = 0
        var uncoveredMinX = width
        var uncoveredMinY = height
        var uncoveredMaxX = -1
        var uncoveredMaxY = -1
        for yTop in minY..<maxY {
            for x in minX..<maxX {
                let alpha = maskData[yTop * maskImage.bytesPerRow + x * bytesPerPixel + 3]
                checked += 1
                if alpha > 32 {
                    uncovered += 1
                    uncoveredMinX = min(uncoveredMinX, x)
                    uncoveredMinY = min(uncoveredMinY, yTop)
                    uncoveredMaxX = max(uncoveredMaxX, x + 1)
                    uncoveredMaxY = max(uncoveredMaxY, yTop + 1)
                }
            }
        }
        let bounds = uncovered == 0 ? nil : [uncoveredMinX, uncoveredMinY, uncoveredMaxX, uncoveredMaxY]
        return HitResult(text: candidate.string, confidence: candidate.confidence, uncoveredPixels: uncovered, checkedPixels: checked, uncoveredBoundsXYXY: bounds)
    }

    let report = Report(
        source: sourcePath,
        mask: maskPath,
        maskConvention: "Transparent pixels (alpha <= 32) are editable; OCR boxes are expanded by 1px before testing.",
        hits: hits,
        allHitsCovered: hits.allSatisfy { $0.uncoveredPixels == 0 }
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    print(String(decoding: try encoder.encode(report), as: UTF8.self))
    if !report.allHitsCovered { exit(1) }
} catch {
    fputs("Text-mask OCR check failed: \(error)\n", stderr)
    exit(1)
}
