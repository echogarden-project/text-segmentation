import { buildRegExp } from 'regexp-composer'
import { buildWordOrNumberPattern as buildWordSplitterPattern, phraseSeparatorRegExp, sentenceSeparatorTrailingPunctuationRegExp, sentenceSeparatorRegExp, whitespacePatternRegExp } from './Patterns.js'
import { cldrSuppressions, leadingApostropheContractionSuppressions, nounSuppressions, tldSuppressions } from './Suppressions.js'
import { eastAsianCharRangesRegExp } from './EastAsianCharacterPatterns.js'
import { WordSequence } from './WordSequence.js'

export { cldrSuppressions } from './Suppressions.js'

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

export async function splitToWords(text: string, options?: SegmentationOptions) {
	options = { ...defaultSegmentationOptions, ...(options ?? {}) }

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

	//console.log(`Encoded pattern: ${wordSplitterRegExp.source}\n`)

	let wordSequence = new WordSequence()

	function addNonWordsBetween(startOffset: number, endOffset: number) {
		const nonWordSubstring = text.substring(startOffset, endOffset)

		let charOffset = startOffset
		let nonwordStartOffset = startOffset

		function addNonWordIfNeeded() {
			if (charOffset > nonwordStartOffset) {
				wordSequence.addWordEntry(text, nonwordStartOffset, charOffset, true)
				nonwordStartOffset = charOffset
			}
		}

		for (const char of nonWordSubstring) {
			if (char === ' ') {
				charOffset += 1

				continue
			}

			addNonWordIfNeeded()

			charOffset += char.length

			addNonWordIfNeeded()
		}

		addNonWordIfNeeded()
	}

	const wordMatches = text.matchAll(wordSplitterRegExp)

	let lastMatchEndOffset = 0

	if (wordMatches) {
		for (const match of wordMatches) {
			const offsets = match.indices![0]
			const matchStartOffset = offsets[0]
			const matchEndOffset = offsets[1]

			if (matchStartOffset > lastMatchEndOffset) {
				addNonWordsBetween(lastMatchEndOffset, matchStartOffset)
			}

			wordSequence.addWordEntry(text, matchStartOffset, matchEndOffset, false)

			lastMatchEndOffset = matchEndOffset
		}

		addNonWordsBetween(lastMatchEndOffset, text.length)
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
