#!/usr/bin/env node

import * as crypto from 'crypto';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// A type for raw image data and its metadata
type RawImage = { data: Buffer; info: sharp.OutputInfo };

// Type definition for opcodes, mimicking Python's difflib
type Opcode = ['equal' | 'insert' | 'delete' | 'replace', number, number, number, number];

// Options for the visual diff algorithm
interface VisualDiffOptions {
    algorithm?: 'exact' | 'perceptual';
    threshold?: number;
    output?: string;
    mergeThreshold?: number;
}

/**
 * Generates an array of MD5 hashes, one for each row of pixels in the image.
 */
function exactLineHashes(img: RawImage): string[] {
    const hashes: string[] = [];
    const { data, info } = img;
    const { width, channels } = info;
    const stride = width * channels;

    for (let y = 0; y < info.height; y++) {
        const start = y * stride;
        const end = start + stride;
        const row = data.slice(start, end);
        const hash = crypto.createHash('md5').update(row).digest('hex');
        hashes.push(hash);
    }
    return hashes;
}

/**
 * Generates perceptual hashes for each row using a simplified approach.
 * This implementation uses average color values and edge detection.
 */
function perceptualLineHashes(img: RawImage, threshold = 0.1): string[] {
    const hashes: string[] = [];
    const { data, info } = img;
    const { width, channels } = info;
    const stride = width * channels;

    for (let y = 0; y < info.height; y++) {
        const start = y * stride;
        const end = start + stride;
        const row = data.slice(start, end);
        
        // Calculate average RGB values
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < row.length; i += channels) {
            r += row[i];
            g += row[i + 1];
            b += row[i + 2];
            count++;
        }
        
        if (count > 0) {
            r = Math.round(r / count / 16) * 16; // Quantize to reduce sensitivity
            g = Math.round(g / count / 16) * 16;
            b = Math.round(b / count / 16) * 16;
        }
        
        // Simple edge detection - count significant color changes
        let edges = 0;
        for (let i = 0; i < row.length - channels; i += channels) {
            const dr = Math.abs(row[i] - row[i + channels]);
            const dg = Math.abs(row[i + 1] - row[i + channels + 1]);
            const db = Math.abs(row[i + 2] - row[i + channels + 2]);
            if (dr + dg + db > 30) edges++;
        }
        
        // Create hash from average colors and edge count
        const perceptualData = `${r},${g},${b},${Math.floor(edges / 5)}`;
        const hash = crypto.createHash('md5').update(perceptualData).digest('hex');
        hashes.push(hash);
    }
    return hashes;
}

/**
 * Generates line hashes based on the selected algorithm.
 */
function generateLineHashes(img1: RawImage, img2: RawImage, algorithm: string, threshold?: number): { hashes1: string[], hashes2: string[] } {
    switch (algorithm) {
        case 'perceptual':
            return {
                hashes1: perceptualLineHashes(img1, threshold),
                hashes2: perceptualLineHashes(img2, threshold)
            };
        case 'exact':
        default:
            return {
                hashes1: exactLineHashes(img1),
                hashes2: exactLineHashes(img2)
            };
    }
}

/**
 * Creates a buffer representing a block of solid color.
 */
async function createColorBlock(width: number, height: number, color: sharp.Color): Promise<RawImage> {
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: color,
        },
    }).raw().toBuffer({ resolveWithObject: true });
}

/**
 * Overlays a semi-transparent color onto an image block.
 */
async function overlayColor(imgBuffer: Buffer, width: number, height: number, color: sharp.Color): Promise<Buffer> {
    const colorBlock = await createColorBlock(width, height, color);
    return sharp(imgBuffer, { raw: { width, height, channels: 4 } })
        .composite([{ input: colorBlock.data, raw: colorBlock.info, blend: 'over' }])
        .toBuffer();
}

/**
 * Converts an image block to a lighter grayscale.
 */
async function lighterGrayscale(imgBuffer: Buffer, width: number, height: number, factor = 0.5): Promise<Buffer> {
    const whiteBlock = await createColorBlock(width, height, { r: 255, g: 255, b: 255, alpha: factor });
    const grayscaleBuffer = await sharp(imgBuffer, { raw: { width, height, channels: 4 } }).grayscale().toBuffer();

    // Composite the grayscale image with a semi-transparent white layer
    return sharp(grayscaleBuffer, { raw: { width, height, channels: 1 } })
        .composite([{ input: whiteBlock.data, raw: whiteBlock.info, blend: 'over' }])
        .toBuffer();
}

