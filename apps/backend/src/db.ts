import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// 1. 创建 PostgreSQL 连接池
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

// 2. 创建 Prisma 适配器
const adapter = new PrismaPg(pool);

// 3. 实例化 Prisma Client 并注入适配器
export const db = new PrismaClient({ adapter });
