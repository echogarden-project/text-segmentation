import { buildRegExp } from 'regexp-composer'
import { buildWordOrNumberPattern as buildWordSplitterPattern, phraseSeparatorRegExp, sentenceSeparatorTrailingPunctuationRegExp, sentenceSeparatorRegExp, whitespacePatternRegExp } from './Patterns.js'
import { cldrSuppressions, leadingApostropheContractionSuppressions, nounSuppressions, tldSuppressions } from './Suppressions.js'
import { eastAsianCharRangesRegExp } from './EastAsianCharacterPatterns.js'
import { WordSequence } from './WordSequence.js'

export { cldrSuppressions } from './Suppressions.js'
export { WordSequence, type WordEntry } from './WordSequence.js'

export async function segmentText(text: string, options?: SegmentationOptions) {
	options = { ...defaultSegmentationOptions, ...(options ?? {}) }

	const wordSequence = await splitToWords(text, options)

	return segmentWordSequence(wordSequence)
}

export async function segmentWordSequence(wordSequence: WordSequence) {
	const sentenceWordRanges: Range[] = []

	let sentenceStartWordOffset = 0

	for (let wordIndex = 0; wordIndex < wordSequence.length; wordIndex++) {
		const word = wordSequence.getWordAt(wordIndex)

		if (sentenceSeparatorRegExp.test(word)) {
			while (wordIndex < wordSequence.length - 1) {
				const nextWord = wordSequence.getWordAt(wordIndex + 1)

				if (!sentenceSeparatorTrailingPunctuationRegExp.test(nextWord)) {
					break
				}

				wordIndex += 1
			}

			sentenceWordRanges.push({
				start: sentenceStartWordOffset,
				end: wordIndex + 1
			})

			sentenceStartWordOffset = wordIndex + 1
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

					if (!sentenceSeparatorTrailingPunctuationRegExp.test(nextWord)) {
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
		wordSequence,
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
				wordSequence.addWordEntry(text, punctuationWordStartOffset, charOffset, true)
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

			wordSequence.addWordEntry(text, matchStartOffset, matchEndOffset, false)

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
				newWordSequence.addWordEntry(
					containingText,
					wordStartOffset + wordBreaks[i],
					wordStartOffset + wordBreaks[i + 1],
					false
				)
			}
		} else {
			newWordSequence.addWordEntry(containingText, wordEntry.startOffset, wordEntry.endOffset, wordEntry.isPunctuation)
		}
	}

	return newWordSequence
}

function buildWordSplitterRegExpForOptions(options: SegmentationOptions) {
	const cldrSuppressionsForLang = cldrSuppressions[options.language ?? ''] ?? []
	const contractionSuppressionsForLang = leadingApostropheContractionSuppressions[options.language ?? ''] ?? []
	const contractionSuppressionsForLangWithSingleQuote = contractionSuppressionsForLang.map(str => str.replaceAll(`'`, `’`))
	const customSuppressions = options.customSuppressions ?? []

	let suppressions = [
		...customSuppressions,
		...cldrSuppressionsForLang,
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
				wordSequenceWithPunctuation.addWordEntry(sourceText, charOffset, charEndOffset, true)
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

async function getIcuSegmentation() {
	try {
		const icuSegmentation = await import('@echogarden/icu-segmentation-wasm')

		return icuSegmentation
	} catch {
		return undefined
	}
}

export interface SegmentationResult {
	wordSequence: WordSequence
	sentences: Sentence[]
}

export class TextFragment {
	wordRange: Range
	wordSequence: WordSequence

	constructor(wordRange: Range, wordSequence: WordSequence) {
		this.wordRange = wordRange
		this.wordSequence = wordSequence
	}

	get text() {
		return this.wordSequence.text
	}

	get charRange(): Range {
		return {
			start: this.wordSequence.firstEntry.startOffset,
			end: this.wordSequence.lastEntry.endOffset
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