/**
 * Converts an image block to grayscale and then overlays a color.
 */
async function grayscaleWithColorOverlay(imgBuffer: Buffer, width: number, height: number, color: sharp.Color, grayscaleFactor = 0.5): Promise<Buffer> {
    // First apply the lighter grayscale effect
    const grayscaleBuffer = await lighterGrayscale(imgBuffer, width, height, grayscaleFactor);
    
    // Then apply the color overlay
    return overlayColor(grayscaleBuffer, width, height, color);
}

/**
 * Compares two image blocks using pixelmatch and composites the resulting diff
 * onto a clone of the second block.
 */
async function perPixelDiffBlock(block1: RawImage, block2: RawImage): Promise<Buffer> {
    const { width, height } = block1.info;
    const diffBuffer = Buffer.alloc(width * height * 4);

    pixelmatch(
        block1.data,
        block2.data,
        diffBuffer,
        width,
        height,
        { threshold: 0.1, includeAA: true }
    );

    return sharp(block2.data, { raw: { width, height, channels: 4 } })
        .composite([{ input: diffBuffer, raw: { width, height, channels: 4 } }])
        .toBuffer();
}

/**
 * Parses the output of 'git diff' into opcodes.
 */
function parseGitDiff(diffOutput: string, len1: number, len2: number): Opcode[] {
    const opcodes: Opcode[] = [];
    const lines = diffOutput.split('\n');
    const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

    let last_a1 = 0;
    let last_b1 = 0;

    for (const line of lines) {
        if (!line.startsWith('@@')) continue;

        const match = line.match(hunkRegex);
        if (!match) continue;

        const a0 = parseInt(match[1], 10) - 1;
        const a_len = parseInt(match[2] ?? '1', 10);
        const b0 = parseInt(match[3], 10) - 1;
        const b_len = parseInt(match[4] ?? '1', 10);

        if (a0 > last_a1) {
            opcodes.push(['equal', last_a1, a0, last_b1, b0]);
        }

        const a1 = a0 + a_len;
        const b1 = b0 + b_len;

        if (a_len > 0 && b_len > 0) {
            opcodes.push(['replace', a0, a1, b0, b1]);
        } else if (a_len > 0) {
            opcodes.push(['delete', a0, a1, b0, b1]);
        } else if (b_len > 0) {
            opcodes.push(['insert', a0, a1, b0, b1]);
        }
        
        last_a1 = a1;
        last_b1 = b1;
    }

    if (last_a1 < len1 || last_b1 < len2) {
        opcodes.push(['equal', last_a1, len1, last_b1, len2]);
    }

    return opcodes;
}

/**
 * Uses git diff to get opcodes.
 */
async function gitDiffOpcodes(hashes1: string[], hashes2: string[]): Promise<Opcode[]> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delta-view-'));
    const file1Path = path.join(tempDir, 'file1.txt');
    const file2Path = path.join(tempDir, 'file2.txt');

    try {
        await fs.writeFile(file1Path, hashes1.join('\n'));
        await fs.writeFile(file2Path, hashes2.join('\n'));

        const command = `git diff --no-index --diff-algorithm=histogram --unified=0 "${file1Path}" "${file2Path}"`;

        return await new Promise<Opcode[]>((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    if (error.code === 1) { // Differences found
                        resolve(parseGitDiff(stdout, hashes1.length, hashes2.length));
                    } else {
                        console.error(`Error executing git diff: ${stderr}`);
                        reject(error);
                    }
                } else { // No differences
                    resolve([['equal', 0, hashes1.length, 0, hashes2.length]]);
                }
            });
        });
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

/**
 * Merges small, adjacent 'delete' and 'insert' blocks into a single 'replace' block.
 */
