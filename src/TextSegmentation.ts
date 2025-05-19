import { buildWordOrNumberPattern as buildWordSplitterPattern, phraseSeparatorRegExp, sentenceSeparatorTrailingPunctuationCharacterRegExp, sentenceSeparatorCharacterRegExp, whitespacePatternRegExp, letterPatternGlobalRegExp, startsWithWhitespacePattern, endsWithWhitespacePattern } from './Patterns.js'
import { cldrSuppressions, additionalSuppressions, leadingApostropheContractionSuppressions, nounSuppressions, tldSuppressions } from './Suppressions.js'
import { eastAsianCharRangesRegExp } from './EastAsianCharacterPatterns.js'
import { WordSequence } from './WordSequence.js'
import { getShortLanguageCode } from './utilities/Utilities.js'
export { WordSequence, type WordEntry } from './WordSequence.js'

import { buildRegExp } from 'regexp-composer'

////////////////////////////////////////////////////////////////////////////////////////////////
// Exported methods
////////////////////////////////////////////////////////////////////////////////////////////////
export async function segmentText(text: string, options?: SegmentationOptions) {
	const wordSequence = await splitToWords(text, options)

	return segmentWordSequence(wordSequence)
}

export async function segmentWordSequence(wordSequence: WordSequence) {
	const sentenceWordRanges: Range[] = []

	const minimumSentenceLetterCount = 2

	let sentenceStartWordOffset = 0
	let currentSentenceLetterCount = 0

	for (let wordIndex = 0; wordIndex < wordSequence.length; wordIndex++) {
		const word = wordSequence.getWordAt(wordIndex)

		if (currentSentenceLetterCount < minimumSentenceLetterCount) {
			const matches = word.matchAll(letterPatternGlobalRegExp)

			for (const _ of matches) {
				currentSentenceLetterCount += 1

				if (currentSentenceLetterCount >= minimumSentenceLetterCount) {
					break
				}
			}
		}

		if (currentSentenceLetterCount >= minimumSentenceLetterCount && sentenceSeparatorCharacterRegExp.test(word)) {
			let trailingSequenceEndIndex = wordIndex
			let trailingSequenceContainedWhitespace = false

			while (trailingSequenceEndIndex < wordSequence.length) {
				const trailingWord = wordSequence.getWordAt(trailingSequenceEndIndex)

				if (sentenceSeparatorTrailingPunctuationCharacterRegExp.test(trailingWord)) {
					if (!trailingSequenceContainedWhitespace && whitespacePatternRegExp.test(trailingWord)) {
						trailingSequenceContainedWhitespace = true
					}

					trailingSequenceEndIndex++
				} else {
					break
				}
			}

			if (trailingSequenceEndIndex === wordSequence.length ||
				trailingSequenceContainedWhitespace ||
				['。', '？', '！'].includes(word)) {

				sentenceWordRanges.push({
					start: sentenceStartWordOffset,
					end: trailingSequenceEndIndex
				})

				sentenceStartWordOffset = trailingSequenceEndIndex
				currentSentenceLetterCount = 0

				wordIndex = trailingSequenceEndIndex - 1
			}
		}
	}

	if (sentenceStartWordOffset < wordSequence.length) {
		sentenceWordRanges.push({ start: sentenceStartWordOffset, end: wordSequence.length })
	}

	const sentences: Sentence[] = []

	for (const wordRange of sentenceWordRanges) {
		const sentenceWordSequence = wordSequence.slice(wordRange.start, wordRange.end)

		sentences.push(new Sentence(wordRange, sentenceWordSequence))
	}

	for (const sentence of sentences) {
		const phraseWordRanges: Range[] = []

		let sentenceEndWordOffset = sentence.wordRange.end
		let phraseStartWordOffset = sentence.wordRange.start

		for (let wordIndex = phraseStartWordOffset; wordIndex < sentenceEndWordOffset; wordIndex++) {
			const currentWord = wordSequence.getWordAt(wordIndex)

			if (phraseSeparatorRegExp.test(currentWord)) {
				let whitespaceSeenOnce = false

				while (wordIndex < sentenceEndWordOffset - 1) {
					const nextWord = wordSequence.getWordAt(wordIndex + 1)

					if (!sentenceSeparatorTrailingPunctuationCharacterRegExp.test(nextWord)) {
						break
					}

					if (whitespacePatternRegExp.test(nextWord)) {
						whitespaceSeenOnce = true
					}

					if (nextWord === '"' && whitespaceSeenOnce) {
						break
					}

					wordIndex += 1
				}

				phraseWordRanges.push({
					start: phraseStartWordOffset,
					end: wordIndex + 1
				})

				phraseStartWordOffset = wordIndex + 1
			}
		}

		if (phraseStartWordOffset < sentenceEndWordOffset) {
			phraseWordRanges.push({ start: phraseStartWordOffset, end: sentenceEndWordOffset })
		}

		for (const wordRange of phraseWordRanges) {
			const phraseWordSequence = wordSequence.slice(wordRange.start, wordRange.end)

			sentence.phrases.push(new Phrase(wordRange, phraseWordSequence))
		}
	}

	const result: SegmentationResult = {
		words: wordSequence,
		sentences,
	}

	return result
}

