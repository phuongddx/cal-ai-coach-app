# CoachCal Redesign v2: research note

Gathered 2026-11-24 with Exa web search. These are the pages actually used for the redesign. Dribbble and Mobbin shots are references for mood and patterns only. Nothing was copied.

## 1. AI calorie trackers on Dribbble: how the category looks
| Link | Takeaway used |
|---|---|
| https://dribbble.com/shots/25772718-CaloriCam-AI-Powered-Calorie-Macro-Tracker | Photo-first home, big ring, macros under it. We keep the ring but move it onto a dark hero card. |
| https://dribbble.com/shots/25151123-Tracking-calories-Mobile-app-Lean-AI | Scan result as a card stack with per-item rows. This is the basis for our Review item cards. |
| https://dribbble.com/shots/25713184-AI-Nutrition-App-I-Calories-Tracker | Soft pastel macro colours. We went the other way, toward saturated and distinct colours that pass 3:1. |
| https://dribbble.com/shots/25812437-AI-Calorie-Tracker-Mobile-App-Design | Viewfinder with corner brackets and mode chips. Shows that the category's convention works. |
| https://dribbble.com/shots/24692953-Nutrio-Calorie-Counter-App-UI-Kit | Meal sections with time icons instead of emoji. |
| https://dribbble.com/shots/27682517-UI-UX-Product-design-for-Nutrition-mobile-app | Clean grouped lists for profile and settings. |
| https://dribbble.com/search/ai-food-app | Survey of ~40 shots. Most use green or lime; few use orange, which leaves room for CoachCal to stand out. |

## 2. Orange or neon on dark: palette direction
| Link | Takeaway used |
|---|---|
| https://dribbble.com/shots/27294795-AI-Powered-Workout-Fitness-Planning-App | Dark base with vibrant orange accents. This led to the signature "ember" hero card. |
| https://dribbble.com/shots/27242702-Fitness-App-Dashboard-UI-Design-Health-Tracking-Mobile-App | Neon accent on both light and dark backgrounds. Neon reads best on dark, so it stays dark in both modes. |
| https://dribbble.com/shots/25678497-sandow-v2-AI-Fitness-Nutrition-App-Virtual-Fitness-Coach-UI | Red-orange (#F12B03) with black type. Confirms black-on-orange labels. |

## 3. Real shipped flows (Mobbin)
| Link | Takeaway used |
|---|---|
| https://mobbin.com/explore/flows/579da5dd-453a-4e7c-9c11-d20708a4db82 (Cal AI onboarding) | Long questionnaire, one question per screen. We merged related questions into 9 steps and kept the progress rail. |
| https://mobbin.com/explore/flows/6ec621e1-1a65-468d-b979-0e8258d0808b (MyFitnessPal onboarding) | Plan reveal shows the target and macros together. Copied as a pattern, not visually. |
| https://mobbin.com/explore/screens/fdc77c35-c3de-4bca-aa29-7004a2714ee9 (MyFitnessPal dashboard) | "Goal − food + exercise = remaining". Eaten / Goal / Burned sit beside the ring. |
| https://mobbin.com/explore/screens/ee72c05c-3ec9-4373-86e8-3548b579dd73 (Lifesum dashboard) | Week strip above the ring. Our cells are 44 pt. |
| https://mobbin.com/explore/screens/55ec4021-ea0e-4cd2-81f7-f591e8d79f41 (Fitbod paywall) | Trial and price on the plan row, plus Restore at the top. |

## 4. Scan UX
| Link | Takeaway used |
|---|---|
| https://screensdesign.com/articles/calorie-tracker-app-design/ | Offer several capture paths. Added Describe as a fourth camera mode, and the quota sheet points to free manual logging. |
| https://medium.com/design-bootcamp/a-redesign-of-healthifyme-snap-track-experience-c7709085ca55 | Gallery inside the camera, fewer steps to save. |
| https://calorix.ai/features/ai-calorie-scanner/ | Per-item confidence; flag sauces and oils. Used for the Low badge on the "Dressing (unsure)" item. |
| https://dev.to/mealumo/building-a-photo-to-calories-logger-for-ios-the-ai-cant-see-the-olive-oil-4i1b | Oil is the most common miss. This shaped the copy on the unresolved item. |
| https://snapkai.com/features/ | Show up front which actions use paid scans. Added the "2 of 3 free scans" chip in the viewfinder. |
| https://fluxnative.app/templates/morsel-ai-calorie-tracker-app | Confidence, editable portions and undo as a set. |

## 5. Orange accessibility
| Link | Takeaway used |
|---|---|
| https://www.pressforge.co.uk/blog/2026/07/22/your-brand-colours-probably-fail-accessibility/ | Bright brand orange fails as text on white, so text needs a darker ink. |
| https://everyhexcode.com/palettes/accessible-orange-brand-set | AA-safe ink around #B84E08. We use #B84300 (5.47:1). |
| https://brand.docs.bauer-group.com/en/accessibility/contrast | Split "fill" and "text" tokens for one brand hue. |
| https://wrc.utdallas.edu/web-accessibility/designers/ | 3:1 for graphics and UI. Rings and charts on light use #E35A00 (3.67:1). |

## 6. Eating-disorder-safe tracking
| Link | Takeaway used |
|---|---|
| https://heyori.app/ | Hide numbers by default and show balance instead. Our ED-Safe ring reads "On track · 2 of 3 meals". |
| https://mytrueplate.com/eating-disorder-safe-food-tracker | Number visibility is optional and weight is shown as a trend. Weight under ED-Safe stays the owner's call. |
| https://meeloapp.com/ | Gentle language, no red "over" states. |
| https://www.getpippa.app/meal-tracking-without-calories | Meal-count and variety cues replace kcal. |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC9128313/ | Calorie and weight fixation is a risk. ED-Safe can be chosen at onboarding step 7, before any number appears. |

## Gaps
- Mobbin and Dribbble pages were read as search extracts; full-resolution shots were not downloaded.
- No user testing. Recommendations come from the audit plus these patterns.
