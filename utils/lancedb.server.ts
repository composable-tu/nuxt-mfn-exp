import * as lancedb from "@lancedb/lancedb";

const DB_PATH = "../data/lancedb";
const TABLE_NAME = "faces";

let db: lancedb.Connection | null = null;
let table: lancedb.Table | null = null;

export interface FaceRecord {
    name: string;
    vector: number[];
}

async function initializeDB() {
    if (db) return db;

    try {
        db = await lancedb.connect(DB_PATH);
        return db;
    } catch (error) {
        console.error("LanceDB 连接失败:", error);
        throw new Error(`Failed to connect to LanceDB: ${error}`);
    }
}

async function getOrCreateTable() {
    if (table) return table;

    const connection = await initializeDB();
    const tables = await connection.tableNames();

    if (tables.includes(TABLE_NAME)) table = await connection.openTable(TABLE_NAME); else {
        table = await connection.createTable(TABLE_NAME, [{name: "default", vector: Array(512).fill(0.0)}]);
        await table.delete("name = 'default'");
        console.log('已创建新的空人脸数据表');
    }

    return table;
}

/**
 * 添加人脸数据
 * @param name 人名
 * @param vector 人脸向量
 */
export async function addFace(name: string, vector: Float32Array | number[]) {
    try {
        const tbl = await getOrCreateTable();
        const vectorArray = Array.from(vector);
        await tbl.add([{name, vector: vectorArray}]);
        console.log(`成功添加人脸数据: ${name}`);
    } catch (error) {
        console.error("添加人脸数据失败:", error);
        throw new Error(`Failed to add face data: ${error}`);
    }
}

/**
 * 搜索人脸数据
 * @param vector 人脸向量
 * @param limit 返回结果数量
 * @param threshold 匹配阈值
 */
export async function searchFace(vector: Float32Array | number[], limit: number = 1, threshold: number = 0.8) {
    try {
        const tbl = await getOrCreateTable();
        const vectorArray = Array.from(vector);
        const results = await tbl
            .vectorSearch(vectorArray)
            .limit(limit)
            .toArray();

        const filteredResults = results.filter((result: any) => {
            const distance = result._distance;
            const isMatch = distance <= threshold;
            console.log(`人名: ${result.name}, 距离: ${distance.toFixed(4)}, 匹配: ${isMatch}`);
            return isMatch;
        });

        if (filteredResults.length === 0) {
            console.log("未找到匹配的人脸");
        }

        return filteredResults;
    } catch (error) {
        console.error("搜索人脸失败:", error);
        throw new Error(`Failed to search face: ${error}`);
    }
}

/**
 * 获取所有身份人名
 */
export async function getAllFacesName(): Promise<string[]> {
    try {
        const tbl = await getOrCreateTable();
        const results = await tbl.query().toArray();
        return results.map((record: FaceRecord) => record.name);
    } catch (error) {
        console.error("获取所有人名失败:", error);
        throw new Error(`Failed to get all face names: ${error}`);
    }
}

/**
 * 删除人脸数据
 * @param name 人名
 */
export async function deleteFace(name: string) {
    try {
        const tbl = await getOrCreateTable();
        await tbl.delete(`name = '${name}'`);
        console.log(`成功删除人脸数据: ${name}`);
    } catch (error) {
        console.error("删除人脸数据失败:", error);
        throw new Error(`Failed to delete face data: ${error}`);
    }
}

