import {getAllFacesName} from "~~/utils/lancedb.server";

export default defineEventHandler(async () => {
    const names = await getAllFacesName();
    return {names};
});
