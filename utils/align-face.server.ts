import * as nudged from 'nudged';
import * as sharp from 'sharp';

const REFERENCE_PTS = [{x: 38.2946, y: 51.6963}, // 左眼
    {x: 73.5318, y: 51.5014}, // 右眼
    {x: 56.0252, y: 71.7366}, // 鼻尖
    {x: 56.1396, y: 92.2048}  // 嘴中心
];

export async function alignFace(imageBuffer: Buffer, srcPts: { x: number, y: number }[]) {
    // 1. 计算变换矩阵
    // nudged.estimate 对应 OpenCV 的 estimateAffinePartial2D (相似变换: 旋转+缩放+平移)
    const transform = nudged.estimate({
        estimator: 'SRT', // SRT 表示 Similarity (相似变换: 缩放+旋转+平移)
        domain: srcPts,   // 源点集
        range: REFERENCE_PTS  // 目标点集
    });

    // 提取矩阵参数用于 sharp 的 affine 变换
    // sharp 的 affine 接受 [a, b, c, d] 矩阵
    const matrix = nudged.transform.toMatrix(transform);
    const {a, b, c, d, e, f} = matrix;

    // 2. 使用 Sharp 进行图像处理
    // 注意：Sharp 的 affine 变换逻辑与 OpenCV 略有不同，
    // 我们可以通过组合 resize, rotate 和 extend 来实现，或者直接用其 affine 方法
    return await sharp(imageBuffer)
        .affine([a, b, c, d], {
            idx: e,  // x 平移
            idy: f,  // y 平移
            background: {r: 255, g: 255, b: 255} // 白色背景
        })
        .resize(112, 112, {
            fit: 'contain', background: {r: 255, g: 255, b: 255}
        })
        .toBuffer();
}