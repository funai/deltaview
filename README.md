# Delta View - Visual Image Diff Tool

A sophisticated visual diffing tool **specially crafted for optimal visual diff between versions of screenshots from the same page**. Creates block-by-block comparisons of two images, highlighting changes with color overlays and precise pixel-level differences. Similar to how `git diff` shows changes between text files, but designed specifically for images.

## The Webpage Screenshot Problem

Traditional image diffing tools struggle with webpage screenshots because they perform pixel-by-pixel comparisons. This creates a critical issue: when a full-width element is inserted or removed from a webpage, all pixels below that element shift vertically, causing the entire lower portion of the image to be marked as "different" even though the content is identical — just repositioned.

Delta View solves this by treating each row of pixels as a "line" and using Git's intelligent diff algorithms to detect content that has moved rather than changed, producing clean, readable diffs that highlight actual content changes rather than mere positional shifts.

## Features

- **Line-by-line Analysis**: Treats each row of pixels as a "line" for intelligent diff detection
- **Git Diff Integration**: Uses Git's histogram algorithm for optimal change sequence detection
- **Webpage-Optimized**: Handles vertical content shifts gracefully (insertions, deletions, reordering)
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
```

## Usage

### Basic Syntax

```bash
# Using NPM package
npx deltaview <image1> <image2> [options]
deltaview <image1> <image2> [options]  # if installed globally
```

### Required Arguments

- `image1`: First (before or base) image for comparison (any format supported by Sharp)
- `image2`: Second (after or test) image for comparison

### Options

- `--output <filename>`: Output filename for the diff image. (Default: `image-diff.png`)
- `--diff <name>`: The algorithm to use for the diff. (Choices: `myers`, `minimal`, `patience`, `histogram`, Default: `histogram`)
- `--threshold <value>`: Matching threshold for pixelmatch (0 to 1). Smaller values are more sensitive. (Default: `0.1`)
- `--include-aa`: A boolean flag to include anti-aliased pixels in the diff. By default, they are ignored.

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

### How It Works

1. **Line Hashing**: Each pixel row is converted to an MD5 hash.
2. **Diff Calculation**: Uses Git's histogram algorithm to find optimal change sequences
3. **Block Processing**: Generates visual blocks for equal, insert, delete, and replace operations
4. **Image Composition**: Combines blocks with appropriate color overlays and effects

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

### Performance Tips

1. **Resize large images**: Scale down for faster processing when pixel-perfect accuracy isn't needed
2. **PNG output**: Use PNG for diff images to preserve all visual information

## License

MIT License - see LICENSE file for details.
