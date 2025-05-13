export class WordSequence {
	entries: WordEntry[] = []

	addWord(text: string, textStartOffset: number, isPunctuation: boolean) {
		const startOffset = textStartOffset
		const endOffset = startOffset + text.length

		this.entries.push({
			text,
			startOffset,
			endOffset,
			isPunctuation
		})
	}

	getWordRange(startIndex: number, endIndex: number) {
		return this.getEntryRange(startIndex, endIndex).map(entry => entry.text)
	}

	*iterateWordRange(startIndex: number, endIndex: number) {
		for (let i = startIndex; i < endIndex; i++) {
			yield this.getWordAt(i)
		}
	}

	getWordAt(index: number) {
		return this.entries[index].text
	}

	getEntryRange(startIndex: number, endIndex: number) {
		return this.entries.slice(startIndex, endIndex)
	}

	*iterateEntryRange(startIndex: number, endIndex: number) {
		for (let i = startIndex; i < endIndex; i++) {
			yield this.getEntryAt(i)
		}
	}

	getEntryAt(index: number): WordEntry {
		return this.entries[index]
	}

	clone() {
		return this.slice(0, this.length)
	}

	slice(startIndex: number, endIndex: number) {
		const slicedSequence = new WordSequence()

		slicedSequence.entries = this.entries.slice(startIndex, endIndex)

		return slicedSequence
	}

	get wordArray() {
		return this.entries.map(entry => entry.text)
	}

	get firstWord() {
		return this.firstEntry?.text
	}

	get lastWord() {
		return this.lastEntry?.text
	}

	get firstEntry() {
		return this.entries[0]
	}

	get lastEntry() {
		return this.entries[this.length - 1]
	}

	get punctuationEntries() {
		return this.entries.filter(entry => entry.isPunctuation === true)
	}

	get punctuationWords() {
		return this.entries.filter(entry => entry.isPunctuation === true).map(entry => entry.text)
	}

	get nonPunctuationEntries() {
		return this.entries.filter(entry => entry.isPunctuation === false)
	}

	get nonPunctuationWords() {
		return this.entries.filter(entry => entry.isPunctuation === false).map(entry => entry.text)
	}

	get text() {
		return this.wordArray.join('')
	}

	get length() {
		return this.entries.length
	}
}

export interface WordEntry {
	text: string

	startOffset: number
	endOffset: number

	isPunctuation: boolean
}
