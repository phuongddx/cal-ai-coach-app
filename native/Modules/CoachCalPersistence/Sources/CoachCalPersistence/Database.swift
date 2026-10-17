import Foundation
import GRDB

public enum Database {
  public static func makePool(at path: String) throws -> DatabasePool {
    try DatabasePool(path: path)
  }
}
