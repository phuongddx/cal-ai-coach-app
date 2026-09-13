import GRDB

public enum Migrations {
  public static var foundationSync: DatabaseMigrator {
    var migrator = DatabaseMigrator()

    migrator.registerMigration("1__foundation_sync") { database in
      try database.create(table: "diary_entries") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("display_text", .text).notNull()
        table.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
        table.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
        table.column("deleted_at", .datetime)
        table.column("server_version", .integer).notNull().defaults(to: 0)
        table.column("accepted_op_id", .text)
        table.column("server_updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
      }
      try database.create(
        index: "diary_entries_user_version_idx",
        on: "diary_entries",
        columns: ["user_id", "server_version"]
      )

      try database.create(table: "pending_ops") { table in
        table.column("op_id", .text).primaryKey()
        table.column("table_name", .text).notNull()
        table.column("record_id", .text).notNull()
        table.column("kind", .text).notNull()
        table.column("snapshot", .text).notNull()
        table.column("client_timestamp", .datetime).notNull()
        table.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
        table.column("dispatch_attempts", .integer).notNull().defaults(to: 0)
        table.column("next_retry_at", .datetime)
      }
      try database.create(
        index: "pending_ops_due_idx",
        on: "pending_ops",
        columns: ["next_retry_at", "created_at"]
      )

      try database.create(table: "sync_state") { table in
        table.column("id", .integer).primaryKey().defaults(to: 1)
        table.column("pull_cursor", .integer).notNull().defaults(to: 0)
        table.check(sql: "id = 1")
      }
      try database.execute(sql: "INSERT INTO sync_state (id, pull_cursor) VALUES (1, 0)")
    }

    migrator.registerMigration("2__outbox_dead_letter") { database in
      try database.alter(table: "pending_ops") { table in
        table.add(column: "quarantined", .boolean).notNull().defaults(to: false)
      }
    }

    return migrator
  }
}
