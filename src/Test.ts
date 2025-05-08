import { addMissingPunctuationWordsToWordSequence, SegmentationResult, segmentText, splitToWords, WordSequence } from "./TextSegmentation.js"
import { Timer } from "./utilities/Timer.js"

const log = console.log

async function test1() {
	{
		const wordSequence = await splitToWords('Hello world! Привет мир! 你好世界！')
		console.log(JSON.stringify(wordSequence.words))
	}

	const { readFileSync, writeFileSync } = await import('fs')
	const text = readFileSync('test-data/Test.txt', 'utf-8')

	const timer = new Timer()

	let result: SegmentationResult

	for (let i = 0; i < 3; i++) {
		result = await segmentText(text, {
			language: 'en',
			customSuppressions: [],
			enableEastAsianPostprocessing: true
		})

		timer.logAndRestart(`Total execution time`)
	}

	log('')

	//

	let segmentedText = ''

	for (let sentenceIndex = 0; sentenceIndex < result!.sentences.length; sentenceIndex++) {
		const sentence = result!.sentences[sentenceIndex]
		const phrases = sentence.phrases

		for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
			const phrase = phrases[phraseIndex]

			segmentedText += phrase.wordSequence.words.join(' | ')

			if (phraseIndex < phrases.length - 1) {
				segmentedText += `\n${'-'.repeat(100)}\n`
			}
		}

		if (sentenceIndex < result!.sentences.length - 1) {
			segmentedText += `\n${ '='.repeat(100) } \n`
		}
	}

	writeFileSync('out/segmented.txt', segmentedText)
}

async function test2() {
	const text = `  Hello,  how are you today                ??    `

	const words = await splitToWords(text)

	const nonPunctuationWordEntries = words.nonPunctuationEntries
	const nonPunctuationWordSequence = new WordSequence()
	nonPunctuationWordSequence.entries = nonPunctuationWordEntries

	const extendedWords = addMissingPunctuationWordsToWordSequence(nonPunctuationWordSequence, text)

	const x = 0
}

test1()
//test2()
