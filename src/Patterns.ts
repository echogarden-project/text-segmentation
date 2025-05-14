import { anyOf, buildRegExp, charRange, inputEnd, inputStart, matches, oneOrMore, possibly, repeated, tab, unicodeProperty, whitespace, zeroOrMore } from 'regexp-composer'

////////////////////////////////////////////////////////////////////////////////////////////////
// Pattern builder methods
////////////////////////////////////////////////////////////////////////////////////////////////
export function buildWordOrNumberPattern(suppressions: string[]) {
	return anyOf(
		buildSuppressionPattern(suppressions),
		wordSegmentPattern
	)
}

export function buildSuppressionPattern(suppressions: string[]) {
	const suppressionsPattern =
		matches(
			anyOf(...suppressions),
			{ ifNotFollowedBy: wordCharacterPattern }
		)

	return suppressionsPattern
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Single character patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const letterPattern = unicodeProperty('Letter')
const markPattern = unicodeProperty('Mark')

const letterOrMarkPattern = anyOf(
	letterPattern,
	markPattern,
)

const apostrophPattern = anyOf(`'`, `’`, `‘`)

const punctuationPattern = unicodeProperty('Punctuation')
const digitPattern = unicodeProperty('Decimal_Number')
const arabicNumeralPattern = charRange('0', '9')

const emojiPattern = unicodeProperty('Emoji')

const percentageCharacters = ['%']
const currencyCharacters = ['$', '¥', '€', '£', '₩', '₭', '₽', '₫', '฿', '¢', '₮', '؋', '₦', '₱', '₴', '₪']

const percentageOrCurrencyCharacterPattern = anyOf(...percentageCharacters, ...currencyCharacters)

////////////////////////////////////////////////////////////////////////////////////////////////
// Numeric patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const numericSeparatorPattern =
	matches(
		anyOf('.', ',', '٬', '_'), {
		ifPrecededBy: arabicNumeralPattern,
		ifFollowedBy: arabicNumeralPattern
	})

const dimensionsPattern = matches([
	oneOrMore(arabicNumeralPattern),

	oneOrMore([
		'x',
		oneOrMore(arabicNumeralPattern),
	]),
], {
	ifPrecededBy: anyOf(whitespace, punctuationPattern, inputStart),
	ifFollowedBy: anyOf(whitespace, punctuationPattern, inputEnd)
})

const spacedThousandsSeparatorPattern =
	matches(
		' ', {
		ifPrecededBy: arabicNumeralPattern,
		ifFollowedBy: [
			repeated(3, arabicNumeralPattern),
			anyOf(whitespace, punctuationPattern, inputEnd)
		]
	})

const numericSignPattern =
	matches(
		anyOf('-', '+'), {
		ifPrecededBy: anyOf(whitespace, punctuationPattern, inputStart),
		ifFollowedBy: arabicNumeralPattern,
	})

const numberPattern = [
	possibly(numericSignPattern),
	digitPattern,

	zeroOrMore(anyOf(
		digitPattern,
		numericSeparatorPattern,
		spacedThousandsSeparatorPattern,
	))
]

const exponentPattern = [
	anyOf('e', 'E'),
	possibly(anyOf('+', '-')),
	oneOrMore(arabicNumeralPattern),
]

const numberPossiblyFollowedByExponentOrLettersPattern = [
	numberPattern,

	possibly(anyOf(
		exponentPattern,

		matches(
			zeroOrMore(unicodeProperty('Letter')), {
			ifNotFollowedBy: digitPattern,
		}),
	))
]

const precedingPercentageOrCurrencyPattern =
	matches([
		percentageOrCurrencyCharacterPattern,
		numberPattern,
	], {
		ifNotPrecededBy: digitPattern,
		ifFollowedBy: anyOf(whitespace, punctuationPattern, inputEnd),
	})

const followingPercentageOrCurrencyPattern =
	matches([
		numberPattern,
		percentageOrCurrencyCharacterPattern,
	], {
		ifPrecededBy: anyOf(whitespace, punctuationPattern, inputStart),
		ifNotFollowedBy: anyOf(digitPattern),
	})

const percentageOrCurrencyPattern = anyOf(
	precedingPercentageOrCurrencyPattern,
	followingPercentageOrCurrencyPattern
)

////////////////////////////////////////////////////////////////////////////////////////////////
// Time patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const timePattern = matches([
	anyOf(arabicNumeralPattern, [charRange('0', '1'), arabicNumeralPattern], ['2', charRange('0', '3')]),

	repeated([1, 2], [
		':',
		anyOf(arabicNumeralPattern, [charRange('0', '5'), arabicNumeralPattern]),
	])
], {
	ifPrecededBy: anyOf(whitespace, punctuationPattern, inputStart),
	ifNotPrecededBy: ':',
	ifFollowedBy: anyOf(whitespace, punctuationPattern, inputEnd),
	ifNotFollowedBy: ':',
})

