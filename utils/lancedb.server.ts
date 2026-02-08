import * as lancedb from "@lancedb/lancedb";
import {join} from 'path';

const projectRoot = process.cwd();
const DB_PATH = join(projectRoot, 'data', 'lancedb');
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

    if (tables.includes(TABLE_NAME)) {
        table = await connection.openTable(TABLE_NAME);
    } else {
        table = await connection.createTable(TABLE_NAME, [{name: "default", vector: Array(512).fill(0.0)}]);
        await table.delete("name = 'default'");
    }

    return table;
}

export async function addFace(name: string, vector: Float32Array | number[]) {
    try {
        const tbl = await getOrCreateTable();
        const vectorArray = Array.from(vector);
        await tbl.add([{name, vector: vectorArray}]);
    } catch (error) {
        console.error("添加人脸数据失败:", error);
        throw new Error(`Failed to add face data: ${error}`);
    }
}

export async function searchFace(vector: Float32Array | number[], limit: number = 1, threshold: number = 0.5) {
    try {
        const tbl = await getOrCreateTable();
        const vectorArray = Array.from(vector);
        const results = await tbl
            .vectorSearch(vectorArray)
            .limit(limit)
            .toArray();

        const filteredResults = results.filter((result: any) => {
            const distance = result._distance;
            return distance <= threshold;
        });

        return filteredResults;
    } catch (error) {
        console.error("搜索人脸失败:", error);
        throw new Error(`Failed to search face: ${error}`);
    }
}

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

export async function getFaceByName(name: string): Promise<FaceRecord | null> {
    try {
        const tbl = await getOrCreateTable();
        const results = await tbl.query().toArray();
        const record = results.find((r: FaceRecord) => r.name === name);
        return record ? {name: record.name, vector: record.vector} : null;
    } catch (error) {
        console.error("根据人名获取人脸失败:", error);
        throw new Error(`Failed to get face by name: ${error}`);
    }
}

export async function deleteFace(name: string) {
    try {
        const tbl = await getOrCreateTable();
        await tbl.delete(`name = '${name}'`);
    } catch (error) {
        console.error("删除人脸数据失败:", error);
        throw new Error(`Failed to delete face data: ${error}`);
    }
}

