import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function toSqlParams(params: unknown[]): SQLInputValue[] {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) {
      return value;
    }
    return JSON.stringify(value);
  });
}

class SqlitePreparedStatement {
  private readonly params: unknown[];

  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    params: unknown[] = [],
  ) {
    this.params = params;
  }

  bind(...values: unknown[]): SqlitePreparedStatement {
    return new SqlitePreparedStatement(this.db, this.sql, values);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...toSqlParams(this.params)) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (colName) return (row[colName] as T) ?? null;
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...toSqlParams(this.params)) as T[];
    return {
      results,
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: results.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...toSqlParams(this.params));
    return {
      results: [] as T[],
      success: true,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
        changed_db: Number(info.changes ?? 0) > 0,
        changes: Number(info.changes ?? 0),
      },
    };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...toSqlParams(this.params)) as Record<string, unknown>[];
    return rows.map((row) => Object.values(row)) as unknown as T[];
  }
}

export function createTestD1Database(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  const migrationPath = resolve(__dirname, '../../migrations/0001_init.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');
  sqlite.exec(migrationSql);

  const adapter = {
    prepare(query: string) {
      return new SqlitePreparedStatement(sqlite, query) as unknown as D1PreparedStatement;
    },
    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      sqlite.exec('BEGIN');
      try {
        for (const stmt of statements) {
          results.push(await stmt.run<T>());
        }
        sqlite.exec('COMMIT');
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
      return results;
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
    withSession() {
      return adapter as unknown as D1DatabaseSession;
    },
  };

  return adapter as unknown as D1Database;
}

export class MemoryR2Bucket {
  private readonly store = new Map<string, { body: Uint8Array; httpMetadata?: R2HTTPMetadata }>();

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: R2PutOptions,
  ): Promise<R2Object | null> {
    let bytes: Uint8Array;
    if (value === null) {
      bytes = new Uint8Array();
    } else if (typeof value === 'string') {
      bytes = new TextEncoder().encode(value);
    } else if (value instanceof Uint8Array) {
      bytes = new Uint8Array(value);
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (value instanceof Blob) {
      bytes = new Uint8Array(await value.arrayBuffer());
    } else {
      const res = new Response(value);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    this.store.set(key, { body: bytes, httpMetadata: options?.httpMetadata as R2HTTPMetadata | undefined });
    return { key, size: bytes.byteLength } as R2Object;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    const copy = new Uint8Array(entry.body);
    return {
      key,
      size: copy.byteLength,
      httpMetadata: entry.httpMetadata ?? {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(copy);
          controller.close();
        },
      }),
      arrayBuffer: async () => copy.buffer,
      text: async () => new TextDecoder().decode(copy),
      json: async <T>() => JSON.parse(new TextDecoder().decode(copy)) as T,
      writeHttpMetadata(headers: Headers) {
        if (entry.httpMetadata?.contentType) {
          headers.set('content-type', entry.httpMetadata.contentType);
        }
        if (entry.httpMetadata?.cacheControl) {
          headers.set('cache-control', entry.httpMetadata.cacheControl);
        }
      },
    } as unknown as R2ObjectBody;
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      this.store.delete(key);
    }
  }
}
