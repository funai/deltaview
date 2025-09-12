# Delta View - Visual Image Diff Tool

A sophisticated visual diffing tool **specially crafted for optimal visual diff between versions of screenshots from the same page**. Creates block-by-block comparisons of two images, highlighting changes with color overlays and precise pixel-level differences. Similar to how `git diff` shows changes between text files, but designed specifically for images.

## The Webpage Screenshot Problem

Traditional image diffing tools struggle with webpage screenshots because they perform pixel-by-pixel comparisons. This creates a critical issue: **when a full-width element is inserted or removed from a webpage, all pixels below that element shift vertically, causing the entire lower portion of the image to be marked as "different" even though the content is identical — just repositioned**.

Delta View solves this by treating each row of pixels as a "line" and using Git's intelligent diff algorithms to detect content that has moved rather than changed, producing clean, readable diffs that highlight actual content changes rather than mere positional shifts.

## Features

- **Line-by-line Analysis**: Treats each row of pixels as a "line" for intelligent diff detection
- **Git Diff Integration**: Uses Git's histogram algorithm for optimal change sequence detection
- **Webpage-Optimized**: Handles vertical content shifts gracefully (insertions, deletions, reordering)
- **Multiple Algorithms**: Choose between exact pixel matching or perceptual similarity
- **Color-coded Changes**: Visual highlighting with blue (deletions), red (insertions), and pixel-level diffs

## Installation

### Prerequisites

- Node.js (v14+) or Bun
- **Git (must be installed and available in PATH) - This is required for the diff algorithm**
- TypeScript

### Quick Install

```bash
# Use directly with npx (no installation required)
npx deltaview img1.png img2.png

# Or install globally for repeated use
npm install -g deltaview
deltaview img1.png img2.png --output out.diff
```

## Usage

### Basic Syntax

```bash
# Using NPM package
npx deltaview <image1> <image2> --output <output> [options]
deltaview <image1> <image2> --output <output> [options]  # if installed globally

# or
bunx deltaview <image1> <image2> --output <output> [options]
```

### Required Arguments

- `image1`: First image for comparison (any format supported by Sharp)
- `image2`: Second image for comparison

### Optional Flags

- `--output <name>`: Filename for output image.
- `--algorithm <algo>`: Choose diff algorithm (`exact` | `perceptual`, default: `exact`)
- `--threshold <value>`: Algorithm-specific threshold (float, varies by algorithm)
- `--merge-threshold <value>`: Merge small adjacent changes (integer, default: 0)

## Visual Output

The generated diff image uses consistent color coding:

- **Light Gray**: Unchanged content (50% grayscale overlay)
- **Blue Overlay**: Deleted content (from first image)
- **Red Overlay**: Inserted content (from second image)
- **Pixel-level Diff**: Precise highlighting for replaced sections

## Important Requirements

### Git Installation
**Git must be installed and available in your system PATH.** Delta View uses Git's sophisticated diff algorithms internally to detect content that has moved rather than changed.

### Image Width Matching
**Both images should have the same width for optimal results.** If the images have different widths, every pixel line will be treated as different, which defeats the purpose of this tool's intelligent diff detection and will result in an unhelpful diff output.

## Examples

### Algorithm Options

```bash
# Use perceptual algorithm (good for screenshots with anti-aliasing)
npx deltaview img1.png img2.png --output diff.png --algorithm perceptual

# Perceptual with custom sensitivity
npx deltaview img1.png img2.png --output diff.png --algorithm perceptual --threshold 0.05

# Merge small adjacent changes
npx deltaview img1.png img2.png --output diff.png --merge-threshold 10
```

## Algorithms

### Exact Algorithm

- **Method**: MD5 hash comparison of each pixel row
- **Speed**: Very fast
- **Sensitivity**: Detects any pixel change
- **Output characteristic**: **Likely to output larger consecutive diff blocks optimal for human inspection**

```bash
npx deltaview img1.png img2.png --output diff.png --algorithm exact
```

### Perceptual Algorithm

- **Method**: Quantized color averaging + edge detection per row
- **Speed**: Moderate (2-3x slower than exact)
- **Sensitivity**: Ignores minor rendering differences (anti-aliasing, font hinting)
- **Default threshold**: 0.1
- **Output characteristic**: **Tends to output shredded and scattered thin diff blocks**

