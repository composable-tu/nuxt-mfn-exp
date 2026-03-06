import {alignFace} from "~~/utils/align-face.server";
import {faceToVector} from "~~/utils/face-to-vector.server";
import {searchFace} from "~~/utils/lancedb.server";
import {faceAntiSpoofing, getAntiSpoofCrop} from "~~/utils/face-anti-spoofing.server";

interface RecognizeBody {
    image: string;
    keypoints: { x: number; y: number }[];
}

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as RecognizeBody;
    if (!body?.image || !Array.isArray(body.keypoints) || body.keypoints.length < 4) {
        throw createError({statusCode: 400, message: "需要 image 与 keypoints（至少 4 个点）"});
    }
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");
    const aligned = await alignFace(imageBuffer, body.keypoints);
    const vector = await faceToVector(aligned.size112);
    const results = await searchFace(vector, 1, 0.6);
    const name = results.length > 0 ? (results[0] as { name: string }).name : null;
    const antiSpoofImage = await getAntiSpoofCrop(imageBuffer, body.keypoints);
    const spoofConfidence = await faceAntiSpoofing(antiSpoofImage);
    return {name, isReal: spoofConfidence};
});
