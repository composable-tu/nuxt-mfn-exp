import {addon as ov} from "openvino-node";
import sharp from "sharp";

const ANTISPOOF_SCALE = 2.7;
const ANTISPOOF_SIZE = 80;

type CompiledModel = InstanceType<typeof ov.CompiledModel>;
let compiledModel: CompiledModel | null = null;

/**
 * @see https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/src/generate_patches.py
 */
export async function getAntiSpoofCrop(imageBuffer: Buffer, keypoints: { x: number; y: number }[]): Promise<Buffer> {
    if (keypoints.length < 4) {
        throw new Error("人脸裁剪需要至少 4 个关键点");
    }
    const minX = Math.min(...keypoints.map((p) => p.x));
    const maxX = Math.max(...keypoints.map((p) => p.x));
    const minY = Math.min(...keypoints.map((p) => p.y));
    const maxY = Math.max(...keypoints.map((p) => p.y));
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const margin = 0.15;
    const left = Math.max(0, minX - rangeX * margin);
    const top = Math.max(0, minY - rangeY * margin);
    const boxW = Math.min(rangeX * (1 + 2 * margin), 1e5);
    const boxH = Math.min(rangeY * (1 + 2 * margin), 1e5);

    const meta = await sharp(imageBuffer).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (srcW < 1 || srcH < 1) throw new Error("无法获取图像尺寸");

    const scale = Math.min((srcH - 1) / boxH, (srcW - 1) / boxW, ANTISPOOF_SCALE);
    const newW = boxW * scale;
    const newH = boxH * scale;
    const cx = left + boxW / 2;
    const cy = top + boxH / 2;
    let leftTopX = cx - newW / 2;
    let leftTopY = cy - newH / 2;
    let rightBottomX = cx + newW / 2;
    let rightBottomY = cy + newH / 2;
    if (leftTopX < 0) {
        rightBottomX -= leftTopX;
        leftTopX = 0;
    }
    if (leftTopY < 0) {
        rightBottomY -= leftTopY;
        leftTopY = 0;
    }
    if (rightBottomX > srcW - 1) {
        leftTopX -= rightBottomX - (srcW - 1);
        rightBottomX = srcW - 1;
    }
    if (rightBottomY > srcH - 1) {
        leftTopY -= rightBottomY - (srcH - 1);
        rightBottomY = srcH - 1;
    }
    const x = Math.round(Math.max(0, leftTopX));
    const y = Math.round(Math.max(0, leftTopY));
    const w = Math.round(Math.min(srcW - x, rightBottomX - leftTopX));
    const h = Math.round(Math.min(srcH - y, rightBottomY - leftTopY));
    if (w < 1 || h < 1) {
        return sharp(imageBuffer).resize(ANTISPOOF_SIZE, ANTISPOOF_SIZE).removeAlpha().png().toBuffer();
    }
    const crop = await sharp(imageBuffer)
        .extract({left: x, top: y, width: w, height: h})
        .resize(ANTISPOOF_SIZE, ANTISPOOF_SIZE)
        .removeAlpha()
        .png()
        .toBuffer();
    return crop;
}

async function initializeModel() {
    if (compiledModel) return compiledModel;

    try {
        const core = new ov.Core();
        const model = await core.readModel("models/openvino/2.7_80x80_MiniFASNetV2.xml");
        compiledModel = await core.compileModel(model, "AUTO");
        return compiledModel;
    } catch (error) {
        console.error("模型加载失败:", error);
        throw new Error(`Failed to load MiniFASNet model: ${error}`);
    }
}

export async function faceAntiSpoofing(imageBuffer: Buffer): Promise<number> {
    try {
        const uint8Data = await getImageTensor(imageBuffer);
        const float32Data = new Float32Array(3 * 80 * 80);

        for (let h = 0; h < 80; h++) {
            for (let w = 0; w < 80; w++) {
                const nhwcIndex = (h * 80 + w) * 3;
                const r = uint8Data[nhwcIndex]!;
                const g = uint8Data[nhwcIndex + 1]!;
                const b = uint8Data[nhwcIndex + 2]!;
                // 转为 BGR
                float32Data[h * 80 + w] = b;
                float32Data[80 * 80 + h * 80 + w] = g;
                float32Data[2 * 80 * 80 + h * 80 + w] = r;
            }
        }

        const model = await initializeModel();
        const inferRequest = model.createInferRequest();
        const inputShape = [1, 3, 80, 80];
        const inputTensor = new ov.Tensor(ov.element.f32, inputShape, float32Data);
        inferRequest.setInputTensor(inputTensor);
        inferRequest.infer();

        const outputTensor = inferRequest.getOutputTensor();
        const outputData = outputTensor.data as Float32Array;
        const scores = Array.from(outputData);
        const score = (scores[1] - scores[0] - scores[2]) ?? 0;
        return score > 0 ? score : 0;
    } catch (error) {
        console.error("活体检测失败:", error);
        throw new Error(`Face anti-spoofing failed: ${error}`);
    }
}

export async function getImageTensor(imageInput: Buffer): Promise<Uint8Array> {
    const {data} = await sharp(imageInput)
        .resize(80, 80)
        .removeAlpha()
        .raw()
        .toBuffer({resolveWithObject: true});

    if (data.length !== 80 * 80 * 3) {
        throw new Error(`图像尺寸不正确：期望 80x80x3=${80 * 80 * 3} 字节，实际 ${data.length} 字节`);
    }

    return new Uint8Array(data);
}

