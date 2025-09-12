# Delta View - Visual Image Diff Tool

A sophisticated visual diffing tool that creates block-by-block comparisons of two images, highlighting changes with color overlays and precise pixel-level differences. Similar to how `git diff` shows changes between text files, but designed specifically for images.

## Features

- **Line-by-line Analysis**: Treats each row of pixels as a "line" for intelligent diff detection
- **Git Diff Integration**: Uses Git's histogram algorithm for optimal change sequence detection
- **Multiple Algorithms**: Choose between exact pixel matching or perceptual similarity
- **Color-coded Changes**: Visual highlighting with blue (deletions), red (insertions), and pixel-level diffs
- **Smart Processing**: Applies consistent grayscale treatment for better change visibility

## Installation

### Prerequisites

- Node.js (v14+) or Bun
- Git (must be available in PATH)
- TypeScript

### Dependencies

Install the required packages:

```bash
npm install sharp pixelmatch
# or
bun install sharp pixelmatch
```

## Usage

### Basic Syntax

```bash
ts-node delta-view.ts <image1> <image2> <output> [options]
# or
bun delta-view.ts <image1> <image2> <output> [options]
```

### Required Arguments

- `image1`: First image for comparison (any format supported by Sharp)
- `image2`: Second image for comparison  
- `output`: Output filename for the diff image (PNG recommended)

### Optional Flags

- `--algorithm <algo>`: Choose diff algorithm (`exact` | `perceptual`, default: `exact`)
- `--threshold <value>`: Algorithm-specific threshold (float, varies by algorithm)
- `--merge-threshold <value>`: Merge small adjacent changes (integer, default: 0)

## Examples

### Basic Usage

```bash
# Simple diff with exact algorithm
ts-node delta-view.ts screenshot1.png screenshot2.png diff.png

# Compare PDF pages
ts-node delta-view.ts page1.jpg page2.jpg comparison.png
```

### Algorithm Options

```bash
# Use perceptual algorithm (good for screenshots with anti-aliasing)
ts-node delta-view.ts img1.png img2.png diff.png --algorithm perceptual

# Perceptual with custom sensitivity
ts-node delta-view.ts img1.png img2.png diff.png --algorithm perceptual --threshold 0.05

# Merge small adjacent changes
ts-node delta-view.ts img1.png img2.png diff.png --merge-threshold 10
```

## Algorithms

### Exact Algorithm (Default)

- **Method**: MD5 hash comparison of each pixel row
- **Best for**: Pixel-perfect comparisons, technical diagrams, precise graphics
- **Speed**: Very fast
- **Sensitivity**: Detects any pixel change

```bash
ts-node delta-view.ts img1.png img2.png diff.png --algorithm exact
```

### Perceptual Algorithm

- **Method**: Quantized color averaging + edge detection per row
- **Best for**: Screenshots, web pages, documents with anti-aliasing
- **Speed**: Moderate (2-3x slower than exact)
- **Sensitivity**: Ignores minor rendering differences
- **Default threshold**: 0.1

```bash
ts-node delta-view.ts img1.png img2.png diff.png --algorithm perceptual --threshold 0.05
```

## Visual Output

The generated diff image uses consistent color coding:

- **Light Gray**: Unchanged content (50% grayscale overlay)
- **Blue Overlay**: Deleted content (from first image)
- **Red Overlay**: Inserted content (from second image)
- **Pixel-level Diff**: Precise highlighting for replaced sections

## Use Cases

### Web Development
- Compare screenshots before/after UI changes
- Validate responsive design across devices
- Test visual regression in CI/CD pipelines

### Document Processing
- Compare scanned document versions
- Highlight changes in PDF renderings
- Analyze form modifications

### Quality Assurance
- Visual testing for applications
- Compare rendered outputs
- Validate design implementations

## Advanced Options

### Merge Threshold

Controls whether small adjacent changes get merged into single replace operations:

```bash
# No merging (default, most precise)
ts-node delta-view.ts img1.png img2.png diff.png --merge-threshold 0

# Merge changes affecting less than 10 lines
ts-node delta-view.ts img1.png img2.png diff.png --merge-threshold 10
```

**Recommendation**: Keep at 0 for most image comparisons, as spatial precision is important for visual diffs.

### Perceptual Thresholds

Fine-tune perceptual algorithm sensitivity:

- `0.01-0.05`: High sensitivity (detects subtle differences)
- `0.1`: Default (good balance)
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
- Ensure Git is installed and available in your PATH
- Check that you have write permissions to temp directory

**"extract_area: bad extract area"**
- Usually indicates corrupted or incompatible image formats
- Try converting images to PNG first

**High memory usage**
- Large images (>10MP) may require significant RAM
- Consider resizing images for preview comparisons

### Performance Tips

1. **Use appropriate algorithm**: Exact for precision, perceptual for screenshots
2. **Resize large images**: Scale down for faster processing when pixel-perfect accuracy isn't needed
3. **PNG output**: Use PNG for diff images to preserve all visual information
4. **Batch processing**: Process multiple comparisons sequentially to avoid memory issues

## Contributing

This tool combines computer vision techniques with Git's proven diff algorithms. Contributions welcome for:

- Additional perceptual algorithms
- Performance optimizations
- Output format options
- Integration with other diff tools

## License

MIT License - see LICENSE file for details.
