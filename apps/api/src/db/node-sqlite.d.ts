declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export class StatementSync {
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined;
    all(...params: SQLInputValue[]): Record<string, unknown>[];
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
