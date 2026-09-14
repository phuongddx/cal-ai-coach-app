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

    migrator.registerMigration("3__domain_core") { database in
      try database.create(table: "user_targets") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("daily_kcal", .integer).notNull()
        table.column("protein_g", .integer).notNull()
        table.column("carbs_g", .integer).notNull()
        table.column("fat_g", .integer).notNull()
        table.column("fiber_goal_g", .integer).notNull()
        table.column("water_glasses", .integer).notNull().defaults(to: 8)
        table.column("sex", .text).notNull()
        table.column("height_cm", .double)
        table.column("weight_kg", .double)
        table.column("goal_weight_kg", .double)
        table.column("pace_kg_per_week", .double)
        table.column("activity", .text).notNull()
        table.column("goal", .text).notNull()
        table.column("updated_at", .datetime).notNull()
      }

      try database.create(table: "diary_entry_details") { table in
        table.column("entry_id", .text).primaryKey()
        table.column("meal_slot", .text).notNull()
        table.column("title", .text).notNull()
        table.column("grams", .integer)
        table.column("kcal", .integer)
        table.column("protein_g", .double)
        table.column("carbs_g", .double)
        table.column("fat_g", .double)
        table.column("fiber_g", .double)
        table.column("confidence", .double)
        table.column("hidden_fat_likely", .boolean).notNull().defaults(to: false)
        table.column("source", .text)
        table.column("unresolved", .boolean).notNull().defaults(to: false)
        table.column("scan_id", .text)
        table.check(
          sql: "meal_slot IN ('breakfast', 'lunch', 'dinner', 'snacks', 'exercise')"
        )
      }

      try database.create(table: "foods") { table in
        table.column("id", .text).primaryKey()
        table.column("name", .text).notNull()
        table.column("brand", .text)
        table.column("per100g_kcal", .integer).notNull()
        table.column("protein_g", .double).notNull()
        table.column("carbs_g", .double).notNull()
        table.column("fat_g", .double).notNull()
        table.column("fiber_g", .double).notNull()
        table.column("serving_grams", .integer)
        table.column("is_custom", .boolean).notNull().defaults(to: false)
        table.column("created_at", .datetime).notNull()
      }
      try database.create(index: "foods_name_idx", on: "foods", columns: ["name"])

      try database.create(table: "saved_meals") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("name", .text).notNull()
        table.column("symbol", .text)
        table.column("kcal", .integer).notNull()
        table.column("items_json", .text).notNull()
        table.column("created_at", .datetime).notNull()
      }

      try database.create(table: "custom_foods") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("name", .text).notNull()
        table.column("basis", .text).notNull()
        table.column("kcal", .integer).notNull()
        table.column("protein_g", .double).notNull()
        table.column("carbs_g", .double).notNull()
        table.column("fat_g", .double).notNull()
        table.column("fiber_g", .double).notNull()
        table.column("serving_grams", .integer)
        table.column("created_at", .datetime).notNull()
        table.check(sql: "basis IN ('per100g', 'per_serving')")
      }

      try database.create(table: "water_logs") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("day", .text).notNull()
        table.column("ml", .integer).notNull()
        table.column("created_at", .datetime).notNull()
      }
      try database.create(
        index: "water_logs_user_day_idx",
        on: "water_logs",
        columns: ["user_id", "day"]
      )

      try database.create(table: "weight_logs") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("day", .text).notNull()
        table.column("kg", .double).notNull()
        table.column("created_at", .datetime).notNull()
      }

      try database.create(table: "exercise_logs") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("day", .text).notNull()
        table.column("exercise_type", .text).notNull()
        table.column("duration_min", .integer).notNull()
        table.column("kcal_burned", .integer)
        table.column("created_at", .datetime).notNull()
      }

      try database.create(table: "streak_state") { table in
        table.column("id", .integer).primaryKey().defaults(to: 1)
        table.column("current_streak", .integer).notNull().defaults(to: 0)
        table.column("best_streak", .integer).notNull().defaults(to: 0)
        table.column("freezes_left", .integer).notNull().defaults(to: 1)
        table.column("freeze_used_on", .text)
        table.column("last_logged_day", .text)
        table.check(sql: "id = 1")
      }

      try database.create(table: "badges") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("code", .text).notNull()
        table.column("label", .text).notNull()
        table.column("detail", .text)
        table.column("earned_at", .datetime)
        table.column("progress", .integer).notNull().defaults(to: 0)
        table.column("target", .integer).notNull().defaults(to: 1)
      }

      try database.create(table: "insights") { table in
        table.column("id", .text).primaryKey()
        table.column("user_id", .text).notNull()
        table.column("day", .text).notNull()
        table.column("kind", .text).notNull()
        table.column("title", .text).notNull()
        table.column("body", .text).notNull()
        table.column("created_at", .datetime).notNull()
      }

      try database.create(table: "app_settings") { table in
        table.column("key", .text).primaryKey()
        table.column("value", .text).notNull()
      }
    }

    return migrator
  }
}