function mergeSmallAlternatingChanges(opcodes: Opcode[], threshold = 0): Opcode[] {
    if (opcodes.length === 0 || threshold === 0) {
        return opcodes;
    }

    const mergedOpcodes: Opcode[] = [];
    let changeGroup: Opcode[] = [];

    for (const opcode of opcodes) {
        const [type] = opcode;
        const isChange = type === 'delete' || type === 'insert';

        if (isChange) {
            changeGroup.push(opcode);
        } else {
            if (changeGroup.length > 0) {
                const group_a0 = changeGroup[0][1];
                const group_a1 = changeGroup[changeGroup.length - 1][2];
                const group_b0 = changeGroup[0][3];
                const group_b1 = changeGroup[changeGroup.length - 1][4];

                if (Math.max(group_a1 - group_a0, group_b1 - group_b0) < threshold) {
                    mergedOpcodes.push(['replace', group_a0, group_a1, group_b0, group_b1]);
                } else {
                    mergedOpcodes.push(...changeGroup);
                }
                changeGroup = [];
            }
            mergedOpcodes.push(opcode);
        }
    }

    if (changeGroup.length > 0) {
        const group_a0 = changeGroup[0][1];
        const group_a1 = changeGroup[changeGroup.length - 1][2];
        const group_b0 = changeGroup[0][3];
        const group_b1 = changeGroup[changeGroup.length - 1][4];

        if (Math.max(group_a1 - group_a0, group_b1 - group_b0) < threshold) {
            mergedOpcodes.push(['replace', group_a0, group_a1, group_b0, group_b1]);
        } else {
            mergedOpcodes.push(...changeGroup);
        }
    }

    return mergedOpcodes;
}

/**
 * The main visual diffing function with algorithm options.
 */
