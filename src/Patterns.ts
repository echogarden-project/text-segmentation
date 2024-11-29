import { anyOf, buildRegExp, charRange, inputEnd, inputStart, matches, oneOrMore, possibly, repeated, tab, unicodeProperty, whitespace } from 'regexp-composer'

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
// Numeric patterns
////////////////////////////////////////////////////////////////////////////////////////////////
export const punctuationPattern = unicodeProperty('Punctuation')
export const digitPattern = unicodeProperty('Decimal_Number')
export const arabicNumeralPattern = charRange('0', '9')

export const numericSeparatorPattern =
	matches(
		anyOf('.', ',', '٬', '_'), {
		ifPrecededBy: arabicNumeralPattern,
		ifFollowedBy: arabicNumeralPattern
	})

export const dateTimeSeparatorPattern = matches(
	anyOf('/', '-', ':'), {
	ifPrecededBy: arabicNumeralPattern,
	ifFollowedBy: arabicNumeralPattern
})

export const dateTimePattern =
	oneOrMore(anyOf(
		arabicNumeralPattern,
		dateTimeSeparatorPattern,
	))

export const spacedThousandsSeparatorPattern =
	matches(
		' ', {
		ifPrecededBy: arabicNumeralPattern,
		ifFollowedBy: repeated(2, arabicNumeralPattern)
	})

export const numericSignPattern =
	matches(
		anyOf('-', '+'), {
		ifPrecededBy: anyOf(whitespace, punctuationPattern),
		ifFollowedBy: arabicNumeralPattern,
	})

export const numberPattern = [
	oneOrMore(anyOf(
		digitPattern,
		numericSeparatorPattern,
		spacedThousandsSeparatorPattern,
		numericSignPattern,
	)),
]

const percentageChars = ['%']
const currencySpecialChars = ['$', '¥', '€', '£', '¥', '₩', '₭', '₽', '₫', '฿', '¢', '₮', '؋', '₦', '₱', '₴', '₪']

const percentageOrCurrencyPattern = anyOf(...percentageChars, ...currencySpecialChars)

export const prefixPercentageOrCurrencyPattern =
	matches([
		percentageOrCurrencyPattern,
		numberPattern,
	], {
		ifNotPrecededBy: digitPattern,
		ifFollowedBy: anyOf(whitespace, punctuationPattern),
	})

export const suffixPercentagePattern =
	matches([
		numberPattern,
		percentageOrCurrencyPattern,
	], {
		ifPrecededBy: anyOf(whitespace, punctuationPattern),
		ifNotFollowedBy: digitPattern,
	})

export const percentagePattern = anyOf(
	prefixPercentageOrCurrencyPattern,
	suffixPercentagePattern
)

////////////////////////////////////////////////////////////////////////////////////////////////
// Letter patterns
////////////////////////////////////////////////////////////////////////////////////////////////
export const letterPattern = unicodeProperty('Letter')
export const markPattern = unicodeProperty('Mark')
export const apostrophPattern = anyOf(`'`, `’`, `‘`)

export const letterOrMarkPattern = anyOf(
	letterPattern,
	markPattern,
)

export const dottedAbbreviationSequencePattern =
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


export const wordCharacterPattern =
	anyOf(
		letterPattern,
		markPattern,
		digitPattern,
	)

export const wordSeparatorPattern =
	matches(
		anyOf('-', '_', '·', '‧', '&'), {

		ifPrecededBy: letterOrMarkPattern,
		ifFollowedBy: letterOrMarkPattern
	})

export const wordInnerApostrophPattern =
	matches(
		apostrophPattern, {

		ifPrecededBy: letterOrMarkPattern,
		ifFollowedBy: letterOrMarkPattern,
	})

export const wordStartApostrophPattern =
	matches(
		apostrophPattern, {

		ifPrecededBy: whitespace,
		ifFollowedBy: [letterOrMarkPattern, letterOrMarkPattern, whitespace]
	})

export const basicWordPattern =
	oneOrMore(
		anyOf(
			wordCharacterPattern,
			wordSeparatorPattern,
			wordInnerApostrophPattern,
		),
	)

export const wordSegmentPattern = anyOf(
	dottedAbbreviationSequencePattern,
	dateTimeSeparatorPattern,
	percentagePattern,
	numberPattern,
	basicWordPattern,
)

////////////////////////////////////////////////////////////////////////////////////////////////
// Prebuilt regular expressions
////////////////////////////////////////////////////////////////////////////////////////////////
export const phraseSeparators = [',', '、', '，', '،', ';', '；', ':', '：', '—']

export const phraseSeparatorRegExp = buildRegExp([
	inputStart,
	anyOf(...phraseSeparators),
	inputEnd
])

export const sentenceSeparators = ['.', '。', '?', '？', '!', '！', '\n']

export const sentenceSeparatorRegExp = buildRegExp([
	inputStart,
	anyOf(...sentenceSeparators),
	inputEnd
])

export const sentenceSeparatorTrailingPunctuationRegExp = buildRegExp([
	inputStart,
	anyOf('"', '”', '’', ')', ']', '}', '»', ...sentenceSeparators, ...phraseSeparators, oneOrMore(whitespace)),
	inputEnd
])

export const phraseSeparatorTrailingPunctuationRegExp = buildRegExp([
	inputStart,
	anyOf(...phraseSeparators, ' ', tab),
	inputEnd
])

export const oneOrMoreSpacesRegExp = buildRegExp([
	inputStart,
	oneOrMore(' '),
	inputEnd
])

export const wordCharacterRegExp = buildRegExp(wordCharacterPattern)
export const whitespacePatternRegExp = buildRegExp(whitespace)
