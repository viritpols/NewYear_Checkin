import mysql from 'mysql2/promise'

// Database connection configuration
// ปรับให้รองรับ concurrent requests มากๆ (100+ users)
const dbConfig = {
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_NAME ,
  port: parseInt(process.env.DB_PORT ?? '3306'),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT ?? '150', 10), // เพิ่มเป็น 150 สำหรับ 100+ concurrent
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT ?? '200', 10), // อนุญาตให้ queue ได้ 200 requests
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // mysql2 ไม่มี acquireTimeout option - connection pool จะรอตาม queueLimit
}

// Create connection pool
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig)
  }
  return pool
}

// Execute query helper
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const connection = getPool()
  try {
    const [results] = await connection.execute(sql, params)
    return results as T
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

// Get a connection from pool for transaction
export async function getConnection() {
  const pool = getPool()
  return await pool.getConnection()
}

// Execute query with transaction
export async function executeTransaction<T = any>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// Execute query without transaction (for simple queries)
export async function executeQuery<T = any>(
  connection: mysql.PoolConnection,
  sql: string,
  params?: any[]
): Promise<T> {
  const [results] = await connection.execute(sql, params)
  return results as T
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const connection = getPool()
    await connection.execute('SELECT 1')
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

