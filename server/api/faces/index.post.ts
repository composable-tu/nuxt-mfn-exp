import {alignFace} from "~~/utils/align-face.server";
import {faceToVector} from "~~/utils/face-to-vector.server";
import {addFace} from "~~/utils/lancedb.server";

interface AddFaceBody {
    image: string;
    keypoints: { x: number; y: number }[];
    name: string;
}

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as AddFaceBody;
    if (!body?.image || !Array.isArray(body.keypoints) || body.keypoints.length < 4 || !body?.name?.trim()) {
        throw createError({statusCode: 400, message: "需要 image、keypoints（至少4个点）和 name"});
    }
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");
    const aligned = await alignFace(imageBuffer, body.keypoints);
    const vector = await faceToVector(aligned);
    await addFace(body.name.trim(), vector);
    return {ok: true};
});
