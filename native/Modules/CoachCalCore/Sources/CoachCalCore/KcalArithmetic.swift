public enum KcalArithmetic {
  public static func mealKcal(per100gKcal: Int, grams: Int) -> Int {
    Int((Double(per100gKcal) * Double(grams) / 100).rounded())
  }

  public static func macroGrams(per100g: Double, grams: Int) -> Double {
    (per100g * Double(grams) / 100 * 10).rounded() / 10
  }
}