async function visualDiff(
    image1: string,
    image2: string,
    options: VisualDiffOptions = {}
): Promise<void> {
    const {
        algorithm = 'exact',
        threshold,
        output = 'image-diff.png',
        mergeThreshold = 0
    } = options;

    const [img1, img2] = await Promise.all([
        sharp(image1).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
        sharp(image2).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);

    const width = Math.min(img1.info.width, img2.info.width);

    console.log(`[*] Using algorithm: ${algorithm}${threshold ? ` (threshold: ${threshold})` : ''}`);

    const { hashes1, hashes2 } = generateLineHashes(img1, img2, algorithm, threshold);

    let opcodes = await gitDiffOpcodes(hashes1, hashes2);

    if (mergeThreshold > 0) {
        opcodes = mergeSmallAlternatingChanges(opcodes, mergeThreshold);
    }

    const blocks: { image: Buffer; height: number }[] = [];

    for (const [opcode, a0, a1, b0, b1] of opcodes) {
        if (opcode === 'equal') {
            const height = a1 - a0;
            if (height === 0) continue;
            const blockBuffer = await sharp(img1.data, { raw: img1.info }).extract({ left: 0, top: a0, width, height }).toBuffer();
            const processedBlock = await lighterGrayscale(blockBuffer, width, height, 0.5);
            blocks.push({ image: processedBlock, height });
        } else if (opcode === 'delete') {
            const height = a1 - a0;
            if (height === 0) continue;
            const blockBuffer = await sharp(img1.data, { raw: img1.info }).extract({ left: 0, top: a0, width, height }).toBuffer();
            const processedBlock = await grayscaleWithColorOverlay(blockBuffer, width, height, { r: 0, g: 0, b: 255, alpha: 0.4 }, 0.5);
            blocks.push({ image: processedBlock, height });
        } else if (opcode === 'insert') {
            const height = b1 - b0;
            if (height === 0) continue;
            const blockBuffer = await sharp(img2.data, { raw: img2.info }).extract({ left: 0, top: b0, width, height }).toBuffer();
            const processedBlock = await grayscaleWithColorOverlay(blockBuffer, width, height, { r: 255, g: 0, b: 0, alpha: 0.4 }, 0.5);
            blocks.push({ image: processedBlock, height });
        } else if (opcode === 'replace') {
            const h1 = a1 - a0;
            const h2 = b1 - b0;
            const hmin = Math.min(h1, h2);

            if (hmin > 0) {
                const block1: RawImage = {
                    data: await sharp(img1.data, { raw: img1.info }).extract({ left: 0, top: a0, width, height: hmin }).toBuffer(),
                    info: { width, height: hmin, channels: 4, premultiplied: false, size: 0, format: 'raw' }
                };
                const block2: RawImage = {
                    data: await sharp(img2.data, { raw: img2.info }).extract({ left: 0, top: b0, width, height: hmin }).toBuffer(),
                    info: { width, height: hmin, channels: 4, premultiplied: false, size: 0, format: 'raw' }
                };
                const diffBlock = await perPixelDiffBlock(block1, block2);
                blocks.push({ image: diffBlock, height: hmin });
            }

            if (h2 > h1) {
                const height = h2 - h1;
                const blockBuffer = await sharp(img2.data, { raw: img2.info }).extract({ left: 0, top: b0 + hmin, width, height }).toBuffer();
                const processedBlock = await grayscaleWithColorOverlay(blockBuffer, width, height, { r: 255, g: 0, b: 0, alpha: 0.4 }, 0.5);
                blocks.push({ image: processedBlock, height });
            } else if (h1 > h2) {
                const height = h1 - h2;
                const blockBuffer = await sharp(img1.data, { raw: img1.info }).extract({ left: 0, top: a0 + hmin, width, height }).toBuffer();
                const processedBlock = await grayscaleWithColorOverlay(blockBuffer, width, height, { r: 0, g: 0, b: 255, alpha: 0.4 }, 0.5);
                blocks.push({ image: processedBlock, height });
            }
        }
    }

    const totalHeight = blocks.reduce((sum, block) => sum + block.height, 0);
    if (totalHeight === 0) {
        console.log("Images are identical or no changes were detected.");
        return;
    }

    const compositeParts = blocks.map((block, i) => {
        const top = blocks.slice(0, i).reduce((sum, b) => sum + b.height, 0);
        return { 
            input: block.image, 
            top, 
            left: 0,
            raw: { 
                width: width,
                height: block.height,
                channels: 4 as const
            }
        };
    });

    await sharp({ create: { width, height: totalHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite(compositeParts)
        .toFile(output);

    console.log(`[*] Visual diff image saved as ${output}`);
}

/**
 * Main execution block.
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error(`Usage: deltaview <image1> <image2> [options]`);
        console.error(`  image1: First image for comparison (required)`);
        console.error(`  image2: Second image for comparison (required)`);
        console.error(`  --output <filename>: Output filename (default: image-diff.png)`);
        console.error(`  --algorithm <algo>: Diff algorithm - exact|perceptual (default: exact)`);
        console.error(`  --threshold <value>: Algorithm threshold for perceptual algorithm (0 to 1, default: 0.1)`);
        console.error(`  --merge-threshold <value>: Merge small changes threshold (height in px, default: 0)`);
        console.error(``);
        console.error(`Examples:`);
        console.error(`  ts-node delta-view.ts img1.png img2.png`);
        console.error(`  ts-node delta-view.ts img1.png img2.png --output diff.png`);
        console.error(`  ts-node delta-view.ts img1.png img2.png --algorithm perceptual --threshold 0.05`);
        process.exit(1);
    }

    const image1 = args[0];
    const image2 = args[1];
    
    const options: VisualDiffOptions = {
        output: 'image-diff.png',
        algorithm: 'exact',
        mergeThreshold: 0
    };

    // Parse command line options
    for (let i = 2; i < args.length; i += 2) {
        const option = args[i];
        const value = args[i + 1];

        switch (option) {
            case '--output':
                options.output = value;
                break;
            case '--algorithm':
                if (['exact', 'perceptual'].includes(value)) {
                    options.algorithm = value as 'exact' | 'perceptual';
                } else {
                    console.error(`Invalid algorithm: ${value}`);
                    process.exit(1);
                }
                break;
            case '--threshold':
                const threshold = parseFloat(value);
                if (!isNaN(threshold)) {
                    options.threshold = threshold;
                } else {
                    console.error(`Invalid threshold: ${value}`);
                    process.exit(1);
                }
                break;
            case '--merge-threshold':
                const mergeThreshold = parseInt(value, 10);
                if (!isNaN(mergeThreshold)) {
                    options.mergeThreshold = mergeThreshold;
                } else {
                    console.error(`Invalid merge threshold: ${value}`);
                    process.exit(1);
                }
                break;
            default:
                console.error(`Unknown option: ${option}`);
                process.exit(1);
        }
    }

    try {
        await visualDiff(image1, image2, options);
    } catch (error) {
        console.error("An error occurred during image diffing:", error);
        process.exit(1);
    }
}

main();