const cachedWordSplitterRegExps = new Map<string, RegExp>()

export async function splitToWords(text: string, options?: SegmentationOptions) {
	if (!options) {
		options = {}
	}

	options = { ...defaultSegmentationOptions, ...options }

	if (options.language) {
		options.language = getShortLanguageCode(options.language)
	}

	const optionsAsJson = JSON.stringify(options)

	let wordSplitterRegExp = cachedWordSplitterRegExps.get(optionsAsJson)

	if (!wordSplitterRegExp) {
		wordSplitterRegExp = buildWordSplitterRegExpForOptions(options)

		cachedWordSplitterRegExps.set(optionsAsJson, wordSplitterRegExp)
	}

	let wordSequence = new WordSequence()

	function addPunctuationWordsBetween(startOffset: number, endOffset: number) {
		const punctuationWordSubstring = text.substring(startOffset, endOffset)

		let charOffset = startOffset
		let punctuationWordStartOffset = startOffset

		function addPunctuationWordIfNeeded() {
			if (charOffset > punctuationWordStartOffset) {
				const wordText = text.substring(punctuationWordStartOffset, charOffset)
				wordSequence.addWord(wordText, punctuationWordStartOffset, true)

				punctuationWordStartOffset = charOffset
			}
		}

		for (const char of punctuationWordSubstring) {
			if (char === ' ') {
				charOffset += 1

				continue
			}

			addPunctuationWordIfNeeded()

			charOffset += char.length

			addPunctuationWordIfNeeded()
		}

		addPunctuationWordIfNeeded()
	}

	const wordMatches = text.matchAll(wordSplitterRegExp)

	let lastMatchEndOffset = 0

	if (wordMatches) {
		for (const match of wordMatches) {
			const offsets = match.indices![0]
			const matchStartOffset = offsets[0]
			const matchEndOffset = offsets[1]

			if (matchStartOffset > lastMatchEndOffset) {
				addPunctuationWordsBetween(lastMatchEndOffset, matchStartOffset)
			}

			const wordText = text.substring(matchStartOffset, matchEndOffset)
			wordSequence.addWord(wordText, matchStartOffset, false)

			lastMatchEndOffset = matchEndOffset
		}

		addPunctuationWordsBetween(lastMatchEndOffset, text.length)
	}

	if (options.enableEastAsianPostprocessing) {
		wordSequence = await postprocessEastAsianWords(text, wordSequence)
	}

	return wordSequence
}

async function postprocessEastAsianWords(containingText: string, wordSequence: WordSequence) {
	const icuSegmentation = await getIcuSegmentation()

	if (icuSegmentation === undefined) {
		return wordSequence
	}

	let icuInitialized = false

	const newWordSequence = new WordSequence()

	for (let wordIndex = 0; wordIndex < wordSequence.length; wordIndex++) {
		const wordEntry = wordSequence.entries[wordIndex]
		const wordStartOffset = wordEntry.startOffset

		const word = wordSequence.getWordAt(wordIndex)

		if (eastAsianCharRangesRegExp.test(word)) {
			if (!icuInitialized) {
				await icuSegmentation.initialize()

				icuInitialized = true
			}

			const wordBreaks = [...icuSegmentation.createWordBreakIterator(word)]

			for (let i = 0; i < wordBreaks.length - 1; i++) {
				const subwordStartOffset = wordStartOffset + wordBreaks[i]
				const subwordEndOffset = wordStartOffset + wordBreaks[i + 1]

				const subwordText = containingText.substring(subwordStartOffset, subwordEndOffset)

				newWordSequence.addWord(
					subwordText,
					subwordStartOffset,
					false,
				)
			}
		} else {
			const wordText = containingText.substring(wordEntry.startOffset, wordEntry.endOffset)

			newWordSequence.addWord(wordText, wordEntry.startOffset, wordEntry.isPunctuation)
		}
	}

	return newWordSequence
}