////////////////////////////////////////////////////////////////////////////////////////////////
// Letter patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const dottedAbbreviationSequencePattern =
	matches(
		anyOf(
			[
				letterPattern,

				oneOrMore([
					'. ',
					letterPattern,
				]),

				possibly('.'),
			],
			[
				letterPattern,

				oneOrMore([
					'.',
					possibly(' '),
					letterPattern,
				]),

				possibly('.'),
			]
		), {
		ifNotPrecededBy: anyOf(letterOrMarkPattern, digitPattern),
		ifNotFollowedBy: anyOf(letterOrMarkPattern, digitPattern)
	})

const wordCharacterPattern =
	anyOf(
		letterPattern,
		markPattern,
		digitPattern,
	)

const wordInnerApostrophPattern =
	matches(
		apostrophPattern, {

		ifPrecededBy: letterOrMarkPattern,
		ifFollowedBy: letterOrMarkPattern,
	})

const wordStartApostrophPattern =
	matches(
		apostrophPattern, {

		ifPrecededBy: whitespace,
		ifFollowedBy: [letterOrMarkPattern, letterOrMarkPattern, anyOf(whitespace, inputEnd)]
	})

const basicWordPattern =
	oneOrMore(
		anyOf(
			wordCharacterPattern,
			wordInnerApostrophPattern,
		),
	)

const hyphenatedWordPattern = [
	basicWordPattern,

	oneOrMore([
		'-',
		basicWordPattern,
	]),
]

const dotSeparatedWordPattern = matches([
	basicWordPattern,

	oneOrMore([
		'.',
		basicWordPattern,
	]),
], {
	//ifPrecededBy: anyOf(whitespace, inputStart),
	//ifFollowedBy: anyOf(whitespace, inputEnd)
})

const interpunctSeparatedWordPattern = [
	basicWordPattern,

	oneOrMore([
		anyOf('·', '‧'),
		basicWordPattern,
	]),
]

const underscoreSeparatedWordPattern = [
	basicWordPattern,

	oneOrMore([
		'_',
		basicWordPattern,
	]),
]

const wordSegmentPattern = anyOf(
	timePattern,
	dimensionsPattern,
	percentageOrCurrencyPattern,
	numberPossiblyFollowedByExponentOrLettersPattern,

	interpunctSeparatedWordPattern,
	dotSeparatedWordPattern,
	dottedAbbreviationSequencePattern,
	underscoreSeparatedWordPattern,
	basicWordPattern,
	emojiPattern,
)

////////////////////////////////////////////////////////////////////////////////////////////////
// Phrase separation patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const phraseSeparatorCharacters = [',', '、', '，', '،', ';', '；', ':', '：', '—']

const phraseSeparatorPattern = [
	inputStart,
	anyOf(...phraseSeparatorCharacters),
	inputEnd
]

const phraseSeparatorTrailingPunctuationPattern = [
	inputStart,
	anyOf(...phraseSeparatorCharacters, ' ', tab),
	inputEnd
]

////////////////////////////////////////////////////////////////////////////////////////////////
// Sentence separation patterns
////////////////////////////////////////////////////////////////////////////////////////////////
const sentenceSeparatorCharacters = ['.', '。', '?', '？', '!', '！', '\n']

const sentenceSeparatorPattern = [
	inputStart,
	anyOf(...sentenceSeparatorCharacters),
	inputEnd
]

const sentenceSeparatorTrailingPunctuationPattern = [
	inputStart,
	anyOf('"', '”', '’', ')', ']', '}', '»', ...sentenceSeparatorCharacters, ...phraseSeparatorCharacters, oneOrMore(whitespace)),
	inputEnd
]

////////////////////////////////////////////////////////////////////////////////////////////////
// Prebuilt regular expressions
////////////////////////////////////////////////////////////////////////////////////////////////
export const wordCharacterRegExp = buildRegExp(wordCharacterPattern)
export const whitespacePatternRegExp = buildRegExp(whitespace)

export const letterPatternGlobalRegExp = buildRegExp(letterPattern, { global: true })

export const phraseSeparatorRegExp = buildRegExp(phraseSeparatorPattern)
export const phraseSeparatorTrailingPunctuationRegExp = buildRegExp(phraseSeparatorTrailingPunctuationPattern)

export const sentenceSeparatorRegExp = buildRegExp(sentenceSeparatorPattern)
export const sentenceSeparatorTrailingPunctuationRegExp = buildRegExp(sentenceSeparatorTrailingPunctuationPattern)
