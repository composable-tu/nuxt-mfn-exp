import {deleteFace} from "~~/utils/lancedb.server";

export default defineEventHandler(async (event) => {
    const name = decodeURIComponent(getRouterParam(event, "name") || "");
    if (!name) throw createError({statusCode: 400, message: "缺少 name"});
    await deleteFace(name);
    return {ok: true};
});
