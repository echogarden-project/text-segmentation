import { anyOf, buildRegExp, codepointRange } from 'regexp-composer'

export const chineseCharacterRanges = anyOf(
	codepointRange('4E00', '9FFF'), // Main
	codepointRange('3400', '4DBF'), // CJK Unified Ideographs Extension A
	codepointRange('20000', '2A6DF') // CJK Unified Ideographs Extension B
)

export const japaneseHiraganaCharacterRanges = anyOf(
	codepointRange('3040', '309F'), // Hiragana
	codepointRange('1AFF0', '1AFFF'), // Kana Extended-B
	codepointRange('1B000', '1B0FF'), // Kana Supplement
	codepointRange('1B100', '1B12F'), // Kana Extended-A
	codepointRange('1B130', '1B16F'), // Small Kana Extension
)

export const japaneseKatakanaCharacterRanges = anyOf(
	codepointRange('30A0', '30FF'), // Katakana
	codepointRange('31F0', '31FF'), // Katakana Phonetic Extensions
	codepointRange('3200', '32FF'), // Enclosed CJK Letters and Months
	codepointRange('FF00', 'FFEF'), // Halfwidth and Fullwidth Forms
	codepointRange('1AFF0', '1AFFF'), // Kana Extended-B
	codepointRange('1B000', '1B0FF'), // Kana Supplement
	codepointRange('1B100', '1B12F'), // Kana Extended-A
	codepointRange('1B130', '1B16F'), // Small Kana Extension
)

export const thaiLetterRanges = anyOf(
	codepointRange('0E00', '0E7F')
)

export const khmerLetterRanges = anyOf(
	codepointRange('1780', '17FF'), // Letters
	codepointRange('19E0', '19FF'), // Symbols
)

export const eastAsianCharRanges = anyOf(
	chineseCharacterRanges,
	japaneseHiraganaCharacterRanges,
	japaneseKatakanaCharacterRanges,
	thaiLetterRanges,
	khmerLetterRanges,
)

export const eastAsianCharRangesRegExp = buildRegExp(eastAsianCharRanges)