```bash
# Recommended for most webpage screenshot comparisons
npx deltaview img1.png img2.png --output diff.png --algorithm perceptual --threshold 0.1
```

## Use Cases

### Web Development (Primary Use Case)
- **Compare webpage screenshots before/after changes**: Handles content insertions, deletions, and reordering intelligently
- **Visual regression testing**: Detects actual UI changes while ignoring positional shifts
- **Cross-browser comparison**: Accounts for rendering differences between browsers
- **Responsive design validation**: Compare layouts across different viewport sizes
- **A/B testing visualization**: Highlight differences between page variants

### Document Processing
- Compare scanned document versions
- Highlight changes in PDF renderings
- Analyze form modifications

### Quality Assurance
- Visual testing for applications
- Compare rendered outputs
- Validate design implementations

## Why Delta View Works Better for Webpage Screenshots

**Traditional approach problems:**
```
Page 1: [Header][Content A][Content B][Footer]
Page 2: [Header][NEW ELEMENT][Content A][Content B][Footer]
         ↓
Traditional diff: Everything below NEW ELEMENT marked as "changed"
```

**Delta View solution:**
```
Page 1: [Header][Content A][Content B][Footer]
Page 2: [Header][NEW ELEMENT][Content A][Content B][Footer]
         ↓
Delta View: Only NEW ELEMENT marked as "inserted", rest recognized as moved
```

This line-based approach with Git's diff algorithm recognizes that content has shifted rather than changed, producing clean, actionable visual diffs.

## Advanced Options

### Merge Threshold

Controls whether small adjacent changes get merged into single replace operations:

```bash
# No merging (default, most precise)
npx deltaview img1.png img2.png --output diff.png --merge-threshold 0

# Merge changes affecting less than 10 lines
npx deltaview img1.png img2.png --output diff.png --merge-threshold 10
```

**Recommendation**: Keep at 0 for most image comparisons, as spatial precision is important for visual diffs.

### Perceptual Thresholds

Fine-tune perceptual algorithm sensitivity:

- `0.01-0.05`: High sensitivity (detects subtle differences)
- `0.1`: Default (good balance for webpage screenshots)
- `0.2-0.5`: Low sensitivity (ignores minor variations)

## Technical Details

### How It Works

1. **Line Hashing**: Each pixel row is converted to a hash (exact) or perceptual signature
2. **Diff Calculation**: Uses Git's histogram algorithm to find optimal change sequences
3. **Block Processing**: Generates visual blocks for equal, insert, delete, and replace operations
4. **Image Composition**: Combines blocks with appropriate color overlays and effects

### Performance

- **Exact algorithm**: ~50-100 images/second (depending on size)
- **Perceptual algorithm**: ~20-30 images/second
- **Memory usage**: Proportional to image height, optimized for large images

### Supported Formats

Input formats (via Sharp):
- PNG, JPEG, WebP, TIFF, GIF
- SVG, PDF (first page)
- Raw formats (DNG, CR2, NEF, etc.)

Output format:
- PNG (recommended for lossless diff preservation)

## Troubleshooting

### Common Issues

**"Error executing git diff"**
- **Ensure Git is installed and available in your PATH** (this is a critical requirement)
- Check that you have write permissions to temp directory

**"extract_area: bad extract area"**
- Usually indicates corrupted or incompatible image formats
- Try converting images to PNG first

**High memory usage**
- Large images (>10MP) may require significant RAM
- Consider resizing images for preview comparisons

**Poor diff results**
- **Ensure both images have the same width** - different widths will cause every line to be marked as different
- Use perceptual algorithm for screenshots with minor rendering differences

### Performance Tips

1. **Use appropriate algorithm**: Exact for precision, perceptual for screenshots
2. **Resize large images**: Scale down for faster processing when pixel-perfect accuracy isn't needed
3. **PNG output**: Use PNG for diff images to preserve all visual information
4. **Batch processing**: Process multiple comparisons sequentially to avoid memory issues

## Contributing

This tool combines computer vision techniques with Git's proven diff algorithms specifically to solve the webpage screenshot diffing problem. Contributions welcome for:

- Additional perceptual algorithms
- Performance optimizations
- Output format options
- Integration with other diff tools

## License

MIT License - see LICENSE file for details.
