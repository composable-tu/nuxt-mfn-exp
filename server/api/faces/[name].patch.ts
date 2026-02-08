import {addFace, deleteFace, getFaceByName} from "~~/utils/lancedb.server";

interface RenameBody {
    newName: string;
}

export default defineEventHandler(async (event) => {
    const name = decodeURIComponent(getRouterParam(event, "name") || "");
    if (!name) throw createError({statusCode: 400, message: "缺少 name"});
    const body = (await readBody(event)) as RenameBody;
    const newName = body?.newName?.trim();
    if (!newName) throw createError({statusCode: 400, message: "需要 newName"});
    const record = await getFaceByName(name);
    if (!record) throw createError({statusCode: 404, message: "未找到该人脸"});
    await deleteFace(name);
    await addFace(newName, record.vector);
    return {ok: true};
});
