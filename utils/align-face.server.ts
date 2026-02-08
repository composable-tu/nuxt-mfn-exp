import sharp from 'sharp';
import {cv} from 'opencv-wasm';

const REFERENCE_PTS = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [56.1396, 92.2048]];

const OUT_SIZE = 112;

function getSimilarityTransformMatrix(srcPts: { x: number; y: number }[]) {
    const n = 4;
    let srcMean = {x: 0, y: 0};
    let dstMean = {x: 0, y: 0};

    for (let i = 0; i < n; i++) {
        srcMean.x += srcPts[i].x;
        srcMean.y += srcPts[i].y;
        dstMean.x += REFERENCE_PTS[i][0];
        dstMean.y += REFERENCE_PTS[i][1];
    }
    srcMean.x /= n;
    srcMean.y /= n;
    dstMean.x /= n;
    dstMean.y /= n;

    let sum_xx_yy = 0;
    let sum_ux_vy = 0;
    let sum_vx_uy = 0;

    for (let i = 0; i < n; i++) {
        const sx = srcPts[i].x - srcMean.x;
        const sy = srcPts[i].y - srcMean.y;
        const dx = REFERENCE_PTS[i][0] - dstMean.x;
        const dy = REFERENCE_PTS[i][1] - dstMean.y;

        sum_xx_yy += sx * sx + sy * sy;
        sum_ux_vy += sx * dx + sy * dy;
        sum_vx_uy += sx * dy - sy * dx;
    }

    const a = sum_ux_vy / sum_xx_yy;
    const b = sum_vx_uy / sum_xx_yy;

    const tx = dstMean.x - (a * srcMean.x - b * srcMean.y);
    const ty = dstMean.y - (b * srcMean.x + a * srcMean.y);

    return [a, -b, tx, b, a, ty];
}

export async function alignFace(imageBuffer: Buffer, srcPts: { x: number; y: number }[]) {
    const {data, info} = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({resolveWithObject: true});

    const srcMat = cv.matFromImageData({
        data: new Uint8ClampedArray(data), width: info.width, height: info.height,
    });

    const mArray = getSimilarityTransformMatrix(srcPts);
    const M = cv.matFromArray(2, 3, cv.CV_64F, mArray);

    const dstMat = new cv.Mat();
    const dsize = new cv.Size(OUT_SIZE, OUT_SIZE);

    cv.warpAffine(srcMat, dstMat, M, dsize, cv.INTER_CUBIC, cv.BORDER_REPLICATE);

    const resultRaw = Buffer.from(dstMat.data);
    const resultBuffer = await sharp(resultRaw, {
        raw: {
            width: OUT_SIZE, height: OUT_SIZE, channels: 4
        }
    })
        .png()
        .toBuffer();

    srcMat.delete();
    M.delete();
    dstMat.delete();

    return resultBuffer;
}