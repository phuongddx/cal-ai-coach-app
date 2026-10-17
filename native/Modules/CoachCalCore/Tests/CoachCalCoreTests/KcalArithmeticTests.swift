import Testing

@testable import CoachCalCore

@Suite
struct KcalArithmeticTests {
  @Test
  func goldenParityCaseMatchesFixture() {
    #expect(KcalArithmetic.mealKcal(per100gKcal: 145, grams: 320) == 464)
    #expect(KcalArithmetic.macroGrams(per100g: 27, grams: 320) == 86.4)
  }

  @Test
  func zeroGramsYieldZero() {
    #expect(KcalArithmetic.mealKcal(per100gKcal: 145, grams: 0) == 0)
    #expect(KcalArithmetic.macroGrams(per100g: 27, grams: 0) == 0)
  }

  @Test
  func mealKcalIsMonotonicInGrams() {
    var previous = -1
    for grams in stride(from: 0, through: 1000, by: 50) {
      let kcal = KcalArithmetic.mealKcal(per100gKcal: 145, grams: grams)
      #expect(kcal >= previous)
      previous = kcal
    }
  }

  @Test
  func mealKcalRoundsToNearestWhole() {
    #expect(KcalArithmetic.mealKcal(per100gKcal: 150, grams: 333) == 500)
    #expect(KcalArithmetic.mealKcal(per100gKcal: 150, grams: 334) == 501)
    #expect(KcalArithmetic.mealKcal(per100gKcal: 100, grams: 100) == 100)
  }

  @Test
  func macroGramsRoundsToOneDecimal() {
    #expect(KcalArithmetic.macroGrams(per100g: 4, grams: 320) == 12.8)
    #expect(KcalArithmetic.macroGrams(per100g: 3.3, grams: 55) == 1.8)
    #expect(KcalArithmetic.macroGrams(per100g: 2, grams: 100) == 2)
  }
}
