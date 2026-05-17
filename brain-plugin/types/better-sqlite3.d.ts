declare module "better-sqlite3" {
  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    transaction<T>(fn: () => T): T;
    pragma(pragma: string, options?: { simple?: boolean }): any;
    loadExtension(path: string): void;
    close(): void;
  }

  interface Statement {
    get(...params: any[]): any;
    run(...params: any[]): any;
    all(...params: any[]): any[];
  }

  namespace Database {
    function Database(path: string): Database;
  }

  export = Database;
}