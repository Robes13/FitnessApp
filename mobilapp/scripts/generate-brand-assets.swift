// Run from the project root on macOS:
// swift -module-cache-path /tmp/nutrify-swift-cache scripts/generate-brand-assets.swift
import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let logo = NSImage(contentsOf: root.appendingPathComponent("public/images/nutrify-logo-v2.svg"))!
let background = NSColor(srgbRed: 248 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)

func render(_ path: String, width: Int, height: Int, logoSize: CGFloat, transparent: Bool = false, round: Bool = false) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let bounds = NSRect(x: 0, y: 0, width: width, height: height)
    if !transparent {
        background.setFill()
        if round { NSBezierPath(ovalIn: bounds).fill() } else { bounds.fill() }
    }
    NSGraphicsContext.current?.imageInterpolation = .high
    // Crop the SVG's empty margins and centre the visible mark.
    let crop = NSRect(x: 140, y: 140, width: 830, height: 760)
    let markHeight = logoSize * crop.height / crop.width
    logo.draw(in: NSRect(x: (CGFloat(width) - logoSize) / 2, y: (CGFloat(height) - markHeight) / 2,
                        width: logoSize, height: markHeight),
              from: crop, operation: .sourceOver, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    var output = bitmap
    if !transparent && !round {
        let opaque = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
            bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        for y in 0..<height {
            for x in 0..<width {
                let source = bitmap.bitmapData! + y * bitmap.bytesPerRow + x * 4
                let target = opaque.bitmapData! + y * opaque.bytesPerRow + x * 3
                target[0] = source[0]; target[1] = source[1]; target[2] = source[2]
            }
        }
        output = opaque
    }
    try output.representation(using: .png, properties: [:])!.write(to: root.appendingPathComponent(path))
}

try render("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", width: 1024, height: 1024, logoSize: 700)
for (density, size, foreground) in [("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)] {
    let base = "android/app/src/main/res/mipmap-\(density)/"
    try render(base + "ic_launcher.png", width: size, height: size, logoSize: CGFloat(size) * 0.68)
    try render(base + "ic_launcher_round.png", width: size, height: size, logoSize: CGFloat(size) * 0.62, round: true)
    // Keep the entire mark inside the adaptive icon's central safe area.
    try render(base + "ic_launcher_foreground.png", width: foreground, height: foreground, logoSize: CGFloat(foreground) * 0.46, transparent: true)
}
let resources = root.appendingPathComponent("android/app/src/main/res")
for case let url as URL in FileManager.default.enumerator(at: resources, includingPropertiesForKeys: nil)! where url.lastPathComponent == "splash.png" {
    let original = NSBitmapImageRep(data: try Data(contentsOf: url))!
    let w = original.pixelsWide, h = original.pixelsHigh
    try render(String(url.path.dropFirst(root.path.count + 1)), width: w, height: h, logoSize: CGFloat(min(w, h)) * 0.24)
}
for name in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"] {
    try render("ios/App/App/Assets.xcassets/Splash.imageset/" + name, width: 2732, height: 2732, logoSize: 460)
}
try render("public/apple-touch-icon.png", width: 180, height: 180, logoSize: 124)
try render("public/favicon-32.png", width: 32, height: 32, logoSize: 27)
// ICO with a PNG payload, supported by modern browsers and desktop tooling.
let png = try Data(contentsOf: root.appendingPathComponent("public/favicon-32.png"))
var ico = Data([0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0])
for value in [UInt32(png.count), UInt32(22)] {
    var little = value.littleEndian
    withUnsafeBytes(of: &little) { ico.append(contentsOf: $0) }
}
ico.append(png)
try ico.write(to: root.appendingPathComponent("public/favicon.ico"))
try FileManager.default.removeItem(at: root.appendingPathComponent("public/favicon-32.png"))
print("Generated Nutrify app icons, splash screens, favicon and Apple touch icon.")