// Add any missing punctuation words to a word sequence
export function addMissingPunctuationWordsToWordSequence(wordSequence: WordSequence, sourceText: string) {
	const originalWordsReverseMapping = new Map<number, number>()

	const wordSequenceWithPunctuation = new WordSequence()

	function addWordEntriesForTextSlice(textSlice: string, initialCharOffset: number) {
		let charOffset = initialCharOffset

		// Add entry for every codepoint (this will correctly treat characters beyond BMP)
		for (const char of textSlice) {
			const charEndOffset = charOffset + char.length

			const lastEntry = wordSequenceWithPunctuation.lastEntry

			if (char === ' ' && lastEntry && lastEntry.isPunctuation && lastEntry.text[0] === ' ') {
				wordSequenceWithPunctuation.lastEntry.text += ' '
				wordSequenceWithPunctuation.lastEntry.endOffset = charEndOffset
			} else {
				const wordText = sourceText.substring(charOffset, charEndOffset)

				wordSequenceWithPunctuation.addWord(wordText, charOffset, true)
			}

			charOffset = charEndOffset
		}
	}

	for (let wordIndex = 0; wordIndex < wordSequence.length; wordIndex++) {
		const wordEntry = wordSequence.getEntryAt(wordIndex)
		const wordStartOffset = wordEntry.startOffset

		const previousWordEndOffset = wordIndex > 0 ? wordSequence.entries[wordIndex - 1].endOffset : 0

		// Add entries for any punctuation characters between the current and previous word (or start)
		if (previousWordEndOffset !== wordStartOffset) {
			const textSlice = sourceText.substring(previousWordEndOffset, wordStartOffset)

			addWordEntriesForTextSlice(textSlice, previousWordEndOffset)
		}

		wordSequenceWithPunctuation.entries.push(wordEntry)
		originalWordsReverseMapping.set(wordSequenceWithPunctuation.length - 1, wordIndex)

		// If last word, add entries for any trailing punctuation characters
		if (wordIndex === wordSequence.length - 1) {
			if (sourceText.length !== wordEntry.endOffset) {
				const textSlice = sourceText.substring(wordEntry.endOffset, sourceText.length)

				addWordEntriesForTextSlice(textSlice, wordEntry.endOffset)
			}
		}
	}

	return { wordSequenceWithPunctuation, originalWordsReverseMapping }
}

function getPunctuationRanges(wordSequence: WordSequence, text: string) {
	const punctuationRanges: Range[] = []
	const wordEntries = wordSequence.entries

	if (wordEntries[0].startOffset > 0) {
		punctuationRanges.push({ start: 0, end: wordEntries[0].startOffset })
	}

	for (let i = 0; i < wordEntries.length; i++) {
		const entry = wordEntries[i]

		const previousEndOffset = wordEntries[i - 1]?.endOffset ?? 0

		if (entry.startOffset > previousEndOffset) {
			punctuationRanges.push({ start: previousEndOffset, end: entry.startOffset })
		}

		if (entry.isPunctuation) {
			punctuationRanges.push({ start: entry.startOffset, end: entry.endOffset })
		}
	}

	{
		const lastEndOffset = wordEntries[wordEntries.length - 1]?.endOffset

		if (lastEndOffset && lastEndOffset < text.length) {
			punctuationRanges.push({ start: lastEndOffset, end: text.length })
		}
	}

	return punctuationRanges
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Helper methods
////////////////////////////////////////////////////////////////////////////////////////////////
function buildWordSplitterRegExpForOptions(options: SegmentationOptions) {
	const cldrSuppressionsForLang = cldrSuppressions[options.language ?? ''] ?? []
	const extendedSuppressionsForLang = additionalSuppressions[options.language ?? ''] ?? []
	const contractionSuppressionsForLang = leadingApostropheContractionSuppressions[options.language ?? ''] ?? []
	const contractionSuppressionsForLangWithSingleQuote = contractionSuppressionsForLang.map(str => str.replaceAll(`'`, `’`))
	const customSuppressions = options.customSuppressions ?? []

	let suppressions = [
		...customSuppressions,
		...cldrSuppressionsForLang,
		...extendedSuppressionsForLang,
		...contractionSuppressionsForLang,
		...contractionSuppressionsForLangWithSingleQuote,
		...nounSuppressions,
		...tldSuppressions,
	]

	const wordPattern = buildWordSplitterPattern([
		...suppressions,
		...suppressions.map(word => word.toLocaleLowerCase()),
		...suppressions.map(word => word.toLocaleUpperCase()),
	])

	const wordSplitterRegExp = buildRegExp(wordPattern, { global: true })

	return wordSplitterRegExp
}

async function getIcuSegmentation() {
	try {
		const icuSegmentation = await import('@echogarden/icu-segmentation-wasm')

		return icuSegmentation
	} catch {
		return undefined
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////////////////////
export interface SegmentationResult {
	words: WordSequence
	sentences: Sentence[]
}

export class TextFragment {
	wordRange: Range
	words: WordSequence

	constructor(wordRange: Range, words: WordSequence) {
		this.wordRange = wordRange
		this.words = words
	}

	get text() {
		return this.words.text
	}

	get charRange(): Range {
		return {
			start: this.words.firstEntry.startOffset,
			end: this.words.lastEntry.endOffset
		}
	}
}

export class Sentence extends TextFragment {
	phrases: Phrase[] = []
}

export class Phrase extends TextFragment {
}

export interface Range {
	start: number
	end: number
}

export interface SegmentationOptions {
	language?: string
	customSuppressions?: string[]
	enableEastAsianPostprocessing?: boolean
}

export const defaultSegmentationOptions: SegmentationOptions = {
	language: '',
	customSuppressions: [],
	enableEastAsianPostprocessing: true,
}
