import { segmentText, splitToWords } from "./TextSegmentation.js"
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

	const result = await segmentText(text, {
		language: 'en',
		customSuppressions: [],
		enableEastAsianPostprocessing: true
	})

	//const json = JSON.stringify(result.sentences)

	timer.logAndRestart(`Total execution time`)

	log('')

	//

	let segmentedText = ''

	for (let sentenceIndex = 0; sentenceIndex < result.sentences.length; sentenceIndex++) {
		const sentence = result.sentences[sentenceIndex]
		const phrases = sentence.phrases

		for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
			const phrase = phrases[phraseIndex]

			segmentedText += phrase.wordSequence.words.join(' | ')

			if (phraseIndex < phrases.length - 1) {
				segmentedText += `\n${'-'.repeat(100)}\n`
			}
		}

		if (sentenceIndex < result.sentences.length - 1) {
			segmentedText += `\n${ '='.repeat(100) } \n`
		}
	}

	writeFileSync('out/segmented.txt', segmentedText)
}

test1()
