import {addon as ov} from "openvino-node";
// @ts-ignore
import sharp from "sharp";

type CompiledModel = InstanceType<typeof ov.CompiledModel>;
let compiledModel: CompiledModel | null = null;

async function initializeModel() {
    if (compiledModel) return compiledModel;

    try {
        const core = new ov.Core();
        const model = await core.readModel("models/openvino/model.xml");
        compiledModel = await core.compileModel(model, "CPU");
        return compiledModel;
    } catch (error) {
        console.error("模型加载失败:", error);
        throw new Error(`Failed to load MobileFaceNet model: ${error}`);
    }
}

export async function faceToVector(imageBuffer: Buffer): Promise<Float32Array> {
    try {
        const uint8Data = await getImageTensor(imageBuffer);
        const model = await initializeModel();
        const inferRequest = model.createInferRequest();

        const inputShape = [1, 112, 112, 3];
        const tensor = new ov.Tensor(ov.element.u8, inputShape, uint8Data);
        inferRequest.setInputTensor(tensor);

        // 执行推理
        inferRequest.infer();

        // 获取输出张量
        const outputTensor = inferRequest.getOutputTensor();
        const rawVector = outputTensor.data as Float32Array;
        const vector = l2Normalize(rawVector);
        console.log("特征向量长度:", vector.length);
        console.log("特征向量:", vector.slice(0, 10));

        return vector;
    } catch (error) {
        console.error("人脸特征提取失败:", error);
        throw new Error(`Face feature extraction failed: ${error}`);
    }
}

function l2Normalize(features: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < features.length; i++) norm += features[i] * features[i];
    norm = Math.sqrt(norm) + 1e-10;

    const normalized = new Float32Array(features.length);
    for (let i = 0; i < features.length; i++) normalized[i] = features[i] / norm;
    return normalized;
}

export async function getImageTensor(imageInput: Buffer): Promise<Uint8Array> {
    const TARGET_SIZE = 112;
    const {data} = await sharp(imageInput)
        .resize(TARGET_SIZE, TARGET_SIZE, {fit: 'fill'})
        .removeAlpha()
        .toColorspace('srgb')
        .raw()
        .toBuffer({resolveWithObject: true});
    return new Uint8Array(data);
}
