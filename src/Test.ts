import { addMissingPunctuationWordsToWordSequence, SegmentationOptions, SegmentationResult, segmentText, segmentWordSequence, splitToWords, WordSequence } from "./TextSegmentation.js"
import { Timer } from "./utilities/Timer.js"

const log = console.log

async function test1() {
	{
		//const text = 'Hello! 1. Say who? 2. How are you? This is v2.0 that good. I have 2 344 234ms C# is good games'
		const text = 'The time is 06:12'
		//const text = 'Hello world! 23rd? 123% 3/4/7  Привет мир! 你好世界！'

		const options: SegmentationOptions = {
			language: 'en'
		}

		const wordSequence = await splitToWords(text, options)

		console.log(JSON.stringify(wordSequence.wordArray))

		const segmentedText = await segmentWordSequence(wordSequence)

		const x = 0
	}

	const { readFileSync, writeFileSync } = await import('fs')
	const text = readFileSync('test-data/Test.txt', 'utf-8')

	const timer = new Timer()

	let result: SegmentationResult

	for (let i = 0; i < 5; i++) {
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

			segmentedText += phrase.words.wordArray.join(' | ')

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
